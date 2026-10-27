/*
 * Request and response models for the Consent Data Master API.
 *
 * Hand-written from openapi/openapi.json and app/schemas.py (the server is the source of
 * truth). tests/types-drift.test.ts fails if a schema or property in the spec is missing
 * here, and tests/server.test.ts fails if an org endpoint has no client method. Timestamps are ISO-8601 strings with an offset.
 * UUIDs are strings.
 *
 * Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0
 */

export type Uuid = string;
/** ISO-8601 timestamp, always with a timezone offset (the API rejects naive timestamps). */
export type IsoDateTime = string;

/** English plus the 22 languages of the Eighth Schedule (DPDP s.5(3)). */
export type Language =
  | "en" | "as" | "bn" | "brx" | "doi" | "gu" | "hi" | "kn" | "ks" | "kok" | "mai" | "ml"
  | "mni" | "mr" | "ne" | "or" | "pa" | "sa" | "sat" | "sd" | "ta" | "te" | "ur";

export const LANGUAGES: readonly Language[] = [
  "en", "as", "bn", "brx", "doi", "gu", "hi", "kn", "ks", "kok", "mai", "ml",
  "mni", "mr", "ne", "or", "pa", "sa", "sat", "sd", "ta", "te", "ur",
];

export type Channel = "web" | "mobile_app" | "branch" | "call_centre" | "consent_manager" | "api";
/** Channels a Data Principal can use themselves via /v1/me. */
export type PrincipalChannel = "web" | "mobile_app";
export type LegalBasis = "consent" | "legitimate_use";
export type ConsentStatus = "active" | "withdrawn" | "superseded";
/** List filter: `active` is in force (not past `expires_at`); `expired` is active but past `expires_at`. */
export type ConsentListStatus = ConsentStatus | "expired";
/** One value or several (the parameter is repeated). */
export type OneOrMany<T> = T | readonly T[];

/** Counts for a list's filters: `facets[dimension][value]` with every OTHER filter applied. */
export interface FacetsOut {
  total: number;
  facets: Record<string, Record<string, number>>;
}
/**
 * Where a rights request arrived (POST /v1/data-requests). Server default "other". Recorded once and immutable.
 */
export type RequestChannel = "web" | "app" | "email" | "whatsapp" | "sms" | "phone" | "branch" | "other";
/** Channels a Data Principal can file a rights request on via /v1/me. Server default "app". */
export type MeRequestChannel = "web" | "app";
export type RequestType = "access" | "correction" | "completion" | "updating" | "erasure" | "grievance" | "nomination";
export type RequestStatus = "received" | "in_progress" | "awaiting_principal" | "completed" | "rejected" | "withdrawn";
export type Scope =
  | "org:read" | "org:write" | "config:read" | "config:write" | "consents:read" | "consents:write"
  | "consents:check" | "requests:read" | "requests:write" | "keys:manage"
  | "audit:read" | "vault:write" | "vault:read" | "purposes:legitimate_use" | "sessions:mint"
  | "retention:manage"
  | "breaches:read" | "breaches:write"
  | "actor:assert" | "members:manage"
  | "findings:read" | "findings:manage";
export type GuardianMethod = "existing_verified_adult" | "digilocker_token" | "government_id_token" | "consent_manager";
export type WithdrawalActor = "data_principal" | "guardian" | "consent_manager";
/** Who the bank's backend authenticated when minting a principal session. */
export type SessionActingAs = "data_principal" | "guardian";
/** What a principal session may do; reads of the notice and the principal's own consents are always allowed. */
export type SessionCapability = "consents:write" | "requests:write" | "requests:read";
/** DPDP s.7 legitimate-use clause backing a `legitimate_use` purpose. */
export type LegitimateUseClause =
  | "s7a_voluntary_provision" | "s7b_state_benefit" | "s7c_state_function" | "s7d_legal_obligation_to_state"
  | "s7e_judgment_or_order" | "s7f_medical_emergency" | "s7g_epidemic" | "s7h_disaster_or_public_order"
  | "s7i_employment";

export interface Pagination {
  /** 1–200, default 50. */
  limit?: number;
  /** 0–10000, default 0. */
  offset?: number;
}

// ------------------------------------------------------------------ organisation

export interface OrganizationOut {
  id: Uuid;
  slug: string;
  status: string;
  name: string;
  legal_name: string;
  registration_number: string | null;
  is_significant_data_fiduciary: boolean;
  dpo_name: string | null;
  dpo_email: string | null;
  dpo_phone: string | null;
  grievance_email: string | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  /** Whether a logo is set (`GET /v1/organization/logo`). */
  has_logo: boolean;
  logo_updated_at: IsoDateTime | null;
}

export type LogoContentType = "image/png" | "image/jpeg" | "image/webp";

/** A stored logo's metadata, returned by `PUT /v1/organization/logo`. */
export interface LogoOut {
  content_type: LogoContentType;
  bytes: number;
  /** Hex SHA-256 of the image; also its ETag. */
  sha256: string;
  updated_at: IsoDateTime;
}

export interface OrganizationPatch {
  name?: string | null;
  legal_name?: string | null;
  registration_number?: string | null;
  is_significant_data_fiduciary?: boolean | null;
  dpo_name?: string | null;
  dpo_email?: string | null;
  /** E.164, e.g. +919876543210. */
  dpo_phone?: string | null;
  grievance_email?: string | null;
}

// ------------------------------------------------------------------ organisation overview

/** The eight "get compliant" steps, in order. */
export type OnboardingStepId =
  | "profile" | "purposes" | "notice" | "team" | "api_key" | "consent" | "retention" | "checkpoint";

export interface OnboardingStepOut {
  id: OnboardingStepId;
  label: string;
  done: boolean;
  /** What was found, e.g. "3 active purposes". */
  detail?: string | null;
}

export interface OnboardingOut {
  steps: OnboardingStepOut[];
  done: number;
  total: number;
}

/** Each count is null when the caller lacks its read scope. */
export interface OrgOverviewCounts {
  principals: number | null;
  active_consents: number | null;
  open_requests: number | null;
}

export interface OverviewRequestItem {
  id: Uuid;
  request_type: string;
  status: string;
  due_at: IsoDateTime;
  overdue: boolean;
}

export interface OrgOverviewSla {
  window_days: number;
  closed: number;
  closed_within_sla: number;
  /** null when nothing closed in the window. */
  adherence_percent: number | null;
}

export interface OrgOverviewRequests {
  open: number;
  due_7d: number;
  overdue: number;
  /** Overdue and due within 7 days, earliest first (at most 5). */
  items: OverviewRequestItem[];
  sla: OrgOverviewSla;
  /** Open requests per status. */
  by_status?: Record<string, number>;
  /** Requests closed in the last 30 days. */
  closed_30d?: number;
}

export interface OverviewBreachItem {
  id: Uuid;
  title: string;
  status: string;
  board_due_at: IsoDateTime;
  overdue: boolean;
}

export interface OrgOverviewBreaches {
  open: number;
  board_overdue: number;
  board_due_7d: number;
  items: OverviewBreachItem[];
  /** Open breaches per status. */
  by_status?: Record<string, number>;
  /** Breaches closed in the last 30 days. */
  closed_30d?: number;
  /** Detections raised by the breach detection engine, still open. */
  open_detections?: number;
}

export interface OrgOverviewTeam {
  members: number;
  pending_invitations: number;
  oldest_pending_at: IsoDateTime | null;
}

export interface OverviewKeyItem {
  id: Uuid;
  name: string;
  prefix: string;
  expires_at: IsoDateTime;
}

export interface OrgOverviewApiKeys {
  active: number;
  /** Active keys without actor:assert (not the portal's service key). */
  backend_active: number;
  expiring_30d: number;
  last_used_at: IsoDateTime | null;
  items: OverviewKeyItem[];
}

export interface OrgOverviewCheckpoint {
  count: number;
  latest_at: IsoDateTime | null;
  latest_number: number | null;
  unsealed_events: number;
}

