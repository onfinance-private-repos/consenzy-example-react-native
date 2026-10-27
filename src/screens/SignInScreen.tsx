// Sign-in: pick the mode (in-app demo or session server) and a synthetic demo customer. A real app would use its own
// login here; its backend then mints the Consenzy session for whoever signed in.
import { describeError } from '@onfinance/consenzy-react-native';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import type { ActingAs, AppBackend, DemoCustomer } from '../backend/types';
import { sessionServerBackend } from '../backend/sessionServer';
import { DEFAULT_SESSION_SERVER_URL } from '../config';
import { inAppDemoBackend } from '../demo/demoBackend';
import { Body, Button, Card, Field, Segmented, Small, Title, styles } from '../ui';

type Mode = 'in-app-demo' | 'session-server';

export interface SignInScreenProps {
  /** Reused across sign-ins so the in-app demo keeps its data until the app restarts. */
  demoBackend?: AppBackend;
  onSignIn: (backend: AppBackend, customer: DemoCustomer, actingAs: ActingAs) => Promise<void>;
}

export function SignInScreen({ demoBackend, onSignIn }: SignInScreenProps) {
  const [mode, setMode] = useState<Mode>('in-app-demo');
  const [serverUrl, setServerUrl] = useState(DEFAULT_SESSION_SERVER_URL);
  const [customers, setCustomers] = useState<DemoCustomer[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [actingAs, setActingAs] = useState<ActingAs>('data_principal');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

  const demo = useMemo(() => demoBackend ?? inAppDemoBackend({ latencyMs: 250 }), [demoBackend]);
  const backend = useMemo(() => (mode === 'in-app-demo' ? demo : sessionServerBackend(serverUrl)), [mode, demo, serverUrl]);

  const loadCustomers = async (b: AppBackend) => {
    setLoadError(null);
    try {
      const list = await b.listCustomers();
      setCustomers(list);
      setSelected((s) => (list.some((c) => c.external_ref === s) ? s : (list[0]?.external_ref ?? null)));
    } catch (e) {
      setCustomers([]);
      setLoadError(describeError(e));
    }
  };

  // The in-app demo needs no setup, so offer its customers straight away.
  useEffect(() => {
    let live = true;
    void demo.listCustomers().then((list) => {
      if (!live) return;
      setCustomers(list);
      setSelected(list[0]?.external_ref ?? null);
    });
    return () => {
      live = false;
    };
  }, [demo]);

  const chooseMode = (m: Mode) => {
    setMode(m);
    setLoadError(null);
    if (m === 'in-app-demo') void loadCustomers(demo);
    else setCustomers([]);
  };

  const customer = customers.find((c) => c.external_ref === selected) ?? null;

  const signIn = async () => {
    if (!customer) return;
    setBusy(true);
    setSignInError(null);
    try {
      await onSignIn(backend, customer, customer.acts_through_guardian ? actingAs : 'data_principal');
    } catch (e) {
      setSignInError(describeError(e));
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} testID="sign-in-screen" keyboardShouldPersistTaps="handled">
      <Title>Consenzy React Native example</Title>
      <Body muted>DPDP consent, preferences, rights requests and guardian consent with the Consenzy React Native SDK. All data is synthetic.</Body>

      <Segmented
        label="Mode"
        value={mode}
        onChange={chooseMode}
        testIDPrefix="mode"
        options={[
          { value: 'in-app-demo', label: 'In-app demo' },
          { value: 'session-server', label: 'Session server' },
        ]}
      />
      {mode === 'in-app-demo' ? (
        <Small muted>No setup: the real SDK runs against an in-memory mock of the Consenzy API (src/demo).</Small>
      ) : (
        <>
          <Field
            testID="server-url"
            label="Session server URL"
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
          <Button testID="connect" variant="secondary" label="Load demo customers" onPress={() => void loadCustomers(backend)} />
          {loadError && <Small tone="danger">{loadError}</Small>}
        </>
      )}

      {customers.length > 0 && (
        <Card>
          <Segmented
            label="Sign in as"
            value={selected ?? ''}
            onChange={setSelected}
            testIDPrefix="customer"
            options={customers.map((c) => ({ value: c.external_ref, label: `${c.label} · ${c.external_ref}` }))}
          />
          {customer?.acts_through_guardian && (
            <Segmented
              label="Who is using the app? (DPDP s.9)"
              value={actingAs}
              onChange={setActingAs}
              testIDPrefix="acting-as"
              options={[
                { value: 'data_principal', label: 'The child' },
                { value: 'guardian', label: 'Guardian' },
              ]}
            />
          )}
          <Button testID="sign-in" label="Sign in" onPress={() => void signIn()} busy={busy} disabled={!customer} />
          {signInError && <Small tone="danger">{signInError}</Small>}
        </Card>
      )}
    </ScrollView>
  );
}
