// Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0
import { createContext, useContext, useMemo, useRef, type ReactNode } from 'react';
import { ConsentSession } from '@onfinance/consenzy';
import { defaultTheme, mergeTheme, type ConsentTheme, type ConsentThemeOverrides } from './theme.ts';
import type { ConsentSessionLike } from './types.ts';

interface ConsentContextValue {
  session: ConsentSessionLike;
  theme: ConsentTheme;
}

const ConsentContext = createContext<ConsentContextValue | null>(null);

export interface ConsentProviderProps {
  /** Base URL of your Consent Data Master deployment, e.g. https://consent.bank.example. */
  baseUrl?: string;
  /**
   * Returns a principal session token (`cps_...`) minted by YOUR backend via
   * POST /v1/principal-sessions. Called whenever the SDK needs a token. Never put an
   * organisation API key (`cdm_...`) in a mobile app.
   */
  sessionProvider?: () => Promise<string>;
  /** Advanced: supply a ready-made session instead of baseUrl + sessionProvider. */
  session?: ConsentSessionLike;
  /** Default theme overrides for every prebuilt component under this provider. */
  theme?: ConsentThemeOverrides;
  children?: ReactNode;
}

export function ConsentProvider({ baseUrl, sessionProvider, session, theme, children }: ConsentProviderProps) {
  // Keep the latest provider in a ref so an inline arrow function does not
  // recreate the session (and refetch everything) on every render.
  const providerRef = useRef(sessionProvider);
  providerRef.current = sessionProvider;

  const resolved = useMemo<ConsentSessionLike>(() => {
    if (session) return session;
    if (!baseUrl || !providerRef.current) {
      throw new Error('ConsentProvider needs either `session` or both `baseUrl` and `sessionProvider`.');
    }
    const created = new ConsentSession({
      baseUrl,
      sessionProvider: () => {
        const current = providerRef.current;
        if (!current) return Promise.reject(new Error('sessionProvider was removed from ConsentProvider'));
        return current();
      },
    });
    return created as unknown as ConsentSessionLike;
  }, [session, baseUrl]);

  const mergedTheme = useMemo(() => mergeTheme(defaultTheme, theme), [theme]);
  const value = useMemo(() => ({ session: resolved, theme: mergedTheme }), [resolved, mergedTheme]);
  return <ConsentContext.Provider value={value}>{children}</ConsentContext.Provider>;
}

function useConsentContext(): ConsentContextValue {
  const ctx = useContext(ConsentContext);
  if (!ctx) throw new Error('Consent hooks and components must be rendered inside <ConsentProvider>.');
  return ctx;
}

/** The underlying `ConsentSession` from @onfinance/consenzy. */
export function useConsentSession(): ConsentSessionLike {
  return useConsentContext().session;
}

/** Provider theme merged with a component-level `theme` prop. */
export function useConsentTheme(overrides?: ConsentThemeOverrides): ConsentTheme {
  const base = useConsentContext().theme;
  return useMemo(() => mergeTheme(base, overrides), [base, overrides]);
}
