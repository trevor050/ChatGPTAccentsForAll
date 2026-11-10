import { contrastRatio, hexToHsv, hsvToHex, normalizeHex } from "../lib/color.js";
import { applyPreset, DEFAULT_SETTINGS, MAX_SAVED, PRESETS } from "../lib/settings.js";
import { loadState, readLocal, writeLive, writeSaved, writeSettings } from "../lib/storage.js";
import { REFERENCE, deriveDarkAccent, resolveAccents, rolesFor, tintHue, tintNeutral } from "../lib/theme.js";

const $ = (id) => document.getElementById(id);
const PREVIEW_NEUTRALS = {
  light: { fg: "#0d0d0d", muted: "#5d5d5d", line: "#0000001a" },
  dark: { fg: "#ffffff", muted: "#afafaf", line: "#ffffff26" },
};

const state = {
  settings: { ...DEFAULT_SETTINGS },
  saved: [],
  mode: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  hsv: { h: 220, s: 0.78, v: 0.94 },
};

// ---------------------------------------------------------------------------
// Persistence: every change repaints open ChatGPT tabs through storage.local
// right away; storage.sync (quota-limited, syncs across devices) is debounced.
// ---------------------------------------------------------------------------
let syncTimer = 0, liveFrame = 0, syncPending = false;

