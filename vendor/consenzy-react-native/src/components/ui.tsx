// Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import type { ConsentTheme } from '../theme.ts';

export type ButtonVariant = 'primary' | 'secondary' | 'danger';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  theme: ConsentTheme;
  variant?: ButtonVariant;
  disabled?: boolean;
  busy?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/** A plain, high-contrast button. Every variant has the same size, so no choice is visually demoted. */
export function Button({
  label,
  onPress,
  theme,
  variant = 'primary',
  disabled,
  busy,
  accessibilityLabel,
  accessibilityHint,
  testID,
  style,
}: ButtonProps) {
  const { colors } = theme;
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : colors.background;
  const fg = variant === 'primary' ? colors.onPrimary : variant === 'danger' ? colors.onDanger : colors.primary;
  const border = variant === 'secondary' ? colors.primary : bg;
  const inactive = disabled || busy;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !!inactive, busy: !!busy }}
      style={({ pressed }) => [
        {
          minHeight: 48,
          paddingHorizontal: theme.spacing,
          borderRadius: theme.radius,
          borderWidth: 2,
          borderColor: border,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: inactive ? 0.5 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontSize: theme.fontSize.body, fontWeight: '600', fontFamily: theme.fontFamily }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function ThemedText({
  theme,
  kind = 'body',
  children,
  muted,
  role,
  testID,
}: {
  theme: ConsentTheme;
  kind?: 'title' | 'body' | 'small';
  muted?: boolean;
  role?: 'header' | 'text' | 'alert';
  testID?: string;
  children: ReactNode;
}) {
  return (
    <Text
      testID={testID}
      accessibilityRole={role}
      style={{
        color: muted ? theme.colors.mutedText : theme.colors.text,
        fontSize: theme.fontSize[kind],
        fontWeight: kind === 'title' ? '700' : '400',
        fontFamily: theme.fontFamily,
        marginBottom: theme.spacing / 2,
      }}
    >
      {children}
    </Text>
  );
}

export function ErrorText({ theme, error, testID }: { theme: ConsentTheme; error: unknown; testID?: string }) {
  if (!error) return null;
  return (
    <Text
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{ color: theme.colors.danger, fontSize: theme.fontSize.small, marginVertical: theme.spacing / 2 }}
    >
      {describeError(error)}
    </Text>
  );
}

/** Human-readable message for an error, using ConsentApiError.detail when present. */
export function describeError(error: unknown): string {
  if (error && typeof error === 'object') {
    const detail = (error as { detail?: unknown }).detail;
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) {
      const msgs = detail
        .map((d) => (d && typeof d === 'object' && 'msg' in d ? String((d as { msg: unknown }).msg) : null))
        .filter(Boolean);
      if (msgs.length) return msgs.join('; ');
    }
    if (error instanceof Error && error.message) return error.message;
  }
  return String(error);
}

export function Loading({ theme, label }: { theme: ConsentTheme; label: string }) {
  return (
    <View accessibilityLabel={label} style={{ padding: theme.spacing * 2, alignItems: 'center' }}>
      <ActivityIndicator color={theme.colors.primary} />
    </View>
  );
}

export const DEFAULT_FOOTER = 'Consent managed by Consenzy';

/** Small attribution line shown under the prebuilt components. Pass `null` as the label to hide it. */
export function Footer({ theme, label }: { theme: ConsentTheme; label: string | null }) {
  if (!label) return null;
  return (
    <Text
      accessibilityRole="text"
      style={{ color: theme.colors.mutedText, fontSize: theme.fontSize.small, textAlign: 'center', marginTop: theme.spacing }}
    >
      {label}
    </Text>
  );
}
