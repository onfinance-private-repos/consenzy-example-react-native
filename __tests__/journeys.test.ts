// The journeys end to end against the in-app demo: the REAL ConsentSession from @onfinance/consenzy (token handling,
// Idempotency-Keys, typed errors) talking to the demo fetch, plus the React Native SDK's helpers.
import { ConsentApiError, ConsentSecurityError, ConsentSession, type CorrectionDetails, type NominationDetails } from '@onfinance/consenzy';
import { isGuardianRequiredError, validateRightsRequest } from '@onfinance/consenzy-react-native';
import { startConsentSession } from '../src/consent/startSession';
import { inAppDemoBackend } from '../src/demo/demoBackend';
import { DEMO_BASE_URL } from '../src/demo/demoFetch';
import { createMockStore, GUARDIAN_REQUIRED } from '../src/demo/mockStore';
import { sha256Hex } from '../src/demo/sha256';

const ADULT = 'CUST-DEMO-0001';
const CHILD = 'CUST-DEMO-CHILD-7';

function setup(now?: () => number) {
  const backend = inAppDemoBackend({ store: createMockStore(now) });
  return { backend, store: backend.store };
}

const purposeIds = (notice: { purposes: { id: string; code: string }[] }, ...codes: string[]) =>
  notice.purposes.filter((p) => codes.includes(p.code)).map((p) => p.id);

describe('session provider', () => {
  it('mints a cps_ session and builds a ConsentSession on the returned base_url', async () => {
    const { backend } = setup();
    const { session, info } = await startConsentSession(backend, ADULT);
    expect(info.token).toMatch(/^cps_demo_/);
    expect(info.base_url).toBe(DEMO_BASE_URL);
    expect(session.baseUrl).toBe(DEMO_BASE_URL);
    const me = await session.me();
    expect(me).toMatchObject({ external_ref: ADULT, acting_as: 'data_principal' });
    expect(me.capabilities).toEqual(['consents:write', 'requests:read', 'requests:write']);
  });

  it('refuses an org API key (cdm_) handed to the app', async () => {
    const { backend } = setup();
    const session = new ConsentSession({
      baseUrl: DEMO_BASE_URL,
      sessionProvider: async () => 'cdm_this_must_never_reach_an_app',
      fetch: backend.sdkFetch,
    });
    await expect(session.me()).rejects.toBeInstanceOf(ConsentSecurityError);
  });

  it('logout revokes the token; the next call mints a fresh one through sessionProvider', async () => {
    const { backend, store } = setup();
    const { session, info } = await startConsentSession(backend, ADULT);
    await session.me();
    await session.logout();
    expect(store.session(info.token)).toBeNull();
    await expect(session.me()).resolves.toMatchObject({ external_ref: ADULT });
  });
});

describe('journey 1: consent collection', () => {
  it('serves the notice in Hindi and falls back to English for an unpublished language', async () => {
    const { session } = await startConsentSession(setup().backend, ADULT);
    const hi = await session.currentNotice('hi');
    expect(hi.language).toBe('hi');
    expect(hi.title).toContain('डेमो बैंक');
    const ta = await session.currentNotice('ta');
    expect(ta.language).toBe('en');
    expect(ta.title).toBe('How Demo Bank uses your personal data');
    expect(ta.purposes.map((p) => p.code)).toEqual(['marketing', 'analytics', 'credit_offers']);
    expect(ta.purposes[0]).toMatchObject({ data_categories: ['name', 'email', 'phone'], retention_days: 365 });
  });

  it('records consent for exactly the selected purposes and replays an Idempotency-Key', async () => {
    const { session } = await startConsentSession(setup().backend, ADULT);
    const notice = await session.currentNotice('en');
    const input = { noticeId: notice.id, purposeIds: purposeIds(notice, 'marketing', 'analytics'), channel: 'mobile_app' as const };
    const first = await session.giveConsent(input, { idempotencyKey: 'demo-key-1' });
    expect(first.map((c) => c.purpose_code).sort()).toEqual(['analytics', 'marketing']);
    expect(first.every((c) => c.status === 'active' && c.channel === 'mobile_app')).toBe(true);
    const replay = await session.giveConsent(input, { idempotencyKey: 'demo-key-1' });
    expect(replay.map((c) => c.id)).toEqual(first.map((c) => c.id));
  });
});

