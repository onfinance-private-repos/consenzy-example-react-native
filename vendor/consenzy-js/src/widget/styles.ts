/* Copyright 2026 OnFinance. SPDX-License-Identifier: Apache-2.0 */

/**
 * Shared shadow-DOM stylesheet. System fonts only (no CDN, works air-gapped).
 *
 * Theme from the host page with CSS custom properties, e.g.
 *   cdm-consent-banner { --cdm-accent: #0b5cad; --cdm-radius: 4px; }
 */
export const STYLES = `
:host {
  --_font: var(--cdm-font-family, system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Devanagari", sans-serif);
  --_size: var(--cdm-font-size, 15px);
  --_text: var(--cdm-text, #1b1f24);
  --_muted: var(--cdm-muted, #57606a);
  --_bg: var(--cdm-bg, #ffffff);
  --_surface: var(--cdm-surface, #f6f8fa);
  --_border: var(--cdm-border, #d0d7de);
  --_accent: var(--cdm-accent, #0b5cad);
  --_accent-text: var(--cdm-accent-text, #ffffff);
  --_danger: var(--cdm-danger, #b42318);
  --_success: var(--cdm-success, #1a7f37);
  --_radius: var(--cdm-radius, 8px);
  --_gap: var(--cdm-gap, 12px);
  --_focus: var(--cdm-focus, #b45309); /* amber-700: >= 4.5:1 on white (WCAG 1.4.11 / 2.4.13) */
  --_max: var(--cdm-max-width, 720px);
  display: block;
  color: var(--_text);
  font-family: var(--_font);
  font-size: var(--_size);
  line-height: 1.5;
}
@media (prefers-color-scheme: dark) {
  :host {
    --_text: var(--cdm-text, #e6edf3);
    --_muted: var(--cdm-muted, #9da7b3);
    --_bg: var(--cdm-bg, #0d1117);
    --_surface: var(--cdm-surface, #161b22);
    --_border: var(--cdm-border, #30363d);
    --_accent: var(--cdm-accent, #4493f8);
    --_accent-text: var(--cdm-accent-text, #0d1117);
    --_danger: var(--cdm-danger, #f85149);
    --_success: var(--cdm-success, #3fb950);
  }
}
:host([hidden]) { display: none; }
* { box-sizing: border-box; }
.card {
  max-width: var(--_max);
  background: var(--_bg);
  border: 1px solid var(--_border);
  border-radius: var(--_radius);
  padding: calc(var(--_gap) * 1.5);
  display: grid;
  gap: var(--_gap);
}
.head { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--_gap); }
h2 { font-size: 1.2em; margin: 0; line-height: 1.3; }
h3 { font-size: 1em; margin: 0; }
p { margin: 0; }
.body { white-space: pre-line; max-height: 40vh; overflow: auto; }
.muted { color: var(--_muted); font-size: 0.9em; }
fieldset { border: 0; margin: 0; padding: 0; display: grid; gap: calc(var(--_gap) * 0.75); min-width: 0; }
legend { padding: 0; margin-bottom: calc(var(--_gap) * 0.5); font-weight: 600; }
.purpose, .row {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 4px 10px;
  padding: var(--_gap);
  background: var(--_surface);
  border: 1px solid var(--_border);
  border-radius: var(--_radius);
}
.row { grid-template-columns: 1fr auto; align-items: center; }
.purpose input[type="checkbox"] { width: 1.25em; height: 1.25em; margin: 2px 0 0; accent-color: var(--_accent); }
.purpose label { font-weight: 600; cursor: pointer; }
.purpose .meta { grid-column: 2; display: grid; gap: 2px; }
ul.chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 4px; }
ul.chips li { border: 1px solid var(--_border); border-radius: 999px; padding: 0 8px; font-size: 0.85em; }
.actions { display: flex; flex-wrap: wrap; gap: var(--_gap); }
.actions .choice { flex: 1 1 12em; }
button, select, input, textarea { font: inherit; color: inherit; }
button {
  min-height: 44px;
  padding: 8px 16px;
  border-radius: var(--_radius);
  border: 2px solid var(--_accent);
  background: var(--_bg);
  color: var(--_accent);
  font-weight: 600;
  cursor: pointer;
}
/* "Accept selected" and "Reject all" share this exact style: equal prominence, no nudging. */
button.choice { background: var(--_accent); color: var(--_accent-text); }
button.link { border-color: transparent; background: transparent; min-height: 0; padding: 4px 8px; }
button[disabled] { opacity: 0.6; cursor: not-allowed; }
select, input, textarea {
  min-height: 40px;
  padding: 6px 10px;
  border: 1px solid var(--_border);
  border-radius: var(--_radius);
  background: var(--_bg);
  width: 100%;
}
textarea { min-height: 6em; resize: vertical; }
.lang { display: flex; align-items: center; gap: 6px; }
.lang select { width: auto; }
.field { display: grid; gap: 4px; }
.field label { font-weight: 600; }
.pair { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; align-items: end; }
.status { color: var(--_success); font-weight: 600; }
.error { color: var(--_danger); font-weight: 600; }
.field .error { font-weight: 400; font-size: 0.9em; }
ul.list { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
.footer { font-size: 0.8em; color: var(--_muted); text-align: end; }
:focus { outline: none; }
:focus-visible, input[type="checkbox"]:focus-visible { outline: 3px solid var(--_focus); outline-offset: 2px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
@media (max-width: 480px) { .pair { grid-template-columns: 1fr; } }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
`;
