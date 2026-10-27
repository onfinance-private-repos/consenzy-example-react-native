/*
 * ConsentServerClient: the organisation-API-key client. SERVER-SIDE ONLY.
 *
 * Import from "@onfinance/consenzy/server". It refuses to run in a browser page with a
 * `cdm_…` key, because an org key in a browser is readable by anyone who opens dev tools.
 *
 * Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0
 */
import { ConsentError, ConsentSecurityError } from "./errors";
import { HttpClient, encodePath, isBrowser, ledgerHashSegment, uuidSegment, uuidv4 } from "./http";
import type { BinaryBody, HttpClientOptions, HttpRequest, HttpResponse, RequestOptions } from "./http";
import type {
  ApiKeyCreate,
  ApiKeyIssued,
  ApiKeyOut,
  ApiKeyScopesPatch,
  ApiKeyUsageOut,
  ApiRequestLogEntry,
  ApplicationCreate,
  ApplicationOut,
  ApplicationPatch,
  ListApplicationsQuery,
  BoardReportIn,
  BoardReportOut,
  BoardReportSubmitIn,
  BreachCreate,
  BreachEventOut,
  BreachImpactIn,
  BreachImpactOut,
  BreachNoticeDeliveriesIn,
  BreachNoticeDeliveriesOut,
  BreachNoticeOut,
  BreachNoticesGenerated,
  BreachOut,
  BreachPatch,
  BreachTransitionIn,
  ListBreachesQuery,
  ListBreachNoticesQuery,
  ConsentCheckIn,
  ConsentCheckOut,
  ConsentEventOut,
  ConsentGrantIn,
  ConsentOut,
  ConsentWithdrawIn,
  DataRequestEventOut,
  DataRequestIn,
  DataRequestOut,
  DataRequestTransitionIn,
  GuardianVerificationIn,
  LedgerAnchorVerification,
  LedgerCheckpointOut,
  LedgerProof,
  LedgerPublicKeys,
  LedgerVerification,
  ListConsentsQuery,
  ListControlsQuery,
  ControlIn,
  ControlOut,
  ControlPatch,
  ListRegulatorsQuery,
  RegulatorOut,
  DetectionAcknowledgeIn,
  DetectionDismissIn,
  DetectionEscalateIn,
  DetectionOut,
  DetectionRuleOrgOut,
  DetectionRuleOverrideIn,
  DetectionSummaryOut,
  ListDetectionsQuery,
  ListDataRequestsQuery,
  ListNoticesQuery,
  ListPrincipalsQuery,
  ListPurposesQuery,
  NoticeIn,
  NoticeOut,
  LogoContentType,
  LogoOut,
  OrganizationOut,
  OrganizationOverviewOut,
  OrganizationPatch,
  Pagination,
  PrincipalIn,
  PrincipalOut,
  PrincipalPatch,
  PrincipalSessionCreate,
  PrincipalSessionOut,
  PurposeIn,
  PurposeOut,
  PurposePatch,
  AuditEventOut,
  AuditEventsQuery,
  AuditFindingCreate,
  AuditFindingNoteOut,
  AuditFindingOut,
  AuditPage,
  BreachNoticeEmailOut,
  EmailSendOut,
  FacetsOut,
  FindingNoteIn,
  FindingStatsOut,
  FindingStatusIn,
  InvitationEmailIn,
  ListAuditFindingsQuery,
  RegulatorNotificationIn,
  RegulatorNotificationOut,
  CurrentKeyOut,
  ClerkInvitationIn,
  InvitationCreate,
  InvitationOut,
  MemberOut,
  MemberRoleIn,
  MembersOut,
  LegalHoldIn,
  LegalHoldNoteOut,
  LegalHoldOut,
  LegalHoldReleaseIn,
  LegalHoldReleaseOut,
  ListLegalHoldsQuery,
  RetentionStatusOut,
  VaultDetokenizeIn,
  VaultDetokenizeOut,
  VaultTokenizeIn,
  VaultTokenizeOut,
  Scope,
  Uuid,
} from "./types";

export interface ConsentServerClientOptions extends HttpClientOptions {
  /** Organisation API key (`cdm_…`). Load it from your secret store, never from client code. */
  apiKey: string;
}

type Query = HttpRequest["query"];

export class ConsentServerClient {
  private readonly http: HttpClient;
  private readonly apiKey: string;

  constructor(options: ConsentServerClientOptions) {
    const apiKey = options?.apiKey;
    if (typeof apiKey !== "string" || !apiKey.startsWith("cdm_")) {
      throw new ConsentError("ConsentServerClient requires an organisation API key (cdm_…)");
    }
    if (isBrowser()) {
      throw new ConsentSecurityError(
        "ConsentServerClient was created in a browser with an organisation API key (cdm_…). Org keys must stay " +
          "on your servers. Use ConsentSession with a sessionProvider in the browser, and rotate this key.",
      );
    }
    this.http = new HttpClient(options);
    this.apiKey = apiKey;
    // Keep the key off enumerable properties so it doesn't show up in logs / JSON.stringify(client).
    Object.defineProperty(this, "apiKey", { enumerable: false });
  }

