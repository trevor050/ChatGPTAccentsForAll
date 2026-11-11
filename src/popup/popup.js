import { normalizeHex } from "../lib/color.js";
import { MAX_SAVED, applyLook, applyTheme } from "../lib/settings.js";
import { ext, loadState, readLocal, writeLive, writeSaved, writeSettings } from "../lib/storage.js";
import { applySurface, rolesFor, surfaceSpec } from "../lib/theme.js";
import { DEFAULT_THEME, THEMES, THEME_GROUPS, findTheme, sameLook, themeLook } from "../lib/themes.js";
import { formatDiagnostics } from "./diagnostics.js";
import { DRAFT_DEFAULTS, draftFromSettings, lookFromDraft, nextGridIndex, nextTabIndex, previewSettings, surfaceNote } from "./model.js";

const $ = (id) => document.getElementById(id);
const PALETTE = [
  ["accent", "accent"],
  ["bubbleBg", "bubbleBg"],
  ["bubbleText", "bubbleText"],
  ["submitBg", "submitBg"],
  ["submitText", "submitText"],
  ["surfaceColor", "surfaceColor"],
];
const PREVIEW_NEUTRALS = {
  light: { fg: "#0d0d0d", line: "#0000001f" },
  dark: { fg: "#ffffff", line: "#ffffff26" },
};
// Purple and Black: the two accents ChatGPT once kept for its paid plans.
const WAS_PAID = { plus: ["$20/mo", "once a ChatGPT Plus color ($20 a month), free here"], pro: ["$200/mo", "once a ChatGPT Pro color ($200 a month), free here"] };
const darkScheme = () => Boolean(globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches);

const state = {
  settings: null,
  saved: [],
  draft: { ...DRAFT_DEFAULTS },
  previewMode: darkScheme() ? "dark" : "light",
  group: "classic",
  view: "themes",
};

