import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { AppContext, type SignedIn } from './src/appContext';
import type { ActingAs, AppBackend, DemoCustomer } from './src/backend/types';
import { AppConsentProvider } from './src/consent/AppConsentProvider';
import { startConsentSession, type StartedSession } from './src/consent/startSession';
import { inAppDemoBackend } from './src/demo/demoBackend';
import { HomeScreen } from './src/screens/HomeScreen';
import { SignInScreen } from './src/screens/SignInScreen';

export default function App() {
  // One in-memory demo per app launch, so demo data survives logout / sign-in until the app restarts.
  const demoBackend = useMemo(() => inAppDemoBackend({ latencyMs: 250 }), []);
  const [signedIn, setSignedIn] = useState<(SignedIn & { started: StartedSession }) | null>(null);

  const signIn = async (backend: AppBackend, customer: DemoCustomer, actingAs: ActingAs) => {
    const started = await startConsentSession(backend, customer.external_ref, actingAs);
    setSignedIn({ backend, customer, info: started.info, started });
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
        {signedIn ? (
          <AppContext.Provider value={signedIn}>
            <AppConsentProvider backend={signedIn.backend} started={signedIn.started}>
              <HomeScreen onSignedOut={() => setSignedIn(null)} />
            </AppConsentProvider>
          </AppContext.Provider>
        ) : (
          <SignInScreen demoBackend={demoBackend} onSignIn={signIn} />
        )}
        <StatusBar style="dark" />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