  get baseUrl(): string {
    return this.http.baseUrl;
  }

  /** Low-level escape hatch, authenticated with the org key. */
  async raw<T>(req: Omit<HttpRequest, "token">): Promise<HttpResponse<T>> {
    return this.http.request<T>({ ...req, token: this.apiKey });
  }

  private async send<T>(req: Omit<HttpRequest, "token">, options?: RequestOptions): Promise<T> {
    const full: HttpRequest = { ...req, token: this.apiKey };
    if (options?.signal) full.signal = options.signal;
    if (options?.timeoutMs !== undefined) full.timeoutMs = options.timeoutMs;
    return (await this.http.request<T>(full)).data;
  }

  private get = <T>(path: string, query?: Query, options?: RequestOptions) =>
    this.send<T>({ method: "GET", path, query }, options);
  private post = <T>(path: string, body?: unknown, options?: RequestOptions) =>
    this.send<T>({ method: "POST", path, body }, options);
  private patch = <T>(path: string, body: unknown, options?: RequestOptions) =>
    this.send<T>({ method: "PATCH", path, body }, options);
  private put = <T>(path: string, body: unknown, options?: RequestOptions) =>
    this.send<T>({ method: "PUT", path, body }, options);
  /** POST to an endpoint that supports Idempotency-Key: one key per logical write, reused on retry. */
  private postIdempotent = <T>(path: string, body: unknown, options?: RequestOptions) =>
    this.send<T>({ method: "POST", path, body, idempotencyKey: options?.idempotencyKey ?? uuidv4() }, options);

  /** Your organisation profile (DPO, grievance contact, SDF flag). Scopes: org:read / org:write. */
  readonly organization = {
    get: (options?: RequestOptions) => this.get<OrganizationOut>("/v1/organization", undefined, options),
    update: (patch: OrganizationPatch, options?: RequestOptions) =>
      this.patch<OrganizationOut>("/v1/organization", patch, options),
    /**
     * The onboarding checklist, work queue, 30-day trends and recent activity in one call. Scope: org:read;
     * each section is null unless the key also holds that section's scope.
     */
    overview: (options?: RequestOptions) =>
      this.get<OrganizationOverviewOut>("/v1/organization/overview", undefined, options),
    /** The logo image (scope org:read). Throws ConsentApiError 404 when none is set. */
    getLogo: (options?: RequestOptions) =>
      this.send<BinaryBody>({ method: "GET", path: "/v1/organization/logo", binary: true }, options),
    /** Set or replace the logo (scope org:write): PNG, JPEG or WebP bytes, at most 256 KiB. SVG is refused. */
    setLogo: (image: Uint8Array, contentType: LogoContentType, options?: RequestOptions) =>
      this.send<LogoOut>({ method: "PUT", path: "/v1/organization/logo", rawBody: { data: image, contentType } }, options),
    /** Remove the logo (scope org:write). Idempotent. */
    removeLogo: async (options?: RequestOptions) => {
      await this.send<void>({ method: "DELETE", path: "/v1/organization/logo" }, options);
    },
  };

  /** Scope: keys:manage. */
  readonly apiKeys = {
    /** The calling key's organisation and scopes (no scope required). */
    current: (options?: RequestOptions) => this.get<CurrentKeyOut>("/v1/api-keys/current", undefined, options),
    /** Every key of the organisation; `applicationId` narrows to the keys issued for that application. */
    list: (options?: RequestOptions & { applicationId?: Uuid }) =>
      this.get<ApiKeyOut[]>(
        "/v1/api-keys",
        options?.applicationId ? { application_id: uuidSegment(options.applicationId, "applicationId") } : undefined,
        options,
      ),
    /** The returned `key` is shown once. */
    create: (input: ApiKeyCreate, options?: RequestOptions) => this.post<ApiKeyIssued>("/v1/api-keys", input, options),
    revoke: async (keyId: Uuid, options?: RequestOptions) =>
      this.post<ApiKeyOut>(`/v1/api-keys/${uuidSegment(keyId, "keyId")}/revoke`, undefined, options),
    /**
     * Replace a key's scopes (the complete new list). Scopes it does not already hold must be held by the caller;
     * a revoked or expired key answers 409. Audited as key.scopes_changed (before and after).
     */
    updateScopes: (keyId: Uuid, scopes: Scope[], options?: RequestOptions) =>
      this.patch<ApiKeyOut>(`/v1/api-keys/${uuidSegment(keyId, "keyId")}`, { scopes } satisfies ApiKeyScopesPatch, options),
    /** Requests made with one key: per UTC day, top routes and status classes, over the last `days` (1-90, default 30). */
    usage: (keyId: Uuid, query: { days?: number } = {}, options?: RequestOptions) =>
      this.get<ApiKeyUsageOut>(`/v1/api-keys/${uuidSegment(keyId, "keyId")}/usage`, { ...query }, options),
    /**
     * The organisation's API request log (scope keys:manage): requests portal members sent from the API reference's
     * request panel, newest first, the last 90 days. An API key cannot ask for `mine`.
     */
    requestLog: (
      query: { source?: "try-it"; method?: ApiRequestLogEntry["method"]; route?: string; limit?: number; offset?: number } = {},
      options?: RequestOptions,
    ) => this.get<ApiRequestLogEntry[]>("/v1/api-logs", { ...query }, options),
  };