// Firefox closes the popup when a native colour picker opens, so there the hex field is the control.
if (/Firefox\//.test(navigator.userAgent)) document.documentElement.dataset.nativePicker = "off";

// ---------------------------------------------------------------------------
// Persistence: every change repaints open ChatGPT tabs through storage.local
// right away; storage.sync (quota-limited, syncs across devices) is debounced.
// ---------------------------------------------------------------------------
let syncTimer = 0, liveFrame = 0, syncPending = false;

function commit(next) {
  state.settings = { ...state.settings, ...next, updatedAt: Date.now() };
  cancelAnimationFrame(liveFrame);
  liveFrame = requestAnimationFrame(() => writeLive(state.settings));
  syncPending = true;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(flushSync, 400);
  render();
}

function flushSync() {
  if (!syncPending) return;
  syncPending = false;
  clearTimeout(syncTimer);
  writeSettings(state.settings);
}
// The popup can close at any moment; don't lose the last edit.
addEventListener("pagehide", flushSync);
document.addEventListener("visibilitychange", () => { if (document.hidden) flushSync(); });

// ---------------------------------------------------------------------------
// Themes: group tabs, each a two-column radio group (one tab stop, arrows move
// and select). Saved themes are the last group when there are any.
// ---------------------------------------------------------------------------
const groups = () => [
  ...THEME_GROUPS.map((g) => ({ ...g, items: [...(g.id === "classic" ? [DEFAULT_THEME] : []), ...THEMES.filter((t) => t.group === g.id)] })),
  ...(state.saved.length ? [{ id: "saved", name: "Saved", items: state.saved.map((t) => ({ ...t, saved: true })) }] : []),
];

function chip(theme) {
  const el = document.createElement("span");
  el.className = "chip";
  el.setAttribute("aria-hidden", "true");
  if (theme === DEFAULT_THEME) el.classList.add("default");
  else {
    const look = theme.saved ? theme : null;
    el.style.setProperty("--chip-accent", look ? look.light : theme.accent);
    el.style.setProperty("--chip-bubble", (look ? look.roles?.bubbleBg : theme.bubbleBg) || rolesFor("light", { ...applyLook({}, look || themeLook(theme)) }).tint);
    el.style.setProperty("--chip-send", (look ? look.roles?.submitBg : theme.submitBg) || (look ? look.light : theme.accent));
    const page = look ? (look.surface?.kind === "custom" ? look.surface.color : look.surface?.kind === "dark" ? "#0f0f10" : null) : theme.surface;
    if (page) el.style.setProperty("--chip-page", page);
  }
  for (const part of ["accent", "bubble", "send"]) el.append(Object.assign(document.createElement("i"), { className: part }));
  return el;
}

function itemButton(item) {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "theme";
  b.setAttribute("role", "radio");
  b.setAttribute("aria-checked", "false");
  b.tabIndex = -1;
  b.dataset.id = item.saved ? `saved:${item.id}` : item.id;
  const name = Object.assign(document.createElement("span"), { className: "name", textContent: item === DEFAULT_THEME ? "ChatGPT's own" : item.name });
  name.title = name.textContent;
  b.append(chip(item), name);
  const paid = WAS_PAID[item.badge];
  if (paid) {
    const was = document.createElement("span");
    was.className = "was";
    was.setAttribute("aria-hidden", "true");
    was.append(Object.assign(document.createElement("s"), { textContent: paid[0] }), " free");
    b.append(was);
    b.setAttribute("aria-label", `${item.name}, ${paid[1]}`);
  }
  b.addEventListener("click", () => chooseItem(item));
  return b;
}

function buildGroups() {
  const tabs = $("groupTabs"), panels = $("groupPanels");
  tabs.textContent = "";
  panels.textContent = "";
  let rows = 1;
  for (const g of groups()) {
    const tab = document.createElement("button");
    tab.type = "button";
    tab.id = `tab-${g.id}`;
    tab.dataset.group = g.id;
    tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", `panel-${g.id}`);
    tab.textContent = g.name;
    tab.addEventListener("click", () => setGroup(g.id));
    tabs.append(tab);

    const panel = document.createElement("div");
    panel.id = `panel-${g.id}`;
    panel.setAttribute("role", "tabpanel");
    panel.setAttribute("aria-labelledby", tab.id);
    const list = document.createElement("div");
    list.className = "list";
    list.setAttribute("role", "radiogroup");
    list.setAttribute("aria-label", `${g.name} themes`);
    for (const item of g.items) list.append(itemButton(item));
    list.addEventListener("keydown", onListKey);
    panel.append(list);
    panels.append(panel);
    rows = Math.max(rows, Math.ceil(g.items.length / 2));
  }
  // Every group gets the height of the tallest, so switching never resizes the popup.
  panels.style.setProperty("--panel-h", `${rows * 38 + (rows - 1) * 2 + 16}px`);
}

function onListKey(e) {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const items = [...e.currentTarget.querySelectorAll(".theme")];
  const from = items.indexOf(document.activeElement);
  if (from < 0) return;
  const to = nextGridIndex(e.key, from, items.length, 2);
  if (to == null) return;
  e.preventDefault();
  if (to === from) return;
  items[to].focus();
  items[to].click(); // like any radio group, selection follows focus
}

$("groupTabs").addEventListener("keydown", (e) => {
  const tabs = [...$("groupTabs").querySelectorAll("[role=tab]")];
  const to = nextTabIndex(e.key, tabs.findIndex((t) => t.dataset.group === state.group), tabs.length);
  if (to == null) return;
  e.preventDefault();
  setGroup(tabs[to].dataset.group, { focus: true });
});

function setGroup(id, { focus = false } = {}) {
  if (!groups().some((g) => g.id === id)) id = "classic";
  state.group = id;
  for (const tab of $("groupTabs").querySelectorAll("[role=tab]")) {
    const on = tab.dataset.group === id;
    tab.setAttribute("aria-selected", String(on));
    tab.tabIndex = on ? 0 : -1;
    if (on && focus) tab.focus();
    $(`panel-${tab.dataset.group}`).hidden = !on;
  }
}

/** Which item is selected: ChatGPT's own while off, else the named or saved theme with exactly these colours. */
function currentItemId() {
  const s = state.settings;
  if (!s.enabled || !s.light) return DEFAULT_THEME.id;
  const named = findTheme(s);
  if (named) return named.id;
  const saved = state.saved.find((t) => sameLook(t, s));
  return saved ? `saved:${saved.id}` : null;
}

const groupOf = (itemId) => groups().find((g) => g.items.some((t) => (t.saved ? `saved:${t.id}` : t.id) === itemId))?.id;

function renderThemes() {
  const cur = currentItemId();
  for (const list of $("groupPanels").querySelectorAll(".list")) {
    const items = [...list.querySelectorAll(".theme")];
    const stop = items.find((b) => b.dataset.id === cur) || items[0];
    for (const b of items) {
      b.setAttribute("aria-checked", String(b.dataset.id === cur));
      b.tabIndex = b === stop ? 0 : -1;
    }
  }
}

function chooseItem(item) {
  if (item === DEFAULT_THEME) commit({ enabled: false });
  else commit(item.saved ? applyLook(state.settings, item) : applyTheme(state.settings, item));
  if (item !== DEFAULT_THEME) {
    state.draft = draftFromSettings(state.settings, state.previewMode);
    writeDraftToInputs();
  }
}

$("random").addEventListener("click", () => {
  const others = THEMES.filter((t) => t.id !== currentItemId());
  const pick = others[Math.floor(Math.random() * others.length)];
  chooseItem(pick);
  setGroup(pick.group);
});

// ---------------------------------------------------------------------------
// Views: themes, customize
// ---------------------------------------------------------------------------
function setView(view) {
  state.view = view;
  const custom = view === "customize";
  $("themesView").hidden = custom;
  $("customizeView").hidden = !custom;
  $("back").hidden = !custom;
  const title = $("title");
  title.textContent = custom ? "Customize" : "Accents ";
  if (!custom) title.append(Object.assign(document.createElement("span"), { textContent: "for ChatGPT" }));
  (custom ? $("back") : $("openCustomize")).focus();
}
$("openCustomize").addEventListener("click", () => {
  state.draft = draftFromSettings(state.settings, state.previewMode);
  writeDraftToInputs();
  setView("customize");
});
$("back").addEventListener("click", () => setView("themes"));
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && state.view === "customize") { e.preventDefault(); setView("themes"); }
});

