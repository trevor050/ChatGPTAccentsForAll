import { normalizeHex } from "../lib/color.js";
import { MAX_SAVED, applyLook, applyTheme } from "../lib/settings.js";
import { loadState, readLocal, writeLive, writeSaved, writeSettings } from "../lib/storage.js";
import { applySurface, rolesFor, surfaceSpec } from "../lib/theme.js";
import { DEFAULT_THEME, THEMES, backgroundTone, findTheme, themeLook } from "../lib/themes.js";
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
const darkScheme = () => Boolean(globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches);

const state = {
  settings: null,
  saved: [],
  draft: { ...DRAFT_DEFAULTS },
  previewMode: darkScheme() ? "dark" : "light",
  tab: "basic",
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
// Basic: the theme grid (a radio group with one tab stop and arrow-key movement)
// ---------------------------------------------------------------------------
const CARDS = [DEFAULT_THEME, ...THEMES];
const cardEls = () => [...$("themeGrid").querySelectorAll(".theme-card")];

function buildGrid() {
  const grid = $("themeGrid");
  for (const theme of CARDS) {
    const isDefault = theme === DEFAULT_THEME;
    const card = document.createElement("button");
    card.className = "theme-card";
    card.type = "button";
    card.setAttribute("role", "radio");
    card.setAttribute("aria-checked", "false");
    card.tabIndex = -1;
    card.dataset.id = theme.id;

    const row = document.createElement("div");
    row.className = "theme-row";
    const title = document.createElement("div");
    title.className = "theme-title";

    const dot = document.createElement("div");
    dot.className = "dot";
    dot.style.background = isDefault ? "#bdbdbd" : theme.accent;
    const name = document.createElement("span");
    name.textContent = theme.name;
    title.append(dot, name);

    if (theme.badge) title.append(badge(theme.badge, theme.badge === "plus" ? "Plus" : "Pro"));
    const tone = isDefault ? null : backgroundTone(theme);
    if (tone) title.append(badge(tone === "light" ? "bg-light" : "bg-dark", `Background: ${tone === "light" ? "Light" : "Dark"}`));

    // Accent, then the page background (or the bubble when the theme has none), then the send button.
    const swatches = document.createElement("div");
    swatches.className = "swatches";
    swatches.setAttribute("aria-hidden", "true");
    const colors = isDefault
      ? Array(3).fill("linear-gradient(90deg,#c8c8c8,#e0e0e0)")
      : [theme.accent, theme.surface || theme.bubbleBg, theme.submitBg];
    for (const color of colors) {
      const pill = document.createElement("div");
      pill.className = "pill";
      pill.style.background = color;
      swatches.append(pill);
    }

    const ring = document.createElement("div");
    ring.className = "selected-ring";
    ring.setAttribute("aria-hidden", "true");
    row.append(title);
    card.append(ring, row, swatches);
    card.addEventListener("click", () => chooseTheme(theme));
    grid.append(card);
  }
  grid.addEventListener("keydown", (e) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const cards = cardEls();
    const from = cards.indexOf(document.activeElement);
    if (from < 0) return;
    const to = nextGridIndex(e.key, from, cards.length);
    if (to == null) return;
    e.preventDefault();
    if (to === from) return;
    cards[to].focus();
    cards[to].click(); // like any radio group, selection follows focus
  });
}

function badge(cls, text) {
  const el = document.createElement("span");
  el.className = `badge ${cls}`;
  el.textContent = text;
  return el;
}

/** Which card is selected: Default while off, the named theme when the colours are exactly its own. */
function currentThemeId() {
  const s = state.settings;
  if (!s.enabled || !s.light) return DEFAULT_THEME.id;
  return findTheme(s)?.id ?? null;
}

function renderGrid() {
  const cur = currentThemeId();
  const cards = cardEls();
  const stop = cards.find((c) => c.dataset.id === cur) || cards[0];
  for (const card of cards) {
    card.setAttribute("aria-checked", String(card.dataset.id === cur));
    card.tabIndex = card === stop ? 0 : -1;
  }
}

