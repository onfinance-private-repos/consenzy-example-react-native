/*
 * @onfinance/consenzy/widget: framework-free Web Components for Consenzy.
 *
 *   <cdm-consent-banner>   notice + per-purpose consent (unchecked by default)
 *   <cdm-consent-manager>  active consents with one-click Withdraw
 *   <cdm-rights-request>   access / correction / erasure / grievance / nomination
 *
 * Importing this module registers the elements (when customElements exists).
 *
 * Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0
 */
import type { Language, MeRequestChannel, PrincipalChannel, RequestType } from "../types";
import { defineElement } from "./base";
import type { ConsentSessionLike } from "./base";
import { ConsentBannerElement } from "./banner";
import type { ConsentBannerResult } from "./banner";
import { ConsentManagerElement } from "./manager";
import { RightsRequestElement } from "./rights";

export { ConsentBannerElement, ConsentManagerElement, RightsRequestElement };
export type { ConsentBannerResult, ConsentSessionLike };
export { registerStrings, LANGUAGE_NAMES } from "./i18n";
export type { Strings } from "./i18n";

export const ELEMENT_NAMES = {
  banner: "cdm-consent-banner",
  manager: "cdm-consent-manager",
  rights: "cdm-rights-request",
} as const;

/** Registers the custom elements. Safe to call more than once; a no-op without customElements (SSR). */
export function defineConsentElements(): void {
  if (typeof HTMLElement === "undefined") return;
  defineElement(ELEMENT_NAMES.banner, ConsentBannerElement);
  defineElement(ELEMENT_NAMES.manager, ConsentManagerElement);
  defineElement(ELEMENT_NAMES.rights, RightsRequestElement);
}

defineConsentElements();

export interface MountHandle<E extends HTMLElement> {
  element: E;
  unmount(): void;
}

export interface MountConsentBannerOptions {
  session: ConsentSessionLike;
  /** Initial language. Default "en". */
  language?: Language;
  /** Languages in the switcher. Default ["en", "hi"]. */
  languages?: Language[];
  /** "web" (default) or "mobile_app" (e.g. inside a WebView). */
  channel?: PrincipalChannel;
  onDone?: (result: ConsentBannerResult) => void;
}

function attach<E extends HTMLElement>(container: Element, element: E): MountHandle<E> {
  if (!container || typeof (container as Element).appendChild !== "function") {
    throw new TypeError("mount target must be a DOM element");
  }
  container.appendChild(element);
  return { element, unmount: () => element.remove() };
}

/** Render a consent banner into `container`. */
export function mountConsentBanner(container: Element, options: MountConsentBannerOptions): MountHandle<ConsentBannerElement> {
  defineConsentElements();
  const el = document.createElement(ELEMENT_NAMES.banner) as ConsentBannerElement;
  el.setAttribute("language", options.language ?? "en");
  if (options.languages?.length) el.setAttribute("languages", options.languages.join(","));
  if (options.channel) el.setAttribute("channel", options.channel);
  el.onDone = options.onDone ?? null;
  el.session = options.session;
  return attach(container, el);
}

/** Render the "manage my consents" list into `container`. */
export function mountConsentManager(
  container: Element,
  options: { session: ConsentSessionLike; language?: Language },
): MountHandle<ConsentManagerElement> {
  defineConsentElements();
  const el = document.createElement(ELEMENT_NAMES.manager) as ConsentManagerElement;
  el.setAttribute("language", options.language ?? "en");
  el.session = options.session;
  return attach(container, el);
}

/** Render the rights-request form into `container`. */
export function mountRightsRequest(
  container: Element,
  options: {
    session: ConsentSessionLike;
    language?: Language;
    types?: RequestType[];
    /** Recorded on each request: "web" (default) or "app" (e.g. inside a WebView). */
    channel?: MeRequestChannel;
  },
): MountHandle<RightsRequestElement> {
  defineConsentElements();
  const el = document.createElement(ELEMENT_NAMES.rights) as RightsRequestElement;
  el.setAttribute("language", options.language ?? "en");
  if (options.types?.length) el.setAttribute("types", options.types.join(","));
  if (options.channel) el.setAttribute("channel", options.channel);
  el.session = options.session;
  return attach(container, el);
}

declare global {
  interface HTMLElementTagNameMap {
    "cdm-consent-banner": ConsentBannerElement;
    "cdm-consent-manager": ConsentManagerElement;
    "cdm-rights-request": RightsRequestElement;
  }
  interface HTMLElementEventMap {
    "cdm-consent-done": CustomEvent<ConsentBannerResult>;
    "cdm-consent-withdrawn": CustomEvent<{ consent: import("../types").MeConsentOut }>;
    "cdm-request-filed": CustomEvent<{ request: import("../types").DataRequestOut }>;
    "cdm-error": CustomEvent<{ error: unknown }>;
  }
}
