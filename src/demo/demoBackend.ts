// DEMO ONLY. The in-app demo's stand-in for "your backend": it mints sessions and checks consent against the
// in-memory mock store, and hands the SDK a fetch that serves /v1/me/* from the same store. No network, no keys.
import type { ActingAs, AppBackend, ConsentCheckResult, DemoCustomer, SessionInfo } from '../backend/types';
import { DEMO_BASE_URL, createDemoFetch } from './demoFetch';
import { createMockStore, type MintedSession, type MockStore } from './mockStore';

function unwrap<T>(r: { status: number; body: unknown }): T {
  if (r.status >= 300) {
    const detail = (r.body as { detail?: unknown } | null)?.detail;
    throw new Error(typeof detail === 'string' ? detail : `demo backend error ${r.status}`);
  }
  return r.body as T;
}

export function inAppDemoBackend(options: { store?: MockStore; latencyMs?: number } = {}): AppBackend & { store: MockStore } {
  const store = options.store ?? createMockStore();
  return {
    kind: 'in-app-demo',
    description: 'In-app demo (synthetic data, no network)',
    store,
    sdkFetch: createDemoFetch(store, { latencyMs: options.latencyMs ?? 0 }),
    listCustomers: async () =>
      store.fixtures.principals.map(
        ({ external_ref, label, acts_through_guardian }): DemoCustomer => ({ external_ref, label, acts_through_guardian }),
      ),
    mintSession: async (externalRef: string, actingAs: ActingAs = 'data_principal'): Promise<SessionInfo> => {
      const s = unwrap<MintedSession>(store.mint({ external_ref: externalRef, acting_as: actingAs, ttl_seconds: 900 }));
      return {
        token: s.token,
        base_url: DEMO_BASE_URL,
        principal_id: s.principal_id,
        acting_as: s.acting_as,
        capabilities: s.capabilities,
        expires_at: s.expires_at,
        mode: 'in-app-demo',
      };
    },
    checkConsent: async (externalRef: string, purposeCode: string) =>
      unwrap<ConsentCheckResult>(store.check({ external_ref: externalRef, purpose_code: purposeCode })),
  };
}
