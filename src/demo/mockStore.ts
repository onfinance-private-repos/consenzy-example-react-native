// DEMO ONLY. An in-memory stand-in for Consenzy, ported from the shared example session server's demo mode
// (github.com/never2average/consenzy-example-session-server, src/mock.js) so every example app behaves the same.
//
// It holds the synthetic principals, notice and requests from ./fixtures.json and implements:
//   - the two org-key calls a real backend makes (mint a principal session, check consent), and
//   - the principal API the SDK calls (/v1/me/*): notice with en/hi and English fallback, grant with supersede,
//     Idempotency-Key replay, withdraw, rights requests with validation and time-based status progression,
//     the DPDP s.9 guardian rule, session capabilities and logout.
// Nothing here talks to a network and nothing here is needed with a real Consenzy deployment.
import { uuidv4 } from '@onfinance/consenzy';
import fixtures from './fixtures.json';
import { sha256Hex } from './sha256';

export const ALL_CAPABILITIES = ['consents:write', 'requests:read', 'requests:write'] as const;
export const REQUEST_TYPES = ['access', 'correction', 'completion', 'updating', 'erasure', 'grievance', 'nomination'];
export const GUARDIAN_REQUIRED =
  'this principal acts through a guardian: the session must be minted with acting_as=guardian (s.9)';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY_MS = 86_400_000;

export type ActingAs = 'data_principal' | 'guardian';
export type Fixtures = typeof fixtures;
export type DemoPrincipal = Fixtures['principals'][number];

/** `{ status, body }`, the shape every store operation answers with (an HTTP response without the HTTP). */
export interface StoreResult {
  status: number;
  body: unknown;
}

export interface MintedSession {
  token: string;
  session_id: string;
  principal_id: string;
  expires_at: string;
  acting_as: ActingAs;
  capabilities: string[];
  application_id: null;
}

export interface ConsentCheckResult {
  allowed: boolean;
  basis: 'consent' | 'legitimate_use' | null;
  consent_id: string | null;
  expires_at: string | null;
  ledger_event_id: number | null;
  ledger_hash: string | null;
}

interface SessionRow extends MintedSession {
  principal: DemoPrincipal;
  revoked: boolean;
}

type Row = Record<string, unknown>;

interface ConsentRow extends Row {
  id: string;
  purpose_code: string;
  status: string;
  created_at: string;
  expires_at: string | null;
  _ref: string;
  _ledgerEventId: number;
  _ledgerHash: string;
}

interface RequestRow extends Row {
  request_type: string;
  status: string;
  received_at: string;
  closed_at: string | null;
  response: Record<string, unknown> | null;
  updated_at: string;
  _ref: string;
  _receivedMs: number;
  _fixedStatus: string | null;
}

const iso = (ms: number) => new Date(ms).toISOString();
const publicRow = (row: Row) => Object.fromEntries(Object.entries(row).filter(([k]) => !k.startsWith('_')));

