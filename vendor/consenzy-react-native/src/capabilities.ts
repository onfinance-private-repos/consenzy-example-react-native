// Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0
//
// What the current principal session may do. GET /v1/me reports `capabilities`; the server
// answers 403 for an action the session lacks, so the prebuilt components hide or disable
// those actions up front instead.
import type { Me, SessionCapability } from './types.ts';

/**
 * True if `me` holds `capability`. A `Me` without a `capabilities` field comes from a server
 * that predates capability-scoped sessions, where every session could do everything.
 */
export function hasCapability(me: Pick<Me, 'capabilities'>, capability: SessionCapability): boolean {
  return !Array.isArray(me.capabilities) || me.capabilities.includes(capability);
}

/** May give and withdraw consent (POST /v1/me/consents, POST /v1/me/consents/{id}/withdraw). */
export const canGiveConsent = (me: Pick<Me, 'capabilities'>): boolean => hasCapability(me, 'consents:write');
/** May file rights requests (POST /v1/me/data-requests). */
export const canFileRequests = (me: Pick<Me, 'capabilities'>): boolean => hasCapability(me, 'requests:write');
/** May list past rights requests (GET /v1/me/data-requests). */
export const canReadRequests = (me: Pick<Me, 'capabilities'>): boolean => hasCapability(me, 'requests:read');
/** The session was minted for a parent / lawful guardian acting for a child or a person with disability. */
export const isActingAsGuardian = (me: Pick<Me, 'acting_as'>): boolean => me.acting_as === 'guardian';

function statusAndDetail(error: unknown): { status?: number; detail?: unknown } {
  if (!error || typeof error !== 'object') return {};
  const e = error as { status?: unknown; detail?: unknown };
  return { status: typeof e.status === 'number' ? e.status : undefined, detail: e.detail };
}

/**
 * The 422 the server returns when consent for a child or a person with disability is given
 * through a session that was not minted with `acting_as: "guardian"` (DPDP s.9).
 */
export function isGuardianRequiredError(error: unknown): boolean {
  const { status, detail } = statusAndDetail(error);
  return status === 422 && typeof detail === 'string' && /acting_as=guardian/i.test(detail);
}

/** A 403 because the session lacks a capability, e.g. it was minted with a narrowed `capabilities` list. */
export function isMissingCapabilityError(error: unknown): boolean {
  const { status, detail } = statusAndDetail(error);
  return status === 403 && typeof detail === 'string' && detail.includes('lacks capability');
}
