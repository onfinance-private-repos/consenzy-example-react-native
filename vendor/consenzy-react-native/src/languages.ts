// Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0
import type { Language } from './types.ts';

/** Endonyms for the language picker: each language is shown in its own script. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  as: 'অসমীয়া',
  bn: 'বাংলা',
  brx: 'बड़ो',
  doi: 'डोगरी',
  gu: 'ગુજરાતી',
  hi: 'हिन्दी',
  kn: 'ಕನ್ನಡ',
  ks: 'کٲشُر',
  kok: 'कोंकणी',
  mai: 'मैथिली',
  ml: 'മലയാളം',
  mni: 'ꯃꯤꯇꯩꯂꯣꯟ',
  mr: 'मराठी',
  ne: 'नेपाली',
  or: 'ଓଡ଼ିଆ',
  pa: 'ਪੰਜਾਬੀ',
  sa: 'संस्कृतम्',
  sat: 'ᱥᱟᱱᱛᱟᱲᱤ',
  sd: 'سنڌي',
  ta: 'தமிழ்',
  te: 'తెలుగు',
  ur: 'اردو',
};

export const ALL_LANGUAGES = Object.keys(LANGUAGE_NAMES) as Language[];

export function languageName(code: string): string {
  return (LANGUAGE_NAMES as Record<string, string>)[code] ?? code;
}