/** Null where the caller lacks the scope (consents:read / requests:read). */
export interface OrgOverviewDay {
  date: string;
  consents_granted: number | null;
  consents_withdrawn: number | null;
  requests_filed: number | null;
  requests_closed: number | null;
  /** Requests closed that day within the SLA; requests:read. */
  requests_closed_within_sla?: number | null;
  /** Breaches open at the end of that day; breaches:read. */
  breaches_open?: number | null;
}

/** The consent lifecycle over the last 30 days; consents:read. */
export interface OrgOverviewConsentLifecycle {
  /** null without config:read. */
  notices_published: number | null;
  granted_30d: number;
  active: number;
  withdrawn_30d: number;
  expired_30d: number;
}

/** Integration progress: principal sessions minted by your backend. */
/** Open drafts in the portal's studio: none is served to Data Principals until published. */
export interface OrgOverviewDrafts {
  purposes: number;
  notices: number;
}

export interface OrgOverviewIntegration {
  sessions_minted_30d: number;
  last_session_at: IsoDateTime | null;
  /** Active registered applications. */
  applications_active?: number;
}

export interface OrgOverviewAuditEvent {
  seq: number;
  occurred_at: IsoDateTime;
  actor: string | null;
  action: string;
}

/** GET /v1/organization/overview: each section is null unless the caller holds its scope. */
export interface OrganizationOverviewOut {
  generated_at: IsoDateTime;
  setup: OnboardingOut;
  counts: OrgOverviewCounts;
  /** requests:read */
  requests: OrgOverviewRequests | null;
  /** breaches:read */
  breaches: OrgOverviewBreaches | null;
  /** members:manage */
  team: OrgOverviewTeam | null;
  /** keys:manage */
  api_keys: OrgOverviewApiKeys | null;
  /** consents:read or audit:read */
  checkpoint: OrgOverviewCheckpoint | null;
  /** The last 30 UTC days, oldest first; consents:read or requests:read. */
  activity: OrgOverviewDay[] | null;
  /** The latest 10 audit events; audit:read. */
  recent_audit: OrgOverviewAuditEvent[] | null;
  /** consents:read */
  consent_lifecycle?: OrgOverviewConsentLifecycle | null;
  integration?: OrgOverviewIntegration | null;
  /** Open studio drafts; needs config:read. */
  drafts?: OrgOverviewDrafts | null;
  /** Open audit findings (test findings excluded); findings:read. */
  findings?: OrgOverviewFindings | null;
}

/** Open audit findings (Ledger › Audit findings), test findings excluded. */
export interface OrgOverviewFindings {
  open: number;
  /** Open and past their due date. */
  overdue: number;
  /** Open findings per severity (critical, high, medium, low, info). */
  by_severity: Partial<Record<FindingSeverity, number>>;
}

// ------------------------------------------------------------------ API keys

export interface ApiKeyCreate {
  name: string;
  scopes: Scope[];
  expires_at?: IsoDateTime | null;
  /** An active registered application this key serves; sessions it mints record it. */
  application_id?: Uuid | null;
}

export interface ApiKeyOut {
  id: Uuid;
  name: string;
  prefix: string;
  scopes: Scope[];
  created_at: IsoDateTime;
  expires_at: IsoDateTime | null;
  revoked_at: IsoDateTime | null;
  last_used_at: IsoDateTime | null;
  /** The registered application this key serves, if any. */
  application_id?: Uuid | null;
}

/**
 * PATCH /v1/api-keys/{id}: the key's complete new scope list. Scopes it does not already hold must be held by the
 * caller; actor:assert is never granted here. Sending the current scopes is a no-op.
 */
export interface ApiKeyScopesPatch {
  scopes: Scope[];
}

export type StatusClass = "1xx" | "2xx" | "3xx" | "4xx" | "5xx";

export interface ApiKeyUsageDay {
  /** UTC day, YYYY-MM-DD. */
  date: string;
  requests: number;
  /** 4xx and 5xx responses. */
  errors: number;
}

export interface ApiKeyUsageRoute {
  method: string;
  /** The route template, e.g. `/v1/consents/{consent_id}` (never a raw path). */
  route: string;
  requests: number;
  errors: number;
  last_seen_at: IsoDateTime;
}

export interface ApiKeyUsageStatus {
  status_class: StatusClass;
  requests: number;
}

/** GET /v1/api-keys/{id}/usage: requests made with the key itself (not portal members or sessions it minted). */
export interface ApiKeyUsageOut {
  key_id: Uuid;
  /** The window in UTC days, ending today (1-90). */
  days: number;
  since: string;
  total_requests: number;
  total_errors: number;
  /** One entry per day of the window, oldest first, zeros included. */
  daily: ApiKeyUsageDay[];
  /** Top routes by requests (at most 20). */
  by_route: ApiKeyUsageRoute[];
  by_status: ApiKeyUsageStatus[];
  last_used_at: IsoDateTime | null;
}

/**
 * GET /v1/api-logs: a request a portal member sent from the API reference's request panel (method, route template,
 * status, duration; never a body, header or query string). Kept 90 days.
 */
export interface ApiRequestLogEntry {
  id: Uuid;
  occurred_at: IsoDateTime;
  source: "try-it";
  /** Who sent it: user:<subject>[;<email>]. */
  actor: string;
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** The route template, e.g. /v1/consents/{consent_id} (never a raw path). */
  route: string;
  status: number;
  duration_ms: number;
  /** Sent by the caller. */
  mine: boolean;
}

// ------------------------------------------------------------------ applications

export type ApplicationKind = "web" | "ios" | "android" | "react_native" | "flutter" | "backend";
export type ApplicationStatus = "active" | "disabled";

/**
 * Register an application. `allowed_origins` (web, react_native): https origins allowed to call /v1/me from a
 * browser, e.g. `https://netbanking.example.in` (exact https origins: no path, no wildcard).
 * `bundle_ids` (ios, react_native, flutter) and `package_names` (android, react_native, flutter).
 */
export interface ApplicationCreate {
  name: string;
  kind: ApplicationKind;
  description?: string | null;
  allowed_origins?: string[];
  bundle_ids?: string[];
  package_names?: string[];
}

/** Any subset; the kind is fixed. A list replaces the stored one. */
export interface ApplicationPatch {
  name?: string | null;
  description?: string | null;
  allowed_origins?: string[] | null;
  bundle_ids?: string[] | null;
  package_names?: string[] | null;
}