function commit(patch) {
  state.settings = { ...state.settings, ...patch, updatedAt: Date.now() };
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
// Colour being edited
// ---------------------------------------------------------------------------
const effectiveLight = () => state.settings.light || REFERENCE.fill;
const effectiveSettings = () => ({ ...state.settings, light: effectiveLight() });
const currentHex = () => resolveAccents(effectiveSettings())[state.mode];

function setColor(hex, { fromPicker = false } = {}) {
  const patch = { enabled: true, preset: null };
  if (state.mode === "light") patch.light = hex;
  else {
    patch.dark = hex;
    if (!state.settings.light) patch.light = effectiveLight();
  }
  if (!fromPicker) state.hsv = hexToHsv(hex);
  commit(patch);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function renderPreview() {
  const s = effectiveSettings();
  const roles = rolesFor(state.mode, s);
  const n = PREVIEW_NEUTRALS[state.mode];
  const hue = tintHue(s);
  const vars = {
    "--p-surface": roles.surface,
    "--p-fg": tintNeutral(n.fg, hue, s.tint),
    "--p-muted": tintNeutral(n.muted, hue, s.tint),
    "--p-line": n.line,
    "--p-tint": roles.tint,
    "--p-on-tint": roles.onTint,
    "--p-text": roles.text,
    "--p-fill": roles.fill,
    "--p-on-fill": roles.onFill,
  };
  const preview = $("preview");
  for (const [k, v] of Object.entries(vars)) preview.style.setProperty(k, v);
  document.documentElement.style.setProperty("--fill", roles.fill);
  document.documentElement.style.setProperty("--on-fill", roles.onFill);

  const button = contrastRatio(roles.onFill, roles.fill).toFixed(1);
  const text = contrastRatio(roles.text, roles.surface).toFixed(1);
  $("contrast").textContent = `Button text ${button}:1 · links ${text}:1`;
  $("contrast").title = "Text colors are adjusted automatically to stay at or above 4.5:1 (WCAG AA).";
}

function renderPicker() {
  const { h, s, v } = state.hsv;
  const pad = $("pad");
  pad.style.setProperty("--hue", Math.round(h));
  $("pad-thumb").style.left = `${s * 100}%`;
  $("pad-thumb").style.top = `${(1 - v) * 100}%`;
  $("pad-thumb").style.background = currentHex();
  pad.setAttribute("aria-valuetext", `saturation ${Math.round(s * 100)}%, brightness ${Math.round(v * 100)}%`);
  $("hue").value = Math.round(h);
  if (document.activeElement !== $("hex")) $("hex").value = currentHex().toUpperCase();
}

function renderSwatches() {
  const list = $("swatches");
  list.textContent = "";
  const s = state.settings;
  const matches = (item) => s.enabled && s.light === item.light && (s.dark || null) === (item.dark || null) && s.tint === item.tint;

  const make = (item, { removable = false } = {}) => {
    const wrap = document.createElement("div");
    wrap.role = "listitem";
    const b = document.createElement("button");
    b.type = "button";
    b.className = "swatch" + (item.tint ? " tinted" : "");
    b.title = item.name;
    b.setAttribute("aria-label", item.name);
    b.setAttribute("aria-pressed", String(matches(item)));
    const dark = state.mode === "dark";
    b.style.setProperty("--sw", dark ? item.dark || deriveDarkAccent(item.light) : item.light);
    if (item.tint) b.style.setProperty("--sw-bg", tintNeutral(dark ? "#212121" : "#f3f3f3", tintHue(item), Math.max(60, item.tint)));
    b.addEventListener("click", () => {
      const next = item.id && PRESETS.includes(item) ? applyPreset(state.settings, item)
        : { ...state.settings, enabled: true, light: item.light, dark: item.dark, tint: item.tint, preset: null };
      state.hsv = hexToHsv(resolveAccents(next)[state.mode]);
      commit(next);
    });
    if (removable) {
      const x = document.createElement("span");
      x.className = "remove";
      x.textContent = "×";
      x.title = `Remove ${item.name}`;
      x.addEventListener("click", (e) => { e.stopPropagation(); removeSaved(item.id); });
      b.addEventListener("keydown", (e) => { if (e.key === "Delete" || e.key === "Backspace") removeSaved(item.id); });
      b.append(x);
    }
    wrap.append(b);
    list.append(wrap);
  };

  for (const p of PRESETS) make(p);
  for (const item of state.saved) make(item, { removable: true });

  const isSaved = state.saved.some(matches);
  if (s.enabled && s.light && !s.preset && !isSaved && state.saved.length < MAX_SAVED) {
    const wrap = document.createElement("div");
    wrap.role = "listitem";
    const add = document.createElement("button");
    add.type = "button";
    add.className = "add";
    add.textContent = "+";
    add.title = "Save these colors";
    add.setAttribute("aria-label", "Save these colors");
    add.addEventListener("click", saveCurrent);
    wrap.append(add);
    list.append(wrap);
  }
}

function render() {
  const s = state.settings;
  $("enabled").checked = s.enabled;
  document.body.classList.toggle("off", !s.enabled);
  for (const mode of ["light", "dark"]) $(`tab-${mode}`).setAttribute("aria-selected", String(state.mode === mode));
  $("auto-row").hidden = state.mode !== "dark";
  $("auto-dark").checked = !s.dark;
  $("tint").value = s.tint;
  $("tint-value").textContent = s.tint;
  renderPreview();
  renderPicker();
  renderSwatches();
}

// ---------------------------------------------------------------------------
// Saved favourites
// ---------------------------------------------------------------------------
function saveCurrent() {
  const s = state.settings;
  const item = { id: `s_${Date.now().toString(36)}`, name: s.light.toUpperCase(), light: s.light, dark: s.dark, tint: s.tint };
  state.saved = [...state.saved, item].slice(0, MAX_SAVED);
  writeSaved(state.saved);
  render();
}

function removeSaved(id) {
  state.saved = state.saved.filter((t) => t.id !== id);
  writeSaved(state.saved);
  render();
}

// ---------------------------------------------------------------------------
// Picker interactions
// ---------------------------------------------------------------------------
function padPick(e) {
  const r = $("pad").getBoundingClientRect();
  const s = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  const v = Math.min(1, Math.max(0, 1 - (e.clientY - r.top) / r.height));
  state.hsv = { ...state.hsv, s, v };
  setColor(hsvToHex(state.hsv), { fromPicker: true });
}

$("pad").addEventListener("pointerdown", (e) => {
  $("pad").setPointerCapture(e.pointerId);
  padPick(e);
  const move = (ev) => padPick(ev);
  const up = () => { $("pad").removeEventListener("pointermove", move); $("pad").removeEventListener("pointerup", up); };
  $("pad").addEventListener("pointermove", move);
  $("pad").addEventListener("pointerup", up);
});

$("pad").addEventListener("keydown", (e) => {
  const step = e.shiftKey ? 0.1 : 0.02;
  const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }[e.key];
  if (!d) return;
  e.preventDefault();
  const clamp = (x) => Math.min(1, Math.max(0, x));
  state.hsv = { ...state.hsv, s: clamp(state.hsv.s + d[0]), v: clamp(state.hsv.v + d[1]) };
  setColor(hsvToHex(state.hsv), { fromPicker: true });
});

$("hue").addEventListener("input", (e) => {
  state.hsv = { ...state.hsv, h: Number(e.target.value) };
  // Picking a hue on a grey would do nothing visible; give it some colour.
  if (state.hsv.s < 0.05) state.hsv = { ...state.hsv, s: 0.75, v: Math.max(state.hsv.v, 0.6) };
  setColor(hsvToHex(state.hsv), { fromPicker: true });
});

$("hex").addEventListener("input", (e) => {
  const hex = normalizeHex(e.target.value);
  if (hex && e.target.value.replace("#", "").length >= 6) setColor(hex);
});
$("hex").addEventListener("change", (e) => {
  const hex = normalizeHex(e.target.value);
  if (hex) setColor(hex);
  else e.target.value = currentHex().toUpperCase();
});

for (const mode of ["light", "dark"]) {
  $(`tab-${mode}`).addEventListener("click", () => {
    state.mode = mode;
    state.hsv = hexToHsv(currentHex());
    render();
  });
}
document.querySelector(".tabs").addEventListener("keydown", (e) => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const next = state.mode === "light" ? "dark" : "light";
  $(`tab-${next}`).click();
  $(`tab-${next}`).focus();
});

$("auto-dark").addEventListener("change", (e) => {
  const patch = { dark: e.target.checked ? null : currentHex(), preset: null };
  commit(patch);
  state.hsv = hexToHsv(currentHex());
  render();
});

$("tint").addEventListener("input", (e) => commit({ tint: Number(e.target.value), enabled: true, light: effectiveLight(), preset: null }));
$("enabled").addEventListener("change", (e) => commit({ enabled: e.target.checked, light: effectiveLight() }));

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------
async function init() {
  const [{ settings, saved }, { status }] = await Promise.all([loadState(), readLocal(["status"])]);
  state.settings = settings;
  state.saved = saved;
  state.hsv = hexToHsv(currentHex());
  render();
  // Only speak up when the last ChatGPT page load found nothing to recolour.
  if (status && !status.ok && settings.enabled) {
    $("status").hidden = false;
    $("status").textContent = "ChatGPT changed its styles and the extension couldn't find its color tokens on the last page load, so colors are paused. Check for an update.";
  }
}

init();