export function createMockStore(now: () => number = () => Date.now()) {
  const sessions = new Map<string, SessionRow>();
  const consents: ConsentRow[] = [];
  const requests: RequestRow[] = [];
  const idempotency = new Map<string, StoreResult>();

  const principalByRef = (ref: string) => fixtures.principals.find((p) => p.external_ref === ref) ?? null;
  const findPrincipal = (ref?: string, id?: string) =>
    ref ? principalByRef(ref) : (fixtures.principals.find((p) => p.principal_id === id) ?? null);

  function dataRequestRow(
    p: DemoPrincipal,
    type: string,
    details: Record<string, unknown>,
    channel: string,
    channelReference: string | null,
    receivedMs: number,
    id: string = uuidv4(),
    fixedStatus: string | null = null,
  ): RequestRow {
    return {
      id,
      principal_id: p.principal_id,
      request_type: type,
      status: fixedStatus ?? 'received',
      channel,
      channel_reference: channelReference,
      details,
      response: null,
      assigned_to: null,
      due_at: iso(receivedMs + fixtures.request_sla_days * DAY_MS),
      received_at: iso(receivedMs),
      closed_at: null,
      created_at: iso(receivedMs),
      updated_at: iso(receivedMs),
      api_key_id: null,
      _ref: p.external_ref,
      _receivedMs: receivedMs,
      _fixedStatus: fixedStatus,
    };
  }

  for (const seed of fixtures.seed_data_requests) {
    const p = principalByRef(seed.external_ref);
    if (!p) continue;
    const receivedMs = now() - seed.received_days_ago * DAY_MS;
    requests.push(
      dataRequestRow(p, seed.request_type, seed.details, seed.channel, seed.channel_reference, receivedMs, seed.id, seed.status),
    );
  }

  // Demo requests move on by themselves so the status-tracking screen has something to show.
  function progressed(row: RequestRow): RequestRow {
    if (row._fixedStatus) return row;
    const age = (now() - row._receivedMs) / 1000;
    const { in_progress: ip, completed: done } = fixtures.status_progression_seconds;
    if (age >= done) {
      row.status = 'completed';
      row.closed_at ??= iso(row._receivedMs + done * 1000);
      row.response ??= { summary: `Demo: your ${row.request_type} request was completed.` };
      row.updated_at = row.closed_at;
    } else if (age >= ip) {
      row.status = 'in_progress';
      row.updated_at = iso(row._receivedMs + ip * 1000);
    }
    return row;
  }

  const lacks = (s: SessionRow, cap: string): StoreResult | null =>
    s.capabilities.includes(cap) ? null : { status: 403, body: { detail: `session lacks the ${cap} capability` } };

  return {
    fixtures,

    /** What POST /v1/principal-sessions does (org key with sessions:mint). */
    mint({
      external_ref,
      principal_id,
      acting_as = 'data_principal',
      capabilities,
      ttl_seconds = 900,
    }: {
      external_ref?: string;
      principal_id?: string;
      acting_as?: ActingAs;
      capabilities?: string[];
      ttl_seconds?: number;
    }): StoreResult {
      const p = findPrincipal(external_ref, principal_id);
      if (!p) return { status: 404, body: { detail: 'principal not found' } };
      if (acting_as === 'guardian' && !p.acts_through_guardian)
        return { status: 422, body: { detail: 'principal does not act through a guardian' } };
      const caps = capabilities ?? [...ALL_CAPABILITIES];
      if (caps.some((c) => !(ALL_CAPABILITIES as readonly string[]).includes(c)))
        return { status: 403, body: { detail: 'cannot grant capabilities the minting key lacks' } };
      const session: MintedSession = {
        token: `cps_demo_${uuidv4().replace(/-/g, '')}`,
        session_id: uuidv4(),
        principal_id: p.principal_id,
        expires_at: iso(now() + ttl_seconds * 1000),
        acting_as,
        capabilities: [...caps].sort(),
        application_id: null,
      };
      sessions.set(session.token, { ...session, principal: p, revoked: false });
      return { status: 201, body: session };
    },

    /** What POST /v1/consents/check does (org key with consents:check). */
    check({ external_ref, principal_id, purpose_code }: { external_ref?: string; principal_id?: string; purpose_code: string }): StoreResult {
      const p = findPrincipal(external_ref, principal_id);
      if (!p) return { status: 404, body: { detail: 'principal not found' } };
      const c = consents.find((r) => r._ref === p.external_ref && r.purpose_code === purpose_code && r.status === 'active');
      const body: ConsentCheckResult = c
        ? { allowed: true, basis: 'consent', consent_id: c.id, expires_at: c.expires_at, ledger_event_id: c._ledgerEventId, ledger_hash: c._ledgerHash }
        : { allowed: false, basis: null, consent_id: null, expires_at: null, ledger_event_id: null, ledger_hash: null };
      return { status: 200, body };
    },

    session(token: string): SessionRow | null {
      const s = sessions.get(token);
      if (!s || s.revoked || Date.parse(s.expires_at) <= now()) return null;
      return s;
    },

    logout(token: string) {
      const s = sessions.get(token);
      if (s) s.revoked = true;
    },

    me(s: SessionRow) {
      const p = s.principal;
      return {
        principal_id: p.principal_id,
        external_ref: p.external_ref,
        preferred_language: p.preferred_language,
        acts_through_guardian: p.acts_through_guardian,
        guardian_verified: p.guardian_verified,
        acting_as: s.acting_as,
        capabilities: s.capabilities,
      };
    },

    /** The notice in `language`, or English when that language is not published (the server's fallback). */
    notice(language: string) {
      const translations = fixtures.notice.translations as Record<string, (typeof fixtures.notice.translations)['en']>;
      const lang = translations[language] ? language : 'en';
      const tr = translations[lang]!;
      return {
        id: fixtures.notice.id,
        version: fixtures.notice.version,
        language: lang,
        title: tr.title,
        body: tr.body,
        purposes: fixtures.purposes.map((pp) => {
          const text = tr.purposes[pp.code as keyof typeof tr.purposes];
          return {
            id: pp.id,
            code: pp.code,
            name: text.name,
            description: text.description,
            data_categories: pp.data_categories,
            retention_days: pp.retention_days,
          };
        }),
      };
    },

    listConsents(s: SessionRow, activeOnly: boolean) {
      return consents
        .filter((c) => c._ref === s.principal.external_ref && (!activeOnly || c.status === 'active'))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map(publicRow);
    },

    grant(s: SessionRow, body: { notice_id?: unknown; purpose_ids?: unknown; channel?: string; expires_at?: string } | null): StoreResult {
      const denied = lacks(s, 'consents:write');
      if (denied) return denied;
      if (s.principal.acts_through_guardian && s.acting_as !== 'guardian') return { status: 422, body: { detail: GUARDIAN_REQUIRED } };
      if (body?.notice_id !== fixtures.notice.id) return { status: 404, body: { detail: 'notice not found' } };
      const ids = body.purpose_ids;
      if (!Array.isArray(ids) || ids.length === 0)
        return { status: 422, body: { detail: [{ loc: ['body', 'purpose_ids'], msg: 'List should have at least 1 item', type: 'too_short' }] } };
      const purposes = ids.map((id) => fixtures.purposes.find((pp) => pp.id === id));
      if (purposes.some((pp) => !pp)) return { status: 422, body: { detail: 'purpose not in notice' } };
      const t = now();
      const out = purposes.map((pp) => {
        const purpose = pp!;
        for (const old of consents) {
          if (old._ref === s.principal.external_ref && old.purpose_code === purpose.code && old.status === 'active') {
            old.status = 'superseded';
            old.updated_at = iso(t);
          }
        }
        const id = uuidv4();
        const row: ConsentRow = {
          id,
          principal_id: s.principal.principal_id,
          purpose_id: purpose.id,
          purpose_code: purpose.code,
          notice_id: fixtures.notice.id,
          status: 'active',
          channel: body.channel ?? 'mobile_app',
          consent_manager_ref: null,
          application_id: null,
          given_at: iso(t),
          expires_at: body.expires_at ?? null,
          withdrawn_at: null,
          withdrawal_reason: null,
          created_at: iso(t),
          updated_at: iso(t),
          _ref: s.principal.external_ref,
          _ledgerEventId: consents.length + 1,
          _ledgerHash: sha256Hex(`${id}:${t}`),
        };
        consents.push(row);
        return publicRow(row);
      });
      return { status: 201, body: out };
    },

    withdraw(s: SessionRow, consentId: string, reason?: string): StoreResult {
      const denied = lacks(s, 'consents:write');
      if (denied) return denied;
      const c = consents.find((r) => r.id === consentId && r._ref === s.principal.external_ref);
      if (!c) return { status: 404, body: { detail: 'consent not found' } };
      if (c.status !== 'active') return { status: 409, body: { detail: 'consent is not active' } };
      const t = iso(now());
      Object.assign(c, { status: 'withdrawn', withdrawn_at: t, withdrawal_reason: reason ?? null, updated_at: t });
      return { status: 200, body: publicRow(c) };
    },

    listRequests(s: SessionRow): StoreResult {
      const denied = lacks(s, 'requests:read');
      if (denied) return denied;
      const rows = requests
        .filter((r) => r._ref === s.principal.external_ref)
        .map(progressed)
        .sort((a, b) => b.received_at.localeCompare(a.received_at))
        .map(publicRow);
      return { status: 200, body: rows };
    },

    fileRequest(s: SessionRow, body: { request_type?: unknown; details?: Record<string, unknown>; channel?: string } | null): StoreResult {
      const denied = lacks(s, 'requests:write');
      if (denied) return denied;
      const type = body?.request_type;
      if (typeof type !== 'string' || !REQUEST_TYPES.includes(type))
        return {
          status: 422,
          body: { detail: [{ loc: ['body', 'request_type'], msg: `Input should be ${REQUEST_TYPES.join(', ')}`, type: 'literal_error' }] },
        };
      const details = body?.details ?? {};
      const problem = validateDetails(type, details);
      if (problem)
        return { status: 422, body: { detail: [{ loc: ['body', 'details', problem.field], msg: problem.msg, type: 'value_error' }] } };
      const row = dataRequestRow(s.principal, type, details, body?.channel ?? 'app', null, now());
      requests.push(row);
      return { status: 201, body: publicRow(row) };
    },

    /** Idempotency-Key replay: the same key on the same endpoint returns the stored response. */
    idempotent(s: SessionRow, endpoint: string, key: string | null, run: () => StoreResult): StoreResult & { replay?: boolean } {
      if (!key) return run();
      const k = `${s.principal.principal_id}:${endpoint}:${key}`;
      const stored = idempotency.get(k);
      if (stored) return { ...stored, replay: true };
      const res = run();
      if (res.status < 300) idempotency.set(k, res);
      return res;
    },
  };
}

