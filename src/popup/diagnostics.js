// "Copy diagnostics": a short, privacy-safe report of what the extension found on
// ChatGPT. Pure (no DOM, no extension APIs) so its contents are unit tested.
//
// Built from an allowlist only: extension version, browser family, the status the
// content script reported (which shell, ChatGPT's theme attributes such as preset
// and mode, variable names it found and overrode, the effect check), and the
// extension's own theme choice. Never page text, URLs, account or user ids.

const ATTRS = ["data-theme", "data-appearance-mode", "data-appearance-preset", "data-window-type", "data-codex-window-type", "data-codex-window-chrome"];
const SAFE = /^[\w#(),.%/ :="'[\]\\-]{0,200}$/;
const clean = (v) => {
  const s = String(v ?? "");
  return SAFE.test(s) ? s : "[omitted]";
};

/** Browser family and major version from a user agent string (nothing else from it). */
export function browserName(ua = "") {
  for (const [name, re] of [["Firefox", /Firefox\/(\d+)/], ["Edge", /Edg\/(\d+)/], ["Opera", /OPR\/(\d+)/], ["Chromium-based", /Chrome\/(\d+)/], ["Safari", /Version\/(\d+).*Safari/]]) {
    const m = re.exec(ua);
    if (m) return `${name} ${m[1]}`;
  }
  return "unknown";
}

function ago(at, now) {
  if (!at) return "unknown";
  const s = Math.max(0, Math.round((now - at) / 1000));
  return s < 90 ? `${s}s ago` : s < 5400 ? `${Math.round(s / 60)} min ago` : `${Math.round(s / 3600)} h ago`;
}

/**
 * @param {{ version: string, ua?: string, settings?: object, status?: object|null,
 *           source?: "active-tab"|"stored"|"none", now?: number }} input
 * @returns {string}
 */
export function formatDiagnostics({ version, ua = "", settings = null, status = null, source = "none", now = Date.now() }) {
  const lines = [];
  lines.push(`ChatGPT Accents ${clean(version)} diagnostics`);
  lines.push(`browser: ${browserName(ua)}`);
  if (settings) {
    lines.push(`extension: ${settings.enabled ? "on" : "off"}, theme ${clean(settings.theme ?? "none")}, surface ${clean(settings.surface?.kind ?? "default")}`);
  }
  if (!status) {
    lines.push("ChatGPT status: none yet (open or reload a chatgpt.com tab)");
    return lines.join("\n");
  }
  const where = source === "active-tab" ? "this ChatGPT tab" : `last ChatGPT tab, not this one (${ago(status.at, now)})`;
  lines.push(`status from: ${where}`);
  lines.push(`healthy: ${status.ok ? "yes" : "no"}${status.reason ? ` (${clean(status.reason)})` : ""}`);
  lines.push(`shell: ${clean(status.shell ?? "unknown")}${status.legacy ? " + legacy names present" : ""}`);
  const page = status.page || {};
  const attrs = ATTRS.filter((a) => page[a] != null).map((a) => `${a}=${clean(page[a])}`);
  if (page.chatgptThemeClass != null) attrs.push(`chatgpt-theme class=${page.chatgptThemeClass ? "yes" : "no"}`);
  if (page.styleXTheme) attrs.push(`stylex theme=${clean(page.styleXTheme)}`);
  if (page.colorScheme) attrs.push(`color-scheme=${clean(page.colorScheme)}`);
  lines.push(`page: ${attrs.join(", ") || "no theme attributes"}`);
  if (status.build) lines.push(`build: ${clean(String(status.build).slice(0, 12))}`);
  const roles = Object.entries(status.appRoles || {}).map(([r, n]) => `${clean(r)} ${Number(n) || 0}`).join(", ");
  lines.push(`found: signed-in vars ${Number(status.appVars) || 0}${roles ? ` (${roles})` : ""}, logged-out accent ${Number(status.accentTokens) || 0}, neutral ${Number(status.neutralTokens) || 0}, rules ${Number(status.rules) || 0}`);
  const over = (status.overridden || []).map(clean);
  const key = over.filter((n) => /user-message|composer-primary|accent|link/.test(n));
  lines.push(`overridden: ${over.length}${key.length ? ` incl. ${key.slice(0, 12).join(" ")}` : ""}`);
  const e = status.effect;
  if (e) {
    const rs = Object.entries(e.roles || {}).map(([r, v]) => `${clean(r)}=${clean(v)}`).join(" ");
    lines.push(`effect check: ${clean(e.state)} (${Number(e.checked) || 0} elements, ${Number(e.probes) || 0} rules)${rs ? ` ${rs}` : ""}`);
    const vars = Object.entries(e.vars || {}).map(([n, v]) => `${clean(n)}=${clean(v)}`);
    if (vars.length) lines.push(`at <html>: ${vars.join(" ")}`);
    for (const m of (e.mismatches || []).slice(0, 4)) {
      lines.push(`  miss ${clean(m.role)}: ${clean(m.selector)} ${clean(m.prop)} = ${clean(m.actual)}, wanted ${clean(m.light)} / ${clean(m.dark)} (${clean(m.name)})`);
    }
  } else {
    lines.push("effect check: not run (colors off or nothing painted)");
  }
  return lines.join("\n");
}
