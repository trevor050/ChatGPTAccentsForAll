// Settings shape, presets, validation and migration from the v1 (2025) storage format.
import { hexToOklch, normalizeHex, parseColor, toHex } from "./color.js";

export const SETTINGS_VERSION = 2;
export const MAX_SAVED = 24;

/**
 * v2 settings (chrome.storage.sync key "settings"):
 *   enabled   apply colours at all
 *   light     accent hex used in light mode (null = never picked)
 *   dark      accent hex for dark mode, or null to derive it from `light`
 *   tint      background tint strength 0..100 (0 = ChatGPT's neutral greys)
 *   preset    id of the preset last applied, if unchanged since
 *   updatedAt ms timestamp, newest write wins between the live and synced copies
 * Saved favourites live under their own key ("saved") so editing colours never
 * rewrites the whole list.
 */
export const DEFAULT_SETTINGS = Object.freeze({
  v: SETTINGS_VERSION,
  enabled: false,
  light: null,
  dark: null,
  tint: 0,
  preset: null,
  updatedAt: 0,
});

export const PRESETS = [
  { id: "black", name: "Black", light: "#0d0d0d", dark: null, tint: 0 },
  { id: "crimson", name: "Crimson", light: "#e11d48", dark: null, tint: 0 },
  { id: "orange", name: "Orange", light: "#ea580c", dark: "#f97316", tint: 0 },
  { id: "saffron", name: "Saffron", light: "#c27c0e", dark: "#eab308", tint: 0 },
  { id: "lime", name: "Lime", light: "#65a30d", dark: "#84cc16", tint: 0 },
  { id: "emerald", name: "Emerald", light: "#059669", dark: "#10b981", tint: 0 },
  { id: "teal", name: "Teal", light: "#0d9488", dark: "#14b8a6", tint: 0 },
  { id: "cobalt", name: "Cobalt", light: "#2563eb", dark: "#3b82f6", tint: 0 },
  { id: "grape", name: "Grape", light: "#7c3aed", dark: "#a78bfa", tint: 0 },
  { id: "magenta", name: "Magenta", light: "#c026d3", dark: "#d946ef", tint: 0 },
  { id: "ocean", name: "Ocean", light: "#0e7490", dark: "#2dd4bf", tint: 70 },
  { id: "forest", name: "Forest", light: "#15803d", dark: "#22c55e", tint: 55 },
  { id: "mocha", name: "Mocha", light: "#8a5a3c", dark: "#d6b28d", tint: 60 },
  { id: "midnight", name: "Midnight", light: "#1d4ed8", dark: "#60a5fa", tint: 65 },
  { id: "void", name: "Void", light: "#7e22ce", dark: "#a855f7", tint: 70 },
  { id: "synthwave", name: "Synthwave", light: "#db2777", dark: "#ff0080", tint: 80 },
];

const clampInt = (v, lo, hi, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

/** Coerce anything read from storage into a valid v2 settings object. */
export function normalizeSettings(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const light = normalizeHex(s.light ?? "");
  return {
    v: SETTINGS_VERSION,
    enabled: Boolean(s.enabled) && Boolean(light),
    light,
    dark: normalizeHex(s.dark ?? ""),
    tint: clampInt(s.tint, 0, 100, 0),
    preset: typeof s.preset === "string" && PRESETS.some((p) => p.id === s.preset) ? s.preset : null,
    updatedAt: Number.isFinite(s.updatedAt) ? s.updatedAt : 0,
  };
}

export function normalizeSaved(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    const light = normalizeHex(item?.light ?? "");
    if (!light) continue;
    out.push({
      id: typeof item.id === "string" && item.id ? item.id.slice(0, 40) : `s_${out.length}_${light.slice(1)}`,
      name: String(item.name ?? "").trim().slice(0, 40) || light,
      light,
      dark: normalizeHex(item.dark ?? ""),
      tint: clampInt(item.tint, 0, 100, 0),
    });
    if (out.length >= MAX_SAVED) break;
  }
  return out;
}

export function applyPreset(settings, preset) {
  return { ...settings, enabled: true, light: preset.light, dark: preset.dark, tint: preset.tint, preset: preset.id };
}

// ---------------------------------------------------------------------------
// Migration from v1 (versions 1.x, Aug 2025). v1 stored raw CSS variables:
//   themeVars:   { "--interactive-bg-accent-default": "#hex", "--bg-primary": "#hex", ... }
//   savedThemes: [{ id, name, vars: { ...same shape... } }]
// v1 tokens no longer exist on chatgpt.com, so we keep what the user chose
// (their accent, and roughly their background colour) in the v2 model.
// ---------------------------------------------------------------------------

const V1_ACCENT_KEYS = ["--interactive-bg-accent-default", "--theme-submit-btn-bg", "--composer-blue-bg"];
const V1_SURFACE_KEYS = ["--bg-primary", "--main-surface-primary"];

const hexOf = (value) => {
  const c = parseColor(String(value ?? ""));
  return c && c.a > 0 ? toHex({ ...c, a: 1 }) : null;
};

/** v1 themeVars -> { light, tint } or null if it held no accent. */
export function fromV1Vars(vars) {
  if (!vars || typeof vars !== "object") return null;
  const light = V1_ACCENT_KEYS.map((k) => hexOf(vars[k])).find(Boolean);
  if (!light) return null;
  // v1 "background" themes painted a coloured page; approximate with a tint whose
  // strength follows how colourful that background was.
  const surface = V1_SURFACE_KEYS.map((k) => hexOf(vars[k])).find(Boolean);
  const C = surface ? hexToOklch(surface).C : 0;
  const tint = C < 0.008 ? 0 : clampInt(30 + C * 1500, 30, 100, 0);
  return { light, tint };
}

/**
 * Given everything in sync storage, return { settings, saved, migrated, removeKeys }.
 * Idempotent: once "settings" exists, v1 keys are only cleaned up, never re-read.
 */
export function migrate(stored) {
  const data = stored && typeof stored === "object" ? stored : {};
  const removeKeys = ["themeVars", "savedThemes"].filter((k) => k in data);
  if (data.settings) {
    return { settings: normalizeSettings(data.settings), saved: normalizeSaved(data.saved), migrated: false, removeKeys };
  }
  if (!removeKeys.length) {
    return { settings: { ...DEFAULT_SETTINGS }, saved: normalizeSaved(data.saved), migrated: false, removeKeys };
  }
  const current = fromV1Vars(data.themeVars);
  const settings = normalizeSettings(current ? { ...current, enabled: true, updatedAt: Date.now() } : DEFAULT_SETTINGS);
  const saved = normalizeSaved(
    (Array.isArray(data.savedThemes) ? data.savedThemes : []).map((t, i) => {
      const v = fromV1Vars(t?.vars);
      return v && { id: typeof t.id === "string" ? t.id : `v1_${i}`, name: t.name, ...v };
    }).filter(Boolean),
  );
  return { settings, saved, migrated: true, removeKeys };
}