function chooseTheme(theme) {
  if (theme === DEFAULT_THEME) {
    commit({ enabled: false });
  } else {
    commit(applyTheme(state.settings, theme));
    state.draft = draftFromSettings(state.settings, state.previewMode);
    writeDraftToInputs();
  }
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------
const TABS = ["basic", "advanced"];

function setTab(which, { focus = false } = {}) {
  state.tab = which;
  for (const t of TABS) {
    const on = t === which;
    const btn = $(`seg-${t}`);
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-selected", String(on));
    btn.tabIndex = on ? 0 : -1;
    $(t).classList.toggle("active", on);
    $(t).toggleAttribute("inert", !on);
  }
  $("segment").dataset.active = which;
  if (focus) $(`seg-${which}`).focus();
  updateStackHeight();
}
for (const t of TABS) $(`seg-${t}`).addEventListener("click", () => setTab(t));
$("segment").addEventListener("keydown", (e) => {
  const to = nextTabIndex(e.key, TABS.indexOf(state.tab), TABS.length);
  if (to == null) return;
  e.preventDefault();
  setTab(TABS[to], { focus: true });
});

// The stack is as tall as the active section (it fades between them); resizing is animated.
const PAD = 8; // room around sections so card shadows and the selection glow aren't clipped
let measured = false;
function updateStackHeight() {
  const stack = $("stack");
  const content = $(state.tab).firstElementChild;
  const height = Math.ceil(content.getBoundingClientRect().height);
  if (!height) return;
  if (!measured) stack.classList.add("measuring");
  stack.style.height = `${height + PAD * 2}px`;
  if (!measured) {
    measured = true;
    requestAnimationFrame(() => stack.classList.remove("measuring"));
  }
}
if (typeof ResizeObserver === "function") {
  const ro = new ResizeObserver(updateStackHeight);
  ro.observe($("themeGrid"));
  ro.observe(document.querySelector(".settings-grid"));
}

// ---------------------------------------------------------------------------
// Advanced: palette, surfaces, preview
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
    "--p-assist": `color-mix(in oklab, ${fg} 6%, transparent)`,
    "--p-line": n.line,
    "--p-bubble": roles.tint,
    "--p-on-bubble": roles.onTint,
    "--p-text": roles.text,
    "--p-submit": roles.submit,
    "--p-on-submit": roles.onSubmit,
  };
  for (const [k, v] of Object.entries(vars)) $("preview").style.setProperty(k, v);
  $("surfaceNote").textContent = surfaceNote(state.draft);
  for (const m of ["light", "dark"]) $(`pv-${m}`).setAttribute("aria-pressed", String(m === mode));
}
for (const m of ["light", "dark"]) {
  $(`pv-${m}`).addEventListener("click", () => { state.previewMode = m; renderPreview(); });
}

// Actions
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

$("random").addEventListener("click", () => {
  const pick = THEMES[Math.floor(Math.random() * THEMES.length)];
  state.draft = draftFromSettings({ ...themeLook(pick), enabled: true }, state.previewMode);
  writeDraftToInputs();
});

// Saved themes
const uid = () => `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function saveCurrent() {
  const look = lookFromDraft(state.draft);
  if (!look.light || state.saved.length >= MAX_SAVED) return;
  const base = $("saveName").value.trim().slice(0, 32) || "My theme";
  const names = new Set(state.saved.map((t) => t.name));
  let name = base;
  for (let i = 2; names.has(name); i++) name = `${base} (${i})`;
  state.saved = [...state.saved, { id: uid(), name, ...look }];
  writeSaved(state.saved);
  $("saveName").value = "";
  renderSaved();
}
$("saveThemeBtn").addEventListener("click", saveCurrent);
$("saveName").addEventListener("keydown", (e) => { if (e.key === "Enter") saveCurrent(); });

function renderSaved() {
  const list = $("savedList");
  list.textContent = "";
  if (!state.saved.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.textContent = "No saved themes yet";
    list.append(empty);
    return;
  }
  for (const item of state.saved) {
    const row = document.createElement("div");
    row.className = "saved-row";
    const name = document.createElement("div");
    name.className = "name";
    name.textContent = item.name;
    name.title = item.name;
    const apply = document.createElement("button");
    apply.type = "button";
    apply.className = "btn";
    apply.textContent = "Apply";
    apply.setAttribute("aria-label", `Apply ${item.name}`);
    apply.addEventListener("click", () => {
      commit(applyLook(state.settings, item));
      state.draft = draftFromSettings(state.settings, state.previewMode);
      writeDraftToInputs();
    });
    const del = document.createElement("button");
    del.type = "button";
    del.className = "btn";
    del.textContent = "Delete";
    del.setAttribute("aria-label", `Delete ${item.name}`);
    del.addEventListener("click", () => {
      state.saved = state.saved.filter((t) => t.id !== item.id);
      writeSaved(state.saved);
      renderSaved();
    });
    row.append(name, apply, del);
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
  renderGrid();
}

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
async function init() {
  const [{ settings, saved }, { status }] = await Promise.all([loadState(), readLocal(["status"])]);
  state.settings = settings;
  state.saved = saved;
  state.draft = draftFromSettings(settings, state.previewMode);
  buildGrid();
  writeDraftToInputs();
  renderSaved();
  render();
  setTab("basic");
  // Only speak up when the last ChatGPT page load found nothing to recolour.
  if (status && !status.ok && settings.enabled) {
    $("status").hidden = false;
    $("status").textContent = "ChatGPT changed its styles, so colors are paused until the extension is updated.";
    updateStackHeight();
  }
  document.body.dataset.ready = "true";
}

init();
