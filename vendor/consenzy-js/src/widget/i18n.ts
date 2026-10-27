/* Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0 */
import type { Language, RequestStatus, RequestType } from "../types";

/** UI chrome strings. Notice/purpose text itself comes from the API in the chosen language. */
export interface Strings {
  noticeFallbackTitle: string;
  choosePurposes: string;
  acceptSelected: string;
  rejectAll: string;
  language: string;
  dataCategories: string;
  retentionDays: string;
  retentionUnspecified: string;
  loading: string;
  saving: string;
  saved: string;
  rejected: string;
  withdrawHint: string;
  error: string;
  retry: string;
  poweredBy: string;
  bannerLabel: string;
  managerTitle: string;
  managerLabel: string;
  managerEmpty: string;
  withdraw: string;
  withdrawFor: string;
  withdrawn: string;
  givenOn: string;
  expiresOn: string;
  rightsTitle: string;
  rightsLabel: string;
  requestType: string;
  requestTypes: Record<RequestType, string>;
  note: string;
  fieldName: string;
  fieldValue: string;
  addField: string;
  removeField: string;
  invalidFieldName: string;
  reason: string;
  description: string;
  related: string;
  none: string;
  nomineeName: string;
  relationship: string;
  nomineeEmail: string;
  nomineePhone: string;
  contactRequired: string;
  required: string;
  submit: string;
  submitted: string;
  yourRequests: string;
  dueBy: string;
  statuses: Record<RequestStatus, string>;
}

const en: Strings = {
  noticeFallbackTitle: "Your privacy choices",
  choosePurposes: "Choose what you agree to. Nothing is selected until you select it.",
  acceptSelected: "Accept selected",
  rejectAll: "Reject all",
  language: "Language",
  dataCategories: "Data used",
  retentionDays: "Kept for {n} days",
  retentionUnspecified: "Retention period as stated in the notice",
  loading: "Loading…",
  saving: "Saving…",
  saved: "Your choices have been saved.",
  rejected: "You have not given consent for any of these purposes.",
  withdrawHint: "You can withdraw your consent at any time, as easily as you gave it.",
  error: "Something went wrong. Please try again.",
  retry: "Try again",
  poweredBy: "Consent managed by Consenzy",
  bannerLabel: "Consent notice (Consenzy)",
  managerTitle: "Your consents",
  managerLabel: "Manage your consents (Consenzy)",
  managerEmpty: "You have no active consents.",
  withdraw: "Withdraw",
  withdrawFor: "Withdraw consent for {name}",
  withdrawn: "Consent for {name} has been withdrawn.",
  givenOn: "Given on {date}",
  expiresOn: "Expires on {date}",
  rightsTitle: "Exercise your data rights",
  rightsLabel: "Data rights request (Consenzy)",
  requestType: "What would you like to do?",
  requestTypes: {
    access: "Get a summary of my data",
    correction: "Correct my data",
    completion: "Complete my data",
    updating: "Update my data",
    erasure: "Erase my data",
    grievance: "Raise a grievance",
    nomination: "Nominate someone to act for me",
  },
  note: "Note (optional)",
  fieldName: "Field to change",
  fieldValue: "Correct value",
  addField: "Add another field",
  removeField: "Remove",
  invalidFieldName: "Use lowercase letters, digits and underscores, starting with a letter (e.g. address_line1).",
  reason: "Reason (optional)",
  description: "Describe your grievance",
  related: "Related request (optional)",
  none: "None",
  nomineeName: "Nominee's full name",
  relationship: "Relationship to you",
  nomineeEmail: "Nominee's email",
  nomineePhone: "Nominee's phone (e.g. +919876543210)",
  contactRequired: "Give the nominee's email or phone number.",
  required: "This field is required.",
  submit: "Submit request",
  submitted: "Request received. Reference {id}. We will respond by {date}.",
  yourRequests: "Your requests",
  dueBy: "Response due by {date}",
  statuses: {
    received: "Received",
    in_progress: "In progress",
    awaiting_principal: "Awaiting your reply",
    completed: "Completed",
    rejected: "Rejected",
    withdrawn: "Withdrawn",
  },
};

