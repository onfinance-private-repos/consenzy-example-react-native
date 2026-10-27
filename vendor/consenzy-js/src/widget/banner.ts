/*
 * <cdm-consent-banner>: shows the current notice and asks for per-purpose consent.
 *
 * DPDP s.6(1) requires a clear affirmative action, so every purpose checkbox starts
 * unchecked, there is no "select all", and "Accept selected" / "Reject all" are styled
 * identically. Rejecting records nothing (absence of consent is the default state).
 *
 * Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0
 */
import type { Language, MeConsentOut, MeNoticeOut, MePurposeOut, PrincipalChannel, Uuid } from "../types";
import { CdmElement, h, nextId } from "./base";
import { LANGUAGE_NAMES } from "./i18n";

export interface ConsentBannerResult {
  action: "accepted" | "rejected";
  noticeId: Uuid | null;
  /** Consent artefacts created (empty when rejected). */
  granted: MeConsentOut[];
  selectedPurposeIds: Uuid[];
  declinedPurposeIds: Uuid[];
}

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; notice: MeNoticeOut; saving: boolean; error?: string }
  | { kind: "done"; result: ConsentBannerResult }
  | { kind: "error"; message: string };

export class ConsentBannerElement extends CdmElement {
  static override get observedAttributes(): string[] {
    return ["language", "languages", "channel"];
  }

  /** Called once the person accepts or rejects. Also dispatched as the `cdm-consent-done` event. */
  // No initializer on purpose: a value set before the element upgrades must survive.
  onDone?: ((result: ConsentBannerResult) => void) | null;

  private state: State = { kind: "idle" };
  private selected = new Set<Uuid>();
  private loadSeq = 0;

  /** Languages offered in the switcher (attribute `languages="en,hi,ta"`). Default en,hi. */
  get languages(): Language[] {
    const raw = this.getAttribute("languages") || "en,hi";
    const list = raw.split(",").map((s) => s.trim()).filter((s): s is Language => s in LANGUAGE_NAMES);
    return list.length ? list : ["en", "hi"];
  }

  get channel(): PrincipalChannel {
    return this.getAttribute("channel") === "mobile_app" ? "mobile_app" : "web";
  }

  /** Purpose ids currently ticked by the person. */
  get selectedPurposeIds(): Uuid[] {
    return [...this.selected];
  }

  protected override onAttributeChanged(name: string): void {
    if (name === "language") super.onAttributeChanged(name);
    else this.render();
  }

  protected async load(): Promise<void> {
    const session = this.session;
    if (!session) return;
    const seq = ++this.loadSeq;
    this.state = { kind: "loading" };
    this.render();
    try {
      const notice = await session.currentNotice(this.language);
      if (seq !== this.loadSeq) return;
      // Keep only selections that still exist on the (possibly re-localised) notice.
      const ids = new Set(notice.purposes.map((p) => p.id));
      for (const id of [...this.selected]) if (!ids.has(id)) this.selected.delete(id);
      this.state = { kind: "ready", notice, saving: false };
    } catch (err) {
      if (seq !== this.loadSeq) return;
      this.state = { kind: "error", message: this.errorText(err) };
    }
    this.render();
  }

  private async accept(): Promise<void> {
    if (this.state.kind !== "ready" || this.state.saving || !this.session) return;
    const notice = this.state.notice;
    // Submit in notice order, and only purposes that are on this notice and ticked.
    const purposeIds = notice.purposes.filter((p) => this.selected.has(p.id)).map((p) => p.id);
    if (purposeIds.length === 0) {
      this.finish({ action: "rejected", noticeId: notice.id, granted: [], selectedPurposeIds: [], declinedPurposeIds: notice.purposes.map((p) => p.id) });
      return;
    }
    this.state = { kind: "ready", notice, saving: true };
    this.render();
    try {
      const granted = await this.session.giveConsent({ noticeId: notice.id, purposeIds, channel: this.channel });
      this.finish({
        action: "accepted",
        noticeId: notice.id,
        granted,
        selectedPurposeIds: purposeIds,
        declinedPurposeIds: notice.purposes.filter((p) => !this.selected.has(p.id)).map((p) => p.id),
      });
    } catch (err) {
      this.state = { kind: "ready", notice, saving: false, error: this.errorText(err) };
      this.render();
      this.emit("cdm-error", { error: err });
    }
  }

  private reject(): void {
    if (this.state.kind !== "ready" || this.state.saving) return;
    const notice = this.state.notice;
    this.selected.clear();
    this.finish({ action: "rejected", noticeId: notice.id, granted: [], selectedPurposeIds: [], declinedPurposeIds: notice.purposes.map((p) => p.id) });
  }