  /**
   * The applications registry (scope apps:manage). apps:manage belongs to the portal's Admin role and is never an
   * API key scope, so these calls succeed only on a request made for a signed-in Admin; an API key gets 403.
   */
  readonly applications = {
    list: (query: ListApplicationsQuery = {}, options?: RequestOptions) =>
      this.get<ApplicationOut[]>("/v1/applications", { ...query }, options),
    /** Idempotent: one Idempotency-Key per logical registration (pass `idempotencyKey` to reuse it on retry). */
    create: (input: ApplicationCreate, options?: RequestOptions) =>
      this.postIdempotent<ApplicationOut>("/v1/applications", input, options),
    get: async (applicationId: Uuid, options?: RequestOptions) =>
      this.get<ApplicationOut>(`/v1/applications/${uuidSegment(applicationId, "applicationId")}`, undefined, options),
    update: async (applicationId: Uuid, patch: ApplicationPatch, options?: RequestOptions) =>
      this.patch<ApplicationOut>(`/v1/applications/${uuidSegment(applicationId, "applicationId")}`, patch, options),
    /** Its origins stop being allowed for /v1/me and its keys stop minting sessions. Idempotent. */
    disable: async (applicationId: Uuid, options?: RequestOptions) =>
      this.post<ApplicationOut>(`/v1/applications/${uuidSegment(applicationId, "applicationId")}/disable`, {}, options),
    enable: async (applicationId: Uuid, options?: RequestOptions) =>
      this.post<ApplicationOut>(`/v1/applications/${uuidSegment(applicationId, "applicationId")}/enable`, {}, options),
  };

  /** Data Principals. Scopes: config:read / config:write (consents:read for their consents). */
  readonly principals = {
    list: (query: ListPrincipalsQuery = {}, options?: RequestOptions) =>
      this.get<PrincipalOut[]>("/v1/principals", { ...query }, options),
    create: (input: PrincipalIn, options?: RequestOptions) => this.post<PrincipalOut>("/v1/principals", input, options),
    get: async (principalId: Uuid, options?: RequestOptions) =>
      this.get<PrincipalOut>(`/v1/principals/${uuidSegment(principalId, "principalId")}`, undefined, options),
    update: async (principalId: Uuid, patch: PrincipalPatch, options?: RequestOptions) =>
      this.patch<PrincipalOut>(`/v1/principals/${uuidSegment(principalId, "principalId")}`, patch, options),
    /** Find by your own customer reference; resolves null when absent. */
    findByExternalRef: async (externalRef: string, options?: RequestOptions) =>
      (await this.get<PrincipalOut[]>("/v1/principals", { external_ref: externalRef, limit: 1 }, options))[0] ?? null,
    listConsents: async (principalId: Uuid, page: Pagination = {}, options?: RequestOptions) =>
      this.get<ConsentOut[]>(`/v1/principals/${uuidSegment(principalId, "principalId")}/consents`, { ...page }, options),
    /** Record verifiable guardian consent for a child / person with disability (Rules r.10). */
    verifyGuardian: async (principalId: Uuid, input: GuardianVerificationIn, options?: RequestOptions) =>
      this.post<PrincipalOut>(`/v1/principals/${uuidSegment(principalId, "principalId")}/guardian-verification`, input, options),
  };

  /** Specified purposes. Scopes: config:read / config:write. */
  readonly purposes = {
    list: (query: ListPurposesQuery = {}, options?: RequestOptions) =>
      this.get<PurposeOut[]>("/v1/purposes", { ...query }, options),
    create: (input: PurposeIn, options?: RequestOptions) => this.post<PurposeOut>("/v1/purposes", input, options),
    get: async (purposeId: Uuid, options?: RequestOptions) =>
      this.get<PurposeOut>(`/v1/purposes/${uuidSegment(purposeId, "purposeId")}`, undefined, options),
    update: async (purposeId: Uuid, patch: PurposePatch, options?: RequestOptions) =>
      this.patch<PurposeOut>(`/v1/purposes/${uuidSegment(purposeId, "purposeId")}`, patch, options),
  };

