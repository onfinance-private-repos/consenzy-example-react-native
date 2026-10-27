// Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useConsentTheme } from '../context.tsx';
import { useCapabilities, useConsents, useNotice } from '../hooks.ts';
import type { ConsentThemeOverrides } from '../theme.ts';
import type { Consent } from '../types.ts';
import { Button, DEFAULT_FOOTER, ErrorText, Footer, Loading, ThemedText, describeError } from './ui.tsx';

export interface ConsentManagerLabels {
  title: string;
  empty: string;
  givenOn: (date: string) => string;
  expiresOn: (date: string) => string;
  withdraw: string;
  withdrawFor: (purposeName: string) => string;
  confirmPrompt: (purposeName: string) => string;
  confirmWithdraw: string;
  cancel: string;
  loading: string;
  retry: string;
  /** Shown when the session lacks consents:write; Withdraw buttons are then disabled. */
  withdrawNotAllowed: string;
  footer: string | null;
}

export const defaultConsentManagerLabels: ConsentManagerLabels = {
  title: 'Your consents',
  empty: 'You have no active consents.',
  givenOn: (d) => `Given on ${d}`,
  expiresOn: (d) => `Expires on ${d}`,
  withdraw: 'Withdraw',
  withdrawFor: (name) => `Withdraw consent for ${name}`,
  confirmPrompt: (name) =>
    `Withdraw consent for ${name}? Processing for this purpose will stop. This does not affect processing already done.`,
  confirmWithdraw: 'Yes, withdraw',
  cancel: 'Cancel',
  loading: 'Loading your consents',
  retry: 'Try again',
  withdrawNotAllowed: 'Consent cannot be withdrawn from this session. Please contact your bank.',
  footer: DEFAULT_FOOTER,
};

export interface ConsentManagerProps {
  /** Language used to look up purpose names from the current notice. */
  language?: string;
  /** Optional reason recorded with each withdrawal. */
  withdrawalReason?: string;
  onWithdrawn?: (consent: Consent) => void;
  onError?: (error: unknown) => void;
  theme?: ConsentThemeOverrides;
  labels?: Partial<ConsentManagerLabels>;
  /** Format ISO timestamps for display. Defaults to the date part (YYYY-MM-DD). */
  formatDate?: (iso: string) => string;
  testID?: string;
}

/**
 * Lists the principal's active consents with a Withdraw button on each (DPDP s.6(4):
 * withdrawal must be as easy as giving consent). Withdrawal is one tap plus an inline
 * confirmation; no reason is required.
 */
export function ConsentManager({
  language,
  withdrawalReason,
  onWithdrawn,
  onError,
  theme: themeOverrides,
  labels: labelOverrides,
  formatDate = (iso) => iso.slice(0, 10),
  testID,
}: ConsentManagerProps) {
  const theme = useConsentTheme(themeOverrides);
  const labels = useMemo(() => ({ ...defaultConsentManagerLabels, ...labelOverrides }), [labelOverrides]);
  const { consents, loading, error, refresh, withdraw } = useConsents({ activeOnly: true });
  const { notice } = useNotice(language);
  const { canGiveConsent } = useCapabilities();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  const names = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of notice?.purposes ?? []) m[p.id] = p.name;
    return m;
  }, [notice]);
  const nameOf = (c: Consent) => names[c.purpose_id] ?? c.purpose_code;

  const doWithdraw = async (consent: Consent) => {
    setBusy(consent.id);
    setActionError(null);
    try {
      const result = await withdraw(consent.id, withdrawalReason);
      setConfirming(null);
      onWithdrawn?.(result);
    } catch (e) {
      setActionError(e);
      onError?.(e);
    } finally {
      setBusy(null);
    }
  };

  if (loading && consents.length === 0 && !error) return <Loading theme={theme} label={labels.loading} />;

  return (
    <ScrollView
      testID={testID}
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing }}
    >
      <ThemedText theme={theme} kind="title" role="header">
        {labels.title}
      </ThemedText>
      {error && (
        <View>
          <ErrorText theme={theme} error={error} />
          <Button theme={theme} variant="secondary" label={labels.retry} onPress={() => void refresh()} />
        </View>
      )}
      {!error && consents.length === 0 && <ThemedText theme={theme} muted>{labels.empty}</ThemedText>}
      {!canGiveConsent && consents.length > 0 && (
        <ThemedText theme={theme} kind="small" role="alert" testID="consent-withdraw-not-allowed">
          {labels.withdrawNotAllowed}
        </ThemedText>
      )}
      {actionError != null && (
        <Text accessibilityRole="alert" style={{ color: theme.colors.danger, fontSize: theme.fontSize.small }}>
          {describeError(actionError)}
        </Text>
      )}
      {consents.map((consent) => {
        const name = nameOf(consent);
        const isConfirming = confirming === consent.id;
        return (
          <View
            key={consent.id}
            testID={`consent-item-${consent.id}`}
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius,
              borderWidth: 1,
              borderColor: theme.colors.border,
              padding: theme.spacing,
              marginTop: theme.spacing,
            }}
          >
            <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.body, fontWeight: '600', fontFamily: theme.fontFamily }}>
              {name}
            </Text>
            <ThemedText theme={theme} kind="small" muted>
              {labels.givenOn(formatDate(consent.given_at))}
            </ThemedText>
            {consent.expires_at && (
              <ThemedText theme={theme} kind="small" muted>
                {labels.expiresOn(formatDate(consent.expires_at))}
              </ThemedText>
            )}
            {isConfirming ? (
              <View>
                <ThemedText theme={theme} kind="small" role="alert">
                  {labels.confirmPrompt(name)}
                </ThemedText>
                <View style={{ flexDirection: 'row', gap: theme.spacing }}>
                  <Button
                    testID={`consent-withdraw-cancel-${consent.id}`}
                    theme={theme}
                    variant="secondary"
                    label={labels.cancel}
                    onPress={() => setConfirming(null)}
                    disabled={busy === consent.id}
                    style={{ flex: 1 }}
                  />
                  <Button
                    testID={`consent-withdraw-confirm-${consent.id}`}
                    theme={theme}
                    variant="danger"
                    label={labels.confirmWithdraw}
                    accessibilityLabel={`${labels.confirmWithdraw}: ${name}`}
                    onPress={() => void doWithdraw(consent)}
                    disabled={!canGiveConsent}
                    busy={busy === consent.id}
                    style={{ flex: 1 }}
                  />
                </View>
              </View>
            ) : (
              <Button
                testID={`consent-withdraw-${consent.id}`}
                theme={theme}
                variant="secondary"
                label={labels.withdraw}
                accessibilityLabel={labels.withdrawFor(name)}
                onPress={() => setConfirming(consent.id)}
                disabled={busy != null || !canGiveConsent}
              />
            )}
          </View>
        );
      })}
      <Footer theme={theme} label={labels.footer} />
    </ScrollView>
  );
}
