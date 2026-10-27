// Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0
//
// Consenzy React Native SDK: provider, hooks and prebuilt DPDP consent screens for
// Consent Data Master. Uses principal session tokens (cps_...) only.

export { ConsentProvider, useConsentSession, useConsentTheme } from './context.tsx';
export type { ConsentProviderProps } from './context.tsx';
export { useMe, useNotice, useConsents, useDataRequests, useCapabilities, useBreachNotices } from './hooks.ts';
export { isUuid, sortBreachNotices, unacknowledgedCount } from './breach.ts';
export {
  hasCapability,
  canGiveConsent,
  canFileRequests,
  canReadRequests,
  isActingAsGuardian,
  isGuardianRequiredError,
  isMissingCapabilityError,
} from './capabilities.ts';
export type { ResourceState } from './hooks.ts';

export { ConsentSheet, defaultConsentSheetLabels } from './components/ConsentSheet.tsx';
export type { ConsentSheetProps, ConsentSheetLabels, ConsentSheetResult } from './components/ConsentSheet.tsx';
export { ConsentManager, defaultConsentManagerLabels } from './components/ConsentManager.tsx';
export type { ConsentManagerProps, ConsentManagerLabels } from './components/ConsentManager.tsx';
export { RightsRequestForm, defaultRightsRequestFormLabels } from './components/RightsRequestForm.tsx';
export type { RightsRequestFormProps, RightsRequestFormLabels } from './components/RightsRequestForm.tsx';
export { BreachNotices, BreachNoticesBadge, defaultBreachNoticesLabels } from './components/BreachNotices.tsx';
export type { BreachNoticesProps, BreachNoticesLabels, BreachNoticesBadgeProps } from './components/BreachNotices.tsx';
export { describeError } from './components/ui.tsx';

export { validateRightsRequest } from './validation.ts';
export type { FieldPair, RightsRequestValues, RightsRequestErrors, ValidationResult } from './validation.ts';
export { defaultTheme, mergeTheme } from './theme.ts';
export type { ConsentTheme, ConsentThemeOverrides } from './theme.ts';
export { LANGUAGE_NAMES, ALL_LANGUAGES, languageName } from './languages.ts';
export type {
  BreachNotice,
  Consent,
  ConsentSessionLike,
  DataRequest,
  Language,
  Me,
  Notice,
  NoticePurpose,
  RequestType,
  SessionActingAs,
  SessionCapability,
} from './types.ts';

// Re-export the core client so apps need only one import.
export { ConsentSession, ConsentApiError } from '@onfinance/consenzy';