  /**
   * The controls register. Scopes: config:read / config:write. Controls are archived, never deleted;
   * `update` with a new status restores one.
   */
  readonly controls = {
    list: (query: ListControlsQuery = {}, options?: RequestOptions) => {
      const { attributes, ...rest } = query;
      const attrs = Object.fromEntries(Object.entries(attributes ?? {}).map(([k, v]) => [`attr.${k}`, v]));
      return this.get<ControlOut[]>("/v1/controls", { ...rest, ...attrs }, options);
    },
    /** The distinct owners of your controls (for an owner filter). */
    owners: (options?: RequestOptions) => this.get<string[]>("/v1/controls/owners", undefined, options),
    /** Sends an Idempotency-Key (generated unless `options.idempotencyKey` is given). 409 when the code is taken. */
    create: (input: ControlIn, options?: RequestOptions) => this.postIdempotent<ControlOut>("/v1/controls", input, options),
    get: async (controlId: Uuid, options?: RequestOptions) =>
      this.get<ControlOut>(`/v1/controls/${uuidSegment(controlId, "controlId")}`, undefined, options),
    update: async (controlId: Uuid, patch: ControlPatch, options?: RequestOptions) =>
      this.patch<ControlOut>(`/v1/controls/${uuidSegment(controlId, "controlId")}`, patch, options),
    archive: async (controlId: Uuid, options?: RequestOptions) =>
      this.post<ControlOut>(`/v1/controls/${uuidSegment(controlId, "controlId")}/archive`, undefined, options),
  };

  /**
   * Audit findings (Ledger › Audit findings). Scopes: findings:read / findings:manage. Findings imported from the
   * investigation platform arrive through its own signed integration, not through this client.
   */
  readonly auditFindings = {
    list: (query: ListAuditFindingsQuery = {}, options?: RequestOptions) =>
      this.get<AuditFindingOut[]>("/v1/audit-findings", { ...query }, options),
    /** Counts per severity, status, category and source for the same filters. */
    facets: (query: Omit<ListAuditFindingsQuery, "limit" | "offset"> = {}, options?: RequestOptions) =>
      this.get<FacetsOut>("/v1/audit-findings/facets", { ...query }, options),
    /** Open / overdue counts, mean days to close and the last 30 days (test findings excluded). */
    stats: (options?: RequestOptions) => this.get<FindingStatsOut>("/v1/audit-findings/stats", undefined, options),
    /** Add a finding by hand (scope findings:manage). */
    create: (input: AuditFindingCreate, options?: RequestOptions) =>
      this.post<AuditFindingOut>("/v1/audit-findings", input, options),
    get: async (findingId: Uuid, options?: RequestOptions) =>
      this.get<AuditFindingOut>(`/v1/audit-findings/${uuidSegment(findingId, "findingId")}`, undefined, options),
    /** Change the status (scope findings:manage); closing needs a `note`. */
    setStatus: async (findingId: Uuid, input: FindingStatusIn, options?: RequestOptions) =>
      this.post<AuditFindingOut>(`/v1/audit-findings/${uuidSegment(findingId, "findingId")}/status`, input, options),
    /** Remediation notes and status changes, oldest first. */
    notes: async (findingId: Uuid, options?: RequestOptions) =>
      this.get<AuditFindingNoteOut[]>(`/v1/audit-findings/${uuidSegment(findingId, "findingId")}/notes`, undefined, options),
    /** Add a remediation note (scope findings:manage). */
    addNote: async (findingId: Uuid, input: FindingNoteIn, options?: RequestOptions) =>
      this.post<AuditFindingNoteOut>(`/v1/audit-findings/${uuidSegment(findingId, "findingId")}/notes`, input, options),
    /** Delete a test finding (scope findings:manage); any other finding is closed, never deleted (409). */
    deleteTest: async (findingId: Uuid, options?: RequestOptions) => {
      await this.send<void>({ method: "DELETE", path: `/v1/audit-findings/${uuidSegment(findingId, "findingId")}` }, options);
    },
  };

  /**
   * The platform's global regulators registry, read-only: active regulators (DPBI, CERT-In, RBI, SEBI...) with their
   * breach / incident notification rules (who reports what, by when, with the source). Scope: config:read.
   */
  readonly regulators = {
    list: (query: ListRegulatorsQuery = {}, options?: RequestOptions) =>
      this.get<RegulatorOut[]>("/v1/regulators", { ...query }, options),
    /** One active regulator by code (e.g. "CERTIN"); 404 when unknown or archived. */
    get: async (code: string, options?: RequestOptions) =>
      this.get<RegulatorOut>(`/v1/regulators/${encodePath(code, "code")}`, undefined, options),
  };

