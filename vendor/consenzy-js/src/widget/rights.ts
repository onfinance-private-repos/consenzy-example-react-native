/*
 * <cdm-rights-request>: lets the Data Principal file access, correction, erasure, grievance
 * and nomination requests (DPDP ss.11–14) and see their open requests.
 *
 * Attribute `types="access,correction,erasure,grievance,nomination"` picks the request types
 * offered (completion and updating are also supported). Attribute `channel` records where the
 * request was filed: "web" (default) or "app" (e.g. inside a WebView; "mobile_app" also maps to "app").
 *
 * Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0
 */
import type { DataRequestOut, MeRequestChannel, RequestType } from "../types";
import { CdmElement, h, nextId } from "./base";
import { formatDate } from "./i18n";

const ALL_TYPES: RequestType[] = ["access", "correction", "completion", "updating", "erasure", "grievance", "nomination"];
const DEFAULT_TYPES: RequestType[] = ["access", "correction", "erasure", "grievance", "nomination"];
const CORRECTION_TYPES = new Set<RequestType>(["correction", "completion", "updating"]);
const FIELD_KEY = /^[a-z][a-z0-9_]{0,63}$/;

interface State {
  phase: "idle" | "ready" | "submitting";
  type: RequestType;
  correctionRows: number;
  requests: DataRequestOut[];
  fieldErrors: Record<string, string>;
  error?: string;
  submitted?: DataRequestOut;
}

export class RightsRequestElement extends CdmElement {
  static override get observedAttributes(): string[] {
    return ["language", "types", "channel"];
  }

  private state: State = { phase: "idle", type: "access", correctionRows: 1, requests: [], fieldErrors: {} };
  private loadSeq = 0;
  private clearForm = false;

  get types(): RequestType[] {
    const raw = this.getAttribute("types");
    if (!raw) return DEFAULT_TYPES;
    const list = raw.split(",").map((s) => s.trim()).filter((s): s is RequestType => (ALL_TYPES as string[]).includes(s));
    return list.length ? list : DEFAULT_TYPES;
  }

  /** Where requests filed here are recorded as arriving: "web" unless the `channel` attribute says "app". */
  get channel(): MeRequestChannel {
    const raw = this.getAttribute("channel");
    return raw === "app" || raw === "mobile_app" ? "app" : "web";
  }

  protected override onAttributeChanged(name: string): void {
    if (name === "types" && !this.types.includes(this.state.type)) this.state.type = this.types[0]!;
    this.render();
  }

  protected async load(): Promise<void> {
    const session = this.session;
    if (!session) return;
    const seq = ++this.loadSeq;
    if (!this.types.includes(this.state.type)) this.state.type = this.types[0]!;
    this.state.phase = "ready";
    this.render();
    try {
      const requests = await session.listDataRequests();
      if (seq !== this.loadSeq) return;
      this.state.requests = requests;
      this.render();
    } catch {
      // The list is informational; the form still works without it.
    }
  }

  /** Collect and validate the form. Returns null (and renders errors) when invalid. */
  private collect(form: HTMLFormElement): Record<string, unknown> | null {
    const t = this.t;
    const value = (name: string) => (form.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value ?? "").trim();
    const errors: Record<string, string> = {};
    const details: Record<string, unknown> = {};
    const type = this.state.type;

    if (type === "access") {
      if (value("note")) details.note = value("note");
    } else if (CORRECTION_TYPES.has(type)) {
      const fields: Record<string, string> = {};
      for (let i = 0; i < this.state.correctionRows; i++) {
        const key = value(`field_${i}`);
        const val = value(`value_${i}`);
        if (!key && !val) continue;
        if (!FIELD_KEY.test(key)) errors[`field_${i}`] = t.invalidFieldName;
        else if (!val) errors[`value_${i}`] = t.required;
        else fields[key] = val;
      }
      if (Object.keys(fields).length === 0 && Object.keys(errors).length === 0) errors.field_0 = t.required;
      details.fields = fields;
      if (value("note")) details.note = value("note");
    } else if (type === "erasure") {
      if (value("reason")) details.reason = value("reason");
    } else if (type === "grievance") {
      if (!value("description")) errors.description = t.required;
      else details.description = value("description");
      if (value("related_request_id")) details.related_request_id = value("related_request_id");
    } else if (type === "nomination") {
      for (const name of ["nominee_name", "relationship"]) {
        if (!value(name)) errors[name] = t.required;
        else details[name] = value(name);
      }
      if (value("nominee_email")) details.nominee_email = value("nominee_email");
      if (value("nominee_phone")) details.nominee_phone = value("nominee_phone");
      if (!details.nominee_email && !details.nominee_phone) errors.nominee_email = t.contactRequired;
    }

    this.state.fieldErrors = errors;
    if (Object.keys(errors).length) {
      this.render();
      this.focusLater('[aria-invalid="true"]');
      return null;
    }
    return details;
  }

