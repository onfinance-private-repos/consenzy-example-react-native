// DEMO ONLY. A `fetch` implementation that answers the Consenzy principal API (/v1/me/*) from the in-memory mock
// store instead of the network.
//
// This is the seam the in-app demo uses: `ConsentSession` from @onfinance/consenzy accepts a custom `fetch` in its
// options (`new ConsentSession({ baseUrl, sessionProvider, fetch })`). Everything above this function, i.e. the real
// SDK's token handling, Idempotency-Keys, retries, typed errors and the React Native hooks and components, runs
// unchanged. Only the bytes on the wire are faked. With a real deployment you simply leave `fetch` out.
import type { FetchLike, ResponseLike } from '@onfinance/consenzy';
import type { MockStore, StoreResult } from './mockStore';

/** The base URL the demo session points the SDK at. `.invalid` is reserved, so nothing can ever resolve it. */
export const DEMO_BASE_URL = 'https://demo.consenzy.invalid';

const UUID = '[0-9a-fA-F-]{36}';

function respond(status: number, body: unknown, extraHeaders: Record<string, string> = {}): ResponseLike {
  const text = body === undefined ? '' : JSON.stringify(body);
  const headers: Record<string, string> = { 'content-type': 'application/json', ...extraHeaders };
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
    text: async () => text,
  };
}

function parseQuery(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of search.split('&')) {
    if (!part) continue;
    const [k, v = ''] = part.split('=');
    out[decodeURIComponent(k!)] = decodeURIComponent(v);
  }
  return out;
}

function page(q: Record<string, string>) {
  const limit = Math.min(Math.max(Number(q.limit ?? 50) || 50, 1), 200);
  const offset = Math.max(Number(q.offset ?? 0) || 0, 0);
  return { limit, offset };
}

/** Optional simulated latency so loading states are visible in the demo. Tests pass 0. */
export function createDemoFetch(store: MockStore, options: { latencyMs?: number } = {}): FetchLike {
  const latency = options.latencyMs ?? 0;

  return async (url, init = {}) => {
    if (latency > 0) await new Promise((resolve) => setTimeout(resolve, latency));
    const method = (init.method ?? 'GET').toUpperCase();
    const headers = Object.fromEntries(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    const body = typeof init.body === 'string' && init.body ? JSON.parse(init.body) : null;

    if (!url.startsWith(DEMO_BASE_URL)) throw new TypeError(`demo fetch only serves ${DEMO_BASE_URL}, not ${url}`);
    const rest = url.slice(DEMO_BASE_URL.length);
    const [path = '', search = ''] = rest.split('?');
    const query = parseQuery(search);

    // Bearer cps_… auth, exactly like the real API: unknown, expired or revoked tokens get a 401.
    const m = /^Bearer (cps_\S+)$/.exec(headers.authorization ?? '');
    const s = m ? store.session(m[1]!) : null;
    if (!s) return respond(401, { detail: 'invalid or expired session token' });

    const send = (r: StoreResult & { replay?: boolean }) =>
      respond(r.status, r.body, r.replay ? { 'idempotent-replay': 'true' } : {});
    const key = headers['idempotency-key'] ?? null;
    let match: RegExpExecArray | null;

    if (method === 'GET' && path === '/v1/me') return respond(200, store.me(s));
    if (method === 'GET' && path === '/v1/me/notice') return respond(200, store.notice(query.language ?? s.principal.preferred_language));
    if (method === 'GET' && path === '/v1/me/consents') {
      const { limit, offset } = page(query);
      return respond(200, store.listConsents(s, query.active_only === 'true').slice(offset, offset + limit));
    }
    if (method === 'POST' && path === '/v1/me/consents') return send(store.idempotent(s, 'consents', key, () => store.grant(s, body)));
    if (method === 'POST' && (match = new RegExp(`^/v1/me/consents/(${UUID})/withdraw$`).exec(path)))
      return send(store.withdraw(s, match[1]!, body?.reason));
    if (method === 'GET' && path === '/v1/me/data-requests') {
      const out = store.listRequests(s);
      if (out.status !== 200) return send(out);
      const { limit, offset } = page(query);
      return respond(200, (out.body as unknown[]).slice(offset, offset + limit));
    }
    if (method === 'POST' && path === '/v1/me/data-requests')
      return send(store.idempotent(s, 'data-requests', key, () => store.fileRequest(s, body)));
    if (method === 'GET' && path === '/v1/me/breach-notices') return respond(200, []);
    if (method === 'POST' && new RegExp(`^/v1/me/breach-notices/(${UUID})/acknowledge$`).test(path))
      return respond(404, { detail: 'breach notice not found' });
    if (method === 'POST' && path === '/v1/me/logout') {
      store.logout(m![1]!);
      return respond(204, undefined);
    }
    return respond(404, { detail: 'not found' });
  };
}
