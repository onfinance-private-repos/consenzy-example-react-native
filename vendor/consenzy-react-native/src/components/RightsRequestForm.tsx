// Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';
import { useConsentSession, useConsentTheme } from '../context.tsx';
import { useCapabilities, useDataRequests } from '../hooks.ts';
import type { ConsentTheme, ConsentThemeOverrides } from '../theme.ts';
import type { DataRequest, RequestType } from '../types.ts';
import { validateRightsRequest, type FieldPair, type RightsRequestErrors, type RightsRequestValues } from '../validation.ts';
import { Button, DEFAULT_FOOTER, ErrorText, Footer, ThemedText } from './ui.tsx';

export interface RightsRequestFormLabels {
  title: string;
  requestType: string;
  types: Record<RequestType, string>;
  typeHelp: Record<RequestType, string>;
  note: string;
  reason: string;
  description: string;
  fieldName: string;
  fieldValue: string;
  addField: string;
  removeField: string;
  nomineeName: string;
  nomineeEmail: string;
  nomineePhone: string;
  relationship: string;
  submit: string;
  submitted: (dueAt: string) => string;
  /** Shown instead of the form when the session lacks requests:write. */
  filingNotAllowed: string;
  pastRequests: string;
  noPastRequests: string;
  pastRequest: (request: DataRequest, typeLabel: string) => string;
  footer: string | null;
}

const OFFLINE_CHANNEL_NAMES: Record<string, string> = {
  email: 'email',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  phone: 'phone',
  branch: 'branch',
};

/** " via WhatsApp" etc. for a request that arrived outside the app; nothing for app/web/other or an older server. */
function channelSuffix(channel: string | undefined): string {
  const name = channel ? OFFLINE_CHANNEL_NAMES[channel] : undefined;
  return name ? ` via ${name}` : '';
}

export const defaultRightsRequestFormLabels: RightsRequestFormLabels = {
  title: 'Exercise your data rights',
  requestType: 'What would you like to do?',
  types: {
    access: 'Access my data',
    correction: 'Correct my data',
    completion: 'Complete my data',
    updating: 'Update my data',
    erasure: 'Erase my data',
    grievance: 'Raise a grievance',
    nomination: 'Nominate someone',
  },
  typeHelp: {
    access: 'Get a summary of your personal data and how it is processed.',
    correction: 'Tell us which details are wrong and what they should be.',
    completion: 'Tell us which details are incomplete and what they should be.',
    updating: 'Tell us which details have changed and their new values.',
    erasure: 'Ask us to erase your data, unless we must keep it by law or for a purpose you consented to.',
    grievance: 'Tell us about a problem with how your data was handled.',
    nomination: 'Choose someone to exercise your rights if you die or become incapacitated.',
  },
  note: 'Note (optional)',
  reason: 'Reason (optional)',
  description: 'Describe your grievance',
  fieldName: 'Field (e.g. address_line1)',
  fieldValue: 'Correct value',
  addField: 'Add another field',
  removeField: 'Remove',
  nomineeName: "Nominee's full name",
  nomineeEmail: "Nominee's email",
  nomineePhone: "Nominee's phone (+91...)",
  relationship: 'Relationship to you',
  submit: 'Submit request',
  submitted: (due) => `Request received. We will respond by ${due.slice(0, 10)}.`,
  filingNotAllowed: 'Rights requests cannot be filed from this session. Please contact your bank.',
  pastRequests: 'Your requests',
  noPastRequests: 'You have not filed any requests yet.',
  pastRequest: (r, typeLabel) =>
    `${typeLabel}: ${r.status.replace(/_/g, ' ')} (filed ${r.received_at.slice(0, 10)}${channelSuffix(r.channel)})`,
  footer: DEFAULT_FOOTER,
};

export interface RightsRequestFormProps {
  /** Request types offered. Defaults to access, correction, erasure, grievance and nomination. */
  types?: RequestType[];
  initialType?: RequestType;
  onSubmitted?: (request: DataRequest) => void;
  onError?: (error: unknown) => void;
  theme?: ConsentThemeOverrides;
  labels?: Partial<RightsRequestFormLabels>;
  /**
   * Also list the principal's past requests under the form. Shown only when the session holds
   * requests:read.
   */
  showPastRequests?: boolean;
  testID?: string;
}

const DEFAULT_TYPES: RequestType[] = ['access', 'correction', 'erasure', 'grievance', 'nomination'];
const isFieldType = (t: RequestType) => t === 'correction' || t === 'completion' || t === 'updating';

/**
 * Files a Data Principal rights request (DPDP ss.11-14) via POST /v1/me/data-requests. The form
 * is replaced by an explanation when the session lacks requests:write.
 */
