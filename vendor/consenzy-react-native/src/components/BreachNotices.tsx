// Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0
import { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useConsentTheme } from '../context.tsx';
import { useBreachNotices } from '../hooks.ts';
import type { ConsentThemeOverrides } from '../theme.ts';
import type { BreachNotice } from '../types.ts';
import { Button, DEFAULT_FOOTER, ErrorText, Footer, Loading, ThemedText } from './ui.tsx';

export interface BreachNoticesLabels {
  title: string;
  intro: string;
  empty: string;
  receivedOn: (date: string) => string;
  affectedData: (categories: string) => string;
  acknowledge: string;
  acknowledgeFor: (subject: string) => string;
  acknowledgedOn: (date: string) => string;
  unread: string;
  loading: string;
  retry: string;
  /** Badge accessibility label, e.g. "2 unread breach notices". */
  badge: (count: number) => string;
  footer: string | null;
}

export const defaultBreachNoticesLabels: BreachNoticesLabels = {
  title: 'Data breach notices',
  intro: 'We are required to tell you about personal data breaches that affect you.',
  empty: 'There are no data breach notices for you.',
  receivedOn: (d) => `Received on ${d}`,
  affectedData: (c) => `Data affected: ${c}`,
  acknowledge: 'I have read this',
  acknowledgeFor: (subject) => `I have read this: ${subject}`,
  acknowledgedOn: (d) => `You read this on ${d}`,
  unread: 'Unread',
  loading: 'Loading data breach notices',
  retry: 'Try again',
  badge: (n) => (n === 1 ? '1 unread data breach notice' : `${n} unread data breach notices`),
  footer: DEFAULT_FOOTER,
};

export interface BreachNoticesProps {
  onAcknowledged?: (notice: BreachNotice) => void;
  onError?: (error: unknown) => void;
  theme?: ConsentThemeOverrides;
  labels?: Partial<BreachNoticesLabels>;
  /** Format ISO timestamps for display. Defaults to the date part (YYYY-MM-DD). */
  formatDate?: (iso: string) => string;
  testID?: string;
}

/**
 * Lists the personal data breach intimations sent to the principal (DPDP Rules r.7(1)), newest
 * first, with an "I have read this" action on each unread one. Subject and body are shown as
 * plain text exactly as the server sent them; nothing is interpreted as HTML or markup.
 */
export function BreachNotices({
  onAcknowledged,
  onError,
  theme: themeOverrides,
  labels: labelOverrides,
  formatDate = (iso) => iso.slice(0, 10),
  testID,
}: BreachNoticesProps) {
  const theme = useConsentTheme(themeOverrides);
  const labels = useMemo(() => ({ ...defaultBreachNoticesLabels, ...labelOverrides }), [labelOverrides]);
  const { notices, loading, error, refresh, acknowledge } = useBreachNotices();
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<unknown>(null);

  const doAcknowledge = async (notice: BreachNotice) => {
    if (busy) return; // ignore double taps while a request is in flight
    setBusy(notice.breach_id);
    setActionError(null);
    try {
      const result = await acknowledge(notice.breach_id);
      onAcknowledged?.(result);
    } catch (e) {
      setActionError(e);
      onError?.(e);
    } finally {
      setBusy(null);
    }
  };

  if (loading && notices.length === 0 && !error) return <Loading theme={theme} label={labels.loading} />;

  return (
    <ScrollView
      testID={testID}
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing }}
    >
      <ThemedText theme={theme} kind="title" role="header">
        {labels.title}
      </ThemedText>
      <ThemedText theme={theme} kind="small" muted>
        {labels.intro}
      </ThemedText>
      {error && (
        <View>
          <ErrorText theme={theme} error={error} />
          <Button theme={theme} variant="secondary" label={labels.retry} onPress={() => void refresh()} />
        </View>
      )}
      {!error && notices.length === 0 && <ThemedText theme={theme} muted>{labels.empty}</ThemedText>}
      <ErrorText theme={theme} error={actionError} testID="breach-notice-action-error" />
      {notices.map((notice) => {
        const acknowledged = notice.acknowledged_at != null;
        return (
          <View
            key={notice.notice_id}
            testID={`breach-notice-${notice.breach_id}`}
            style={{
              backgroundColor: theme.colors.surface,
              borderRadius: theme.radius,
              borderWidth: acknowledged ? 1 : 2,
              borderColor: acknowledged ? theme.colors.border : theme.colors.danger,
              padding: theme.spacing,
              marginTop: theme.spacing,
            }}
          >
            {!acknowledged && (
              <Text style={{ color: theme.colors.danger, fontSize: theme.fontSize.small, fontWeight: '700' }}>
                {labels.unread}
              </Text>
            )}
            <Text
              accessibilityRole="header"
              style={{
                color: theme.colors.text,
                fontSize: theme.fontSize.body,
                fontWeight: '600',
                fontFamily: theme.fontFamily,
                marginBottom: theme.spacing / 2,
              }}
            >
              {notice.subject}
            </Text>
            <ThemedText theme={theme} kind="small" muted>
              {labels.receivedOn(formatDate(notice.generated_at))}
            </ThemedText>
            <ThemedText theme={theme} testID={`breach-notice-body-${notice.breach_id}`}>
              {notice.body}
            </ThemedText>
            {notice.data_categories.length > 0 && (
              <ThemedText theme={theme} kind="small">
                {labels.affectedData(notice.data_categories.join(', '))}
              </ThemedText>
            )}
            {acknowledged ? (
              <ThemedText theme={theme} kind="small" muted testID={`breach-notice-acknowledged-${notice.breach_id}`}>
                {labels.acknowledgedOn(formatDate(notice.acknowledged_at as string))}
              </ThemedText>
            ) : (
              <Button
                testID={`breach-notice-acknowledge-${notice.breach_id}`}
                theme={theme}
                label={labels.acknowledge}
                accessibilityLabel={labels.acknowledgeFor(notice.subject)}
                onPress={() => void doAcknowledge(notice)}
                disabled={busy != null && busy !== notice.breach_id}
                busy={busy === notice.breach_id}
              />
            )}
          </View>
        );
      })}
      <Footer theme={theme} label={labels.footer} />
    </ScrollView>
  );
}

export interface BreachNoticesBadgeProps {
  /** Number of unread notices, e.g. `useBreachNotices().unacknowledgedCount`. Nothing renders for 0. */
  count: number;
  theme?: ConsentThemeOverrides;
  /** Accessibility label; defaults to "N unread data breach notices". */
  label?: (count: number) => string;
  testID?: string;
}

/** A small count pill for a menu item or tab. Renders nothing when there is nothing unread. */
export function BreachNoticesBadge({ count, theme: themeOverrides, label, testID }: BreachNoticesBadgeProps) {
  const theme = useConsentTheme(themeOverrides);
  if (!count || count < 1) return null;
  const text = count > 99 ? '99+' : String(count);
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={(label ?? defaultBreachNoticesLabels.badge)(count)}
      style={{
        minWidth: 20,
        height: 20,
        paddingHorizontal: 6,
        borderRadius: 10,
        backgroundColor: theme.colors.danger,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color: theme.colors.onDanger, fontSize: 12, fontWeight: '700' }}>{text}</Text>
    </View>
  );
}
