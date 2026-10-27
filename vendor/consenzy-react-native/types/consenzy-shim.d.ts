// Minimal declaration of the @onfinance/consenzy surface this package uses. Only for
// `npm run typecheck:standalone`, i.e. type-checking before sdks/js has been built.
// The real typecheck (`npm run typecheck`) resolves the built package instead.
export declare class ConsentSession {
  constructor(options: { baseUrl: string; sessionProvider: () => Promise<string> });
  me(): Promise<unknown>;
  currentNotice(language?: string): Promise<unknown>;
  listConsents(options?: { activeOnly?: boolean }): Promise<unknown[]>;
  giveConsent(input: { noticeId: string; purposeIds: string[]; channel: 'web' | 'mobile_app' }): Promise<unknown[]>;
  withdrawConsent(consentId: string, reason?: string): Promise<unknown>;
  listDataRequests(): Promise<unknown[]>;
  fileDataRequest(type: string, details: Record<string, unknown>): Promise<unknown>;
  listBreachNotices(params?: { limit?: number; offset?: number }): Promise<unknown[]>;
  acknowledgeBreachNotice(breachId: string): Promise<unknown>;
  logout(): Promise<void>;
}

export declare class ConsentApiError extends Error {
  readonly status: number;
  readonly detail: unknown;
}
