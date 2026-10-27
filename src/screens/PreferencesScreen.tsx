// Journey 3: preferences centre.
// List the customer's active consents and withdraw one (inline confirmation and an optional reason). Withdrawing is
// as easy as giving consent (DPDP s.6(4)). The second tab shows the SDK's drop-in ConsentManager.
import { ConsentManager, describeError, useCapabilities, useConsents, useNotice, type Consent } from '@onfinance/consenzy-react-native';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Body, Button, Card, Field, Mono, Segmented, Small, Title, styles } from '../ui';

export function PreferencesScreen() {
  const [variant, setVariant] = useState<'custom' | 'manager'>('custom');
  const [last, setLast] = useState<string | null>(null);
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <Segmented
          label="Implementation"
          value={variant}
          onChange={setVariant}
          testIDPrefix="preferences-variant"
          options={[
            { value: 'custom', label: 'Custom screen (hooks)' },
            { value: 'manager', label: 'Drop-in ConsentManager' },
          ]}
        />
        {variant === 'manager' && last && <Small tone="success">{last}</Small>}
      </View>
      {variant === 'custom' ? (
        <CustomPreferences />
      ) : (
        <ConsentManager
          withdrawalReason="Withdrawn from the example app's preferences centre"
          onWithdrawn={(c) => setLast(`Withdrew ${c.purpose_code} at ${c.withdrawn_at}`)}
          onError={(e) => setLast(`Error: ${describeError(e)}`)}
        />
      )}
    </View>
  );
}

function CustomPreferences() {
  // The status-aware consent list plus a withdraw action that refreshes it.
  const { consents, loading, error, refresh, withdraw } = useConsents({ activeOnly: true });
  const { notice } = useNotice();
  const { canGiveConsent } = useCapabilities();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);

  const names = useMemo(() => Object.fromEntries((notice?.purposes ?? []).map((p) => [p.id, p.name])), [notice]);
  const nameOf = (c: Consent) => names[c.purpose_id] ?? c.purpose_code;

  // The withdraw call: POST /v1/me/consents/{id}/withdraw, then the hook refreshes the list.
  const confirmWithdraw = async (c: Consent) => {
    setBusy(true);
    setMessage(null);
    try {
      const out = await withdraw(c.id, reason.trim() || undefined);
      setMessage({ text: `Withdrew ${nameOf(c)} (${out.status}, ${out.withdrawn_at})`, tone: 'success' });
      setConfirming(null);
      setReason('');
    } catch (e) {
      setMessage({ text: describeError(e), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} testID="preferences-screen">
      <Title>Your consents</Title>
      <Button label="Refresh" variant="secondary" onPress={() => void refresh()} busy={loading} />
      {error && <Small tone="danger">{describeError(error)}</Small>}
      {message && <Small tone={message.tone} testID="preferences-message">{message.text}</Small>}
      {!loading && !error && consents.length === 0 && (
        <Body muted>No active consents. Give some on the Consent tab first.</Body>
      )}
      {consents.map((c) => (
        <Card key={c.id} testID={`active-consent-${c.purpose_code}`}>
          <Body>{nameOf(c)}</Body>
          <Small muted>{`Given ${c.given_at.slice(0, 10)} via ${c.channel}${c.expires_at ? ` · expires ${c.expires_at.slice(0, 10)}` : ''}`}</Small>
          <Mono>{c.id}</Mono>
          {confirming === c.id ? (
            <View>
              <Small>{`Withdraw consent for ${nameOf(c)}? Processing for this purpose stops; past processing is not affected.`}</Small>
              <Field
                testID="withdraw-reason"
                label="Reason (optional)"
                value={reason}
                onChangeText={setReason}
                placeholder="e.g. Too many messages"
              />
              <Button testID={`withdraw-confirm-${c.purpose_code}`} variant="danger" label="Yes, withdraw" busy={busy} onPress={() => void confirmWithdraw(c)} />
              <Button variant="secondary" label="Cancel" disabled={busy} onPress={() => setConfirming(null)} />
            </View>
          ) : (
            <Button
              testID={`withdraw-${c.purpose_code}`}
              variant="secondary"
              label="Withdraw"
              disabled={!canGiveConsent || confirming != null}
              onPress={() => setConfirming(c.id)}
            />
          )}
        </Card>
      ))}
    </ScrollView>
  );
}
