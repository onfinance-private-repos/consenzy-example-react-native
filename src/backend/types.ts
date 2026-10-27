// What the app needs from "your backend". In a real app this is your own server, behind your own login: it holds the
// Consenzy org API key (cdm_…) and is the only thing that ever uses it. The app only ever sees cps_… session tokens.
import type { FetchLike } from '@onfinance/consenzy';

export type ActingAs = 'data_principal' | 'guardian';

/** POST /session on the example session server (a PrincipalSessionOut plus the base URL to give the SDK). */
export interface SessionInfo {
  token: string;
  base_url: string;
  principal_id: string;
  acting_as: ActingAs;
  capabilities: string[];
  expires_at: string;
  mode: 'demo' | 'live' | 'in-app-demo';
}

/** POST /consent-check on the example session server (Consenzy's POST /v1/consents/check). */
export interface ConsentCheckResult {
  allowed: boolean;
  basis: 'consent' | 'legitimate_use' | null;
  consent_id: string | null;
  ledger_event_id: number | null;
  ledger_hash: string | null;
  expires_at: string | null;
}

/** GET /demo-customers on the example session server. */
export interface DemoCustomer {
  external_ref: string;
  label: string;
  acts_through_guardian: boolean;
}

export interface AppBackend {
  kind: 'in-app-demo' | 'session-server';
  /** Shown on the home screen. */
  description: string;
  listCustomers(): Promise<DemoCustomer[]>;
  /** Mint a short-lived principal session for the signed-in customer (or their guardian). */
  mintSession(externalRef: string, actingAs?: ActingAs): Promise<SessionInfo>;
  /** Ask the consent ledger whether a purpose is allowed, before processing data for it. */
  checkConsent(externalRef: string, purposeCode: string): Promise<ConsentCheckResult>;
  /**
   * In-app demo only: the `fetch` handed to `ConsentSession` so the SDK talks to the in-memory mock.
   * Undefined for a real backend: the SDK then uses the global fetch against `base_url`.
   */
  sdkFetch?: FetchLike;
}
