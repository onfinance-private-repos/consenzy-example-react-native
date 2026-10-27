/*
 * Isomorphic HTTP layer: global fetch, per-attempt timeouts, typed errors, and retries with
 * jittered exponential backoff for requests that are safe to repeat.
 *
 * Deliberately typed against a minimal fetch shape (no DOM lib) so it compiles for Node,
 * React Native and workers alike.
 *
 * Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0
 */
import { ConsentApiError, ConsentError, ConsentNetworkError, ConsentTimeoutError } from "./errors";
import type { ErrorDetail } from "./types";

export interface ResponseLike {
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  text(): Promise<string>;
  /** Used for binary responses (logos) when present. */
  arrayBuffer?(): Promise<ArrayBuffer>;
}

export interface RequestInitLike {
  method?: string;
  headers?: Record<string, string>;
  body?: string | Uint8Array;
  signal?: AbortSignalLike;
}

export type FetchLike = (url: string, init?: RequestInitLike) => Promise<ResponseLike>;

export interface AbortSignalLike {
  readonly aborted: boolean;
  readonly reason?: unknown;
  addEventListener(type: "abort", listener: () => void, options?: { once?: boolean }): void;
  removeEventListener(type: "abort", listener: () => void): void;
}

interface AbortControllerLike {
  readonly signal: AbortSignalLike;
  abort(reason?: unknown): void;
}

declare const AbortController: { new (): AbortControllerLike } | undefined;
declare function setTimeout(cb: () => void, ms: number): unknown;
declare function clearTimeout(handle: unknown): void;
declare const TextEncoder: { new (): { encode(input: string): Uint8Array } };

export interface RetryOptions {
  /** Retries after the first attempt. Default 3, capped at 3. */
  maxRetries?: number;
  /** First backoff ceiling in ms (full jitter, doubled per attempt). Default 250. */
  baseDelayMs?: number;
  /** Upper bound for any single backoff in ms. Default 4000. */
  maxDelayMs?: number;
}

export interface HttpClientOptions {
  /** e.g. https://consent.bank.internal. A trailing slash is ignored. */
  baseUrl: string;
  /** Custom fetch (defaults to the global one). */
  fetch?: FetchLike;
  /** Per-attempt timeout. Default 15000 ms. */
  timeoutMs?: number;
  retry?: RetryOptions;
  /** Extra headers sent on every request (e.g. a tracing header). */
  headers?: Record<string, string>;
}

/** Per-call options accepted by every SDK method. */
export interface RequestOptions {
  /**
   * Idempotency-Key for writes that support it. If omitted the SDK generates a UUID per
   * logical call and reuses it across retries. Pass your own to dedupe across page reloads.
   */
  idempotencyKey?: string;
  signal?: AbortSignalLike;
  timeoutMs?: number;
}

export interface HttpRequest {
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  path: string;
  /** An array value repeats the parameter (`?status=a&status=b`). */
  query?: Record<string, QueryValue | readonly QueryValue[] | null | undefined>;
  body?: unknown;
  /** A raw (non-JSON) body sent as is with its own Content-Type, e.g. a logo image. */
  rawBody?: { data: Uint8Array; contentType: string };
  /** Read the response as bytes: `data` is then a {@link BinaryBody}. */
  binary?: boolean;
  token: string;
  /** Set for endpoints that accept Idempotency-Key; makes the POST retryable. */
  idempotencyKey?: string;
  signal?: AbortSignalLike;
  timeoutMs?: number;
}

/** A binary response body (`binary: true`). */
export interface BinaryBody {
  bytes: Uint8Array;
  contentType: string | null;
  etag: string | null;
}

export interface HttpResponse<T> {
  status: number;
  data: T;
  /** True when the server replayed a stored response for this Idempotency-Key. */
  idempotentReplay: boolean;
}

const RETRYABLE_STATUS = (s: number) => s === 429 || s >= 500;
const MAX_RETRIES = 3;

