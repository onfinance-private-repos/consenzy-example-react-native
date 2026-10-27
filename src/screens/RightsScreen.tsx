// Journey 4: rights requests and status tracking.
// File access (s.11), correction (s.12(1)), erasure (s.12(3)) and grievance (s.13) requests through the principal
// session, validated on the device with the SDK's validateRightsRequest, then track every request: status, the channel
// it arrived on (requests made on WhatsApp, email or at a branch appear here too) and the statutory due date.
// The second tab shows the SDK's drop-in RightsRequestForm with its past-requests list.
import {
  RightsRequestForm,
  describeError,
  useCapabilities,
  useDataRequests,
  validateRightsRequest,
  type DataRequest,
  type RequestType,
  type RightsRequestErrors,
} from '@onfinance/consenzy-react-native';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Body, Button, Card, Field, Mono, Segmented, Small, Title, styles } from '../ui';

type FiledType = Extract<RequestType, 'access' | 'correction' | 'erasure' | 'grievance'>;

const TYPES: { value: FiledType; label: string }[] = [
  { value: 'access', label: 'Access' },
  { value: 'correction', label: 'Correction' },
  { value: 'erasure', label: 'Erasure' },
  { value: 'grievance', label: 'Grievance' },
];

const CHANNEL_NAMES: Record<string, string> = {
  app: 'this app',
  web: 'website',
  whatsapp: 'WhatsApp',
  email: 'email',
  sms: 'SMS',
  phone: 'phone',
  branch: 'branch',
  other: 'other',
};

export function RightsScreen() {
  const [variant, setVariant] = useState<'custom' | 'form'>('custom');
  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <Segmented
          label="Implementation"
          value={variant}
          onChange={setVariant}
          testIDPrefix="rights-variant"
          options={[
            { value: 'custom', label: 'Custom screen (hooks)' },
            { value: 'form', label: 'Drop-in RightsRequestForm' },
          ]}
        />
      </View>
      {variant === 'custom' ? (
        <CustomRights />
      ) : (
        <RightsRequestForm types={['access', 'correction', 'erasure', 'grievance', 'nomination']} showPastRequests />
      )}
    </View>
  );
}

function CustomRights() {
  const { canFileRequests, canReadRequests } = useCapabilities();
  // One hook for both: `requests` is the status-tracking list, `file` files and then refreshes it.
  const { requests, loading, error, refresh, file } = useDataRequests({ enabled: canReadRequests });
  const [type, setType] = useState<FiledType>('access');
  const [note, setNote] = useState('');
  const [field, setField] = useState('address_line1');
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<RightsRequestErrors>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'danger' } | null>(null);

  // The file-request call: validate on the device, then POST /v1/me/data-requests via the SDK.
  const submit = async () => {
    const related = requests[0]?.id;
    const v = validateRightsRequest(type, {
      note,
      reason,
      description,
      fields: [{ field, value }],
    });
    if (!v.ok) {
      setErrors(v.errors);
      return;
    }
    setErrors({});
    const details = type === 'grievance' && related ? { ...v.details, related_request_id: related } : v.details;
    setBusy(true);
    setMessage(null);
    try {
      const r = await file(type, details);
      setMessage({ text: `Filed ${r.request_type} request, due by ${r.due_at.slice(0, 10)}`, tone: 'success' });
      setNote('');
      setValue('');
      setReason('');
      setDescription('');
    } catch (e) {
      setMessage({ text: describeError(e), tone: 'danger' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.screen} testID="rights-screen" keyboardShouldPersistTaps="handled">
      <Title>Exercise your data rights</Title>
      {canFileRequests ? (
        <>
          <Segmented label="Request type" value={type} onChange={setType} options={TYPES} testIDPrefix="request-type" />
          {type === 'access' && <Field testID="access-note" label="Note (optional)" value={note} onChangeText={setNote} error={errors.note} />}
          {type === 'correction' && (
            <>
              <Field testID="correction-field" label="Field" value={field} onChangeText={setField} autoCapitalize="none" error={errors.fieldRows?.[0] ?? errors.fields} />
              <Field testID="correction-value" label="Correct value" value={value} onChangeText={setValue} />
            </>
          )}
          {type === 'erasure' && <Field testID="erasure-reason" label="Reason (optional)" value={reason} onChangeText={setReason} error={errors.reason} />}
          {type === 'grievance' && (
            <>
              <Field testID="grievance-description" label="Describe your grievance" value={description} onChangeText={setDescription} multiline error={errors.description} />
              {requests[0] && <Small muted>{`Linked to your latest request (${requests[0].request_type}).`}</Small>}
            </>
          )}
          <Button testID="submit-request" label="Submit request" onPress={() => void submit()} busy={busy} />
        </>
      ) : (
        <Body muted>This session cannot file requests (no requests:write capability).</Body>
      )}
      {message && <Small tone={message.tone} testID="rights-message">{message.text}</Small>}

      <View style={{ marginTop: 24 }}>
        <Title>Your requests</Title>
        {canReadRequests ? (
          <>
            <Button testID="refresh-requests" label="Refresh status" variant="secondary" onPress={() => void refresh()} busy={loading} />
            {error && <Small tone="danger">{describeError(error)}</Small>}
            {!loading && !error && requests.length === 0 && <Body muted>No requests yet.</Body>}
            {requests.map((r) => (
              <RequestRow key={r.id} r={r} />
            ))}
          </>
        ) : (
          <Body muted>This session cannot list requests (no requests:read capability).</Body>
        )}
      </View>
    </ScrollView>
  );
}

function RequestRow({ r }: { r: DataRequest }) {
  const channel = r.channel ? (CHANNEL_NAMES[r.channel] ?? r.channel) : 'this app';
  return (
    <Card testID={`request-${r.id}`}>
      <Body>{`${r.request_type} · ${r.status.replace(/_/g, ' ')}`}</Body>
      <Small muted testID={`request-channel-${r.id}`}>
        {`Received ${r.received_at.slice(0, 10)} via ${channel}${r.channel_reference ? ` (ref ${r.channel_reference})` : ''}`}
      </Small>
      <Small muted>{`Due by ${r.due_at.slice(0, 10)}${r.closed_at ? ` · closed ${r.closed_at.slice(0, 10)}` : ''}`}</Small>
      <Mono>{r.id}</Mono>
    </Card>
  );
}