// ---------------------------------------------------------------------------
// Customize: palette, surfaces, preview
// ---------------------------------------------------------------------------
function writeDraftToInputs() {
  for (const [id, key] of PALETTE) {
    const value = state.draft[key];
    $(id).value = value;
    $(`${id}Hex`).value = value;
    $(`${id}Hex`).removeAttribute("aria-invalid");
  }
  const radio = $(`surface-${state.draft.surfaceKind}`);
  if (radio) radio.checked = true;
  $("customSurfaceRow").classList.toggle("hidden", state.draft.surfaceKind !== "custom");
  renderPreview();
}

function setDraft(patch) {
  state.draft = { ...state.draft, ...patch };
  $("customSurfaceRow").classList.toggle("hidden", state.draft.surfaceKind !== "custom");
  renderPreview();
}

function wirePair(id, key) {
  const color = $(id), hex = $(`${id}Hex`);
  const patchFor = (value) => (key === "accent" ? { accent: value, link: null } : { [key]: value });
  color.addEventListener("input", () => { hex.value = color.value; hex.removeAttribute("aria-invalid"); setDraft(patchFor(color.value)); });
  // Accept a colour as soon as it is six digits; "#abc" is expanded when the field is left.
  hex.addEventListener("input", () => {
    const v = normalizeHex(hex.value);
    hex.setAttribute("aria-invalid", String(!v && hex.value.trim() !== ""));
    if (v && hex.value.replace("#", "").length === 6) { color.value = v; setDraft(patchFor(v)); }
  });
  hex.addEventListener("change", () => {
    const v = normalizeHex(hex.value);
    if (v) { hex.value = v; color.value = v; setDraft(patchFor(v)); } else hex.value = color.value;
    hex.removeAttribute("aria-invalid");
  });
}
for (const [id, key] of PALETTE) wirePair(id, key);
for (const radio of document.querySelectorAll('input[name="surfaceMode"]')) {
  radio.addEventListener("change", () => { if (radio.checked) setDraft({ surfaceKind: radio.value }); });
}

