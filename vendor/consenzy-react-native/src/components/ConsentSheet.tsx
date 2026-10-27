// Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0
import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { useConsentSession, useConsentTheme } from '../context.tsx';
import { isGuardianRequiredError } from '../capabilities.ts';
import { useCapabilities, useNotice } from '../hooks.ts';
import { languageName } from '../languages.ts';
import type { ConsentThemeOverrides } from '../theme.ts';
import type { Consent, Me, Notice, NoticePurpose } from '../types.ts';
import { Button, DEFAULT_FOOTER, ErrorText, Footer, Loading, ThemedText } from './ui.tsx';

export interface ConsentSheetLabels {
  language: string;
  dataCollected: string;
  retention: (days: number | null) => string;
  acceptSelected: string;
  rejectAll: string;
  noneSelectedHint: string;
  loading: string;
  retry: string;
  consentTo: (purposeName: string) => string;
  /** Context shown when the session was minted with acting_as=guardian. */
  actingAsGuardian: (me: Me) => string;
  /** Shown instead of the API detail when the server requires a guardian session (422). */
  guardianRequired: string;
  /** Shown when the session lacks consents:write; Accept selected is then disabled. */
  consentNotAllowed: string;
  /** Footer attribution; `null` hides it. */
  footer: string | null;
}

export const defaultConsentSheetLabels: ConsentSheetLabels = {
  language: 'Language',
  dataCollected: 'Data used',
  retention: (days) =>
    days == null ? 'Kept only as long as needed for this purpose' : `Kept for up to ${days} days`,
  acceptSelected: 'Accept selected',
  rejectAll: 'Reject all',
  noneSelectedHint: 'Turn on at least one purpose to accept, or choose Reject all.',
  loading: 'Loading consent notice',
  retry: 'Try again',
  consentTo: (name) => `Consent to ${name}`,
  actingAsGuardian: (me) =>
    `You are acting as guardian for the account holder (${me.external_ref}). The choices you make here are recorded as given by a parent or lawful guardian.`,
  guardianRequired: 'A parent or guardian must give this consent. Please ask them to sign in and complete this step.',
  consentNotAllowed: 'Consent cannot be given from this session. Please contact your bank.',
  footer: DEFAULT_FOOTER,
};

export type ConsentSheetResult =
  | { action: 'accepted'; consents: Consent[]; notice: Notice; purposeIds: string[] }
  | { action: 'rejected'; notice: Notice };

export interface ConsentSheetProps {
  /** Initial language. Defaults to the principal's preferred language (resolved by the server). */
  language?: string;
  /** Languages offered in the picker. The picker is hidden when only one is given. */
  languages?: string[];
  onLanguageChange?: (language: string) => void;
  /** Called after consents are granted, or when the principal rejects all. */
  onComplete?: (result: ConsentSheetResult) => void;
  onError?: (error: unknown) => void;
  theme?: ConsentThemeOverrides;
  labels?: Partial<ConsentSheetLabels>;
  testID?: string;
}

/**
 * Shows the current notice with one switch per purpose, all OFF by default (DPDP s.6(1):
 * consent must be a clear affirmative action). "Accept selected" grants only the purposes
 * the principal switched on; "Reject all" grants nothing. Both buttons are the same size.
 */
