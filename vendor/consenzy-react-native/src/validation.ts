// Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0
//
// Client-side mirror of the per-type `details` models in app/schemas.py (DETAILS_BY_TYPE).
// The server re-validates everything; this exists so the form can explain problems
// before a round trip.
import type { RequestType } from './types.ts';

export interface FieldPair {
  field: string;
  value: string;
}

export interface RightsRequestValues {
  note?: string;
  reason?: string;
  description?: string;
  fields?: FieldPair[];
  nominee_name?: string;
  nominee_email?: string;
  nominee_phone?: string;
  relationship?: string;
}

export type RightsRequestErrors = Partial<Record<keyof RightsRequestValues | 'form', string>> & {
  /** Per-row errors for correction pairs, by index. */
  fieldRows?: Record<number, string>;
};

export type ValidationResult =
  | { ok: true; details: Record<string, unknown> }
  | { ok: false; errors: RightsRequestErrors };

const FIELD_NAME = /^[a-z][a-z0-9_]{0,63}$/;
const PHONE = /^\+[1-9][0-9]{6,14}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SHORT = 1000;
const LONG = 4000;

function trimmed(v?: string): string {
  return (v ?? '').trim();
}

function optionalText(
  key: keyof RightsRequestValues,
  value: string | undefined,
  max: number,
  details: Record<string, unknown>,
  errors: RightsRequestErrors,
) {
  const t = trimmed(value);
  if (!t) return;
  if (t.length > max) errors[key] = `Must be ${max} characters or fewer.`;
  else details[key] = t;
}

/** Validate form values for `type` and build the `details` object the API expects. */
export function validateRightsRequest(type: RequestType, values: RightsRequestValues): ValidationResult {
  const details: Record<string, unknown> = {};
  const errors: RightsRequestErrors = {};

  switch (type) {
    case 'access':
      optionalText('note', values.note, SHORT, details, errors);
      break;

    case 'correction':
    case 'completion':
    case 'updating': {
      const rows = (values.fields ?? []).filter((r) => trimmed(r.field) || trimmed(r.value));
      const fields: Record<string, string> = {};
      const rowErrors: Record<number, string> = {};
      rows.forEach((row, i) => {
        const name = trimmed(row.field);
        const value = trimmed(row.value);
        if (!FIELD_NAME.test(name)) rowErrors[i] = 'Field names use lowercase letters, digits and underscores, starting with a letter.';
        else if (!value) rowErrors[i] = 'Enter the correct value.';
        else if (name in fields) rowErrors[i] = 'This field is listed twice.';
        else fields[name] = value;
      });
      if (rows.length === 0) errors.fields = 'Add at least one field to correct and its correct value.';
      else if (rows.length > 50) errors.fields = 'At most 50 fields per request.';
      if (Object.keys(rowErrors).length) errors.fieldRows = rowErrors;
      details.fields = fields;
      optionalText('note', values.note, SHORT, details, errors);
      break;
    }

    case 'erasure':
      optionalText('reason', values.reason, SHORT, details, errors);
      break;

    case 'grievance': {
      const d = trimmed(values.description);
      if (!d) errors.description = 'Describe your grievance.';
      else if (d.length > LONG) errors.description = `Must be ${LONG} characters or fewer.`;
      else details.description = d;
      break;
    }

    case 'nomination': {
      const name = trimmed(values.nominee_name);
      const relationship = trimmed(values.relationship);
      const email = trimmed(values.nominee_email);
      const phone = trimmed(values.nominee_phone).replace(/[\s-]/g, '');
      if (!name) errors.nominee_name = "Enter the nominee's name.";
      else if (name.length > 200) errors.nominee_name = 'Must be 200 characters or fewer.';
      else details.nominee_name = name;
      if (!relationship) errors.relationship = 'Enter your relationship to the nominee.';
      else if (relationship.length > 128) errors.relationship = 'Must be 128 characters or fewer.';
      else details.relationship = relationship;
      if (!email && !phone) errors.form = "Enter the nominee's email or phone number.";
      if (email) {
        if (!EMAIL.test(email)) errors.nominee_email = 'Enter a valid email address.';
        else details.nominee_email = email;
      }
      if (phone) {
        if (!PHONE.test(phone)) errors.nominee_phone = 'Use international format, e.g. +919876543210.';
        else details.nominee_phone = phone;
      }
      break;
    }

    default: {
      const never: never = type;
      errors.form = `Unsupported request type: ${String(never)}`;
    }
  }

  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, details };
}
