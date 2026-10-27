/* Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0 */
import { ConsentApiError } from "../errors";
import type { ConsentSession } from "../session";
import type { Language } from "../types";
import { directionFor, format, stringsFor } from "./i18n";
import type { Strings } from "./i18n";
import { STYLES } from "./styles";

/** The subset of ConsentSession the widgets use (lets tests and wrappers pass a compatible object). */
export type ConsentSessionLike = Pick<
  ConsentSession,
  "currentNotice" | "giveConsent" | "listConsents" | "withdrawConsent" | "listDataRequests" | "fileDataRequest"
>;

// Allows importing the module during SSR (no DOM): elements are simply not defined there.
const HTMLElementBase: typeof HTMLElement =
  typeof HTMLElement !== "undefined" ? HTMLElement : (class {} as unknown as typeof HTMLElement);

let uid = 0;
export function nextId(prefix: string): string {
  uid += 1;
  return `cdm-${prefix}-${uid}`;
}

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | null | undefined | EventListener>;

/** Tiny DOM builder. Text is always set via text nodes: API content is never parsed as HTML. */
export function h(tag: string, attrs: Attrs = {}, ...children: (Child | Child[])[]): HTMLElement {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === "class") {
      node.className = String(value);
    } else if (value === true) {
      node.setAttribute(key, "");
    } else {
      node.setAttribute(key, String(value));
    }
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    node.append(typeof child === "string" ? document.createTextNode(child) : child);
  }
  return node;
}

export abstract class CdmElement extends HTMLElementBase {
  static get observedAttributes(): string[] {
    return ["language"];
  }

  protected readonly root: ShadowRoot;
  private _session: ConsentSessionLike | null = null;
  private connected = false;

  constructor() {
    super();
    this.root = this.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = STYLES;
    this.root.append(style);
  }

  /** A ConsentSession (set as a property, never an attribute: it is not serialisable). */
  get session(): ConsentSessionLike | null {
    return this._session;
  }
  set session(value: ConsentSessionLike | null) {
    this._session = value;
    if (this.connected && value) void this.load();
  }

  get language(): Language {
    return (this.getAttribute("language") || "en") as Language;
  }
  set language(value: Language) {
    this.setAttribute("language", value);
  }

  protected get t(): Strings {
    return stringsFor(this.language);
  }

  connectedCallback(): void {
    // A `session` assigned before the element was upgraded is an own data property that
    // shadows the accessor; move it onto the accessor.
    if (Object.prototype.hasOwnProperty.call(this, "session")) {
      const value = (this as { session?: ConsentSessionLike | null }).session ?? null;
      delete (this as { session?: unknown }).session;
      this._session = value;
    }
    this.connected = true;
    if (this._session) void this.load();
    else this.render();
  }

  disconnectedCallback(): void {
    this.connected = false;
  }

  attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
    if (oldValue === newValue || !this.connected) return;
    this.onAttributeChanged(name);
  }

  protected onAttributeChanged(name: string): void {
    if (name === "language" && this._session) void this.load();
  }

  protected abstract load(): Promise<void>;
  protected abstract render(): void;

  /** Replace everything except the stylesheet, restoring focus to the element with the same data-focus key. */
  protected mount(content: HTMLElement): void {
    const active = this.root.activeElement as HTMLElement | null;
    const focusKey = active?.getAttribute("data-focus") ?? null;
    while (this.root.childNodes.length > 1) this.root.lastChild!.remove();
    content.setAttribute("lang", this.language);
    content.setAttribute("dir", directionFor(this.language));
    this.root.append(content);
    if (focusKey) {
      const next = this.root.querySelector<HTMLElement>(`[data-focus="${focusKey}"]`);
      next?.focus();
    }
  }

  protected emit<T>(type: string, detail: T): void {
    this.dispatchEvent(new CustomEvent<T>(type, { detail, bubbles: true, composed: true }));
  }

  protected errorText(err: unknown): string {
    if (err instanceof ConsentApiError && (err.status === 400 || err.status === 404 || err.status === 409 || err.status === 422)) {
      return `${this.t.error} (${err.detailMessage})`;
    }
    return this.t.error;
  }

  protected footer(): HTMLElement {
    return h("p", { class: "footer" }, this.t.poweredBy);
  }

  protected fmt(template: string, values: Record<string, string | number>): string {
    return format(template, values);
  }

  protected focusLater(selector: string): void {
    queueMicrotask(() => this.root.querySelector<HTMLElement>(selector)?.focus());
  }
}

export function defineElement(name: string, ctor: CustomElementConstructor): void {
  if (typeof customElements === "undefined") return;
  if (!customElements.get(name)) customElements.define(name, ctor);
}