  /**
   * Breach detections raised by the real-time engine. Scopes: breaches:read / breaches:write.
   * `escalate` records a breach (status detected) linked to the detection.
   */
  readonly detections = {
    list: (query: ListDetectionsQuery = {}, options?: RequestOptions) =>
      this.get<DetectionOut[]>("/v1/detections", { ...query }, options),
    /** Counts per status, severity and rule category for the same filters. */
    facets: (query: Omit<ListDetectionsQuery, "limit" | "offset"> = {}, options?: RequestOptions) =>
      this.get<FacetsOut>("/v1/detections/facets", { ...query }, options),
    summary: (options?: RequestOptions) => this.get<DetectionSummaryOut>("/v1/detections/summary", undefined, options),
    get: async (detectionId: Uuid, options?: RequestOptions) =>
      this.get<DetectionOut>(`/v1/detections/${uuidSegment(detectionId, "detectionId")}`, undefined, options),
    acknowledge: async (detectionId: Uuid, input: DetectionAcknowledgeIn = {}, options?: RequestOptions) =>
      this.post<DetectionOut>(`/v1/detections/${uuidSegment(detectionId, "detectionId")}/acknowledge`, input, options),
    dismiss: async (detectionId: Uuid, input: DetectionDismissIn, options?: RequestOptions) =>
      this.post<DetectionOut>(`/v1/detections/${uuidSegment(detectionId, "detectionId")}/dismiss`, input, options),
    escalate: async (detectionId: Uuid, input: DetectionEscalateIn = {}, options?: RequestOptions) =>
      this.post<DetectionOut>(`/v1/detections/${uuidSegment(detectionId, "detectionId")}/escalate`, input, options),
    /** The platform's rule library with your organisation's overrides. */
    rules: (options?: RequestOptions) => this.get<DetectionRuleOrgOut[]>("/v1/detection-rules", undefined, options),
    /** Switch a rule on/off for your organisation or scale its threshold. Both null: back to the default. */
    overrideRule: async (ruleId: Uuid, input: DetectionRuleOverrideIn, options?: RequestOptions) =>
      this.put<DetectionRuleOrgOut>(`/v1/detection-rules/${uuidSegment(ruleId, "ruleId")}/override`, input, options),
  };

  /** Versioned, multilingual consent notices. Scopes: config:read / config:write. */
  readonly notices = {
    list: (query: ListNoticesQuery = {}, options?: RequestOptions) =>
      this.get<NoticeOut[]>("/v1/notices", { ...query }, options),
    publish: (input: NoticeIn, options?: RequestOptions) => this.post<NoticeOut>("/v1/notices", input, options),
    get: async (noticeId: Uuid, options?: RequestOptions) =>
      this.get<NoticeOut>(`/v1/notices/${uuidSegment(noticeId, "noticeId")}`, undefined, options),
  };

  /** Consent artefacts and the processing gate. */
  readonly consents = {
    /** Scope consents:write. One artefact per purpose. Idempotent across retries. */
    grant: (input: ConsentGrantIn, options?: RequestOptions) =>
      this.postIdempotent<ConsentOut[]>("/v1/consents", input, options),
    list: (query: ListConsentsQuery = {}, options?: RequestOptions) =>
      this.get<ConsentOut[]>("/v1/consents", { ...query }, options),
    /** Counts per status (active / expired / withdrawn / superseded) and channel for the same filters. */
    facets: (query: Omit<ListConsentsQuery, "limit" | "offset"> = {}, options?: RequestOptions) =>
      this.get<FacetsOut>("/v1/consents/facets", { ...query }, options),
    get: async (consentId: Uuid, options?: RequestOptions) =>
      this.get<ConsentOut>(`/v1/consents/${uuidSegment(consentId, "consentId")}`, undefined, options),
    withdraw: async (consentId: Uuid, input: ConsentWithdrawIn = {}, options?: RequestOptions) =>
      this.post<ConsentOut>(`/v1/consents/${uuidSegment(consentId, "consentId")}/withdraw`, input, options),
    /**
     * Processing gate (scope consents:check): "may I process this purpose for this person now?"
     * Fail closed: treat any thrown error as `allowed: false`.
     */
    check: (input: ConsentCheckIn, options?: RequestOptions) =>
      this.post<ConsentCheckOut>("/v1/consents/check", input, options),
    /** Hash-chained ledger events for one consent. */
    events: async (consentId: Uuid, options?: RequestOptions) =>
      this.get<ConsentEventOut[]>(`/v1/consents/${uuidSegment(consentId, "consentId")}/events`, undefined, options),
    /** Recompute the hash chain server-side. */
    verify: async (consentId: Uuid, options?: RequestOptions) =>
      this.get<LedgerVerification>(`/v1/consents/${uuidSegment(consentId, "consentId")}/verify`, undefined, options),
    /** Check an anchor (`ledger_hash` from `check`) recorded at the time the data was used. */
    verifyAnchor: async (consentId: Uuid, ledgerHash: string, options?: RequestOptions) =>
      this.get<LedgerAnchorVerification>(
        `/v1/consents/${uuidSegment(consentId, "consentId")}/anchors/${ledgerHashSegment(ledgerHash)}`, undefined, options,
      ),
  };