const hi: Strings = {
  noticeFallbackTitle: "आपकी गोपनीयता संबंधी पसंद",
  choosePurposes: "चुनें कि आप किसके लिए सहमति देते हैं। जब तक आप स्वयं न चुनें, कुछ भी चयनित नहीं है।",
  acceptSelected: "चयनित स्वीकार करें",
  rejectAll: "सभी अस्वीकार करें",
  language: "भाषा",
  dataCategories: "उपयोग किया जाने वाला डेटा",
  retentionDays: "{n} दिनों तक रखा जाएगा",
  retentionUnspecified: "रखने की अवधि सूचना में बताए अनुसार",
  loading: "लोड हो रहा है…",
  saving: "सहेजा जा रहा है…",
  saved: "आपकी पसंद सहेज ली गई है।",
  rejected: "आपने इनमें से किसी भी उद्देश्य के लिए सहमति नहीं दी है।",
  withdrawHint: "आप किसी भी समय अपनी सहमति उतनी ही आसानी से वापस ले सकते हैं जितनी आसानी से आपने दी थी।",
  error: "कुछ गलत हो गया। कृपया पुनः प्रयास करें।",
  retry: "पुनः प्रयास करें",
  poweredBy: "सहमति प्रबंधन: Consenzy",
  bannerLabel: "सहमति सूचना (Consenzy)",
  managerTitle: "आपकी सहमतियाँ",
  managerLabel: "अपनी सहमतियाँ प्रबंधित करें (Consenzy)",
  managerEmpty: "आपकी कोई सक्रिय सहमति नहीं है।",
  withdraw: "वापस लें",
  withdrawFor: "{name} के लिए सहमति वापस लें",
  withdrawn: "{name} के लिए सहमति वापस ले ली गई है।",
  givenOn: "{date} को दी गई",
  expiresOn: "{date} को समाप्त",
  rightsTitle: "अपने डेटा अधिकारों का उपयोग करें",
  rightsLabel: "डेटा अधिकार अनुरोध (Consenzy)",
  requestType: "आप क्या करना चाहते हैं?",
  requestTypes: {
    access: "मेरे डेटा का सारांश प्राप्त करें",
    correction: "मेरा डेटा सुधारें",
    completion: "मेरा डेटा पूरा करें",
    updating: "मेरा डेटा अपडेट करें",
    erasure: "मेरा डेटा मिटाएँ",
    grievance: "शिकायत दर्ज करें",
    nomination: "मेरी ओर से कार्य करने के लिए किसी को नामित करें",
  },
  note: "टिप्पणी (वैकल्पिक)",
  fieldName: "बदलने वाला फ़ील्ड",
  fieldValue: "सही मान",
  addField: "एक और फ़ील्ड जोड़ें",
  removeField: "हटाएँ",
  invalidFieldName: "छोटे अंग्रेज़ी अक्षर, अंक और अंडरस्कोर का उपयोग करें, शुरुआत अक्षर से करें (जैसे address_line1)।",
  reason: "कारण (वैकल्पिक)",
  description: "अपनी शिकायत का विवरण दें",
  related: "संबंधित अनुरोध (वैकल्पिक)",
  none: "कोई नहीं",
  nomineeName: "नामित व्यक्ति का पूरा नाम",
  relationship: "आपसे संबंध",
  nomineeEmail: "नामित व्यक्ति का ईमेल",
  nomineePhone: "नामित व्यक्ति का फ़ोन (जैसे +919876543210)",
  contactRequired: "नामित व्यक्ति का ईमेल या फ़ोन नंबर दें।",
  required: "यह फ़ील्ड आवश्यक है।",
  submit: "अनुरोध भेजें",
  submitted: "अनुरोध प्राप्त हुआ। संदर्भ {id}। हम {date} तक उत्तर देंगे।",
  yourRequests: "आपके अनुरोध",
  dueBy: "उत्तर की अंतिम तिथि {date}",
  statuses: {
    received: "प्राप्त",
    in_progress: "प्रगति में",
    awaiting_principal: "आपके उत्तर की प्रतीक्षा",
    completed: "पूर्ण",
    rejected: "अस्वीकृत",
    withdrawn: "वापस लिया गया",
  },
};

const catalogs: Partial<Record<Language, Strings>> = { en, hi };

/**
 * Add or override UI strings for a language (e.g. ta, bn). Missing keys fall back to English.
 * Call before the elements render.
 */
export function registerStrings(language: Language, strings: Partial<Strings>): void {
  catalogs[language] = { ...en, ...(catalogs[language] ?? {}), ...strings };
}

export function stringsFor(language: string | null | undefined): Strings {
  return catalogs[(language ?? "en") as Language] ?? en;
}

export function format(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in values ? String(values[key]) : m));
}

/** Native names for the language switcher. */
export const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  as: "অসমীয়া",
  bn: "বাংলা",
  brx: "बड़ो",
  doi: "डोगरी",
  gu: "ગુજરાતી",
  hi: "हिन्दी",
  kn: "ಕನ್ನಡ",
  ks: "کٲشُر",
  kok: "कोंकणी",
  mai: "मैथिली",
  ml: "മലയാളം",
  mni: "ꯃꯤꯇꯩꯂꯣꯟ",
  mr: "मराठी",
  ne: "नेपाली",
  or: "ଓଡ଼ିଆ",
  pa: "ਪੰਜਾਬੀ",
  sa: "संस्कृतम्",
  sat: "ᱥᱟᱱᱛᱟᱲᱤ",
  sd: "سنڌي",
  ta: "தமிழ்",
  te: "తెలుగు",
  ur: "اردو",
};

const RTL = new Set(["ur", "ks", "sd"]);
export function directionFor(language: string): "rtl" | "ltr" {
  return RTL.has(language) ? "rtl" : "ltr";
}

export function formatDate(iso: string | null | undefined, language: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  try {
    return new Intl.DateTimeFormat(`${language}-IN`, { year: "numeric", month: "short", day: "numeric" }).format(date);
  } catch {
    return date.toISOString().slice(0, 10);
  }
}
