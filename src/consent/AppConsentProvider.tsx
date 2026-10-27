// Wraps the signed-in part of the app in the SDK's ConsentProvider.
//
// Session-server mode uses the documented form, `baseUrl` + `sessionProvider`, exactly as in the SDK quickstart.
// The in-app demo uses ConsentProvider's `session` prop instead, because it needs a ConsentSession built with a custom
// `fetch` (ConsentProvider's baseUrl/sessionProvider form always uses the global fetch).
import { ConsentProvider, type ConsentSessionLike } from '@onfinance/consenzy-react-native';
import type { ReactNode } from 'react';
import type { StartedSession } from './startSession';
import type { AppBackend } from '../backend/types';

export const THEME = { colors: { primary: '#0B5FFF' } };

export function AppConsentProvider({ backend, started, children }: { backend: AppBackend; started: StartedSession; children: ReactNode }) {
  if (backend.sdkFetch) {
    // ConsentSession satisfies the structural ConsentSessionLike the provider expects (the SDK casts the same way).
    return (
      <ConsentProvider session={started.session as unknown as ConsentSessionLike} theme={THEME}>
        {children}
      </ConsentProvider>
    );
  }
  return (
    <ConsentProvider baseUrl={started.info.base_url} sessionProvider={started.getToken} theme={THEME}>
      {children}
    </ConsentProvider>
  );
}
