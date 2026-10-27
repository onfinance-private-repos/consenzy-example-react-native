// The session/token provider: how the app gets a principal session token (cps_…) from its backend and builds the
// SDK's ConsentSession around it. The org API key (cdm_…) never appears here: it stays on the backend.
import { ConsentSession, type SessionToken } from '@onfinance/consenzy';
import type { ActingAs, AppBackend, SessionInfo } from '../backend/types';

export interface StartedSession {
  /** The SDK's core client for /v1/me/*. */
  session: ConsentSession;
  /** The first /session answer (token, base_url, acting_as, capabilities, expires_at). */
  info: SessionInfo;
  /** For ConsentProvider's baseUrl + sessionProvider form: returns a fresh cps_… token each call after the first. */
  getToken: () => Promise<string>;
}

/**
 * Mint the first session up front, because its answer tells us the base URL to give the SDK. After that the SDK's
 * `sessionProvider` asks the backend again whenever the token is missing, about to expire (expires_at minus 30 s)
 * or rejected with 401.
 */
export async function startConsentSession(backend: AppBackend, externalRef: string, actingAs: ActingAs = 'data_principal'): Promise<StartedSession> {
  const info = await backend.mintSession(externalRef, actingAs);
  let firstToken: SessionInfo | null = info;
  const nextToken = async (): Promise<SessionInfo> => {
    const s = firstToken ?? (await backend.mintSession(externalRef, actingAs));
    firstToken = null;
    return s;
  };

  const sessionProvider = async (): Promise<SessionToken> => {
    const s = await nextToken();
    return { token: s.token, expires_at: s.expires_at };
  };

  const session = new ConsentSession({
    baseUrl: info.base_url,
    sessionProvider,
    // In-app demo only: answer /v1/me/* from the in-memory mock. Real deployments leave this out.
    ...(backend.sdkFetch ? { fetch: backend.sdkFetch } : {}),
  });

  return { session, info, getToken: async () => (await nextToken()).token };
}