  private async submit(form: HTMLFormElement): Promise<void> {
    if (this.state.phase === "submitting" || !this.session) return;
    const details = this.collect(form);
    if (!details) return;
    this.state.phase = "submitting";
    this.state.error = undefined;
    this.state.submitted = undefined;
    this.render();
    try {
      const created = await this.session.fileDataRequest(this.state.type, details as never, { channel: this.channel });
      this.state.submitted = created;
      this.state.requests = [created, ...this.state.requests.filter((r) => r.id !== created.id)];
      this.state.phase = "ready";
      this.state.correctionRows = 1;
      this.clearForm = true;
      this.render();
      this.focusLater("[data-status]");
      this.emit("cdm-request-filed", { request: created });
    } catch (err) {
      this.state.phase = "ready";
      this.state.error = this.errorText(err);
      this.render();
      this.focusLater('[role="alert"]');
      this.emit("cdm-error", { error: err });
    }
  }

  private field(
    name: string,
    label: string,
    opts: { type?: string; textarea?: boolean; required?: boolean; autocomplete?: string; pattern?: string } = {},
  ): HTMLElement {
    const id = nextId(name);
    const errId = `${id}-err`;
    const error = this.state.fieldErrors[name];
    const attrs = {
      id,
      name,
      "data-focus": `f-${name}`,
      required: !!opts.required,
      "aria-required": opts.required ? "true" : undefined,
      "aria-invalid": error ? "true" : undefined,
      "aria-describedby": error ? errId : undefined,
      autocomplete: opts.autocomplete,
      pattern: opts.pattern,
    };
    const control = opts.textarea ? h("textarea", attrs) : h("input", { type: opts.type ?? "text", ...attrs });
    return h(
      "div",
      { class: "field" },
      h("label", { for: id }, label),
      control,
      error ? h("p", { class: "error", id: errId }, error) : null,
    );
  }

  private typeFields(): (HTMLElement | null)[] {
    const t = this.t;
    const type = this.state.type;
    if (type === "access") return [this.field("note", t.note, { textarea: true })];
    if (type === "erasure") return [this.field("reason", t.reason, { textarea: true })];
    if (type === "grievance") {
      const relatedId = nextId("related");
      return [
        this.field("description", t.description, { textarea: true, required: true }),
        this.state.requests.length
          ? h(
              "div",
              { class: "field" },
              h("label", { for: relatedId }, t.related),
              h(
                "select",
                { id: relatedId, name: "related_request_id", "data-focus": "f-related" },
                h("option", { value: "" }, t.none),
                this.state.requests.map((r) =>
                  h("option", { value: r.id }, `${t.requestTypes[r.request_type] ?? r.request_type} · ${formatDate(r.received_at, this.language)} · ${r.id.slice(0, 8)}`),
                ),
              ),
            )
          : null,
      ];
    }
    if (type === "nomination") {
      return [
        this.field("nominee_name", t.nomineeName, { required: true, autocomplete: "off" }),
        this.field("relationship", t.relationship, { required: true }),
        this.field("nominee_email", t.nomineeEmail, { type: "email", autocomplete: "off" }),
        this.field("nominee_phone", t.nomineePhone, { type: "tel", autocomplete: "off", pattern: "\\+[1-9][0-9]{6,14}" }),
      ];
    }
    // correction / completion / updating
    const rows: HTMLElement[] = [];
    for (let i = 0; i < this.state.correctionRows; i++) {
      rows.push(
        h(
          "div",
          { class: "pair" },
          this.field(`field_${i}`, t.fieldName, { required: i === 0, autocomplete: "off", pattern: "[a-z][a-z0-9_]{0,63}" }),
          this.field(`value_${i}`, t.fieldValue, { required: i === 0 }),
          i > 0 && i === this.state.correctionRows - 1
            ? h("button", { type: "button", class: "link", "data-focus": `remove-${i}`, onclick: () => this.setRows(this.state.correctionRows - 1) }, t.removeField)
            : h("span", {}),
        ),
      );
    }
    return [
      ...rows,
      this.state.correctionRows < 50
        ? h("div", {}, h("button", { type: "button", class: "link", "data-focus": "add-field", onclick: () => this.setRows(this.state.correctionRows + 1) }, `+ ${t.addField}`))
        : null,
      this.field("note", t.note, { textarea: true }),
    ];
  }