  private finish(result: ConsentBannerResult): void {
    this.state = { kind: "done", result };
    this.render();
    this.focusLater("[data-status]");
    this.emit("cdm-consent-done", result);
    this.onDone?.(result);
  }

  protected render(): void {
    const t = this.t;
    const titleId = nextId("title");
    const brandId = nextId("brand");
    const state = this.state;

    const langSelectId = nextId("lang");
    const languageSwitcher = h(
      "div",
      { class: "lang" },
      h("label", { for: langSelectId }, t.language),
      h(
        "select",
        {
          id: langSelectId,
          "data-focus": "language",
          disabled: state.kind === "ready" && state.saving,
          onchange: (e: Event) => {
            this.language = (e.target as HTMLSelectElement).value as Language;
          },
        },
        this.languages.map((code) =>
          h("option", { value: code, selected: code === this.language, lang: code }, LANGUAGE_NAMES[code]),
        ),
      ),
    );

    let title = t.noticeFallbackTitle;
    const content: (HTMLElement | null)[] = [];

    if (state.kind === "idle" || state.kind === "loading") {
      content.push(h("p", { role: "status", "aria-live": "polite" }, t.loading));
    } else if (state.kind === "error") {
      content.push(
        h("p", { class: "error", role: "alert" }, state.message),
        h("div", { class: "actions" }, h("button", { type: "button", "data-focus": "retry", onclick: () => void this.load() }, t.retry)),
      );
    } else if (state.kind === "done") {
      content.push(
        h(
          "p",
          { class: "status", role: "status", "aria-live": "polite", tabindex: "-1", "data-status": "" },
          state.result.action === "accepted" ? t.saved : t.rejected,
        ),
        h("p", { class: "muted" }, t.withdrawHint),
      );
    } else {
      const { notice, saving, error } = state;
      title = notice.title;
      const descId = nextId("desc");
      content.push(
        h("div", { class: "body", id: descId, lang: notice.language, tabindex: "0" }, notice.body),
        h(
          "fieldset",
          { "aria-describedby": descId, disabled: saving },
          h("legend", {}, t.choosePurposes),
          notice.purposes.map((p) => this.purposeRow(p)),
        ),
        error ? h("p", { class: "error", role: "alert" }, error) : null,
        h(
          "div",
          { class: "actions" },
          h("button", { type: "button", class: "choice", "data-action": "accept", "data-focus": "accept", disabled: saving, onclick: () => void this.accept() }, saving ? t.saving : t.acceptSelected),
          h("button", { type: "button", class: "choice", "data-action": "reject", "data-focus": "reject", disabled: saving, onclick: () => this.reject() }, t.rejectAll),
        ),
        h("p", { class: "muted" }, t.withdrawHint),
      );
    }

    this.mount(
      h(
        "section",
        { class: "card", "aria-labelledby": `${titleId} ${brandId}`, "aria-busy": state.kind === "loading" || (state.kind === "ready" && state.saving) ? "true" : undefined },
        h("div", { class: "head" }, h("h2", { id: titleId }, title), languageSwitcher),
        content,
        h("span", { class: "sr-only", id: brandId }, t.bannerLabel),
        this.footer(),
      ),
    );
  }

  private purposeRow(p: MePurposeOut): HTMLElement {
    const t = this.t;
    const inputId = nextId("purpose");
    const metaId = nextId("meta");
    const checkbox = h("input", {
      type: "checkbox",
      id: inputId,
      name: "purpose",
      value: p.id,
      "data-purpose-id": p.id,
      "data-focus": `purpose-${p.id}`,
      "aria-describedby": metaId,
      onchange: (e: Event) => {
        const input = e.target as HTMLInputElement;
        if (input.checked) this.selected.add(p.id);
        else this.selected.delete(p.id);
      },
    }) as HTMLInputElement;
    // Set the live property (not the `checked` attribute): unchecked unless the person ticked it.
    checkbox.checked = this.selected.has(p.id);
    return h(
      "div",
      { class: "purpose" },
      checkbox,
      h("label", { for: inputId }, p.name),
      h(
        "div",
        { class: "meta", id: metaId },
        h("p", {}, p.description),
        p.data_categories.length
          ? h("div", {}, h("span", { class: "muted" }, `${t.dataCategories}: `), h("ul", { class: "chips" }, p.data_categories.map((c) => h("li", {}, c))))
          : null,
        h("p", { class: "muted" }, p.retention_days ? this.fmt(t.retentionDays, { n: p.retention_days }) : t.retentionUnspecified),
      ),
    );
  }
}
