// Journey 2: check consent before using data for a purpose.
// "Send me offers" asks YOUR backend to check the `marketing` purpose with Consenzy (POST /v1/consents/check, an
// org-key call, so it never happens in the app). The offer is "sent" only when the answer is allowed, and the
// consent_id and ledger_hash are kept as the audit trail for that use of the data. Fail closed on any error.
import { describeError, useCapabilities, useConsentSession, useNotice } from '@onfinance/consenzy-react-native';
import { useState } from 'react';
import { ScrollView } from 'react-native';
import { useApp } from '../appContext';
import type { ConsentCheckResult } from '../backend/types';
import { Body, Button, Card, Mono, Small, Title, styles } from '../ui';

const PURPOSE = 'marketing';

export function ConsentCheckScreen() {
  const { backend, customer } = useApp();
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<ConsentCheckResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [log, setLog] = useState<string[]>([]);

  // The consent check: the backend asks the ledger; the app proceeds only on allowed === true.
  const sendOffers = async () => {
    setChecking(true);
    setError(null);
    setResult(null);
    try {
      const gate = await backend.checkConsent(customer.external_ref, PURPOSE);
      setResult(gate);
      if (gate.allowed) {
        // Your backend would now send the campaign and store consent_id + ledger_hash with it.
        setLog((l) => [`Offer sent to ${customer.external_ref} under consent ${gate.consent_id}`, ...l]);
      }
    } catch (e) {
      setError(e); // fail closed: no answer means no processing
    } finally {
      setChecking(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} testID="consent-check-screen">
      <Title>Check before processing</Title>
      <Body muted>
        {`Before your backend uses ${customer.external_ref}'s data for "${PURPOSE}", it asks Consenzy whether that purpose is allowed. Only an allowed answer lets the offer go out.`}
      </Body>
      <Button testID="send-offers" label="Send me offers" onPress={() => void sendOffers()} busy={checking} />

      {error != null && <Small tone="danger">{`Check failed, nothing was sent (fail closed): ${describeError(error)}`}</Small>}
      {result && (
        <Card testID="check-result">
          {result.allowed ? (
            <Small tone="success" testID="check-allowed">
              {`Allowed (basis: ${result.basis}). Offer sent.`}
            </Small>
          ) : (
            <Small tone="danger" testID="check-denied">
              Not allowed: no active marketing consent. Nothing was sent.
            </Small>
          )}
          <Mono testID="check-consent-id">{`consent_id: ${result.consent_id ?? 'null'}`}</Mono>
          <Mono testID="check-ledger-hash">{`ledger_hash: ${result.ledger_hash ?? 'null'}`}</Mono>
          <Mono>{`ledger_event_id: ${result.ledger_event_id ?? 'null'}`}</Mono>
          <Mono>{`expires_at: ${result.expires_at ?? 'null'}`}</Mono>
        </Card>
      )}

      <MarketingOptIn onGranted={() => setResult(null)} />

      {log.length > 0 && (
        <Card>
          <Small muted>Audit trail (what your backend stores with each use)</Small>
          {log.map((line, i) => (
            <Mono key={i}>{line}</Mono>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

/** A one-tap opt-in for just the marketing purpose, built with the SDK hooks (the quickstart's custom-screen example). */
function MarketingOptIn({ onGranted }: { onGranted: () => void }) {
  const session = useConsentSession();
  const { notice } = useNotice('en');
  const { canGiveConsent } = useCapabilities();
  const [state, setState] = useState<string | null>(null);
  if (!notice) return null;
  const marketing = notice.purposes.filter((p) => p.code === PURPOSE).map((p) => p.id);

  const optIn = async () => {
    try {
      await session.giveConsent({ noticeId: notice.id, purposeIds: marketing, channel: 'mobile_app' });
      setState('Marketing consent recorded. Tap "Send me offers" again.');
      onGranted();
    } catch (e) {
      setState(describeError(e));
    }
  };

  return (
    <Card>
      <Small muted>No marketing consent yet? The customer can opt in here (or on the Consent tab).</Small>
      <Button testID="opt-in-marketing" variant="secondary" label="Yes, send me offers" disabled={!canGiveConsent} onPress={() => void optIn()} />
      {state && <Small testID="opt-in-state">{state}</Small>}
    </Card>
  );
}
