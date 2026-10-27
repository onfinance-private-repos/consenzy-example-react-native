// Journey 5: guardian consent for a minor (DPDP s.9) and a nominee (s.14).
// CUST-DEMO-CHILD-7 is a 12-year-old. A session minted for the child (acting_as "data_principal") can read the notice
// but Consenzy refuses to record consent with a 422, which the SDK recognises with isGuardianRequiredError. After the
// backend authenticates the parent and mints a session with acting_as "guardian", the same grant succeeds. The
// guardian then files a nomination request. This screen uses the core ConsentSession directly (headless), so it
// works whoever is signed in.
import { isGuardianRequiredError, describeError, validateRightsRequest, type RightsRequestErrors } from '@onfinance/consenzy-react-native';
import type { MeConsentOut, MeNoticeOut, MeOut, NominationDetails } from '@onfinance/consenzy';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { useApp } from '../appContext';
import { DEMO_CHILD_REF } from '../config';
import { startConsentSession, type StartedSession } from '../consent/startSession';
import { Body, Button, Card, Field, Mono, Small, Title, styles } from '../ui';

type Outcome = { tone: 'success' | 'danger'; text: string; detail?: string };

export function GuardianScreen() {
  const { backend } = useApp();
  const [childOutcome, setChildOutcome] = useState<Outcome | null>(null);
  const [guardian, setGuardian] = useState<StartedSession | null>(null);
  const [me, setMe] = useState<MeOut | null>(null);
  const [notice, setNotice] = useState<MeNoticeOut | null>(null);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [granted, setGranted] = useState<MeConsentOut[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const guardianRef = useRef<StartedSession | null>(null);
  useEffect(() => {
    guardianRef.current = guardian;
  }, [guardian]);

  // Revoke the guardian session when leaving the screen.
  useEffect(() => () => void guardianRef.current?.session.logout().catch(() => undefined), []);

  // Step 1: a data_principal session for the child tries to grant and is refused (422, s.9).
  const tryAsChild = async () => {
    setBusy('child');
    setChildOutcome(null);
    const child = await startConsentSession(backend, DEMO_CHILD_REF, 'data_principal').catch((e) => {
      setChildOutcome({ tone: 'danger', text: describeError(e) });
      return null;
    });
    if (!child) return setBusy(null);
    try {
      const n = await child.session.currentNotice('en');
      const analytics = n.purposes.filter((p) => p.code === 'analytics').map((p) => p.id);
      await child.session.giveConsent({ noticeId: n.id, purposeIds: analytics, channel: 'mobile_app' });
      setChildOutcome({ tone: 'danger', text: 'Unexpected: the child session was allowed to consent.' });
    } catch (e) {
      setChildOutcome(
        isGuardianRequiredError(e)
          ? { tone: 'success', text: 'Refused as expected: a parent or lawful guardian must give this consent.', detail: describeError(e) }
          : { tone: 'danger', text: describeError(e) },
      );
    } finally {
      await child.session.logout().catch(() => undefined);
      setBusy(null);
    }
  };

  // Step 2a: the backend authenticates the parent and mints a guardian session for the child's account.
  const signInAsGuardian = async () => {
    setBusy('guardian');
    setError(null);
    try {
      const started = await startConsentSession(backend, DEMO_CHILD_REF, 'guardian');
      const [m, n] = await Promise.all([started.session.me(), started.session.currentNotice('en')]);
      setGuardian(started);
      setMe(m);
      setNotice(n);
      setSelected({});
      setGranted(null);
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  // Step 2b: the guardian records consent for the purposes they switched on.
  const grantAsGuardian = async () => {
    if (!guardian || !notice) return;
    const purposeIds = notice.purposes.filter((p) => selected[p.id]).map((p) => p.id);
    if (purposeIds.length === 0) return;
    setBusy('grant');
    setError(null);
    try {
      setGranted(await guardian.session.giveConsent({ noticeId: notice.id, purposeIds, channel: 'mobile_app' }));
    } catch (e) {
      setError(describeError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} testID="guardian-screen" keyboardShouldPersistTaps="handled">
      <Title>Guardian consent for a minor</Title>
      <Body muted>{`${DEMO_CHILD_REF} is 12. Under DPDP s.9 only a verified parent or lawful guardian can give consent for them.`}</Body>

      <Card>
        <Body>1. The child tries to consent</Body>
        <Small muted>Session minted with acting_as = data_principal.</Small>
        <Button testID="try-as-child" label="Record consent as the child" onPress={() => void tryAsChild()} busy={busy === 'child'} />
        {childOutcome && (
          <>
            <Small tone={childOutcome.tone} testID="child-outcome">
              {childOutcome.text}
            </Small>
            {childOutcome.detail && <Mono testID="child-outcome-detail">{`422: ${childOutcome.detail}`}</Mono>}
          </>
        )}
      </Card>

      <Card>
        <Body>2. The guardian consents</Body>
        <Small muted>Your backend authenticates the parent, then mints a session with acting_as = guardian.</Small>
        {!guardian && <Button testID="sign-in-guardian" label="Sign in as guardian" onPress={() => void signInAsGuardian()} busy={busy === 'guardian'} />}
        {me && (
          <Small testID="guardian-me">{`Session acting_as: ${me.acting_as} · account ${me.external_ref} · guardian verified: ${me.guardian_verified ? 'yes' : 'no'}`}</Small>
        )}
        {notice?.purposes.map((p) => (
          <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <View style={{ flex: 1 }}>
              <Small>{p.name}</Small>
            </View>
            <Switch
              testID={`guardian-switch-${p.code}`}
              accessibilityLabel={`Consent to ${p.name} on the child's behalf`}
              value={!!selected[p.id]}
              onValueChange={(v) => setSelected((s) => ({ ...s, [p.id]: v }))}
            />
          </View>
        ))}
        {guardian && (
          <Button
            testID="grant-as-guardian"
            label="Record consent as guardian"
            onPress={() => void grantAsGuardian()}
            busy={busy === 'grant'}
            disabled={!Object.values(selected).some(Boolean)}
          />
        )}
        {granted && (
          <View testID="guardian-granted">
            <Small tone="success">{`Recorded ${granted.length} consent(s) given by the guardian:`}</Small>
            {granted.map((c) => (
              <Mono key={c.id}>{`${c.purpose_code} · ${c.status}`}</Mono>
            ))}
          </View>
        )}
        {error && <Small tone="danger">{error}</Small>}
      </Card>

      {guardian && <Nomination guardian={guardian} />}
    </ScrollView>
  );
}

/** Step 3: a nomination request (s.14), filed through the guardian session. */
function Nomination({ guardian }: { guardian: StartedSession }) {
  const [name, setName] = useState('');
  const [relationship, setRelationship] = useState('');
  const [phone, setPhone] = useState('');
  const [errors, setErrors] = useState<RightsRequestErrors>({});
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const submit = async () => {
    const v = validateRightsRequest('nomination', { nominee_name: name, relationship, nominee_phone: phone });
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    setBusy(true);
    try {
      const r = await guardian.session.fileDataRequest('nomination', v.details as unknown as NominationDetails);
      setResult(`Nomination ${r.status}, channel ${r.channel}, due by ${r.due_at.slice(0, 10)}`);
    } catch (e) {
      setResult(describeError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Body>3. Nominate someone (s.14)</Body>
      <Small muted>{"The nominee can exercise the account holder's rights if they die or become incapacitated."}</Small>
      <Field testID="nominee-name" label="Nominee's full name" value={name} onChangeText={setName} error={errors.nominee_name} />
      <Field testID="nominee-relationship" label="Relationship" value={relationship} onChangeText={setRelationship} error={errors.relationship} />
      <Field
        testID="nominee-phone"
        label="Nominee's phone (+91…)"
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
        error={errors.nominee_phone ?? errors.form}
      />
      <Button testID="file-nomination" label="File nomination" onPress={() => void submit()} busy={busy} />
      {result && <Small testID="nomination-result">{result}</Small>}
    </Card>
  );
}