export interface ApplicationOut {
  id: Uuid;
  name: string;
  kind: ApplicationKind;
  description: string | null;
  allowed_origins: string[];
  bundle_ids: string[];
  package_names: string[];
  status: ApplicationStatus;
  created_by: string;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ListApplicationsQuery extends Pagination {
  status?: ApplicationStatus;
  kind?: ApplicationKind;
  /** Case-insensitive substring of the name. */
  q?: string;
}

export interface ApiKeyIssued extends ApiKeyOut {
  /** Shown once. Only a SHA-256 hash is stored server-side. */
  key: string;
}

// ------------------------------------------------------------------ data principals

export interface PrincipalIn {
  /** Your customer id (CIF, CRN…). Pattern ^[A-Za-z0-9._:/-]{1,128}$. */
  external_ref: string;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  preferred_language?: Language;
  is_child?: boolean;
  has_disability?: boolean;
  /** Required for a child or a person with disability (s.9, s.2(j)). */
  guardian_name?: string | null;
  guardian_email?: string | null;
}

export interface PrincipalPatch {
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  preferred_language?: Language | null;
  guardian_name?: string | null;
  guardian_email?: string | null;
}

export interface GuardianVerificationIn {
  method: GuardianMethod;
}

export interface PrincipalOut {
  id: Uuid;
  external_ref: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  preferred_language: Language;
  is_child: boolean;
  has_disability: boolean;
  guardian_name: string | null;
  guardian_email: string | null;
  guardian_verified_at: IsoDateTime | null;
  guardian_verification_method: GuardianMethod | null;
  erased_at: IsoDateTime | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ListPrincipalsQuery extends Pagination {
  external_ref?: string;
  erased?: boolean;
  is_child?: boolean;
  has_disability?: boolean;
  /** Principals acting through a guardian whose guardian is verified / not yet verified. */
  guardian?: "verified" | "pending";
  /** Holds an in-force consent (for `purpose_id` when given). */
  has_active_consent?: boolean;
  purpose_id?: Uuid;
  /** Under an active legal hold. */
  on_hold?: boolean;
  /** Has an open rights request. */
  open_request?: boolean;
  preferred_language?: OneOrMany<Language>;
  created_from?: IsoDateTime;
  created_to?: IsoDateTime;
  /** Seen through this application (a principal session its key minted). */
  application_id?: Uuid;
  sort?: "created_at" | "-created_at";
}

// ------------------------------------------------------------------ purposes

export interface PurposeIn {
  /** Pattern ^[a-z0-9][a-z0-9_.-]{1,63}$. */
  code: string;
  name: string;
  description: string;
  data_categories: string[];
  legal_basis?: LegalBasis;
  /** Required when legal_basis is `legitimate_use` (the key then needs scope purposes:legitimate_use). */
  legitimate_use_clause?: LegitimateUseClause | null;
  /** Why the clause applies (1–1000 chars); recorded in the audit trail. Required for legitimate_use. */
  legitimate_use_justification?: string | null;
  involves_behavioural_tracking?: boolean;
  retention_days?: number | null;
  is_active?: boolean;
  /** Third parties and processors the data is shared with (unique, at most 50). */
  processors?: string[];
  /** How a Data Principal withdraws this consent (s.6(4)), 1-1000 chars. */
  withdrawal_instructions?: string | null;
}

/** Only non-material fields: what a principal consented to cannot be edited in place. */
export interface PurposePatch {
  name?: string | null;
  is_active?: boolean | null;
  retention_days?: number | null;
  description?: string | null;
  data_categories?: string[] | null;
  involves_behavioural_tracking?: boolean | null;
  legitimate_use_clause?: LegitimateUseClause | null;
  legitimate_use_justification?: string | null;
  processors?: string[] | null;
  withdrawal_instructions?: string | null;
}

/** published (in force), superseded (a newer version exists) or retired (switched off). */
export type PurposeStatus = "published" | "superseded" | "retired";

export interface PurposeOut {
  id: Uuid;
  code: string;
  name: string;
  description: string;
  data_categories: string[];
  legal_basis: LegalBasis;
  legitimate_use_clause: LegitimateUseClause | (string & {}) | null;
  legitimate_use_justification: string | null;
  involves_behavioural_tracking: boolean;
  retention_days: number | null;
  is_active: boolean;
  processors: string[];
  withdrawal_instructions: string | null;
  /** Position in the purpose's lineage: a material change to a noticed purpose is a new purpose, version + 1. */
  version: number;
  supersedes_id: Uuid | null;
  superseded_by_id: Uuid | null;
  status: PurposeStatus;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ListPurposesQuery extends Pagination {
  active?: boolean;
}

// ------------------------------------------------------------------ controls

/** Free-form JSON object for a control's additional columns: lower_snake_case keys, at most 16 KiB. */
export type ControlAttributes = Record<string, unknown>;

export interface ControlIn {
  /** Unique in the organisation, case-insensitively. Pattern ^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,63}$, e.g. AC-01. */
  code: string;
  name: string;
  description?: string | null;
  /** Free text (1-64 chars); default `draft`. `archived` is set by `controls.archive`. */
  status?: string;
  owner?: string | null;
  attributes?: ControlAttributes;
}

/** Every field optional. `attributes` merges into the stored object; a key set to null is removed. */
export interface ControlPatch {
  code?: string | null;
  name?: string | null;
  description?: string | null;
  status?: string | null;
  owner?: string | null;
  attributes?: Record<string, unknown | null> | null;
}

/** The Consenzy processes a regulator or an obligation involves. */
export type RegulatorProcess =
  | "breach_board_intimation" | "breach_principal_notice" | "breach_regulator_reporting" | "rights_requests"
  | "consent_manager" | "sdf_obligations" | "data_localisation" | "legal_holds";

/**
 * A regulator obligation (incident report, periodic report, request response, registration): who must do what, by
 * when, with the source.
 */
export interface RegulatorRuleOut {
  id: Uuid;
  regulator_id: Uuid;
  /** A short name for the obligation. */
  title: string | null;
  obligation_type: "incident_report" | "periodic_report" | "request_response" | "registration";
  /** The class of data fiduciary the obligation applies to. */
  applies_to_class:
    | "all_data_fiduciaries" | "significant_data_fiduciaries" | "consent_managers" | "regulated_entities" | "other"
    | null;
  /** The Consenzy process that implements it. */
  process: RegulatorProcess | null;
  /** The deployment timer that implements the deadline (its value is configured on the deployment). */
  timer: "breach_board_deadline" | "request_sla" | null;
  applies_to: string;
  trigger: string;
  /** With deadline_unit and deadline_from; null when the source sets no fixed period ("without delay"). */
  deadline_value: number | null;
  deadline_unit: "hours" | "days" | null;
  /** The event the clock starts from. */
  deadline_from: "detection" | "awareness" | "occurrence" | "receipt" | null;
  /** The structured deadline in hours. */
  deadline_hours: number | null;
  /** The deadline as the source words it. */
  deadline_text: string;
  follow_up: string | null;
  channel: string | null;
  /** Document title and clause. */
  source_citation: string;
  source_url: string;
  /** YYYY-MM-DD */
  last_verified_on: string | null;
  notes: string | null;
  status: "active" | "draft" | "archived";
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

/** A regulator from the platform's global registry (read-only for organisations), with its active rules. */
export interface RegulatorOut {
  id: Uuid;
  /** e.g. DPBI, CERTIN, RBI */
  code: string;
  name: string;
  jurisdiction: string;
  sectors: string[];
  statutes: string[];
  website: string | null;
  reporting_portal_url: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  /** One line: why the regulator matters under the DPDP Act. */
  dpdp_relevance: string | null;
  /** Its role in relation to the DPDP Act. */
  dpdp_role: string | null;
  processes: RegulatorProcess[];
  /** YYYY-MM-DD */
  last_reviewed_on: string | null;
  status: "active" | "archived";
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  rules: RegulatorRuleOut[];
}

export interface ListRegulatorsQuery {
  /** Matches code, name, jurisdiction or a statute. */
  q?: string;
  /** Regulators covering this sector (or all sectors), e.g. "banking". */
  sector?: string;
  /** Exact jurisdiction, case-insensitive, e.g. "India". */
  jurisdiction?: string;
  /** 1–500, default 200. */
  limit?: number;
  offset?: number;
}

export interface ControlOut {
  id: Uuid;
  code: string;
  name: string;
  description: string | null;
  status: string;
  owner: string | null;
  attributes: ControlAttributes;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
  /** The audit actor: `api_key:<id>` or `user:<subject>`. */
  created_by: string;
  updated_by: string;
}

export type ControlSort =
  | "code" | "-code" | "name" | "-name" | "status" | "-status" | "owner" | "-owner"
  | "updated_at" | "-updated_at" | "created_at" | "-created_at";

export interface ListControlsQuery extends Pagination {
  /** Case-insensitive text in code, name, description or owner. */
  q?: string;
  /** Exact status(es) (case-insensitive). */
  status?: OneOrMany<string>;
  /** Archived controls are left out unless this is true or status is `archived`. */
  include_archived?: boolean;
  /** Exactly this owner (case-insensitive). */
  owner?: string;
  /** true: no owner set. */
  unowned?: boolean;
  updated_from?: IsoDateTime;
  updated_to?: IsoDateTime;
  /** `attr.<key>=<value>` filters (up to 5): the attributes hold that key with that value. */
  attributes?: Record<string, string | number | boolean>;
  sort?: ControlSort;
}

// ------------------------------------------------------------------ audit findings (scopes findings:read / findings:manage)

export type FindingSeverity = "critical" | "high" | "medium" | "low" | "info";
export type FindingStatus = "open" | "in_remediation" | "risk_accepted" | "closed";
export type FindingSource = "investigation_platform" | "manual";

/** Where a finding's evidence lives (in the investigation platform or a document system). */
export interface EvidenceLink {
  /** An https link. */
  url: string;
  /** What the link shows, e.g. "Checklist C-12 response". */
  label?: string | null;
}

/**
 * Optional links to your organisation's own Consenzy records. An id or code that does not exist here is dropped;
 * it never fails the request.
 */
export interface FindingLinksIn {
  application_id?: Uuid | null;
  breach_id?: Uuid | null;
  control_id?: Uuid | null;
  /** Alternative to control_id: the control's code in the controls register. */
  control_code?: string | null;
  /** A privacy notice version. */
  notice_id?: Uuid | null;
  purpose_id?: Uuid | null;
  /** Alternative to purpose_id: the processing purpose's code. */
  purpose_code?: string | null;
  /** A Data Principal rights request. */
  request_id?: Uuid | null;
}

export interface FindingLinksOut {
  application_id?: Uuid | null;
  breach_id?: Uuid | null;
  control_id?: Uuid | null;
  notice_id?: Uuid | null;
  purpose_id?: Uuid | null;
  request_id?: Uuid | null;
}

/** An audit finding (Ledger › Audit findings): imported from the investigation platform or added by hand. */
export interface AuditFindingOut {
  id: Uuid;
  source: FindingSource;
  /** The investigation platform's id (imported findings). */
  external_id: string | null;
  external_ref: string | null;
  title: string;
  description: string | null;
  severity: FindingSeverity;
  status: FindingStatus;
  category: string | null;
  dpdp_ref: string | null;
  owner: string | null;
  owner_member_id: Uuid | null;
  /** The owning portal member's email, when the owner is a member. */
  owner_email?: string | null;
  /** YYYY-MM-DD */
  due_date: string | null;
  /** Not closed and past its due date. */
  overdue: boolean;
  is_test: boolean;
  source_url: string | null;
  evidence: EvidenceLink[];
  links: FindingLinksOut;
  context: Record<string, string>;
  opened_at: IsoDateTime;
  closed_at: IsoDateTime | null;
  created_at: IsoDateTime;
  created_by: string;
  updated_at: IsoDateTime;
  updated_by: string;
}

/** A finding added by hand (findings:manage). */
export interface AuditFindingCreate {
  title: string;
  severity: FindingSeverity;
  description?: string | null;
  category?: string | null;
  dpdp_ref?: string | null;
  owner?: string | null;
  /** A portal member of your organisation (members.list()). */
  owner_member_id?: Uuid | null;
  /** YYYY-MM-DD */
  due_date?: string | null;
  source_url?: string | null;
  evidence?: EvidenceLink[];
  links?: FindingLinksIn | null;
}

export interface FindingStatusIn {
  status: FindingStatus;
  /** Required to close a finding. */
  note?: string | null;
}

export interface FindingNoteIn {
  body: string;
}

/** A remediation note or a status change on a finding. */
export interface AuditFindingNoteOut {
  id: Uuid;
  kind: "note" | "status_change";
  body: string | null;
  from_status: FindingStatus | null;
  to_status: FindingStatus | null;
  author: string;
  occurred_at: IsoDateTime;
}

export interface FindingSeriesDay {
  /** YYYY-MM-DD (UTC) */
  date: string;
  opened: number;
  closed: number;
  /** Open (not closed) at the end of the day. */
  open: number;
}

export interface FindingStatsOut {
  open: number;
  overdue: number;
  closed_30d: number;
  open_by_severity: Partial<Record<FindingSeverity, number>>;
  /** Mean days from opened to closed, over findings closed in the last 90 days. */
  mean_days_to_close: number | null;
  /** The last 30 days (UTC), oldest first. */
  days: FindingSeriesDay[];
}

export interface ListAuditFindingsQuery extends Pagination {
  /** Text in the title, reference, category or DPDP reference. */
  q?: string;
  severity?: OneOrMany<FindingSeverity>;
  status?: OneOrMany<FindingStatus>;
  /** true: not closed; false: closed. */
  open?: boolean;
  /** Exact category(ies). */
  category?: OneOrMany<string>;
  /** true: not closed and past the due date. */
  overdue?: boolean;
  /** Linked to a record of any of these types ("none": not linked). */
  linked?: OneOrMany<string>;
  source?: OneOrMany<FindingSource>;
  /** true: only test findings; false: hide them. */
  test?: boolean;
}

// ------------------------------------------------------------------ breach detections

export type DetectionStatus = "open" | "acknowledged" | "dismissed" | "escalated";
export type DetectionSeverity = "low" | "medium" | "high" | "critical";

/** A detection raised by the real-time engine from the platform's rule library. Never contains personal data. */
export interface DetectionOut {
  id: Uuid;
  rule_id: Uuid;
  rule_code: string;
  rule_name: string;
  rule_version: number;
  category: string;
  kind: string;
  severity: DetectionSeverity;
  /** `org`, `api_key:<id>`, `purpose:<code>` or `user#<digest>` (joined with `|` for two keys). */
  group_key: string;
  window_start: IsoDateTime;
  window_end: IsoDateTime;
  observed_value: number;
  threshold: number;
  /** Up to 20 audit sequence numbers of matching events (look them up in the audit trail). */
  sample_event_seqs: number[];
  status: DetectionStatus;
  breach_id: Uuid | null;
  note: string | null;
  handled_by: string | null;
  handled_at: IsoDateTime | null;
  created_at: IsoDateTime;
}

export interface DetectionSummaryOut {
  open: number;
  acknowledged: number;
  dismissed: number;
  escalated: number;
  open_by_severity: Record<string, number>;
  latest_at: IsoDateTime | null;
}

export type DetectionCategory =
  | "data_exfiltration"
  | "credential_misuse"
  | "privilege_escalation"
  | "integrity"
  | "availability"
  | "consent_abuse"
  | "configuration";

export interface ListDetectionsQuery extends Pagination {
  status?: OneOrMany<DetectionStatus>;
  severity?: OneOrMany<DetectionSeverity>;
  rule_code?: string;
  category?: OneOrMany<DetectionCategory>;
  /** Only detections raised after this instant (poll with the newest `created_at`). */
  since?: IsoDateTime;
  /** Raised at or before this instant. */
  until?: IsoDateTime;
  /** Escalated to this breach. */
  breach_id?: Uuid;
  /** Exactly this group, e.g. `api_key:<id>`. */
  group_key?: string;
}

export interface DetectionAcknowledgeIn {
  note?: string | null;
}

export interface DetectionDismissIn {
  reason: string;
}

export interface DetectionEscalateIn {
  /** Breach title; default from the rule name. */
  title?: string | null;
  nature?: ("confidentiality" | "integrity" | "availability")[] | null;
  note?: string | null;
}

/** A global detection rule as your organisation sees it, with your override. */
export interface DetectionRuleOrgOut {
  id: Uuid;
  code: string;
  name: string;
  description: string;
  category: string;
  severity: string;
  kind: string;
  definition: Record<string, unknown>;
  version: number;
  /** The platform default. */
  enabled: boolean;
  override_enabled: boolean | null;
  threshold_multiplier: number | null;
  effective_enabled: boolean;
}

export interface DetectionRuleOverrideIn {
  /** null: follow the platform default. */
  enabled?: boolean | null;
  /** 0.25-10; scales the rule's threshold. null: 1. */
  threshold_multiplier?: number | null;
}

// ------------------------------------------------------------------ notices

export interface NoticeIn {
  version: number;
  language?: Language;
  title: string;
  body: string;
  purpose_ids: Uuid[];
}

export interface NoticeOut {
  id: Uuid;
  version: number;
  language: Language;
  title: string;
  body: string;
  purpose_ids: Uuid[];
  /** superseded: a later version exists in this language. */
  status: "published" | "superseded";
  /** The structured document a studio publish composed the body from (null for plain-text notices). */
  content: Record<string, unknown> | null;
  published_at: IsoDateTime;
  created_at: IsoDateTime;
}

export interface ListNoticesQuery extends Pagination {
  language?: Language;
}

// ------------------------------------------------------------------ consents

export interface ConsentGrantIn {
  principal_id: Uuid;
  notice_id: Uuid;
  /** 1–20 unique purpose ids, each must be on the notice. */
  purpose_ids: Uuid[];
  channel: Channel;
  /** Required when channel is "consent_manager" (s.6(7)). */
  consent_manager_ref?: string | null;
  expires_at?: IsoDateTime | null;
  ip_address?: string | null;
  user_agent?: string | null;
}

export interface ConsentWithdrawIn {
  reason?: string | null;
  on_behalf_of?: WithdrawalActor;
}

export interface ConsentOut {
  id: Uuid;
  principal_id: Uuid;
  purpose_id: Uuid;
  notice_id: Uuid;
  status: ConsentStatus;
  channel: Channel;
  consent_manager_ref: string | null;
  given_at: IsoDateTime;
  expires_at: IsoDateTime | null;
  withdrawn_at: IsoDateTime | null;
  withdrawal_reason: string | null;
  /** The registered application the consent was given through (the minting key's or session's). */
  application_id?: Uuid | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ListConsentsQuery extends Pagination {
  principal_id?: Uuid;
  purpose_id?: OneOrMany<Uuid>;
  status?: OneOrMany<ConsentListStatus>;
  /** true: only expired consents (active but past `expires_at`); false: none. */
  expired?: boolean;
  notice_id?: OneOrMany<Uuid>;
  channel?: OneOrMany<Channel>;
  given_from?: IsoDateTime;
  given_to?: IsoDateTime;
  withdrawn_from?: IsoDateTime;
  withdrawn_to?: IsoDateTime;
  /** In-force consents that expire at or before this instant. */
  expires_before?: IsoDateTime;
  /** Given through this registered application. */
  application_id?: Uuid;
  principal_is_child?: boolean;
}

export interface ConsentEventOut {
  id: number;
  consent_id: Uuid;
  event_type: string;
  actor: string;
  /**
   * Event data. Withdrawals record `{ reason_given: boolean, reason_hash: string | null }` (a keyed digest; the
   * free-text reason itself is never written to the ledger).
   */
  payload: Record<string, unknown>;
  prev_hash: string | null;
  hash: string;
  occurred_at: IsoDateTime;
}

/** Exactly one of principal_id / external_ref. */
export type ConsentCheckIn =
  | { principal_id: Uuid; external_ref?: never; purpose_code: string }
  | { external_ref: string; principal_id?: never; purpose_code: string };

export interface ConsentCheckOut {
  allowed: boolean;
  basis?: LegalBasis | null;
  consent_id?: Uuid | null;
  expires_at?: IsoDateTime | null;
  /** Latest ledger event of the consent at check time. */
  ledger_event_id?: number | null;
  /**
   * Ledger anchor. Record it with each use of the data (e.g. in your audit trail);
   * verify later with `consents.verifyAnchor(consentId, ledgerHash)`.
   */
  ledger_hash?: string | null;
}

/** Proof that a consent was (or was not) in force when an anchor was recorded. */
export interface LedgerAnchorVerification {
  consent_id: Uuid;
  ledger_hash: string;
  found: boolean;
  chain_valid: boolean;
  event_id?: number | null;
  event_type?: string | null;
  occurred_at?: IsoDateTime | null;
  in_force_at_anchor?: boolean | null;
  later_events?: ConsentEventOut[];
}

export interface LedgerVerification {
  consent_id: Uuid;
  events: number;
  valid: boolean;
}

// ------------------------------------------------------------------ data principal requests (ss.11–14)

/** s.11: summary of personal data processed. */
export interface AccessDetails {
  note?: string;
}

/** s.12(1)-(2): correction, completion, updating. Field keys match ^[a-z][a-z0-9_]{0,63}$. */
export interface CorrectionDetails {
  fields: Record<string, unknown>;
  note?: string;
}

/** s.12(3): erasure. */
export interface ErasureDetails {
  reason?: string;
}

/** s.13: grievance redressal. */
export interface GrievanceDetails {
  description: string;
  related_request_id?: Uuid;
}

/** s.14: nomination. nominee_email or nominee_phone is required. */
export interface NominationDetails {
  nominee_name: string;
  nominee_email?: string;
  nominee_phone?: string;
  relationship: string;
}

export interface DataRequestDetailsByType {
  access: AccessDetails;
  correction: CorrectionDetails;
  completion: CorrectionDetails;
  updating: CorrectionDetails;
  erasure: ErasureDetails;
  grievance: GrievanceDetails;
  nomination: NominationDetails;
}

export type DataRequestDetails<T extends RequestType = RequestType> = DataRequestDetailsByType[T];

export type DataRequestBody = {
  [T in RequestType]: { request_type: T; details: DataRequestDetailsByType[T] };
}[RequestType];

export type DataRequestIn = DataRequestBody & {
  principal_id: Uuid;
  /** Where the request arrived. Default "other". */
  channel?: RequestChannel;
  /**
   * Opaque id from that channel (WhatsApp message id, email Message-ID, ticket number), 1–128 chars.
   * Never contact details; redacted on erasure.
   */
  channel_reference?: string | null;
};

/** Body of POST /v1/me/data-requests (principal session). */
export type MeDataRequestIn = {
  /** "web" or "app" (server default "app"). */
  channel?: MeRequestChannel;
} & DataRequestBody;

export interface DataRequestTransitionIn {
  to_status: Exclude<RequestStatus, "received">;
  /** Required when rejecting. */
  note?: string | null;
  response?: Record<string, unknown> | null;
  assigned_to?: string | null;
}

export interface DataRequestOut {
  id: Uuid;
  principal_id: Uuid;
  request_type: RequestType;
  status: RequestStatus;
  /** Where the request arrived. */
  channel: RequestChannel;
  /** Opaque id from that channel, or null (always null after erasure). */
  channel_reference: string | null;
  details: Record<string, unknown>;
  response: Record<string, unknown> | null;
  assigned_to: string | null;
  /** The API key that filed the request (null when filed from the portal). */
  api_key_id?: Uuid | null;
  /** Statutory response deadline (90 days under the DPDP Rules, 2025). */
  due_at: IsoDateTime;
  received_at: IsoDateTime;
  closed_at: IsoDateTime | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface DataRequestEventOut {
  id: number;
  request_id: Uuid;
  from_status: RequestStatus | null;
  to_status: RequestStatus;
  note: string | null;
  actor: string;
  occurred_at: IsoDateTime;
}

export interface ListDataRequestsQuery extends Pagination {
  principal_id?: Uuid;
  status?: OneOrMany<RequestStatus>;
  /** true: not yet completed, rejected or withdrawn. */
  open?: boolean;
  request_type?: OneOrMany<RequestType>;
  channel?: OneOrMany<RequestChannel>;
  /** Only open requests past their due_at. */
  overdue?: boolean;
  /** Open requests due at or before this instant. */
  due_before?: IsoDateTime;
  assigned_to?: string;
  unassigned?: boolean;
  received_from?: IsoDateTime;
  received_to?: IsoDateTime;
  closed_from?: IsoDateTime;
  closed_to?: IsoDateTime;
  /** Filed with this API key / with a key of this application. */
  api_key_id?: Uuid;
  application_id?: Uuid;
}

// ------------------------------------------------------------------ principal sessions and /v1/me

/** Exactly one of principal_id / external_ref. ttl_seconds 60–3600, default 900. */
/** Exactly one of principal_id / external_ref. Minting needs scope sessions:mint. */
export type PrincipalSessionCreate =
  | ({ principal_id: Uuid; external_ref?: never } & PrincipalSessionOptions)
  | ({ external_ref: string; principal_id?: never } & PrincipalSessionOptions);

/** Options common to both principal selectors. */
export interface PrincipalSessionOptions {
  ttl_seconds?: number;
  /**
   * Who your backend authenticated. Default `data_principal`. For a child or a person with disability, consent
   * can only be given through a session minted with `guardian` (DPDP s.9).
   */
  acting_as?: SessionActingAs;
  /** Narrow the session; default: every capability the minting key's scopes allow. */
  capabilities?: SessionCapability[] | null;
}

export interface PrincipalSessionOut {
  /** `cps_…` bearer token for /v1/me. Hand it to the browser or mobile SDK. */
  token: string;
  session_id: Uuid;
  principal_id: Uuid;
  expires_at: IsoDateTime;
  acting_as: SessionActingAs | (string & {});
  capabilities: SessionCapability[];
  /** The minting key's registered application, if any. */
  application_id?: Uuid | null;
}

export interface MeOut {
  principal_id: Uuid;
  external_ref: string;
  preferred_language: Language;
  acts_through_guardian: boolean;
  guardian_verified: boolean;
  acting_as: SessionActingAs | (string & {});
  capabilities: SessionCapability[];
}

export interface MePurposeOut {
  id: Uuid;
  code: string;
  name: string;
  description: string;
  data_categories: string[];
  retention_days: number | null;
}

export interface MeNoticeOut {
  id: Uuid;
  version: number;
  language: Language;
  title: string;
  body: string;
  /** Active, consent-based purposes on this notice (legitimate-use purposes are not shown). */
  purposes: MePurposeOut[];
}

export interface MeConsentOut extends ConsentOut {
  purpose_code: string;
}

export interface MeConsentGrantIn {
  notice_id: Uuid;
  purpose_ids: Uuid[];
  channel: PrincipalChannel;
  expires_at?: IsoDateTime | null;
}

export interface MeConsentWithdrawIn {
  reason?: string | null;
}

// ------------------------------------------------------------------ errors

export interface ValidationErrorItem {
  loc: (string | number)[];
  msg: string;
  type: string;
  [extra: string]: unknown;
}

/** The `detail` of an error response: a message, a structured object, or FastAPI's validation list. */
export type ErrorDetail = string | ValidationErrorItem[] | Record<string, unknown> | null;

/** `GET /v1/api-keys/current`: introspect the calling key. */
export interface CurrentKeyOut {
  organization_id: Uuid;
  key: ApiKeyOut;
}

// ------------------------------------------------------------------ audit trail feed (bring your own lakehouse)

export type AuditEventType =
  | "consent.granted" | "consent.withdrawn" | "consent.superseded" | "data_request.status_changed"
  | "data.accessed" | "data.access_denied" | "principal.erased" | "purpose.legitimate_use_declared"
  | "retention.hold_placed" | "retention.hold_released" | "retention.expired_shredded"
  | "breach.detected" | "breach.transitioned" | "breach.impact_assessed" | "breach.board_report_generated"
  | "breach.board_report_submitted" | "breach.principals_notified"
  // Configuration, keys, sessions and org-API reads of principal records (attributes: ids and field names only).
  | "config.purpose_created" | "config.purpose_changed" | "config.notice_published"
  | "key.issued" | "key.revoked" | "key.scopes_changed" | "org.created" | "org.updated" | "org.status_changed"
  | "org.identity_link_changed" | "org.logo_set" | "org.logo_removed"
  | "member.invited" | "member.invitation_revoked" | "member.joined" | "member.role_changed" | "member.removed"
  | "guardian.verified" | "principal.created" | "principal.updated" | "principal.read"
  | "session.minted" | "session.revoked"
  // A signed ledger checkpoint (attributes: statement, statement_hash, signature, key_id).
  | "ledger.checkpoint";

/** One PII-free audit event. `seq` is per-organisation, gap-free and commit-ordered. */
export interface AuditEventOut {
  seq: number;
  event_id: Uuid;
  event_type: AuditEventType | (string & {});
  occurred_at: IsoDateTime;
  principal_id: Uuid | null;
  consent_id: Uuid | null;
  purpose_code: string | null;
  ledger_hash: string | null;
  request_id: Uuid | null;
  actor: string | null;
  api_key_id: Uuid | null;
  attributes: Record<string, unknown>;
}

export interface AuditPage {
  events: AuditEventOut[];
  /** Pass as `after` next time; persist it atomically with the rows you load for exactly-once. */
  next_after: number;
  has_more: boolean;
  /** `order: "desc"` only: pass as `before` for the next (older) page; null on the last page. */
  next_before?: number | null;
}

export interface AuditEventsQuery {
  after?: number;
  limit?: number;
  event_type?: OneOrMany<AuditEventType>;
  since?: IsoDateTime;
  until?: IsoDateTime;
  principal_id?: Uuid;
  api_key_id?: Uuid;
  application_id?: Uuid;
  /** Exactly this actor (`user:<subject>` also matches its `;<email>` form). */
  actor?: string;
  purpose_code?: string;
  consent_id?: Uuid;
  request_id?: Uuid;
  /** `desc`: newest first, paged with `before`. Ingestion uses the default `asc` with `after`. */
  order?: "asc" | "desc";
  before?: number;
}

export interface ListCheckpointsQuery {
  after?: number;
  limit?: number;
  since?: IsoDateTime;
  until?: IsoDateTime;
  key_id?: string;
}

// ------------------------------------------------------------------ ledger checkpoints (verify offline with scripts/verify_checkpoint.py)

/** A signed checkpoint over one window of the audit trail. `statement` is exactly the signed bytes. */
export interface LedgerCheckpointOut {
  id: Uuid;
  number: number;
  audit_seq_from: number;
  audit_seq_to: number;
  audit_count: number;
  ledger_count: number;
  /** RFC 9162 Merkle tree hash over the canonical audit rows of the window. */
  audit_root: string;
  /** RFC 9162 Merkle tree hash over the consent-ledger events of the window. */
  ledger_root: string;
  prev_statement_hash: string | null;
  /** Canonical JSON. */
  statement: string;
  /** SHA-256 of `statement`; the next checkpoint's `prev_statement_hash`. */
  statement_hash: string;
  /** Base64 Ed25519 signature over `statement`. */
  signature: string;
  key_id: string;
  created_at: IsoDateTime;
}

export interface SignedStatement {
  id: Uuid;
  number: number;
  statement: string;
  statement_hash: string;
  signature: string;
  key_id: string;
}

export interface LedgerLeaf {
  consent_id: Uuid;
  ledger_event_id: number;
  event_type: string;
  hash: string;
}

export interface ProofEvent {
  id: number;
  event_type: string;
  payload: Record<string, unknown>;
  /** Exactly as hashed into the consent chain. */
  occurred_at: string;
  prev_hash: string | null;
  hash: string;
}

/** Inclusion proof for a consent's latest checkpointed ledger event. */
export interface LedgerProof {
  org_id: Uuid;
  consent_id: Uuid;
  /** The checkpoint whose window holds the event. */
  checkpoint: SignedStatement;
  anchor_checkpoint_id: Uuid;
  /** Checkpoints after `checkpoint`, up to the anchor. */
  statement_chain: SignedStatement[];
  leaf: LedgerLeaf;
  leaf_index: number;
  tree_size: number;
  inclusion_path: string[];
  /** The consent's hash chain up to and including the leaf event. */
  events: ProofEvent[];
}

export interface LedgerPublicKey {
  key_id: string;
  algorithm: "Ed25519";
  /** Base64 raw 32-byte Ed25519 public key. */
  public_key: string;
}

export interface LedgerPublicKeys {
  keys: LedgerPublicKey[];
}

// ------------------------------------------------------------------ PII vault

export interface VaultItemIn {
  /** Must be a data category declared by one of your purposes. */
  data_category: string;
  value: string;
}

/** Exactly one of principal_id / external_ref. */
export type VaultTokenizeIn =
  | { principal_id: Uuid; external_ref?: never; items: VaultItemIn[] }
  | { external_ref: string; principal_id?: never; items: VaultItemIn[] };

export interface VaultTokenOut {
  token: string;
  data_category: string;
}

export interface VaultTokenizeOut {
  principal_id: Uuid;
  tokens: VaultTokenOut[];
}

export interface VaultDetokenizeIn {
  /** The purpose the data is being used for right now. */
  purpose_code: string;
  tokens: string[];
}

/**
 * `retention_expired`: an erased principal's legally retained value past its `retain_until` (kept only
 * while a legal hold is active; a hold never authorises use).
 */
export type VaultDenialReason =
  | "not_found" | "erased" | "category_not_in_purpose" | "no_consent" | "integrity_error" | "retention_expired";

export interface VaultDetokenizeResult {
  token: string;
  status: "ok" | "denied";
  data_category?: string | null;
  value?: string | null;
  reason?: VaultDenialReason | null;
  basis?: LegalBasis | null;
  consent_id?: Uuid | null;
  /** Ledger anchor of the consent that authorised the release. */
  ledger_hash?: string | null;
}

export interface VaultDetokenizeOut {
  purpose_code: string;
  results: VaultDetokenizeResult[];
}

// ------------------------------------------------------------------ retention and legal holds (scope retention:manage)

export type LegalHoldBasis = "court_order" | "regulator_order" | "litigation" | "investigation" | "statutory_audit" | "other";

export interface LegalHoldIn {
  principal_id: Uuid;
  basis: LegalHoldBasis;
  /** Internal note; kept out of the audit feed. Do not put the principal's personal data here. */
  reason: string;
  /** Order / case / notice number. Written to the audit trail. */
  reference: string;
}

export interface LegalHoldReleaseIn {
  reason: string;
}

export interface LegalHoldOut {
  id: Uuid;
  principal_id: Uuid;
  basis: LegalHoldBasis | (string & {});
  reason: string;
  reference: string;
  placed_at: IsoDateTime;
  /** null when a person placed it in the portal (then placed_by_member is set). */
  placed_by_key: Uuid | null;
  placed_by_member?: Uuid | null;
  released_at: IsoDateTime | null;
  released_by_key: Uuid | null;
  released_by_member?: Uuid | null;
  release_reason: string | null;
  active: boolean;
  /** Documents attached to the hold (not deleted). The documents themselves: /v1/retention/holds/{id}/documents. */
  document_count?: number;
  /** Keep (and review) until: the hold's latest extension, if any. */
  retain_until?: IsoDateTime | null;
}

/** A note on a legal hold, or an extension of its retain-until date (append-only). */
export interface LegalHoldNoteOut {
  id: Uuid;
  hold_id: Uuid;
  kind: "note" | "extension";
  note: string | null;
  retain_until: IsoDateTime | null;
  actor: string;
  created_at: IsoDateTime;
}

export interface RetentionShredOut {
  principal_id: Uuid;
  retention_class: string;
  retain_until: IsoDateTime | null;
  categories: string[];
}

export interface LegalHoldReleaseOut {
  hold: LegalHoldOut;
  /** Another active hold still covers the principal; nothing was shredded. */
  still_held: boolean;
  /** Retained keys whose retention had already ended, shredded on release. */
  expired_shredded: RetentionShredOut[];
}

export interface RetentionClassOut {
  /** "consent", or "lu:<purpose id>" for a legally retained class. */
  retention_class: string;
  purpose_id: Uuid | null;
  purpose_code: string | null;
  categories: string[];
  records: number;
  status: "live" | "retained" | "shredded";
  retain_until: IsoDateTime | null;
  shredded_at: IsoDateTime | null;
}

export interface RetentionStatusOut {
  principal_id: Uuid;
  erased_at: IsoDateTime | null;
  under_legal_hold: boolean;
  active_hold_ids: Uuid[];
  classes: RetentionClassOut[];
}

export interface ListLegalHoldsQuery extends Pagination {
  principal_id?: Uuid;
  active?: boolean;
  basis?: OneOrMany<LegalHoldBasis>;
  /** Exactly this order / case number (the reason is never searched). */
  reference?: string;
  placed_from?: IsoDateTime;
  placed_to?: IsoDateTime;
  placed_by_member?: Uuid;
  placed_by_key?: Uuid;
}

/**
 * DataRequestOut.response of a completed erasure request: the s.12(3) reply. `statement` is
 * principal-facing and never mentions a legal hold; `under_legal_hold` is for the fiduciary only.
 */
export interface ErasureNotice {
  erased_at: IsoDateTime;
  shredded: { retention_class: string; categories: string[] }[];
  retained: {
    retention_class: string;
    purpose_id: Uuid;
    purpose_code: string | null;
    purpose_name: string | null;
    categories: string[];
    retain_until: IsoDateTime;
    legal_basis: { clause: string; justification: string; retention_days: number } | null;
    under_legal_hold: boolean;
  }[];
  under_legal_hold: boolean;
  statement: string;
}

// ------------------------------------------------------------------ personal data breaches (s.8(6), Rules r.7)

export type BreachStatus = "detected" | "assessing" | "contained" | "notified_board" | "notified_principals" | "closed";
export type BreachNature = "confidentiality" | "integrity" | "availability";
export type ContainmentStatus = "not_contained" | "partially_contained" | "contained";
export type ImpactSource = "consents" | "vault" | "access_log" | "external_refs";
export type DeliveryStatus = "pending" | "sent" | "delivered" | "failed";
export type BoardReportKind = "initial" | "detailed";

/**
 * One language's intimation template. `${placeholder}`s: org_name, breach_ref, title, description, nature,
 * occurred_window, detected_at, location, data_categories, likely_consequences, mitigation,
 * principal_safety_steps, dpo_name, dpo_email, dpo_phone, dpo_contact. None identifies the recipient.
 */
export interface BreachNoticeTemplate {
  subject: string;
  body: string;
}

/** Breach particulars the DPO fills in as the investigation proceeds (r.7(1) and r.7(2)). */
export interface BreachFields {
  occurred_from?: IsoDateTime | null;
  occurred_to?: IsoDateTime | null;
  location?: string | null;
  data_categories?: string[] | null;
  /** Purposes whose data was involved (scopes the impact query). */
  purpose_ids?: Uuid[] | null;
  estimated_affected_count?: number | null;
  likely_consequences?: string | null;
  mitigation?: string | null;
  principal_safety_steps?: string | null;
  circumstances?: string | null;
  responsible_party_findings?: string | null;
  remedial_measures?: string | null;
  containment_status?: ContainmentStatus | null;
  /** Contact for principals (r.7(1)(e)); defaults to the organisation's DPO. */
  dpo_name?: string | null;
  dpo_email?: string | null;
  dpo_phone?: string | null;
  /** Must include "en" (the fallback). Frozen once notices are generated. */
  notice_templates?: Partial<Record<Language, BreachNoticeTemplate>> | null;
}

export interface BreachCreate extends BreachFields {
  title: string;
  description: string;
  nature: BreachNature[];
  /** When the organisation became aware (starts the r.7 clocks). Default: now. */
  detected_at?: IsoDateTime | null;
}

/** Unset fields are left alone; `null` clears an optional field. */
export interface BreachPatch extends BreachFields {
  title?: string | null;
  description?: string | null;
  nature?: BreachNature[] | null;
  /** A longer period the Board allowed for the detailed report; can only move later. */
  board_deadline_extended_to?: IsoDateTime | null;
}

export interface BreachOut {
  id: Uuid;
  title: string;
  status: BreachStatus;
  detected_at: IsoDateTime;
  occurred_from: IsoDateTime | null;
  occurred_to: IsoDateTime | null;
  location: string | null;
  description: string;
  nature: BreachNature[];
  data_categories: string[];
  purpose_ids: Uuid[];
  estimated_affected_count: number | null;
  likely_consequences: string | null;
  mitigation: string | null;
  principal_safety_steps: string | null;
  circumstances: string | null;
  responsible_party_findings: string | null;
  remedial_measures: string | null;
  containment_status: ContainmentStatus;
  dpo_name: string | null;
  dpo_email: string | null;
  dpo_phone: string | null;
  notice_templates: Partial<Record<Language, BreachNoticeTemplate>>;
  board_report_due_at: IsoDateTime;
  board_deadline_extended_to: IsoDateTime | null;
  /** board_deadline_extended_to if set, else board_report_due_at. */
  board_deadline: IsoDateTime;
  /** Detailed Board report not submitted and the deadline has passed. */
  board_overdue: boolean;
  board_initial_submitted_at: IsoDateTime | null;
  board_detailed_submitted_at: IsoDateTime | null;
  board_reference: string | null;
  principals_notified_at: IsoDateTime | null;
  impact_version: number;
  closed_at: IsoDateTime | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ListBreachesQuery extends Pagination {
  status?: OneOrMany<BreachStatus>;
  /** true: not closed. */
  open?: boolean;
  /** Detailed Board report past its (possibly extended) deadline. */
  overdue?: boolean;
  /** Open breaches whose detailed Board report is due at or before this instant. */
  board_due_before?: IsoDateTime;
  board_stage?: OneOrMany<"none" | "initial" | "detailed">;
  principals_notified?: boolean;
  containment?: OneOrMany<ContainmentStatus>;
  nature?: OneOrMany<BreachNature>;
  purpose_id?: OneOrMany<Uuid>;
  data_category?: OneOrMany<string>;
  detected_from?: IsoDateTime;
  detected_to?: IsoDateTime;
  /** `detection`: escalated from a detection. */
  source?: "manual" | "detection";
  /** Case-insensitive text in the title. */
  q?: string;
  min_affected?: number;
  /** Notified to this regulator. */
  regulator_id?: Uuid;
}

/** Mark a breach notified to a regulator under one of its rules. */
export interface RegulatorNotificationIn {
  /** Default: now. */
  notified_at?: IsoDateTime | null;
  /** The regulator's acknowledgement or ticket number. */
  reference?: string | null;
}

export interface RegulatorNotificationOut {
  id: Uuid;
  breach_id: Uuid;
  regulator_id: Uuid;
  regulator_code: string;
  rule_id: Uuid;
  /** The rule's deadline from the breach's detection (or occurrence); null for "without delay" rules. */
  due_at: IsoDateTime | null;
  notified_at: IsoDateTime;
  reference: string | null;
  created_by: string;
  created_at: IsoDateTime;
  updated_by: string;
  updated_at: IsoDateTime;
}

export interface BreachTransitionIn {
  to_status: Exclude<BreachStatus, "detected">;
  note?: string | null;
}

export interface BreachEventOut {
  id: number;
  breach_id: Uuid;
  event_type: string;
  from_status: BreachStatus | null;
  to_status: BreachStatus | null;
  note: string | null;
  attributes: Record<string, unknown>;
  actor: string;
  occurred_at: IsoDateTime;
}

export interface BreachImpactIn {
  /** Default: occurred_from, else detected_at. */
  window_from?: IsoDateTime | null;
  /** Default: occurred_to, else detected_at. */
  window_to?: IsoDateTime | null;
  /** Default: consents, vault, access_log (external_refs is added when external_refs is given). */
  sources?: ImpactSource[];
  data_categories?: string[] | null;
  purpose_ids?: Uuid[] | null;
  /** access_log: only accesses made with these (e.g. compromised) API keys. */
  api_key_ids?: Uuid[] | null;
  external_refs?: string[] | null;
}

export interface BreachImpactOut {
  breach_id: Uuid;
  version: number;
  principal_count: number;
  by_source: Record<string, number>;
  by_category: Record<string, number>;
  by_purpose: Record<string, number>;
  unmatched_external_refs: number;
  parameters: Record<string, unknown>;
  created_at: IsoDateTime;
}

export interface BoardReportIn {
  kind: BoardReportKind;
}

export interface BoardReportSubmitIn {
  /** Acknowledgement / reference number the Board issued. */
  board_reference?: string | null;
}

export interface BoardReportOut {
  id: Uuid;
  breach_id: Uuid;
  kind: BoardReportKind;
  /** Immutable report JSON; verify against the notified Rules text (see content.disclaimer). */
  content: Record<string, unknown>;
  /** Fields still empty; a report with any cannot be submitted. */
  missing_fields: string[];
  generated_at: IsoDateTime;
  submitted_at: IsoDateTime | null;
  board_reference: string | null;
}

export interface BreachNoticesGenerated {
  impact_version: number;
  generated: number;
  already_generated: number;
  skipped_erased: number;
  by_language: Record<string, number>;
}

export interface BreachNoticeContact {
  email: string | null;
  phone: string | null;
  guardian_email: string | null;
}

export interface BreachNoticeOut {
  id: Uuid;
  breach_id: Uuid;
  principal_id: Uuid;
  impact_version: number;
  language: Language;
  subject: string;
  body: string;
  data_categories: string[];
  generated_at: IsoDateTime;
  delivery_status: DeliveryStatus;
  delivery_attempts: number;
  last_attempt_at: IsoDateTime | null;
  delivered_at: IsoDateTime | null;
  acknowledged_at: IsoDateTime | null;
  /** Child or person with disability: deliver to the guardian (s.9). */
  deliver_to_guardian: boolean;
  /** Only for keys that also hold config:read. */
  contact: BreachNoticeContact | null;
}

export interface ListBreachNoticesQuery {
  delivery_status?: DeliveryStatus;
  /** 1–1000, default 500. */
  limit?: number;
  offset?: number;
}

export interface BreachNoticeDelivery {
  notice_id: Uuid;
  status: Exclude<DeliveryStatus, "pending">;
}

export interface BreachNoticeDeliveriesIn {
  items: BreachNoticeDelivery[];
}

export interface BreachNoticeDeliveriesOut {
  updated: number;
  unchanged: number;
  not_found: number;
}

/** The result of emailing a breach's pending intimations through the organisation's email sender. */
export interface BreachNoticeEmailOut {
  status: "sent" | "partial" | "failed" | "not_configured" | "nothing_to_send";
  sent: number;
  failed: number;
  /** Pending notices whose principal (or guardian) has no email address. */
  no_email: number;
  /** Pending or failed notices left for another call. */
  remaining: number;
  error?: string | null;
}

/** A breach intimation as the principal sees it on /v1/me/breach-notices. */
export interface MeBreachNoticeOut {
  notice_id: Uuid;
  breach_id: Uuid;
  language: Language;
  subject: string;
  body: string;
  data_categories: string[];
  generated_at: IsoDateTime;
  acknowledged_at: IsoDateTime | null;
}

// ------------------------------------------------------------------ team: invitations and memberships (scope members:manage)

export type MemberRole = "admin" | "dpo" | "privacy_ops" | "auditor" | "developer";

/** Invite someone to your organisation; they accept by signing in with this verified email. */
export interface InvitationCreate {
  email: string;
  role: MemberRole;
}

export interface InvitationOut {
  id: Uuid;
  scope: "platform" | "org";
  org_id: Uuid | null;
  email: string;
  role: MemberRole | (string & {});
  status: "pending" | "accepted" | "revoked" | "expired";
  invited_by: string;
  created_at: IsoDateTime;
  expires_at: IsoDateTime;
  accepted_at: IsoDateTime | null;
  clerk_invitation_id: string | null;
}

export interface MemberOut {
  id: Uuid;
  external_user_id: string;
  email: string;
  role: MemberRole | (string & {});
  created_at: IsoDateTime;
  created_from_invitation: Uuid | null;
}

export interface MembersOut {
  members: MemberOut[];
  invitations: InvitationOut[];
}

export interface MemberRoleIn {
  role: MemberRole;
}

export interface InvitationEmailIn {
  /** The portal's sign-in page (used when the API has no CDM_PORTAL_PUBLIC_URL). */
  sign_in_url?: string | null;
}

/** The result of sending an email through the organisation's sender (or the deployment default). */
export interface EmailSendOut {
  status: "sent" | "failed" | "not_configured";
  /** Whose sender was used. */
  source?: "org" | "deployment" | "none" | null;
  error?: string | null;
  error_code?:
    | "auth_failed" | "permission_missing" | "tls_error" | "unreachable" | "not_found" | "rate_limited" | "rejected"
    | "config" | null;
}

/** Record the id of the Clerk invitation email sent for a Consenzy invitation. */
export interface ClerkInvitationIn {
  clerk_invitation_id: string;
}
