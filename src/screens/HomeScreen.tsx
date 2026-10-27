// Home: who is signed in, the five journeys as tabs, and logout (which revokes the cps_ token server-side).
import { describeError, useCapabilities, useConsentSession } from '@onfinance/consenzy-react-native';
import { useState, type ComponentType } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useApp } from '../appContext';
import { Button, Small, colors } from '../ui';
import { ConsentCheckScreen } from './ConsentCheckScreen';
import { ConsentCollectionScreen } from './ConsentCollectionScreen';
import { GuardianScreen } from './GuardianScreen';
import { PreferencesScreen } from './PreferencesScreen';
import { RightsScreen } from './RightsScreen';

const TABS: { key: string; label: string; Screen: ComponentType }[] = [
  { key: 'consent', label: 'Consent', Screen: ConsentCollectionScreen },
  { key: 'check', label: 'Check', Screen: ConsentCheckScreen },
  { key: 'preferences', label: 'Preferences', Screen: PreferencesScreen },
  { key: 'rights', label: 'Rights', Screen: RightsScreen },
  { key: 'guardian', label: 'Guardian', Screen: GuardianScreen },
];

export function HomeScreen({ onSignedOut }: { onSignedOut: () => void }) {
  const { backend, customer, info } = useApp();
  const session = useConsentSession();
  const { me } = useCapabilities();
  const [tab, setTab] = useState(TABS[0]!.key);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Active = (TABS.find((t) => t.key === tab) ?? TABS[0]!).Screen;

  const logout = async () => {
    setBusy(true);
    try {
      await session.logout(); // POST /v1/me/logout revokes the token
      onSignedOut();
    } catch (e) {
      setError(describeError(e));
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 12, borderBottomWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', color: colors.text }} testID="signed-in-as">
            {customer.external_ref}
          </Text>
          <Small muted>{`${me?.acting_as ?? info.acting_as} · ${backend.description}`}</Small>
          <Small muted>{`capabilities: ${(me?.capabilities ?? info.capabilities).join(', ')}`}</Small>
          {error && <Small tone="danger">{error}</Small>}
        </View>
        <Button testID="logout" label="Log out" variant="secondary" onPress={() => void logout()} busy={busy} />
      </View>
      <View style={{ flex: 1 }}>
        <Active />
      </View>
      <View accessibilityRole="tablist" style={{ flexDirection: 'row', borderTopWidth: 1, borderColor: colors.border }}>
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <Pressable
              key={t.key}
              testID={`tab-${t.key}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              onPress={() => setTab(t.key)}
              style={{ flex: 1, paddingVertical: 12, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 12, color: active ? colors.primary : colors.muted, fontWeight: active ? '700' : '400' }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