export function ConsentSheet({
  language,
  languages = ['en', 'hi'],
  onLanguageChange,
  onComplete,
  onError,
  theme: themeOverrides,
  labels: labelOverrides,
  testID,
}: ConsentSheetProps) {
  const theme = useConsentTheme(themeOverrides);
  const labels = useMemo(() => ({ ...defaultConsentSheetLabels, ...labelOverrides }), [labelOverrides]);
  const session = useConsentSession();
  const { me, canGiveConsent, actingAsGuardian } = useCapabilities();
  const [lang, setLang] = useState<string | undefined>(language);
  const { notice, loading, error, refresh } = useNotice(lang);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  useEffect(() => setLang(language), [language]);
  // A different notice (new version or language) needs a fresh, explicit choice.
  useEffect(() => setSelected({}), [notice?.id]);

  const selectedIds = notice ? notice.purposes.filter((p) => selected[p.id]).map((p) => p.id) : [];

  const chooseLanguage = (code: string) => {
    setLang(code);
    onLanguageChange?.(code);
  };

  const accept = async () => {
    if (!notice || selectedIds.length === 0 || !canGiveConsent) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const consents = await session.giveConsent({ noticeId: notice.id, purposeIds: selectedIds, channel: 'mobile_app' });
      onComplete?.({ action: 'accepted', consents, notice, purposeIds: selectedIds });
    } catch (e) {
      setSubmitError(e);
      onError?.(e);
    } finally {
      setSubmitting(false);
    }
  };

  const rejectAll = () => {
    if (!notice) return;
    setSelected({});
    onComplete?.({ action: 'rejected', notice });
  };

  if (loading && !notice) return <Loading theme={theme} label={labels.loading} />;
  if (error && !notice) {
    return (
      <View style={{ padding: theme.spacing, backgroundColor: theme.colors.background }} testID={testID}>
        <ErrorText theme={theme} error={error} />
        <Button theme={theme} label={labels.retry} variant="secondary" onPress={() => void refresh()} />
      </View>
    );
  }
  if (!notice) return null;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }} testID={testID}>
      <ScrollView contentContainerStyle={{ padding: theme.spacing }}>
        {languages.length > 1 && (
          <View accessibilityRole="radiogroup" accessibilityLabel={labels.language} style={{ marginBottom: theme.spacing }}>
            <ThemedText theme={theme} kind="small" muted>
              {labels.language}
            </ThemedText>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing / 2 }}>
              {languages.map((code) => {
                const active = (lang ?? notice.language) === code;
                return (
                  <Pressable
                    key={code}
                    testID={`consent-language-${code}`}
                    onPress={() => chooseLanguage(code)}
                    accessibilityRole="radio"
                    accessibilityLabel={languageName(code)}
                    accessibilityState={{ checked: active, selected: active }}
                    style={{
                      minHeight: 40,
                      paddingHorizontal: theme.spacing,
                      justifyContent: 'center',
                      borderRadius: theme.radius,
                      borderWidth: 1,
                      borderColor: active ? theme.colors.primary : theme.colors.border,
                      backgroundColor: active ? theme.colors.primary : theme.colors.background,
                    }}
                  >
                    <Text style={{ color: active ? theme.colors.onPrimary : theme.colors.text, fontSize: theme.fontSize.small }}>
                      {languageName(code)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <ThemedText theme={theme} kind="title" role="header">
          {notice.title}
        </ThemedText>
        <ThemedText theme={theme}>{notice.body}</ThemedText>
        {actingAsGuardian && me && (
          <ThemedText theme={theme} kind="small" testID="consent-guardian-context">
            {labels.actingAsGuardian(me)}
          </ThemedText>
        )}

        {notice.purposes.map((purpose) => (
          <PurposeRow
            key={purpose.id}
            purpose={purpose}
            value={!!selected[purpose.id]}
            onChange={(v) => setSelected((s) => ({ ...s, [purpose.id]: v }))}
            labels={labels}
            theme={theme}
            disabled={submitting || !canGiveConsent}
          />
        ))}

        <ErrorText
          theme={theme}
          error={isGuardianRequiredError(submitError) ? labels.guardianRequired : submitError}
          testID="consent-sheet-error"
        />
        {!canGiveConsent && (
          <ThemedText theme={theme} kind="small" role="alert" testID="consent-not-allowed">
            {labels.consentNotAllowed}
          </ThemedText>
        )}
        {canGiveConsent && selectedIds.length === 0 && (
          <ThemedText theme={theme} kind="small" muted>
            {labels.noneSelectedHint}
          </ThemedText>
        )}
        <View style={{ flexDirection: 'row', gap: theme.spacing, marginTop: theme.spacing }}>
          <Button
            testID="consent-reject-all"
            theme={theme}
            variant="secondary"
            label={labels.rejectAll}
            onPress={rejectAll}
            disabled={submitting}
            style={{ flex: 1 }}
          />
          <Button
            testID="consent-accept-selected"
            theme={theme}
            variant="secondary"
            label={labels.acceptSelected}
            onPress={() => void accept()}
            disabled={selectedIds.length === 0 || !canGiveConsent}
            busy={submitting}
            style={{ flex: 1 }}
          />
        </View>
        <Footer theme={theme} label={labels.footer} />
      </ScrollView>
    </View>
  );
}

function PurposeRow({
  purpose,
  value,
  onChange,
  labels,
  theme,
  disabled,
}: {
  purpose: NoticePurpose;
  value: boolean;
  onChange: (v: boolean) => void;
  labels: ConsentSheetLabels;
  theme: ReturnType<typeof useConsentTheme>;
  disabled: boolean;
}) {
  return (
    <View
      style={{
        backgroundColor: theme.colors.surface,
        borderRadius: theme.radius,
        borderWidth: 1,
        borderColor: theme.colors.border,
        padding: theme.spacing,
        marginTop: theme.spacing,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <View style={{ flex: 1, paddingRight: theme.spacing }}>
          <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.body, fontWeight: '600', fontFamily: theme.fontFamily }}>
            {purpose.name}
          </Text>
        </View>
        <Switch
          testID={`consent-switch-${purpose.id}`}
          value={value}
          onValueChange={onChange}
          disabled={disabled}
          accessibilityRole="switch"
          accessibilityLabel={labels.consentTo(purpose.name)}
          accessibilityState={{ checked: value, disabled }}
          trackColor={{ true: theme.colors.switchTrackOn, false: theme.colors.switchTrackOff }}
          thumbColor={theme.colors.switchThumb}
        />
      </View>
      <ThemedText theme={theme} kind="small">
        {purpose.description}
      </ThemedText>
      {purpose.data_categories.length > 0 && (
        <ThemedText theme={theme} kind="small" muted>
          {`${labels.dataCollected}: ${purpose.data_categories.join(', ')}`}
        </ThemedText>
      )}
      <ThemedText theme={theme} kind="small" muted>
        {labels.retention(purpose.retention_days)}
      </ThemedText>
    </View>
  );
}
