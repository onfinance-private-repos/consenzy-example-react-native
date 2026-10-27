// App-level state shared by the screens: which backend we talk to and who is signed in.
import { createContext, useContext } from 'react';
import type { AppBackend, DemoCustomer, SessionInfo } from './backend/types';

export interface SignedIn {
  backend: AppBackend;
  customer: DemoCustomer;
  /** The first /session answer for this sign-in. */
  info: SessionInfo;
}

export const AppContext = createContext<SignedIn | null>(null);

export function useApp(): SignedIn {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppContext.Provider>');
  return ctx;
}
