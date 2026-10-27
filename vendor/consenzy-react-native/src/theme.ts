// Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0

/** Visual tokens for the prebuilt components. Uses system fonts only; no remote assets. */
export interface ConsentTheme {
  colors: {
    background: string;
    surface: string;
    text: string;
    mutedText: string;
    border: string;
    primary: string;
    onPrimary: string;
    danger: string;
    onDanger: string;
    switchTrackOn: string;
    switchTrackOff: string;
    switchThumb: string;
  };
  spacing: number;
  radius: number;
  fontSize: { title: number; body: number; small: number };
  /** Optional system font family name (e.g. a font already bundled in the host app). */
  fontFamily?: string;
}

export type ConsentThemeOverrides = {
  colors?: Partial<ConsentTheme['colors']>;
  spacing?: number;
  radius?: number;
  fontSize?: Partial<ConsentTheme['fontSize']>;
  fontFamily?: string;
};

export const defaultTheme: ConsentTheme = {
  colors: {
    background: '#FFFFFF',
    surface: '#F5F6F8',
    text: '#111827',
    mutedText: '#4B5563',
    border: '#D1D5DB',
    primary: '#1F3A8A',
    onPrimary: '#FFFFFF',
    danger: '#B91C1C',
    onDanger: '#FFFFFF',
    switchTrackOn: '#1F3A8A',
    switchTrackOff: '#9CA3AF',
    switchThumb: '#FFFFFF',
  },
  spacing: 12,
  radius: 8,
  fontSize: { title: 20, body: 15, small: 13 },
};

export function mergeTheme(base: ConsentTheme, overrides?: ConsentThemeOverrides): ConsentTheme {
  if (!overrides) return base;
  return {
    ...base,
    ...overrides,
    colors: { ...base.colors, ...overrides.colors },
    fontSize: { ...base.fontSize, ...overrides.fontSize },
  };
}
