/*
 * <cdm-consent-manager>: lists the person's active consents with a one-click Withdraw each.
 * DPDP s.6(4): withdrawing must be as easy as giving, so there is no confirmation maze.
 *
 * Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0
 */
import type { MeConsentOut, Uuid } from "../types";
import { CdmElement, h, nextId } from "./base";
import { formatDate } from "./i18n";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ready"; consents: MeConsentOut[]; busy: Set<Uuid>; message?: string; error?: string }
  | { kind: "error"; message: string };

export class ConsentManagerElement extends CdmElement {
  private state: State = { kind: "idle" };
  private names = new Map<Uuid, string>();
  private loadSeq = 0;

  protected async load(): Promise<void> {
    const session = this.session;
    if (!session) return;
    const seq = ++this.loadSeq;
    this.state = { kind: "loading" };
    this.render();
    try {
      const [consents, notice] = await Promise.all([
        session.listConsents({ activeOnly: true }),
        // Purpose names in the person's language; codes are the fallback if this fails.
        session.currentNotice(this.language).catch(() => null),
      ]);
      if (seq !== this.loadSeq) return;
      for (const p of notice?.purposes ?? []) this.names.set(p.id, p.name);
      this.state = { kind: "ready", consents, busy: new Set() };
    } catch (err) {
      if (seq !== this.loadSeq) return;
      this.state = { kind: "error", message: this.errorText(err) };
    }
    this.render();
  }

  private nameOf(c: MeConsentOut): string {
    return this.names.get(c.purpose_id) ?? c.purpose_code;
  }

  private async withdraw(consent: MeConsentOut): Promise<void> {
    const state = this.state;
    if (state.kind !== "ready" || state.busy.has(consent.id) || !this.session) return;
    state.busy.add(consent.id);
    state.error = undefined;
    state.message = undefined;
    this.render();
    try {
      const updated = await this.session.withdrawConsent(consent.id);
      const index = state.consents.findIndex((c) => c.id === consent.id);
      state.consents = state.consents.filter((c) => c.id !== consent.id);
      state.message = this.fmt(this.t.withdrawn, { name: this.nameOf(consent) });
      state.busy.delete(consent.id);
      this.render();
      // Move focus to the next Withdraw button (or the status message) so keyboard users don't lose their place.
      const next = state.consents[Math.min(index, state.consents.length - 1)];
      this.focusLater(next ? `[data-focus="withdraw-${next.id}"]` : "[data-status]");
      this.emit("cdm-consent-withdrawn", { consent: updated });
    } catch (err) {
      state.busy.delete(consent.id);
      state.error = this.errorText(err);
      this.render();
      this.emit("cdm-error", { error: err });
    }
  }

  protected render(): void {
    const t = this.t;
    const titleId = nextId("title");
    const brandId = nextId("brand");
    const state = this.state;
    const content: (HTMLElement | null)[] = [];

    if (state.kind === "idle" || state.kind === "loading") {
      content.push(h("p", { role: "status", "aria-live": "polite" }, t.loading));
    } else if (state.kind === "error") {
      content.push(
        h("p", { class: "error", role: "alert" }, state.message),
        h("div", { class: "actions" }, h("button", { type: "button", "data-focus": "retry", onclick: () => void this.load() }, t.retry)),
      );
    } else {
      content.push(
        h("p", { class: "status", role: "status", "aria-live": "polite", tabindex: "-1", "data-status": "" }, state.message ?? ""),
        state.error ? h("p", { class: "error", role: "alert" }, state.error) : null,
        state.consents.length === 0
          ? h("p", { class: "muted" }, t.managerEmpty)
          : h(
              "ul",
              { class: "list" },
              state.consents.map((c) => {
                const name = this.nameOf(c);
                const busy = state.busy.has(c.id);
                return h(
                  "li",
                  { class: "row", "data-consent-id": c.id },
                  h(
                    "div",
                    {},
                    h("h3", {}, name),
                    h("p", { class: "muted" }, this.fmt(t.givenOn, { date: formatDate(c.given_at, this.language) })),
                    c.expires_at ? h("p", { class: "muted" }, this.fmt(t.expiresOn, { date: formatDate(c.expires_at, this.language) })) : null,
                  ),
                  h(
                    "button",
                    {
                      type: "button",
                      class: "choice",
                      "data-action": "withdraw",
                      "data-focus": `withdraw-${c.id}`,
                      "aria-label": this.fmt(t.withdrawFor, { name }),
                      disabled: busy,
                      onclick: () => void this.withdraw(c),
                    },
                    busy ? t.saving : t.withdraw,
                  ),
                );
              }),
            ),
        h("p", { class: "muted" }, t.withdrawHint),
      );
    }

    this.mount(
      h(
        "section",
        { class: "card", "aria-labelledby": `${titleId} ${brandId}`, "aria-busy": state.kind === "loading" ? "true" : undefined },
        h("div", { class: "head" }, h("h2", { id: titleId }, t.managerTitle)),
        content,
        h("span", { class: "sr-only", id: brandId }, t.managerLabel),
        this.footer(),
      ),
    );
  }
}