  /** Rights requests (ss.11–14). Scopes: requests:read / requests:write. */
  readonly dataRequests = {
    /** Idempotent across retries. */
    create: (input: DataRequestIn, options?: RequestOptions) =>
      this.postIdempotent<DataRequestOut>("/v1/data-requests", input, options),
    list: (query: ListDataRequestsQuery = {}, options?: RequestOptions) =>
      this.get<DataRequestOut[]>("/v1/data-requests", { ...query }, options),
    /** Counts per status, request type and channel for the same filters. */
    facets: (query: Omit<ListDataRequestsQuery, "limit" | "offset"> = {}, options?: RequestOptions) =>
      this.get<FacetsOut>("/v1/data-requests/facets", { ...query }, options),
    get: async (requestId: Uuid, options?: RequestOptions) =>
      this.get<DataRequestOut>(`/v1/data-requests/${uuidSegment(requestId, "requestId")}`, undefined, options),
    transition: async (requestId: Uuid, input: DataRequestTransitionIn, options?: RequestOptions) =>
      this.post<DataRequestOut>(`/v1/data-requests/${uuidSegment(requestId, "requestId")}/transition`, input, options),
    events: async (requestId: Uuid, options?: RequestOptions) =>
      this.get<DataRequestEventOut[]>(`/v1/data-requests/${uuidSegment(requestId, "requestId")}/events`, undefined, options),
  };

  /**
   * Mint / revoke short-lived `cps_…` tokens for browser and mobile SDKs. Scope sessions:mint.
   * Use `acting_as: "guardian"` for a child or a person with disability (s.9); `capabilities` narrows the token.
   */
  /**
   * Your organisation's team (scope members:manage): who can sign in to the portal and with which role.
   * The last Admin cannot be removed or demoted.
   */
  readonly members = {
    list: (options?: RequestOptions) => this.get<MembersOut>("/v1/members", undefined, options),
    invite: (input: InvitationCreate, options?: RequestOptions) =>
      this.post<InvitationOut>("/v1/members/invitations", input, options),
    revokeInvitation: async (invitationId: Uuid, options?: RequestOptions) =>
      this.post<InvitationOut>(`/v1/members/invitations/${uuidSegment(invitationId, "invitationId")}/revoke`, {}, options),
    /**
     * Email the invited person a sign-in link through your organisation's email sender (else the deployment's
     * default relay). `status: "not_configured"` when neither exists: share the link yourself.
     */
    emailInvitation: async (invitationId: Uuid, input: InvitationEmailIn = {}, options?: RequestOptions) =>
      this.post<EmailSendOut>(`/v1/members/invitations/${uuidSegment(invitationId, "invitationId")}/email`, input, options),
    linkClerkInvitation: async (invitationId: Uuid, input: ClerkInvitationIn, options?: RequestOptions) =>
      this.post<unknown>(
        `/v1/members/invitations/${uuidSegment(invitationId, "invitationId")}/clerk-invitation`, input, options,
      ),
    revoke: async (membershipId: Uuid, options?: RequestOptions) =>
      this.post<MemberOut>(`/v1/members/${uuidSegment(membershipId, "membershipId")}/revoke`, {}, options),
    setRole: async (membershipId: Uuid, input: MemberRoleIn, options?: RequestOptions) =>
      this.post<MemberOut>(`/v1/members/${uuidSegment(membershipId, "membershipId")}/role`, input, options),
  };

  readonly principalSessions = {
    /** Call only after YOUR backend has authenticated the customer. */
    create: (input: PrincipalSessionCreate, options?: RequestOptions) =>
      this.post<PrincipalSessionOut>("/v1/principal-sessions", input, options),
    revoke: async (sessionId: Uuid, options?: RequestOptions) =>
      this.post<void>(`/v1/principal-sessions/${uuidSegment(sessionId, "sessionId")}/revoke`, undefined, options),
  };

  /** PII-free audit trail feed for your lakehouse. Scope audit:read. */
  readonly audit = {
    /** Events with `seq > after`, oldest first. */
    events: (query: AuditEventsQuery = {}, options?: RequestOptions) =>
      this.get<AuditPage>("/v1/audit/events", { ...query }, options),
    /** Iterate every event after `after`, page by page. */
    all: (after = 0, options?: RequestOptions): AsyncGenerator<AuditEventOut> => {
      const events = this.audit.events;
      return (async function* () {
        for (;;) {
          const page = await events({ after, limit: 1000 }, options);
          yield* page.events;
          if (!page.has_more) return;
          after = page.next_after;
        }
      })();
    },
  };

