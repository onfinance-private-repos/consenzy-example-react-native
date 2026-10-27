/* Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0 */
import type { ErrorDetail, ValidationErrorItem } from "./types";

/** Base class for every error thrown by the SDK. */
export class ConsentError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "ConsentError";
    if (options && "cause" in options) (this as { cause?: unknown }).cause = options.cause;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** The API answered with a non-2xx status. */
export class ConsentApiError extends ConsentError {
  readonly status: number;
  /** The `detail` field of the error body (string, object or FastAPI validation list). */
  readonly detail: ErrorDetail;
  readonly method: string;
  readonly path: string;

  constructor(init: { status: number; detail: ErrorDetail; method: string; path: string }) {
    super(`${init.method} ${init.path} failed with ${init.status}: ${describeDetail(init.detail, init.status)}`);
    this.name = "ConsentApiError";
    this.status = init.status;
    this.detail = init.detail;
    this.method = init.method;
    this.path = init.path;
  }

  /** FastAPI validation errors (422), if the detail is that shape. */
  get validationErrors(): ValidationErrorItem[] {
    return Array.isArray(this.detail) ? this.detail : [];
  }

  /** Human-readable form of `detail`, suitable for showing to an operator. */
  get detailMessage(): string {
    return describeDetail(this.detail, this.status);
  }
}

/** The request never produced an HTTP response (DNS, connection reset, CORS, offline…). */
export class ConsentNetworkError extends ConsentError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ConsentNetworkError";
  }
}

/** The request exceeded its timeout. */
export class ConsentTimeoutError extends ConsentNetworkError {
  readonly timeoutMs: number;
  constructor(timeoutMs: number, options?: { cause?: unknown }) {
    super(`request timed out after ${timeoutMs} ms`, options);
    this.name = "ConsentTimeoutError";
    this.timeoutMs = timeoutMs;
  }
}

/** The SDK was used in a way that would leak a credential (e.g. an org key in a browser). */
export class ConsentSecurityError extends ConsentError {
  constructor(message: string) {
    super(message);
    this.name = "ConsentSecurityError";
  }
}

export function describeDetail(detail: ErrorDetail, status: number): string {
  if (detail == null || detail === "") return `HTTP ${status}`;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((e) => {
        const loc = Array.isArray(e?.loc) ? e.loc.filter((p) => p !== "body").join(".") : "";
        return loc ? `${loc}: ${e?.msg ?? "invalid"}` : String(e?.msg ?? "invalid");
      })
      .join("; ");
  }
  try {
    return JSON.stringify(detail);
  } catch {
    return `HTTP ${status}`;
  }
}