export class HttpClient {
  readonly baseUrl: string;
  private readonly fetchImpl?: FetchLike;
  private readonly timeoutMs: number;
  private readonly retry: Required<RetryOptions>;
  private readonly headers: Record<string, string>;
  /** Overridable for tests. */
  sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  constructor(options: HttpClientOptions) {
    if (!options || typeof options.baseUrl !== "string" || !/^https?:\/\//i.test(options.baseUrl)) {
      throw new ConsentError("baseUrl must be an absolute http(s) URL");
    }
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.fetchImpl = options.fetch;
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.retry = {
      maxRetries: Math.max(0, Math.min(MAX_RETRIES, options.retry?.maxRetries ?? MAX_RETRIES)),
      baseDelayMs: options.retry?.baseDelayMs ?? 250,
      maxDelayMs: options.retry?.maxDelayMs ?? 4_000,
    };
    this.headers = { ...(options.headers ?? {}) };
  }

  async request<T>(req: HttpRequest): Promise<HttpResponse<T>> {
    const retryable = req.method === "GET" || req.idempotencyKey !== undefined;
    const maxAttempts = retryable ? this.retry.maxRetries + 1 : 1;
    const url = this.baseUrl + req.path + buildQuery(req.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      ...this.headers,
      Authorization: `Bearer ${req.token}`,
    };
    if (req.binary) headers.Accept = "*/*";
    if (req.rawBody !== undefined) headers["Content-Type"] = req.rawBody.contentType;
    else if (req.body !== undefined) headers["Content-Type"] = "application/json";
    if (req.idempotencyKey !== undefined) headers["Idempotency-Key"] = req.idempotencyKey;
    const body = req.rawBody !== undefined ? req.rawBody.data : req.body === undefined ? undefined : JSON.stringify(req.body);

    for (let attempt = 1; ; attempt++) {
      let response: ResponseLike;
      try {
        response = await this.attempt(url, { method: req.method, headers, body }, req);
      } catch (err) {
        if (isUserAbort(req.signal) || !(err instanceof ConsentNetworkError) || attempt >= maxAttempts) throw err;
        await this.sleep(this.backoff(attempt));
        continue;
      }
      if (response.ok && req.binary) {
        const bytes = response.arrayBuffer
          ? new Uint8Array(await response.arrayBuffer())
          : new TextEncoder().encode(await response.text());
        const data: BinaryBody = {
          bytes,
          contentType: response.headers.get("Content-Type"),
          etag: response.headers.get("ETag"),
        };
        return { status: response.status, data: data as T, idempotentReplay: false };
      }
      if (response.ok) {
        const text = await response.text();
        return {
          status: response.status,
          data: (text ? safeJson(text) : undefined) as T,
          idempotentReplay: (response.headers.get("Idempotent-Replay") ?? "").toLowerCase() === "true",
        };
      }
      // 409 on a keyed write means "same Idempotency-Key still in flight / not yet committed":
      // waiting and retrying yields the stored (replayed) response.
      const inFlight = response.status === 409 && req.idempotencyKey !== undefined;
      if ((RETRYABLE_STATUS(response.status) || inFlight) && attempt < maxAttempts && !isUserAbort(req.signal)) {
        await this.sleep(this.backoff(attempt, response.headers.get("Retry-After")));
        continue;
      }
      throw new ConsentApiError({
        status: response.status,
        detail: await readDetail(response),
        method: req.method,
        path: req.path,
      });
    }
  }

  private async attempt(url: string, init: RequestInitLike, req: HttpRequest): Promise<ResponseLike> {
    const fetchImpl = this.fetchImpl ?? (globalThis as { fetch?: FetchLike }).fetch;
    if (typeof fetchImpl !== "function") {
      throw new ConsentError("global fetch is not available; pass `fetch` in the client options (Node >= 18 has it built in)");
    }
    if (req.signal?.aborted) throw new ConsentError("request aborted", { cause: req.signal.reason });

    const timeoutMs = req.timeoutMs ?? this.timeoutMs;
    const controller = typeof AbortController === "function" ? new AbortController() : undefined;
    let timedOut = false;
    const timer = controller
      ? setTimeout(() => {
          timedOut = true;
          controller.abort();
        }, timeoutMs)
      : undefined;
    const onAbort = () => controller?.abort(req.signal?.reason);
    req.signal?.addEventListener("abort", onAbort, { once: true });
    try {
      const response = await fetchImpl(url, { ...init, signal: controller?.signal ?? req.signal });
      return response;
    } catch (err) {
      if (timedOut) throw new ConsentTimeoutError(timeoutMs, { cause: err });
      if (req.signal?.aborted) throw new ConsentError("request aborted", { cause: err });
      throw new ConsentNetworkError(`network error calling ${init.method} ${url}: ${errorMessage(err)}`, { cause: err });
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      req.signal?.removeEventListener("abort", onAbort);
    }
  }