  /**
   * Signed ledger checkpoints (created by the operator's `python -m app.ledger_admin checkpoint`).
   * Verify proofs offline with scripts/verify_checkpoint.py against keys pinned out of band.
   */
  readonly ledger = {
    /** Scope consents:read. Checkpoints with `number > after`, oldest first. */
    checkpoints: (query: { after?: number; limit?: number } = {}, options?: RequestOptions) =>
      this.get<LedgerCheckpointOut[]>("/v1/ledger/checkpoints", { ...query }, options),
    /**
     * Scope consents:read. Inclusion proof for the consent's latest ledger event covered by `checkpointId`
     * (409 if not yet checkpointed, or if the database no longer matches the signed root).
     */
    proof: async (checkpointId: Uuid, consentId: Uuid, options?: RequestOptions) =>
      this.get<LedgerProof>(
        `/v1/ledger/checkpoints/${uuidSegment(checkpointId, "checkpointId")}/proof`,
        { consent_id: uuidSegment(consentId, "consentId") },
        options,
      ),
    /** Signing public keys (no scope needed). Pin them out of band for real verification. */
    publicKeys: (options?: RequestOptions) => this.get<LedgerPublicKeys>("/v1/ledger/public-key", undefined, options),
  };

  /**
   * PII vault. Store opaque tokens instead of personal data; values are released only for a
   * purpose with a lawful basis whose declared data categories include the field.
   */
  readonly vault = {
    /** Scope vault:write. Idempotent across retries. */
    tokenize: (input: VaultTokenizeIn, options?: RequestOptions) =>
      this.postIdempotent<VaultTokenizeOut>("/v1/vault/tokens", input, options),
    /** Scope vault:read. Per-token results; denied tokens carry a `reason`. Every call is audited. */
    detokenize: (input: VaultDetokenizeIn, options?: RequestOptions) =>
      this.post<VaultDetokenizeOut>("/v1/vault/detokenize", input, options),
  };

  /**
   * Legal holds and retention status. Scope retention:manage. A hold preserves an erased
   * principal's legally retained vault data past its retention period; it never authorises use.
   */
  readonly retention = {
    placeHold: (input: LegalHoldIn, options?: RequestOptions) =>
      this.post<LegalHoldOut>("/v1/retention/holds", input, options),
    listHolds: (query: ListLegalHoldsQuery = {}, options?: RequestOptions) =>
      this.get<LegalHoldOut[]>("/v1/retention/holds", { ...query }, options),
    /** Counts per state (active / released) and basis for the same filters. */
    holdFacets: (query: Omit<ListLegalHoldsQuery, "limit" | "offset"> = {}, options?: RequestOptions) =>
      this.get<FacetsOut>("/v1/retention/holds/facets", { ...query }, options),
    getHold: async (holdId: Uuid, options?: RequestOptions) =>
      this.get<LegalHoldOut>("/v1/retention/holds/" + uuidSegment(holdId, "holdId"), undefined, options),
    /** One-way. With no other active hold, retained data already past retention is shredded. */
    releaseHold: async (holdId: Uuid, input: LegalHoldReleaseIn, options?: RequestOptions) =>
      this.post<LegalHoldReleaseOut>("/v1/retention/holds/" + uuidSegment(holdId, "holdId") + "/release", input, options),
    /** The hold's notes and retain-until extensions, oldest first. */
    listHoldNotes: async (holdId: Uuid, options?: RequestOptions) =>
      this.get<LegalHoldNoteOut[]>("/v1/retention/holds/" + uuidSegment(holdId, "holdId") + "/notes", undefined, options),
    principalStatus: async (principalId: Uuid, options?: RequestOptions) =>
      this.get<RetentionStatusOut>("/v1/retention/principals/" + uuidSegment(principalId, "principalId"), undefined, options),
  };