function renderPreview() {
  const mode = state.previewMode;
  const s = previewSettings(state.draft);
  const roles = rolesFor(mode, s);
  const spec = surfaceSpec(s);
  const n = PREVIEW_NEUTRALS[mode];
  const fg = applySurface(n.fg, mode, spec);
  const vars = {
    "--p-surface": roles.surface,
    "--p-fg": fg,
    "--p-muted": `color-mix(in oklab, ${fg} 55%, ${roles.surface})`,
    "--p-line": n.line,
    "--p-bubble": roles.tint,
    "--p-on-bubble": roles.onTint,
    "--p-text": roles.text,
    "--p-submit": roles.submit,
    "--p-on-submit": roles.onSubmit,
  };
  for (const [k, v] of Object.entries(vars)) $("preview").parentElement.style.setProperty(k, v);
  $("surfaceNote").textContent = surfaceNote(state.draft);
  for (const m of ["light", "dark"]) $(`pv-${m}`).setAttribute("aria-pressed", String(m === mode));
}
for (const m of ["light", "dark"]) {
  $(`pv-${m}`).addEventListener("click", () => { state.previewMode = m; renderPreview(); });
}

let appliedTimer = 0;
function say(text) {
  $("applied").textContent = text;
  clearTimeout(appliedTimer);
  appliedTimer = setTimeout(() => { $("applied").textContent = ""; }, 2000);
}

$("save").addEventListener("click", () => {
  commit(applyLook(state.settings, lookFromDraft(state.draft)));
  say("Applied");
});

$("reset").addEventListener("click", () => {
  commit({ enabled: false });
  state.draft = { ...DRAFT_DEFAULTS };
  writeDraftToInputs();
  say("Back to ChatGPT's colors");
});

$("randomDraft").addEventListener("click", () => {
  const pick = THEMES[Math.floor(Math.random() * THEMES.length)];
  state.draft = draftFromSettings({ ...themeLook(pick), enabled: true }, state.previewMode);
  writeDraftToInputs();
});

// Saved themes
const uid = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function setSaved(next) {
  const group = state.group;
  state.saved = next;
  writeSaved(state.saved);
  buildGroups();
  setGroup(group);
  renderThemes();
  renderSaved();
}

function saveCurrent() {
  const look = lookFromDraft(state.draft);
  if (!look.light) return;
  if (state.saved.length >= MAX_SAVED) { say(`${MAX_SAVED} saved is the limit`); return; }
  const base = $("saveName").value.trim().slice(0, 32) || "My theme";
  const names = new Set(state.saved.map((t) => t.name));
  let name = base;
  for (let i = 2; names.has(name); i++) name = `${base} (${i})`;
  $("saveName").value = "";
  setSaved([...state.saved, { id: uid(), name, ...look }]);
  say(`Saved as ${name}`);
}
$("saveThemeBtn").addEventListener("click", saveCurrent);
$("saveName").addEventListener("keydown", (e) => { if (e.key === "Enter") saveCurrent(); });

function renderSaved() {
  const list = $("savedList");
  list.textContent = "";
  for (const item of state.saved) {
    const row = document.createElement("div");
    row.className = "row";
    const label = Object.assign(document.createElement("span"), { className: "label", textContent: item.name, title: item.name });
    const apply = Object.assign(document.createElement("button"), { type: "button", className: "link quiet", textContent: "Apply" });
    apply.setAttribute("aria-label", `Apply ${item.name}`);
    apply.addEventListener("click", () => chooseItem({ ...item, saved: true }));
    const del = Object.assign(document.createElement("button"), { type: "button", className: "link quiet", textContent: "Delete" });
    del.setAttribute("aria-label", `Delete ${item.name}`);
    del.addEventListener("click", () => setSaved(state.saved.filter((t) => t.id !== item.id)));
    row.append(chip({ ...item, saved: true }), label, apply, del);
    list.append(row);
  }
}

