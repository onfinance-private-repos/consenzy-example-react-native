// Session-server mode: the app calls the example backend
// (https://github.com/never2average/consenzy-example-session-server) for the two calls that need an org API key.
// The backend answers /session with a cps_… token and the base_url the SDK should use; the app never sees a cdm_ key.
import type { ActingAs, AppBackend, ConsentCheckResult, DemoCustomer, SessionInfo } from './types';

async function call<T>(serverUrl: string, method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${serverUrl.replace(/\/+$/, '')}${path}`, {
      method,
      headers: body === undefined ? { accept: 'application/json' } : { accept: 'application/json', 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(`Cannot reach the session server at ${serverUrl}: ${e instanceof Error ? e.message : String(e)}`);
  }
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(`${method} ${path} failed with ${res.status}: ${json?.detail ?? text}`);
  return json as T;
}

export function sessionServerBackend(serverUrl: string): AppBackend {
  return {
    kind: 'session-server',
    description: `Session server at ${serverUrl}`,
    listCustomers: () => call<DemoCustomer[]>(serverUrl, 'GET', '/demo-customers'),
    // The server derives nothing from the client in production: it must use YOUR login. This example sends the
    // external_ref because it has no login; the server checks it against an allow-list.
    mintSession: (externalRef: string, actingAs: ActingAs = 'data_principal') =>
      call<SessionInfo>(serverUrl, 'POST', '/session', { external_ref: externalRef, acting_as: actingAs }),
    checkConsent: (externalRef: string, purposeCode: string) =>
      call<ConsentCheckResult>(serverUrl, 'POST', '/consent-check', { external_ref: externalRef, purpose_code: purposeCode }),
  };
}
