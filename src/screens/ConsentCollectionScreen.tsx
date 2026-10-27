// Journey 1: consent collection.
// Fetch the notice in the chosen language (Hindi is published; Tamil is not, so the server falls back to English),
// show the itemised notice (title, body, and per purpose: description, data categories, retention), let the customer
// switch purposes on (all start OFF, DPDP s.6(1)) and record consent through the SDK. The second tab shows the same
// journey with the SDK's drop-in ConsentSheet.
import {
  ConsentSheet,
  describeError,
  isGuardianRequiredError,
  useCapabilities,
  useConsentSession,
  useNotice,
  type Consent,
} from '@onfinance/consenzy-react-native';
import { useState } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { Body, Button, Card, Mono, Segmented, Small, Title, styles } from '../ui';

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी (Hindi)' },
  { value: 'ta', label: 'தமிழ் (Tamil, not published)' },
] as const;
type Lang = (typeof LANGUAGES)[number]['value'];

export function ConsentCollectionScreen() {
  const [variant, setVariant] = useState<'custom' | 'sheet'>('custom');
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <Segmented
          label="Implementation"
          value={variant}
          onChange={setVariant}
          testIDPrefix="collection-variant"
          options={[
            { value: 'custom', label: 'Custom screen (hooks)' },
            { value: 'sheet', label: 'Drop-in ConsentSheet' },
          ]}
        />
      </View>
      {variant === 'custom' ? <CustomConsentScreen /> : <DropInConsentSheet />}
    </View>
  );
}

/** Custom UI built from the SDK hooks: useNotice + useCapabilities + useConsentSession().giveConsent. */
function CustomConsentScreen() {
  const session = useConsentSession();
  const { canGiveConsent, actingAsGuardian, me } = useCapabilities();
  const [language, setLanguage] = useState<Lang>('en');
  const { notice, loading, error, refresh } = useNotice(language);
  const [choice, setChoice] = useState<{ notice: string; ids: Record<string, boolean> }>({ notice: '', ids: {} });
  const [busy, setBusy] = useState(false);
  const [granted, setGranted] = useState<Consent[] | null>(null);
  const [grantError, setGrantError] = useState<unknown>(null);

  // Choices belong to one notice version and language: a different notice needs a fresh, explicit choice.
  const noticeKey = notice ? `${notice.id}:${notice.version}:${notice.language}` : '';
  const selected = choice.notice === noticeKey ? choice.ids : {};
  const setSelected = (update: (s: Record<string, boolean>) => Record<string, boolean>) =>
    setChoice({ notice: noticeKey, ids: update(selected) });

  const purposeIds = notice ? notice.purposes.filter((p) => selected[p.id]).map((p) => p.id) : [];

  // The headless grant: exactly the purposes the customer switched on, recorded with channel "mobile_app".
  const recordConsent = async () => {
    if (!notice || purposeIds.length === 0) return;
    setBusy(true);
    setGrantError(null);
    setGranted(null);
    try {
      const consents = await session.giveConsent({ noticeId: notice.id, purposeIds, channel: 'mobile_app' });
      setGranted(consents);
      setSelected(() => ({}));
    } catch (e) {
      setGrantError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} testID="consent-collection-screen">
      <Segmented label="Notice language" value={language} onChange={setLanguage} options={[...LANGUAGES]} testIDPrefix="notice-lang" />
      {loading && !notice && <Small muted>Loading notice…</Small>}
      {error && (
        <View>
          <Small tone="danger">{describeError(error)}</Small>
          <Button label="Try again" variant="secondary" onPress={() => void refresh()} />
        </View>
      )}
      {notice && (
        <>
          {notice.language !== language && (
            <Small muted testID="notice-fallback">
              {`No "${language}" translation is published, so Consenzy returned the ${notice.language === 'en' ? 'English' : notice.language} notice (fallback).`}
            </Small>
          )}
          <Small muted>{`Notice v${notice.version} · language ${notice.language}`}</Small>
          <Title>{notice.title}</Title>
          <Body>{notice.body}</Body>
          {actingAsGuardian && me && <Small testID="guardian-context">{`Acting as guardian for ${me.external_ref}.`}</Small>}

          {notice.purposes.map((p) => (
            <Card key={p.id} testID={`purpose-${p.code}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <Body>{p.name}</Body>
                </View>
                <Switch
                  testID={`purpose-switch-${p.code}`}
                  accessibilityLabel={`Consent to ${p.name}`}
                  value={!!selected[p.id]}
                  disabled={!canGiveConsent || busy}
                  onValueChange={(v) => setSelected((s) => ({ ...s, [p.id]: v }))}
                />
              </View>
              <Small>{p.description}</Small>
              <Small muted>{`Data used: ${p.data_categories.join(', ')}`}</Small>
              <Small muted>{p.retention_days == null ? 'Kept only as long as needed' : `Kept for up to ${p.retention_days} days`}</Small>
            </Card>
          ))}

          {!canGiveConsent && <Small tone="danger">This session cannot give consent (no consents:write capability).</Small>}
          <Button
            testID="record-consent"
            label={`Record consent (${purposeIds.length} selected)`}
            onPress={() => void recordConsent()}
            disabled={purposeIds.length === 0 || !canGiveConsent}
            busy={busy}
          />
          <Button label="Decline all" variant="secondary" onPress={() => setSelected(() => ({}))} disabled={busy} />

          {grantError != null && (
            <Small tone="danger" testID="grant-error">
              {isGuardianRequiredError(grantError)
                ? 'A parent or guardian must give this consent (DPDP s.9). Sign in again with "Guardian" selected.'
                : describeError(grantError)}
            </Small>
          )}
          {granted && (
            <Card testID="grant-result">
              <Small tone="success">{`Recorded ${granted.length} consent(s):`}</Small>
              {granted.map((c) => (
                <Mono key={c.id}>{`${c.purpose_code} · ${c.status} · ${c.id}`}</Mono>
              ))}
            </Card>
          )}
        </>
      )}
    </ScrollView>
  );
}

/** The SDK's prebuilt ConsentSheet: language picker, one Switch per purpose, Accept selected / Reject all. */
function DropInConsentSheet() {
  const [result, setResult] = useState<string | null>(null);
  return (
    <View style={{ flex: 1 }}>
      {result && (
        <View style={{ paddingHorizontal: 16 }}>
          <Small tone="success" testID="sheet-result">
            {result}
          </Small>
        </View>
      )}
      <ConsentSheet
        languages={['en', 'hi']}
        onComplete={(r) => {
          if (r.action === 'accepted') setResult(`Accepted: ${r.consents.map((c) => c.purpose_code).join(', ')}`);
          else setResult('Rejected all: nothing was recorded.');
        }}
        onError={(e) => setResult(`Error: ${describeError(e)}`)}
      />
    </View>
  );
}
