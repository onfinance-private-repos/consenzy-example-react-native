/*
 * ConsentSession: the browser / mobile-safe client for /v1/me.
 *
 * It never sees an organisation API key. It asks the bank's own backend for a short-lived
 * `cps_…` principal session token (sessionProvider), caches it, refreshes it once on 401,
 * and otherwise fails.
 *
 * Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0
 */
import { ConsentApiError, ConsentError, ConsentSecurityError } from "./errors";
import { HttpClient, uuidSegment, uuidv4 } from "./http";
import type { HttpClientOptions, HttpRequest, RequestOptions } from "./http";
import type {
  DataRequestDetailsByType,
  DataRequestOut,
  IsoDateTime,
  Language,
  MeBreachNoticeOut,
  MeConsentOut,
  MeNoticeOut,
  MeOut,
  MeRequestChannel,
  PrincipalChannel,
  RequestType,
  Uuid,
} from "./types";

/**
 * What the bank's backend returns. Either the bare `cps_…` token, or the full
 * PrincipalSessionOut (`{ token, expires_at }`) so the SDK can refresh shortly before expiry.
 */
export type SessionToken = string | { token: string; expires_at?: IsoDateTime | null };
export type SessionProvider = () => Promise<SessionToken>;

export interface ConsentSessionOptions extends Omit<HttpClientOptions, "baseUrl"> {
  /** Base URL of the Consent Data Master API reachable from this device. */
  baseUrl: string;
  /** Calls YOUR backend, which authenticates the customer and mints a principal session. */
  sessionProvider: SessionProvider;
  /** Refresh this many seconds before a known expires_at. Default 30. */
  refreshSkewSeconds?: number;
}

export interface GiveConsentInput {
  noticeId: Uuid;
  /** Only the purposes the person affirmatively selected. */
  purposeIds: Uuid[];
  channel: PrincipalChannel;
  expiresAt?: IsoDateTime;
}

/** Per-call options of `fileDataRequest`. */
export interface FileDataRequestOptions extends RequestOptions {
  /** Where the person filed it: "web" or "app". Omitted, the server records "app". */
  channel?: MeRequestChannel;
}

export interface ListConsentsOptions {
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}

const SESSION_PREFIX = "cps_";
const ORG_KEY_PREFIX = "cdm_";

/** Throws unless the value is a principal session token. Never echoes the token. */
export function assertSessionToken(token: unknown): asserts token is string {
  if (typeof token !== "string" || token.length === 0) {
    throw new ConsentSecurityError("sessionProvider must resolve to a principal session token (cps_…)");
  }
  if (token.startsWith(ORG_KEY_PREFIX)) {
    throw new ConsentSecurityError(
      "sessionProvider returned an organisation API key (cdm_…). Org keys are secret and must never reach a " +
        "browser or mobile app. Mint a principal session on your backend with POST /v1/principal-sessions and " +
        "return its `token` (cps_…) instead. Rotate the exposed key now.",
    );
  }
  if (!token.startsWith(SESSION_PREFIX)) {
    throw new ConsentSecurityError("sessionProvider must resolve to a principal session token starting with cps_");
  }
}

export class ConsentSession {
  private readonly http: HttpClient;
  private readonly sessionProvider: SessionProvider;
  private readonly refreshSkewMs: number;
  private token: string | null = null;
  private tokenExpiresAt = Number.POSITIVE_INFINITY;
  private pending: Promise<string> | null = null;
  private generation = 0;

  constructor(options: ConsentSessionOptions) {
    if (!options || typeof options.sessionProvider !== "function") {
      throw new ConsentError("ConsentSession requires a sessionProvider function");
    }
    if ((options as { apiKey?: unknown }).apiKey !== undefined) {
      throw new ConsentSecurityError(
        "ConsentSession does not accept an apiKey. Use ConsentServerClient on your server and pass a sessionProvider here.",
      );
    }
    this.http = new HttpClient(options);
    this.sessionProvider = options.sessionProvider;
    this.refreshSkewMs = (options.refreshSkewSeconds ?? 30) * 1000;
  }

  get baseUrl(): string {
    return this.http.baseUrl;
  }

  /** The signed-in Data Principal. */
  me(options?: RequestOptions): Promise<MeOut> {
    return this.call<MeOut>({ method: "GET", path: "/v1/me" }, options);
  }

  /** Latest notice in `language` (or the principal's preferred language), falling back to English. */
  currentNotice(language?: Language, options?: RequestOptions): Promise<MeNoticeOut> {
    return this.call<MeNoticeOut>({ method: "GET", path: "/v1/me/notice", query: { language } }, options);
  }

  listConsents(params: ListConsentsOptions = {}, options?: RequestOptions): Promise<MeConsentOut[]> {
    return this.call<MeConsentOut[]>(
      {
        method: "GET",
        path: "/v1/me/consents",
        query: { active_only: params.activeOnly, limit: params.limit, offset: params.offset },
      },
      options,
    );
  }

  /** Record consent for exactly the purposes the person selected. Idempotent across retries. */
  giveConsent(input: GiveConsentInput, options?: RequestOptions): Promise<MeConsentOut[]> {
    if (!input || !Array.isArray(input.purposeIds) || input.purposeIds.length === 0) {
      return Promise.reject(new ConsentError("giveConsent requires at least one purpose id"));
    }
    const body: Record<string, unknown> = {
      notice_id: input.noticeId,
      purpose_ids: [...input.purposeIds],
      channel: input.channel,
    };
    if (input.expiresAt) body.expires_at = input.expiresAt;
    return this.call<MeConsentOut[]>(
      { method: "POST", path: "/v1/me/consents", body, idempotencyKey: options?.idempotencyKey ?? uuidv4() },
      options,
    );
  }