  private setRows(n: number): void {
    this.state.correctionRows = Math.max(1, Math.min(50, n));
    this.render();
    this.focusLater(`[data-focus="f-field_${this.state.correctionRows - 1}"]`);
  }

  protected render(): void {
    // Keep what the person has typed across re-renders (validation errors, adding rows,
    // language switch); only a successful submission clears the form.
    const snapshot = new Map<string, string>();
    if (!this.clearForm) {
      this.root.querySelectorAll<HTMLInputElement>("form [name]").forEach((el) => {
        if (el.name !== "request_type") snapshot.set(el.name, el.value);
      });
    }
    this.clearForm = false;
    this.renderView();
    this.root.querySelectorAll<HTMLInputElement>("form [name]").forEach((el) => {
      const v = snapshot.get(el.name);
      if (v !== undefined) el.value = v;
    });
  }

  private renderView(): void {
    const t = this.t;
    const titleId = nextId("title");
    const brandId = nextId("brand");
    const typeId = nextId("type");
    const s = this.state;
    const submitting = s.phase === "submitting";

    const form = h(
      "form",
      {
        novalidate: true,
        "aria-busy": submitting ? "true" : undefined,
        onsubmit: (e: Event) => {
          e.preventDefault();
          void this.submit(e.currentTarget as HTMLFormElement);
        },
      },
      h(
        "fieldset",
        { disabled: submitting || s.phase === "idle" },
        h(
          "div",
          { class: "field" },
          h("label", { for: typeId }, t.requestType),
          h(
            "select",
            {
              id: typeId,
              name: "request_type",
              "data-focus": "type",
              onchange: (e: Event) => {
                this.state.type = (e.target as HTMLSelectElement).value as RequestType;
                this.state.fieldErrors = {};
                this.state.correctionRows = 1;
                this.render();
              },
            },
            this.types.map((type) => h("option", { value: type, selected: type === s.type }, t.requestTypes[type])),
          ),
        ),
        this.typeFields(),
        h("div", { class: "actions" }, h("button", { type: "submit", class: "choice", "data-action": "submit", "data-focus": "submit" }, submitting ? t.saving : t.submit)),
      ),
    );

    this.mount(
      h(
        "section",
        { class: "card", "aria-labelledby": `${titleId} ${brandId}` },
        h("div", { class: "head" }, h("h2", { id: titleId }, t.rightsTitle)),
        s.submitted
          ? h(
              "p",
              { class: "status", role: "status", "aria-live": "polite", tabindex: "-1", "data-status": "" },
              this.fmt(t.submitted, { id: s.submitted.id.slice(0, 8), date: formatDate(s.submitted.due_at, this.language) }),
            )
          : null,
        s.error ? h("p", { class: "error", role: "alert", tabindex: "-1" }, s.error) : null,
        form,
        s.requests.length
          ? h(
              "div",
              {},
              h("h3", {}, t.yourRequests),
              h(
                "ul",
                { class: "list" },
                s.requests.map((r) =>
                  h(
                    "li",
                    { class: "row", "data-request-id": r.id },
                    h(
                      "div",
                      {},
                      h("strong", {}, t.requestTypes[r.request_type] ?? r.request_type),
                      h("p", { class: "muted" }, `${t.statuses[r.status] ?? r.status} · ${this.fmt(t.dueBy, { date: formatDate(r.due_at, this.language) })}`),
                    ),
                    h("span", { class: "muted" }, r.id.slice(0, 8)),
                  ),
                ),
              ),
            )
          : null,
        h("span", { class: "sr-only", id: brandId }, t.rightsLabel),
        this.footer(),
      ),
    );
  }
}
