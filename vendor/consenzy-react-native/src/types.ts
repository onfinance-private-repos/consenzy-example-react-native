// Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0
//
// Shapes of the principal (/v1/me) API as the components consume them. They mirror
// app/schemas.py (MeOut, MeNoticeOut, MeConsentOut, DataRequestOut) and are declared
// structurally, so they stay compatible with the @onfinance/consenzy types.

/** English plus the 22 languages of the Eighth Schedule (DPDP s.5(3)). */
export type Language =
  | 'en' | 'as' | 'bn' | 'brx' | 'doi' | 'gu' | 'hi' | 'kn' | 'ks' | 'kok' | 'mai' | 'ml'
  | 'mni' | 'mr' | 'ne' | 'or' | 'pa' | 'sa' | 'sat' | 'sd' | 'ta' | 'te' | 'ur';

export type RequestType =
  | 'access' | 'correction' | 'completion' | 'updating' | 'erasure' | 'grievance' | 'nomination';

/** Who the bank's backend authenticated when it minted the session. */
export type SessionActingAs = 'data_principal' | 'guardian';

/**
 * What a session may do beyond reading the profile, notice and own consents. A session
 * holds a capability only if the minting key had the matching scope and the bank did not
 * narrow it away when minting.
 */
export type SessionCapability = 'consents:write' | 'requests:write' | 'requests:read';

export interface Me {
  principal_id: string;
  external_ref: string;
  preferred_language: string;
  acts_through_guardian: boolean;
  guardian_verified: boolean;
  /**
   * `data_principal` or `guardian`. Typed open-ended so a future value does not break
   * anything. Absent only on servers that predate capability-scoped sessions.
   */
  acting_as?: SessionActingAs | (string & {});
  /**
   * Capabilities this session holds; unknown future values are kept and ignored. Absent only
   * on older servers, in which case every action is offered and the server decides.
   */
  capabilities?: (SessionCapability | (string & {}))[];
}

export interface NoticePurpose {
  id: string;
  code: string;
  name: string;
  description: string;
  data_categories: string[];
  retention_days: number | null;
}

export interface Notice {
  id: string;
  version: number;
  language: string;
  title: string;
  body: string;
  purposes: NoticePurpose[];
}

export interface Consent {
  id: string;
  principal_id: string;
  purpose_id: string;
  purpose_code: string;
  notice_id: string;
  status: string;
  channel: string;
  consent_manager_ref: string | null;
  given_at: string;
  expires_at: string | null;
  withdrawn_at: string | null;
  withdrawal_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface DataRequest {
  id: string;
  principal_id: string;
  request_type: string;
  status: string;
  /**
   * Where the request arrived: "app" or "web" when filed in-app through a principal session, or
   * "email", "whatsapp", "sms", "phone", "branch" or "other" when your backend filed it with an org
   * key. Optional: older servers do not send it.
   */
  channel?: string;
  /** Your opaque reference for that channel (e.g. a ticket or message id), if the backend set one. */
  channel_reference?: string | null;
  details: Record<string, unknown>;
  response: Record<string, unknown> | null;
  assigned_to: string | null;
  due_at: string;
  received_at: string;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * A personal data breach intimation as the principal sees it (GET /v1/me/breach-notices,
 * DPDP Rules r.7(1)). `subject` and `body` are plain text: render them as text, never as HTML.
 */
export interface BreachNotice {
  notice_id: string;
  breach_id: string;
  language: string;
  subject: string;
  body: string;
  data_categories: string[];
  generated_at: string;
  acknowledged_at: string | null;
}

/**
 * The subset of `ConsentSession` from `@onfinance/consenzy` that this package uses.
 * Pass your own implementation to `<ConsentProvider session={...}>` if you need to
 * (for example in Storybook or tests).
 */
export interface ConsentSessionLike {
  me(): Promise<Me>;
  currentNotice(language?: string): Promise<Notice>;
  listConsents(options?: { activeOnly?: boolean }): Promise<Consent[]>;
  giveConsent(input: { noticeId: string; purposeIds: string[]; channel: 'web' | 'mobile_app' }): Promise<Consent[]>;
  withdrawConsent(consentId: string, reason?: string): Promise<Consent>;
  listDataRequests(): Promise<DataRequest[]>;
  fileDataRequest(type: RequestType, details: Record<string, unknown>): Promise<DataRequest>;
  listBreachNotices(params?: { limit?: number; offset?: number }): Promise<BreachNotice[]>;
  /** Idempotent server-side: the first acknowledgement time is kept. */
  acknowledgeBreachNotice(breachId: string): Promise<BreachNotice>;
  logout(): Promise<void>;
}