export type MockStore = ReturnType<typeof createMockStore>;

function validateDetails(type: string, d: Record<string, unknown>): { field: string; msg: string } | null {
  const short = (v: unknown) => v == null || (typeof v === 'string' && v.length <= 500);
  switch (type) {
    case 'access':
      return short(d.note) ? null : { field: 'note', msg: 'String should have at most 500 characters' };
    case 'correction':
    case 'completion':
    case 'updating': {
      const f = d.fields;
      if (!f || typeof f !== 'object' || Object.keys(f).length === 0) return { field: 'fields', msg: 'Dictionary should have at least 1 item' };
      const bad = Object.keys(f).find((k) => !/^[a-z][a-z0-9_]{0,63}$/.test(k));
      return bad ? { field: 'fields', msg: `invalid field name: ${bad}` } : null;
    }
    case 'erasure':
      return short(d.reason) ? null : { field: 'reason', msg: 'String should have at most 500 characters' };
    case 'grievance':
      if (typeof d.description !== 'string' || d.description.trim() === '') return { field: 'description', msg: 'Field required' };
      if (d.related_request_id != null && !UUID_RE.test(String(d.related_request_id)))
        return { field: 'related_request_id', msg: 'Input should be a valid UUID' };
      return null;
    case 'nomination':
      if (!d.nominee_name) return { field: 'nominee_name', msg: 'Field required' };
      if (!d.relationship) return { field: 'relationship', msg: 'Field required' };
      if (!d.nominee_email && !d.nominee_phone) return { field: 'nominee_email', msg: 'nominee_email or nominee_phone is required' };
      return null;
    default:
      return null;
  }
}
