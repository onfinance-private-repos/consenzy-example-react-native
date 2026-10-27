// Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0
//
// Pure helpers for personal data breach notices (GET /v1/me/breach-notices).
import type { BreachNotice } from './types.ts';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a canonical (hyphenated) UUID string. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/** Throws a TypeError unless `value` is a UUID; used before an id goes into a URL path. */
export function assertUuid(value: unknown, name: string): string {
  if (!isUuid(value)) throw new TypeError(`${name} must be a UUID`);
  return value;
}

function time(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

/** A copy of `notices`, newest `generated_at` first (ties broken by notice_id for a stable order). */
export function sortBreachNotices(notices: readonly BreachNotice[]): BreachNotice[] {
  return [...notices].sort(
    (a, b) => time(b.generated_at) - time(a.generated_at) || a.notice_id.localeCompare(b.notice_id),
  );
}

/** How many notices the principal has not yet acknowledged (for a badge). */
export function unacknowledgedCount(notices: readonly BreachNotice[] | undefined | null): number {
  return (notices ?? []).filter((n) => n.acknowledged_at == null).length;
}