  /** Withdraw one consent. As easy as giving it (s.6(4)). */
  async withdrawConsent(consentId: Uuid, reason?: string, options?: RequestOptions): Promise<MeConsentOut> {
    const body = reason ? { reason } : {};
    return this.call<MeConsentOut>(
      { method: "POST", path: `/v1/me/consents/${uuidSegment(consentId, "consentId")}/withdraw`, body },
      options,
    );
  }

  listDataRequests(params: { limit?: number; offset?: number } = {}, options?: RequestOptions): Promise<DataRequestOut[]> {
    return this.call<DataRequestOut[]>(
      { method: "GET", path: "/v1/me/data-requests", query: { limit: params.limit, offset: params.offset } },
      options,
    );
  }

  /**
   * File a rights request (ss.11–14). `details` is typed per request type. Idempotent across retries.
   * Pass `{ channel: "web" }` from a website (the server records "app" when it is omitted).
   */
  fileDataRequest<T extends RequestType>(
    type: T,
    details: DataRequestDetailsByType[T],
    options?: FileDataRequestOptions,
  ): Promise<DataRequestOut> {
    const body: Record<string, unknown> = { request_type: type, details: details ?? {} };
    if (options?.channel) body.channel = options.channel;
    return this.call<DataRequestOut>(
      {
        method: "POST",
        path: "/v1/me/data-requests",
        body,
        idempotencyKey: options?.idempotencyKey ?? uuidv4(),
      },
      options,
    );
  }

  /** Personal data breach intimations sent to this principal (DPDP Rules r.7(1)). Always readable. */
  listBreachNotices(params: { limit?: number; offset?: number } = {}, options?: RequestOptions): Promise<MeBreachNoticeOut[]> {
    return this.call<MeBreachNoticeOut[]>(
      { method: "GET", path: "/v1/me/breach-notices", query: { limit: params.limit, offset: params.offset } },
      options,
    );
  }

  /** Record that the principal has read a breach notice. Idempotent: the first acknowledgement is kept. */
  async acknowledgeBreachNotice(breachId: Uuid, options?: RequestOptions): Promise<MeBreachNoticeOut> {
    return this.call<MeBreachNoticeOut>(
      { method: "POST", path: `/v1/me/breach-notices/${uuidSegment(breachId, "breachId")}/acknowledge` },
      options,
    );
  }

  /** Revoke the current session token server-side and forget it. */
  async logout(options?: RequestOptions): Promise<void> {
    const token = this.token;
    this.clearToken();
    if (!token) return;
    try {
      await this.http.request<void>({ method: "POST", path: "/v1/me/logout", token, ...pick(options) });
    } catch (err) {
      // An already-expired or revoked session is logged out by definition.
      if (!(err instanceof ConsentApiError && err.status === 401)) throw err;
    }
  }

  /** Drop the cached token; the next call asks sessionProvider again. */
  clearToken(): void {
    this.token = null;
    this.tokenExpiresAt = Number.POSITIVE_INFINITY;
    this.pending = null;
    this.generation++;
  }

  // ---------------------------------------------------------------- internals

  private async call<T>(req: Omit<HttpRequest, "token">, options?: RequestOptions): Promise<T> {
    const full = { ...req, ...pick(options) };
    const first = await this.getToken();
    try {
      return (await this.http.request<T>({ ...full, token: first })).data;
    } catch (err) {
      if (!(err instanceof ConsentApiError && err.status === 401)) throw err;
      // Expired or revoked: refresh once (same Idempotency-Key), then give up.
      if (this.token === first) this.clearToken();
      const second = await this.getToken();
      return (await this.http.request<T>({ ...full, token: second })).data;
    }
  }

  private getToken(): Promise<string> {
    if (this.token && Date.now() < this.tokenExpiresAt - this.refreshSkewMs) return Promise.resolve(this.token);
    // Concurrent callers share one sessionProvider call.
    if (!this.pending) {
      const generation = ++this.generation;
      const pending = this.fetchToken().then(
        ({ token, expiresAt }) => {
          // Ignore the result if clearToken()/logout() happened while it was in flight.
          if (generation === this.generation) {
            this.token = token;
            this.tokenExpiresAt = expiresAt;
            this.pending = null;
          }
          return token;
        },
        (err: unknown) => {
          if (generation === this.generation) this.pending = null;
          throw err;
        },
      );
      this.pending = pending;
    }
    return this.pending;
  }

  private async fetchToken(): Promise<{ token: string; expiresAt: number }> {
    let result: SessionToken;
    try {
      result = await this.sessionProvider();
    } catch (err) {
      throw new ConsentError(`sessionProvider failed: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
    }
    const token = typeof result === "string" ? result : result?.token;
    assertSessionToken(token);
    const expires = typeof result === "object" && result?.expires_at ? Date.parse(result.expires_at) : NaN;
    return { token, expiresAt: Number.isFinite(expires) ? expires : Number.POSITIVE_INFINITY };
  }
}

function pick(options?: RequestOptions): Pick<HttpRequest, "signal" | "timeoutMs"> {
  const out: Pick<HttpRequest, "signal" | "timeoutMs"> = {};
  if (options?.signal) out.signal = options.signal;
  if (options?.timeoutMs !== undefined) out.timeoutMs = options.timeoutMs;
  return out;
}