export function RightsRequestForm({
  types = DEFAULT_TYPES,
  initialType,
  onSubmitted,
  onError,
  theme: themeOverrides,
  labels: labelOverrides,
  showPastRequests = false,
  testID,
}: RightsRequestFormProps) {
  const theme = useConsentTheme(themeOverrides);
  const labels = useMemo(() => ({ ...defaultRightsRequestFormLabels, ...labelOverrides }), [labelOverrides]);
  const session = useConsentSession();
  const { known, canFileRequests, canReadRequests } = useCapabilities();
  const listPast = showPastRequests && known && canReadRequests;
  const past = useDataRequests({ enabled: listPast });
  const [type, setType] = useState<RequestType>(initialType ?? types[0] ?? 'access');
  const [values, setValues] = useState<RightsRequestValues>({ fields: [{ field: '', value: '' }] });
  const [errors, setErrors] = useState<RightsRequestErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<unknown>(null);
  const [submitted, setSubmitted] = useState<DataRequest | null>(null);

  const set = (key: keyof RightsRequestValues) => (text: string) => setValues((v) => ({ ...v, [key]: text }));
  const fields = values.fields ?? [];
  const setRow = (i: number, patch: Partial<FieldPair>) =>
    setValues((v) => ({ ...v, fields: (v.fields ?? []).map((r, j) => (j === i ? { ...r, ...patch } : r)) }));

  const chooseType = (t: RequestType) => {
    setType(t);
    setErrors({});
    setSubmitError(null);
    setSubmitted(null);
  };

  const submit = async () => {
    const result = validateRightsRequest(type, values);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSubmitError(null);
    setSubmitting(true);
    try {
      const request = await session.fileDataRequest(type, result.details);
      setSubmitted(request);
      setValues({ fields: [{ field: '', value: '' }] });
      onSubmitted?.(request);
      if (listPast) void past.refresh();
    } catch (e) {
      setSubmitError(e);
      onError?.(e);
    } finally {
      setSubmitting(false);
    }
  };

  const input = (key: keyof RightsRequestValues, label: string, opts: InputOpts = {}) => (
    <LabeledInput
      theme={theme}
      testID={`rights-${key}`}
      label={label}
      value={(values[key] as string | undefined) ?? ''}
      onChangeText={set(key)}
      error={errors[key]}
      {...opts}
    />
  );

  const pastList = listPast && (
    <View testID="rights-past-requests" style={{ marginTop: theme.spacing * 1.5 }}>
      <ThemedText theme={theme} kind="body" role="header">
        {labels.pastRequests}
      </ThemedText>
      <ErrorText theme={theme} error={past.error} />
      {!past.loading && !past.error && past.requests.length === 0 && (
        <ThemedText theme={theme} kind="small" muted>
          {labels.noPastRequests}
        </ThemedText>
      )}
      {past.requests.map((r) => (
        <ThemedText key={r.id} theme={theme} kind="small" testID={`rights-past-${r.id}`}>
          {labels.pastRequest(r, labels.types[r.request_type as RequestType] ?? r.request_type)}
        </ThemedText>
      ))}
    </View>
  );

  if (!canFileRequests) {
    return (
      <ScrollView testID={testID} style={{ backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: theme.spacing }}>
        <ThemedText theme={theme} kind="title" role="header">
          {labels.title}
        </ThemedText>
        <ThemedText theme={theme} role="alert" testID="rights-not-allowed">
          {labels.filingNotAllowed}
        </ThemedText>
        {pastList}
        <Footer theme={theme} label={labels.footer} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      testID={testID}
      style={{ backgroundColor: theme.colors.background }}
      contentContainerStyle={{ padding: theme.spacing }}
      keyboardShouldPersistTaps="handled"
    >
      <ThemedText theme={theme} kind="title" role="header">
        {labels.title}
      </ThemedText>
      <ThemedText theme={theme} kind="small" muted>
        {labels.requestType}
      </ThemedText>
      <View accessibilityRole="radiogroup" accessibilityLabel={labels.requestType} style={{ gap: theme.spacing / 2 }}>
        {types.map((t) => {
          const active = t === type;
          return (
            <Pressable
              key={t}
              testID={`rights-type-${t}`}
              onPress={() => chooseType(t)}
              accessibilityRole="radio"
              accessibilityLabel={labels.types[t]}
              accessibilityHint={labels.typeHelp[t]}
              accessibilityState={{ checked: active, selected: active }}
              style={{
                minHeight: 44,
                padding: theme.spacing / 1.5,
                justifyContent: 'center',
                borderRadius: theme.radius,
                borderWidth: active ? 2 : 1,
                borderColor: active ? theme.colors.primary : theme.colors.border,
                backgroundColor: active ? theme.colors.surface : theme.colors.background,
              }}
            >
              <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.body, fontWeight: active ? '600' : '400' }}>
                {labels.types[t]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ marginTop: theme.spacing }}>
        <ThemedText theme={theme} kind="small" muted>
          {labels.typeHelp[type]}
        </ThemedText>

        {type === 'access' && input('note', labels.note, { multiline: true })}

        {isFieldType(type) && (
          <View>
            {fields.map((row, i) => (
              <View
                key={i}
                style={{ borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius, padding: theme.spacing / 2, marginBottom: theme.spacing / 2 }}
              >
                <LabeledInput
                  theme={theme}
                  testID={`rights-field-name-${i}`}
                  label={labels.fieldName}
                  value={row.field}
                  onChangeText={(t) => setRow(i, { field: t })}
                  autoCapitalize="none"
                />
                <LabeledInput
                  theme={theme}
                  testID={`rights-field-value-${i}`}
                  label={labels.fieldValue}
                  value={row.value}
                  onChangeText={(t) => setRow(i, { value: t })}
                  error={errors.fieldRows?.[i]}
                />
                {fields.length > 1 && (
                  <Button
                    theme={theme}
                    variant="secondary"
                    label={labels.removeField}
                    accessibilityLabel={`${labels.removeField} ${row.field || i + 1}`}
                    onPress={() => setValues((v) => ({ ...v, fields: (v.fields ?? []).filter((_, j) => j !== i) }))}
                  />
                )}
              </View>
            ))}
            <ErrorText theme={theme} error={errors.fields} testID="rights-fields-error" />
            <Button
              testID="rights-add-field"
              theme={theme}
              variant="secondary"
              label={labels.addField}
              disabled={fields.length >= 50}
              onPress={() => setValues((v) => ({ ...v, fields: [...(v.fields ?? []), { field: '', value: '' }] }))}
            />
            {input('note', labels.note, { multiline: true })}
          </View>
        )}

        {type === 'erasure' && input('reason', labels.reason, { multiline: true })}

        {type === 'grievance' && input('description', labels.description, { multiline: true, required: true })}

        {type === 'nomination' && (
          <View>
            {input('nominee_name', labels.nomineeName, { required: true })}
            {input('relationship', labels.relationship, { required: true })}
            {input('nominee_email', labels.nomineeEmail, { keyboardType: 'email-address', autoCapitalize: 'none' })}
            {input('nominee_phone', labels.nomineePhone, { keyboardType: 'phone-pad' })}
          </View>
        )}
      </View>

      <ErrorText theme={theme} error={errors.form} testID="rights-form-error" />
      <ErrorText theme={theme} error={submitError} testID="rights-submit-error" />
      {submitted && (
        <Text accessibilityRole="alert" accessibilityLiveRegion="polite" testID="rights-submitted" style={{ color: theme.colors.text, marginVertical: theme.spacing / 2 }}>
          {labels.submitted(submitted.due_at)}
        </Text>
      )}
      <Button
        testID="rights-submit"
        theme={theme}
        label={labels.submit}
        onPress={() => void submit()}
        busy={submitting}
        style={{ marginTop: theme.spacing }}
      />
      {pastList}
      <Footer theme={theme} label={labels.footer} />
    </ScrollView>
  );
}

interface InputOpts {
  multiline?: boolean;
  required?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences';
}

function LabeledInput({
  theme,
  label,
  value,
  onChangeText,
  error,
  testID,
  multiline,
  required,
  keyboardType,
  autoCapitalize,
}: {
  theme: ConsentTheme;
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  error?: string;
  testID?: string;
} & InputOpts) {
  return (
    <View style={{ marginTop: theme.spacing / 2 }}>
      <Text style={{ color: theme.colors.text, fontSize: theme.fontSize.small, marginBottom: 4 }}>
        {required ? `${label} *` : label}
      </Text>
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        accessibilityLabel={label}
        accessibilityHint={error}
        aria-required={required}
        aria-invalid={!!error}
        multiline={multiline}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        placeholderTextColor={theme.colors.mutedText}
        style={{
          minHeight: multiline ? 88 : 44,
          borderWidth: 1,
          borderColor: error ? theme.colors.danger : theme.colors.border,
          borderRadius: theme.radius,
          paddingHorizontal: theme.spacing,
          paddingVertical: 8,
          color: theme.colors.text,
          fontSize: theme.fontSize.body,
          fontFamily: theme.fontFamily,
          textAlignVertical: multiline ? 'top' : 'center',
        }}
      />
      {error ? (
        <Text accessibilityRole="alert" style={{ color: theme.colors.danger, fontSize: theme.fontSize.small, marginTop: 2 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