  /**
   * Personal data breach response (DPDP s.8(6), Rules r.7). Scopes: breaches:read / breaches:write.
   * See docs/breach-response.md for the DPO runbook.
   */
  readonly breaches = {
    /** Record a breach as soon as you become aware of it (`detected_at` starts the Board clock). */
    create: (input: BreachCreate, options?: RequestOptions) => this.post<BreachOut>("/v1/breaches", input, options),
    list: (query: ListBreachesQuery = {}, options?: RequestOptions) =>
      this.get<BreachOut[]>("/v1/breaches", { ...query }, options),
    /** Counts per status and containment state for the same filters. */
    facets: (query: Omit<ListBreachesQuery, "limit" | "offset"> = {}, options?: RequestOptions) =>
      this.get<FacetsOut>("/v1/breaches/facets", { ...query }, options),
    /** The regulators this breach was notified to, by rule. */
    regulatorNotifications: async (breachId: Uuid, options?: RequestOptions) =>
      this.get<RegulatorNotificationOut[]>(
        `/v1/breaches/${uuidSegment(breachId, "breachId")}/regulator-notifications`, undefined, options,
      ),
    /** Mark the breach notified to a regulator rule's regulator (again: corrects the time / reference). */
    markRegulatorNotified: async (breachId: Uuid, ruleId: Uuid, input: RegulatorNotificationIn = {}, options?: RequestOptions) =>
      this.put<RegulatorNotificationOut>(
        `/v1/breaches/${uuidSegment(breachId, "breachId")}/regulator-notifications/${uuidSegment(ruleId, "ruleId")}`,
        input,
        options,
      ),
    get: async (breachId: Uuid, options?: RequestOptions) =>
      this.get<BreachOut>(`/v1/breaches/${uuidSegment(breachId, "breachId")}`, undefined, options),
    update: async (breachId: Uuid, patch: BreachPatch, options?: RequestOptions) =>
      this.patch<BreachOut>(`/v1/breaches/${uuidSegment(breachId, "breachId")}`, patch, options),
    transition: async (breachId: Uuid, input: BreachTransitionIn, options?: RequestOptions) =>
      this.post<BreachOut>(`/v1/breaches/${uuidSegment(breachId, "breachId")}/transition`, input, options),
    events: async (breachId: Uuid, options?: RequestOptions) =>
      this.get<BreachEventOut[]>(`/v1/breaches/${uuidSegment(breachId, "breachId")}/events`, undefined, options),
    /** New versioned snapshot of the affected principals; returns counts only. */
    assessImpact: async (breachId: Uuid, input: BreachImpactIn = {}, options?: RequestOptions) =>
      this.post<BreachImpactOut>(`/v1/breaches/${uuidSegment(breachId, "breachId")}/impact`, input, options),
    latestImpact: async (breachId: Uuid, options?: RequestOptions) =>
      this.get<BreachImpactOut>(`/v1/breaches/${uuidSegment(breachId, "breachId")}/impact`, undefined, options),
    /** Freeze an initial (r.7(2)(a)) or detailed (r.7(2)(b)) Board report; check `missing_fields`. */
    generateBoardReport: async (breachId: Uuid, input: BoardReportIn, options?: RequestOptions) =>
      this.post<BoardReportOut>(`/v1/breaches/${uuidSegment(breachId, "breachId")}/board-reports`, input, options),
    listBoardReports: async (breachId: Uuid, options?: RequestOptions) =>
      this.get<BoardReportOut[]>(`/v1/breaches/${uuidSegment(breachId, "breachId")}/board-reports`, undefined, options),
    /** Record that the report was filed with the Board. A detailed report moves the breach to notified_board. */
    submitBoardReport: async (breachId: Uuid, reportId: Uuid, input: BoardReportSubmitIn = {}, options?: RequestOptions) =>
      this.post<BreachOut>(
        `/v1/breaches/${uuidSegment(breachId, "breachId")}/board-reports/${uuidSegment(reportId, "reportId")}/submit`,
        input,
        options,
      ),
    /** Render the r.7(1) intimation for every affected principal of the latest impact snapshot. */
    generateNotices: async (breachId: Uuid, options?: RequestOptions) =>
      this.post<BreachNoticesGenerated>(`/v1/breaches/${uuidSegment(breachId, "breachId")}/notices/generate`, undefined, options),
    /** Delivery batch for your messaging system; `contact` only with a key that also holds config:read. */
    listNotices: async (breachId: Uuid, query: ListBreachNoticesQuery = {}, options?: RequestOptions) =>
      this.get<BreachNoticeOut[]>(`/v1/breaches/${uuidSegment(breachId, "breachId")}/notices`, { ...query }, options),
    /**
     * Email the pending (and previously failed) intimations to the affected principals (the guardian for a child or a
     * person with a disability) through your organisation's email sender, else the deployment default. Up to 200 per
     * call: call again while `remaining` > 0.
     */
    emailNotices: async (breachId: Uuid, options?: RequestOptions) =>
      this.post<BreachNoticeEmailOut>(`/v1/breaches/${uuidSegment(breachId, "breachId")}/notices/email`, undefined, options),
    recordDeliveries: async (breachId: Uuid, input: BreachNoticeDeliveriesIn, options?: RequestOptions) =>
      this.post<BreachNoticeDeliveriesOut>(
        `/v1/breaches/${uuidSegment(breachId, "breachId")}/notices/deliveries`, input, options,
      ),
  };

  /** Never serialise the key. */
  toJSON(): Record<string, unknown> {
    return { baseUrl: this.baseUrl };
  }
}

export { ConsentApiError, ConsentError, ConsentNetworkError, ConsentSecurityError, ConsentTimeoutError } from "./errors";
export type { HttpClientOptions, RequestOptions, RetryOptions, FetchLike } from "./http";
export type * from "./types";
