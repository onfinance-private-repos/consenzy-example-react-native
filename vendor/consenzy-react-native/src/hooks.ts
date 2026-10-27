// Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useConsentSession } from './context.tsx';
import { canFileRequests, canGiveConsent, canReadRequests, isActingAsGuardian } from './capabilities.ts';
import { assertUuid, sortBreachNotices, unacknowledgedCount } from './breach.ts';
import type { BreachNotice, Consent, DataRequest, Me, Notice, RequestType } from './types.ts';

export interface ResourceState<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  /** Refetch. Resolves when the new data (or error) is in state. */
  refresh: () => Promise<void>;
}

function toError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

/**
 * Fetch on mount and whenever `deps` change; ignore responses that arrive after a newer request or unmount.
 * With `enabled: false` nothing is fetched (and `refresh` is a no-op).
 */
function useResource<T>(fetcher: () => Promise<T>, deps: readonly unknown[], enabled = true): ResourceState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(enabled);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const [error, setError] = useState<Error | null>(null);
  const latest = useRef(0);
  const mounted = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const refresh = useCallback(async () => {
    const id = ++latest.current;
    if (!enabledRef.current) {
      setData(undefined);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (mounted.current && id === latest.current) setData(result);
    } catch (e) {
      if (mounted.current && id === latest.current) setError(toError(e));
    } finally {
      if (mounted.current && id === latest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refresh, enabled, ...deps]);

  return { data, loading, error, refresh };
}

/** The signed-in Data Principal (GET /v1/me). */
export function useMe() {
  const session = useConsentSession();
  const state = useResource(() => session.me(), [session]);
  return { ...state, me: state.data as Me | undefined };
}

/**
 * The latest consent notice in `language` (falling back server-side to the principal's
 * preferred language, then English). GET /v1/me/notice.
 */
export function useNotice(language?: string) {
  const session = useConsentSession();
  const state = useResource(() => session.currentNotice(language), [session, language]);
  return { ...state, notice: state.data as Notice | undefined };
}

/** The principal's consents (GET /v1/me/consents), plus a withdraw action that refreshes the list. */
export function useConsents(options: { activeOnly?: boolean } = {}) {
  const session = useConsentSession();
  const activeOnly = options.activeOnly ?? false;
  const state = useResource(() => session.listConsents({ activeOnly }), [session, activeOnly]);
  const { refresh } = state;
  const withdraw = useCallback(
    async (consentId: string, reason?: string) => {
      const result = await session.withdrawConsent(consentId, reason);
      await refresh();
      return result;
    },
    [session, refresh],
  );
  return { ...state, consents: (state.data ?? []) as Consent[], withdraw };
}

/**
 * What the current session may do, from GET /v1/me. While `me` is still loading (or failed to
 * load) every flag is `true` and `known` is `false`: actions stay available and the server
 * remains the authority (403 for a missing capability).
 */
export function useCapabilities() {
  const { me, loading, error, refresh } = useMe();
  return {
    me,
    loading,
    error,
    refresh,
    known: me != null,
    /** consents:write: give and withdraw consent. */
    canGiveConsent: me ? canGiveConsent(me) : true,
    /** requests:write: file rights requests. */
    canFileRequests: me ? canFileRequests(me) : true,
    /** requests:read: list past rights requests. */
    canReadRequests: me ? canReadRequests(me) : true,
    /** The session was minted with acting_as=guardian. */
    actingAsGuardian: me ? isActingAsGuardian(me) : false,
  };
}

/**
 * The principal's rights requests (GET /v1/me/data-requests), plus a file action that refreshes the list.
 * Pass `enabled: false` (e.g. `enabled: canReadRequests`) for a session without `requests:read`: the
 * list is then not fetched and stays empty, and `file` does not try to refresh it.
 */
export function useDataRequests(options: { enabled?: boolean } = {}) {
  const session = useConsentSession();
  const state = useResource(() => session.listDataRequests(), [session], options.enabled ?? true);
  const { refresh } = state;
  const file = useCallback(
    async (type: RequestType, details: Record<string, unknown>) => {
      const result = await session.fileDataRequest(type, details);
      await refresh();
      return result;
    },
    [session, refresh],
  );
  return { ...state, requests: (state.data ?? []) as DataRequest[], file };
}

/**
 * Personal data breach intimations sent to the principal (GET /v1/me/breach-notices), newest
 * first, plus an `acknowledge` action ("I have read this"). Always readable by any session.
 *
 * `acknowledge` validates the breach id as a UUID, does not call the server again for a notice
 * that is already acknowledged, and refreshes the list afterwards. The server keeps the first
 * acknowledgement time, so a repeated call is harmless.
 */
export function useBreachNotices(options: { enabled?: boolean } = {}) {
  const session = useConsentSession();
  const state = useResource(() => session.listBreachNotices(), [session], options.enabled ?? true);
  const { data, refresh } = state;
  const notices = useMemo(() => sortBreachNotices((data ?? []) as BreachNotice[]), [data]);
  const acknowledge = useCallback(
    async (breachId: string): Promise<BreachNotice> => {
      assertUuid(breachId, 'breachId');
      const existing = notices.find((n) => n.breach_id === breachId);
      if (existing?.acknowledged_at) return existing;
      const result = await session.acknowledgeBreachNotice(breachId);
      await refresh();
      return result;
    },
    [session, refresh, notices],
  );
  return { ...state, notices, unacknowledgedCount: unacknowledgedCount(notices), acknowledge };
}
