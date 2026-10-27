// Small presentational helpers for the example screens. Nothing Consenzy-specific lives here.
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';

export const colors = {
  primary: '#0B5FFF',
  text: '#1b1f24',
  muted: '#57606a',
  border: '#d0d7de',
  surface: '#f6f8fa',
  danger: '#b42318',
  success: '#1a7f37',
  background: '#ffffff',
};

export function Title({ children }: { children: ReactNode }) {
  return (
    <Text accessibilityRole="header" style={styles.title}>
      {children}
    </Text>
  );
}

export function Body({ children, muted, testID }: { children: ReactNode; muted?: boolean; testID?: string }) {
  return (
    <Text testID={testID} style={[styles.body, muted && { color: colors.muted }]}>
      {children}
    </Text>
  );
}

export function Small({ children, muted, testID, tone }: { children: ReactNode; muted?: boolean; testID?: string; tone?: 'danger' | 'success' }) {
  return (
    <Text
      testID={testID}
      accessibilityRole={tone === 'danger' ? 'alert' : undefined}
      style={[styles.small, muted && { color: colors.muted }, tone && { color: colors[tone] }]}
    >
      {children}
    </Text>
  );
}

export function Mono({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <Text testID={testID} selectable style={styles.mono}>
      {children}
    </Text>
  );
}

export function Card({ children, testID }: { children: ReactNode; testID?: string }) {
  return (
    <View testID={testID} style={styles.card}>
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled,
  busy,
  variant = 'primary',
  testID,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  testID?: string;
}) {
  const filled = variant !== 'secondary';
  const bg = variant === 'danger' ? colors.danger : variant === 'primary' ? colors.primary : colors.background;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={[
        styles.button,
        { backgroundColor: bg, borderColor: filled ? bg : colors.border, opacity: disabled ? 0.5 : 1 },
      ]}
    >
      {busy ? <ActivityIndicator color={filled ? '#fff' : colors.primary} /> : <Text style={{ color: filled ? '#fff' : colors.text, fontWeight: '600' }}>{label}</Text>}
    </Pressable>
  );
}

/** A row of mutually exclusive choices (radio group). */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  testIDPrefix,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  testIDPrefix?: string;
}) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ marginVertical: 6 }}>
      <Small muted>{label}</Small>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              testID={testIDPrefix ? `${testIDPrefix}-${o.value}` : undefined}
              accessibilityRole="radio"
              accessibilityLabel={o.label}
              accessibilityState={{ checked: active, selected: active }}
              onPress={() => onChange(o.value)}
              style={[styles.chip, active && { backgroundColor: colors.primary, borderColor: colors.primary }]}
            >
              <Text style={{ color: active ? '#fff' : colors.text, fontSize: 13 }}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ marginTop: 8 }}>
      <Small muted>{label}</Small>
      <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={styles.input} {...props} />
      {error ? <Small tone="danger">{error}</Small> : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { padding: 16, paddingBottom: 48, backgroundColor: colors.background },
  title: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
  body: { fontSize: 15, color: colors.text, marginVertical: 4, lineHeight: 21 },
  small: { fontSize: 13, color: colors.text, marginVertical: 2 },
  mono: { fontFamily: 'monospace', fontSize: 12, color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  button: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: 12,
    justifyContent: 'center',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 15,
    color: colors.text,
    backgroundColor: colors.background,
  },
});