  /** Full-jitter exponential backoff; honours Retry-After (seconds) up to maxDelayMs. */
  private backoff(attempt: number, retryAfter?: string | null): number {
    const ceiling = Math.min(this.retry.maxDelayMs, this.retry.baseDelayMs * 2 ** (attempt - 1));
    const jittered = Math.random() * ceiling;
    const hinted = retryAfter && /^\d+$/.test(retryAfter.trim()) ? Number(retryAfter) * 1000 : 0;
    return Math.min(this.retry.maxDelayMs, Math.max(jittered, hinted));
  }
}

function isUserAbort(signal?: AbortSignalLike): boolean {
  return !!signal?.aborted;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function readDetail(response: ResponseLike): Promise<ErrorDetail> {
  let text = "";
  try {
    text = await response.text();
  } catch {
    return null;
  }
  if (!text) return null;
  const parsed = safeJson(text);
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "detail" in parsed) {
    return (parsed as { detail: ErrorDetail }).detail;
  }
  return typeof parsed === "string" ? parsed.slice(0, 1000) : (parsed as ErrorDetail);
}

export type QueryValue = string | number | boolean;

export function buildQuery(query?: HttpRequest["query"]): string {
  if (!query) return "";
  const parts: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    for (const v of Array.isArray(value) ? value : [value]) {
      if (v === undefined || v === null) continue;
      parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.length ? `?${parts.join("&")}` : "";
}

/**
 * Percent-encode one path segment. `.` and `..` are refused outright: encodeURIComponent leaves them
 * unchanged and URL normalisation (fetch, proxies) would then resolve `/v1/principals/../consents` to a
 * different endpoint. Prefer {@link uuidSegment} / {@link ledgerHashSegment} for typed ids.
 */
export function encodePath(segment: string, what = "id"): string {
  if (typeof segment !== "string" || segment === "") throw new ConsentError(`${what} must be a non-empty string`);
  // Also catch percent-encoded dots that some servers decode before normalising.
  const decodedDots = segment.replace(/%2e/gi, ".");
  if (decodedDots === "." || decodedDots === "..") throw new ConsentError(`${what} must not be "." or ".."`);
  return encodeURIComponent(segment);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEDGER_HASH_RE = /^[0-9a-f]{64}$/i;

/** Validate a UUID id before it is placed in a URL path; throws ConsentError otherwise. */
export function uuidSegment(id: string, what = "id"): string {
  if (typeof id !== "string" || !UUID_RE.test(id)) throw new ConsentError(`${what} must be a UUID`);
  return id.toLowerCase();
}

/** Validate a ledger hash (64 hex chars, SHA-256) before it is placed in a URL path. */
export function ledgerHashSegment(hash: string): string {
  if (typeof hash !== "string" || !LEDGER_HASH_RE.test(hash)) {
    throw new ConsentError("ledgerHash must be 64 hexadecimal characters");
  }
  return hash.toLowerCase();
}

declare const crypto: { randomUUID?: () => string; getRandomValues?: (a: Uint8Array) => Uint8Array } | undefined;

/** RFC 4122 v4 UUID. Uses crypto.randomUUID / getRandomValues where available (React Native may lack both). */
export function uuidv4(): string {
  const c = typeof crypto !== "undefined" ? crypto : undefined;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** True in a browser-like page context (window + document). False in Node, workers and React Native. */
export function isBrowser(): boolean {
  const g = globalThis as { window?: unknown; document?: unknown };
  return typeof g.window !== "undefined" && typeof g.document !== "undefined";
}
