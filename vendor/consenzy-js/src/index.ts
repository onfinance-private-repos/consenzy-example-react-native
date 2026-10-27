/*
 * @onfinance/consenzy: browser / mobile-safe entry point for Consenzy (Consent Data Master).
 *
 * This entry never handles organisation API keys. For the server-side org-key client import
 * "@onfinance/consenzy/server"; for the drop-in Web Components import
 * "@onfinance/consenzy/widget".
 *
 * Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0
 */
export { ConsentSession, assertSessionToken } from "./session";
export type {
  ConsentSessionOptions,
  FileDataRequestOptions,
  GiveConsentInput,
  ListConsentsOptions,
  SessionProvider,
  SessionToken,
} from "./session";
export {
  ConsentApiError,
  ConsentError,
  ConsentNetworkError,
  ConsentSecurityError,
  ConsentTimeoutError,
  describeDetail,
} from "./errors";
export { HttpClient, uuidv4 } from "./http";
export type { BinaryBody, FetchLike, HttpClientOptions, RequestOptions, ResponseLike, RetryOptions } from "./http";
export { LANGUAGES } from "./types";
export type * from "./types";