// ---------------------------------------------------------------------------
// The on/off switch and the rest of the render
// ---------------------------------------------------------------------------
$("enabled").addEventListener("change", (e) => {
  if (e.target.checked && !state.settings.light) commit(applyLook(state.settings, lookFromDraft(state.draft)));
  else commit({ enabled: e.target.checked });
});

function render() {
  $("enabled").checked = state.settings.enabled;
  renderThemes();
  if (document.body.dataset.ready) renderStatus();
}

// ---------------------------------------------------------------------------
// Status of the ChatGPT tab this popup belongs to
// ---------------------------------------------------------------------------
const ROLE_LABELS = { send: "send button", bubble: "message bubble" };

/**
 * Ask the active tab's content script how it is doing. Resolves to its status, or
 * null when the active tab is not a ChatGPT page (or has not checked yet), in which
 * case the popup says nothing rather than repeating another tab's result.
 */
function askActiveTab() {
  return new Promise((resolve) => {
    const done = (v) => { clearTimeout(timer); resolve(v); };
    const timer = setTimeout(() => resolve(null), 600);
    try {
      ext.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const id = tabs?.[0]?.id;
        if (id == null) return done(null);
        ext.tabs.sendMessage(id, { type: "chatgpt-accents:status" }, (reply) => {
          void ext.runtime?.lastError; // no content script in that tab
          done(reply?.status ?? null);
        });
      });
    } catch { done(null); }
  });
}

const tabStatus = { status: null, source: "none" };

async function refreshStatus() {
  const live = await askActiveTab();
  if (live) Object.assign(tabStatus, { status: live, source: "active-tab" });
  else {
    const { status } = await readLocal(["status"]);
    Object.assign(tabStatus, { status: status || null, source: status ? "stored" : "none" });
  }
  renderStatus();
}

function renderStatus() {
  const { status, source } = tabStatus;
  let text = "";
  // Only describe the ChatGPT tab this popup is attached to.
  if (state.settings.enabled && source === "active-tab" && status && status.effect?.state !== "pending") {
    if (!status.ok) text = "ChatGPT changed its styles, so colors are paused until the extension is updated.";
    else if (status.reason === "partial") {
      const missing = Object.entries(status.effect?.roles || {}).filter(([r, v]) => v === "fail" && ROLE_LABELS[r]).map(([r]) => ROLE_LABELS[r]);
      text = `Some of this page isn't taking your colors yet${missing.length ? ` (${missing.join(", ")})` : ""}.`;
    }
  }
  $("status").hidden = !text;
  $("statusText").textContent = text;
}

async function copyDiagnostics(button) {
  await refreshStatus().catch(() => {});
  const text = formatDiagnostics({
    version: ext.runtime?.getManifest?.().version ?? "?",
    ua: navigator.userAgent,
    settings: state.settings,
    status: tabStatus.status,
    source: tabStatus.source,
  });
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch {
    // Fallback for browsers that refuse the async clipboard in extension popups.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    try { ok = document.execCommand("copy"); } catch { /* clipboard unavailable */ }
    area.remove();
  }
  const label = button.textContent;
  button.textContent = ok ? "Copied" : "Copy failed";
  setTimeout(() => { button.textContent = label; }, 1500);
}
$("copyDiag").addEventListener("click", (e) => copyDiagnostics(e.currentTarget));
$("copyDiagWarn").addEventListener("click", (e) => copyDiagnostics(e.currentTarget));

async function init() {
  const { settings, saved } = await loadState();
  state.settings = settings;
  state.saved = saved;
  state.draft = draftFromSettings(settings, state.previewMode);
  buildGroups();
  writeDraftToInputs();
  renderSaved();
  render();
  setGroup(groupOf(currentItemId()) || "classic");
  await refreshStatus().catch(() => {});
  // A theme change repaints the tab, which re-checks and reports back.
  ext.storage?.onChanged?.addListener((changes, area) => {
    if (area === "local" && changes.status) refreshStatus().catch(() => {});
  });
  document.body.dataset.ready = "true";
}

init();
