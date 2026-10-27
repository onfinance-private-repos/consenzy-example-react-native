# Changelog

All notable changes to `@onfinance/consenzy` are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the package uses
[Semantic Versioning](https://semver.org/).

## Unreleased

- `auditFindings`: list (with `severity`, `status`, `open`, `category`, `overdue`, `linked`, `source`, `test`
  filters), `facets`, `stats`, `create`, `get`, `setStatus`, `notes`, `addNote`, `deleteTest` (scopes
  `findings:read` / `findings:manage`). Types `AuditFindingOut`, `AuditFindingCreate`, `FindingStatsOut` and
  friends; `Scope` gains `findings:read` / `findings:manage`; `OrganizationOverviewOut.findings`.
- `breaches.emailNotices(id)`: email the pending intimations through the organisation's email sender
  (`BreachNoticeEmailOut`). `members.emailInvitation(id, { sign_in_url })` (`EmailSendOut`).
- `RegulatorOut` gains `dpdp_relevance`, `dpdp_role`, `processes`, `last_reviewed_on`; `RegulatorRuleOut` gains
  `title`, `obligation_type`, `applies_to_class`, `process`, `timer`, `deadline_from: "receipt"` and the `draft`
  status.
- The drift tests share one list of endpoints outside the SDK, each with its reason (`tests/sdk-surface.ts`): the
  operator's API, portal-only scopes and portal-member endpoints (workflows, notifications, email sender,
  integrations, journeys) and the investigation platform's signed push.
- List filters (server migration 0027): every list method takes the new filters, and a list parameter given an
  array is repeated (`consents.list({ status: ["active", "expired"] })`). Consents: `expired`, `notice_id`,
  `channel`, `given_*` / `withdrawn_*` ranges, `expires_before`, `application_id`, `principal_is_child`; data
  requests: `open`, `due_before`, `assigned_to` / `unassigned`, `received_*` / `closed_*`, `api_key_id`,
  `application_id`; principals, breaches, detections, legal holds, controls (`owner`, `attributes` as
  `attr.<key>`) and `audit.events` (`event_type`, `since` / `until`, principal, key, application, actor,
  purpose, consent, request, `order: "desc"` with `before` / `next_before`) likewise.
- `consents.facets`, `dataRequests.facets`, `breaches.facets`, `detections.facets`, `retention.holdFacets`:
  counts per status / type for the same filters (`FacetsOut`). `controls.owners()`.
- `breaches.regulatorNotifications(id)` / `breaches.markRegulatorNotified(id, ruleId, { reference })`.
- `ConsentOut.application_id`, `DataRequestOut.api_key_id`.
- `apiKeys.updateScopes(id, scopes)`: replace a key's scopes (PATCH /v1/api-keys/{id}; audited as
  `key.scopes_changed`).
- `apiKeys.usage(id, { days })`: a key's requests per UTC day, top routes and status classes
  (GET /v1/api-keys/{id}/usage). Types `ApiKeyScopesPatch`, `ApiKeyUsageOut` and friends.
- Rights requests record the channel they arrived on: `dataRequests.create` accepts `channel`
  (`RequestChannel`) and `channel_reference`, `dataRequests.list` filters by `channel`, and
  `DataRequestOut` has `channel` and `channel_reference`.
- `ConsentSession.fileDataRequest(type, details, { channel })` takes an optional `"web" | "app"`
  channel (`MeRequestChannel`); `<cdm-rights-request>` and `mountRightsRequest` send `"web"` by
  default, or `"app"` via the `channel` attribute / option.
- `regulators.list(query)` / `regulators.get(code)`: the platform's read-only regulators registry with each
  regulator's breach / incident notification rules and sources (GET /v1/regulators, scope `config:read`). Types
  `RegulatorOut`, `RegulatorRuleOut`, `ListRegulatorsQuery`.

## 0.1.0

First public release, under the Apache License 2.0 (previously distributed privately as
`@onfinance/consent-sdk`).

- `@onfinance/consenzy`: `ConsentSession`, the principal-session client for browsers, React Native
  and Node (`/v1/me/*`).
- `@onfinance/consenzy/server`: `ConsentServerClient`, the org-key client for your backend.
- `@onfinance/consenzy/widget`: the `<cdm-consent-banner>`, `<cdm-consent-manager>` and
  `<cdm-rights-request>` Web Components.