describe('journey 2 + 3: consent check, grant -> list -> withdraw', () => {
  it('checks consent before processing, then withdraws it and the check fails closed again', async () => {
    const { backend } = setup();
    const { session } = await startConsentSession(backend, ADULT);
    expect(await backend.checkConsent(ADULT, 'marketing')).toMatchObject({ allowed: false, consent_id: null, ledger_hash: null });

    const notice = await session.currentNotice();
    const [marketing] = await session.giveConsent({ noticeId: notice.id, purposeIds: purposeIds(notice, 'marketing'), channel: 'mobile_app' });
    const gate = await backend.checkConsent(ADULT, 'marketing');
    expect(gate).toMatchObject({ allowed: true, basis: 'consent', consent_id: marketing!.id });
    expect(gate.ledger_hash).toMatch(/^[0-9a-f]{64}$/);

    // Granting again supersedes the earlier consent for that purpose.
    const [again] = await session.giveConsent({ noticeId: notice.id, purposeIds: purposeIds(notice, 'marketing'), channel: 'mobile_app' });
    const all = await session.listConsents();
    expect(all.find((c) => c.id === marketing!.id)?.status).toBe('superseded');
    expect(await session.listConsents({ activeOnly: true })).toHaveLength(1);

    const withdrawn = await session.withdrawConsent(again!.id, 'Too many messages');
    expect(withdrawn).toMatchObject({ status: 'withdrawn', withdrawal_reason: 'Too many messages' });
    expect(await session.listConsents({ activeOnly: true })).toHaveLength(0);
    expect((await backend.checkConsent(ADULT, 'marketing')).allowed).toBe(false);

    // Withdrawing twice is a conflict, surfaced as a typed ConsentApiError.
    await expect(session.withdrawConsent(again!.id)).rejects.toMatchObject({ status: 409 });
  });
});

describe('journey 4: rights requests and status tracking', () => {
  it('files access, correction, erasure and grievance requests and tracks their status across channels', async () => {
    let clock = Date.parse('2026-10-01T10:00:00Z');
    const { backend } = setup(() => clock);
    const { session } = await startConsentSession(backend, ADULT);

    // The seeded request arrived on WhatsApp, filed by the bank's backend.
    const seeded = await session.listDataRequests();
    expect(seeded).toHaveLength(1);
    expect(seeded[0]).toMatchObject({ request_type: 'erasure', channel: 'whatsapp', channel_reference: 'wamid.DEMO-0001', status: 'in_progress' });

    const access = validateRightsRequest('access', { note: 'Everything you hold about me' });
    const correction = validateRightsRequest('correction', { fields: [{ field: 'address_line1', value: '12 MG Road' }] });
    const erasure = validateRightsRequest('erasure', { reason: 'Closing my account' });
    if (!access.ok || !correction.ok || !erasure.ok) throw new Error('validation failed');
    const a = await session.fileDataRequest('access', access.details);
    await session.fileDataRequest('correction', correction.details as unknown as CorrectionDetails);
    await session.fileDataRequest('erasure', erasure.details);
    await session.fileDataRequest('grievance', { description: 'No reply yet', related_request_id: a.id });

    expect(a).toMatchObject({ status: 'received', channel: 'app' });
    expect(Date.parse(a.due_at) - Date.parse(a.received_at)).toBe(90 * 86_400_000);

    let list = await session.listDataRequests();
    expect(list.map((r) => r.request_type).sort()).toEqual(['access', 'correction', 'erasure', 'erasure', 'grievance']);

    clock += 25_000;
    list = await session.listDataRequests();
    expect(list.find((r) => r.id === a.id)?.status).toBe('in_progress');
    clock += 40_000;
    list = await session.listDataRequests();
    expect(list.find((r) => r.id === a.id)).toMatchObject({ status: 'completed', closed_at: expect.any(String) });
  });

  it('validates on the device and on the (demo) server', async () => {
    const { session } = await startConsentSession(setup().backend, ADULT);
    expect(validateRightsRequest('grievance', { description: '  ' })).toMatchObject({ ok: false });
    const err = await session.fileDataRequest('grievance', { description: '' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ConsentApiError);
    expect((err as ConsentApiError).status).toBe(422);
  });
});

describe('journey 5: guardian consent for a minor', () => {
  it('refuses a data_principal session (s.9) and accepts a guardian session', async () => {
    const { backend } = setup();
    const child = await startConsentSession(backend, CHILD, 'data_principal');
    const notice = await child.session.currentNotice('en');
    const input = { noticeId: notice.id, purposeIds: purposeIds(notice, 'analytics'), channel: 'mobile_app' as const };

    const refused = await child.session.giveConsent(input).catch((e: unknown) => e);
    expect(refused).toBeInstanceOf(ConsentApiError);
    expect(refused).toMatchObject({ status: 422, detail: GUARDIAN_REQUIRED });
    expect(isGuardianRequiredError(refused)).toBe(true);

    const guardian = await startConsentSession(backend, CHILD, 'guardian');
    expect(await guardian.session.me()).toMatchObject({ acting_as: 'guardian', acts_through_guardian: true, guardian_verified: true });
    const granted = await guardian.session.giveConsent(input);
    expect(granted).toHaveLength(1);
    expect((await backend.checkConsent(CHILD, 'analytics')).allowed).toBe(true);

    const nomination = validateRightsRequest('nomination', { nominee_name: 'Meera Rao', relationship: 'aunt', nominee_phone: '+91 98765 43210' });
    if (!nomination.ok) throw new Error('validation failed');
    const r = await guardian.session.fileDataRequest('nomination', nomination.details as unknown as NominationDetails);
    expect(r).toMatchObject({ request_type: 'nomination', details: { nominee_phone: '+919876543210' } });
  });

  it('cannot mint a guardian session for an adult', async () => {
    await expect(setup().backend.mintSession(ADULT, 'guardian')).rejects.toThrow('does not act through a guardian');
  });
});

it('sha256 matches the standard test vector', () => {
  expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
