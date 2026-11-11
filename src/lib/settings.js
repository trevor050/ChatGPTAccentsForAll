// Settings shape, validation and migration from the 1.x and 2.0.0 storage formats.
import { hexToOklch, normalizeHex, oklchToHex, parseColor, toHex } from "./color.js";
import { ORIGINAL_THEMES } from "./themes-original.js";
import { THEME_IDS, findTheme, themeById, themeLook } from "./themes.js";

// 3: 2.0 settings (roles, surface). 4: themes curated; see `retireTheme`.
export const SETTINGS_VERSION = 4;
export const MAX_SAVED = 24;

export const ROLE_KEYS = ["bubbleBg", "bubbleText", "submitBg", "submitText", "link"];
export const SURFACE_KINDS = ["default", "dark", "light", "custom"];

/**
 * v3 settings (chrome.storage.sync key "settings"):
 *   enabled   apply colours at all
 *   theme     id of the named theme this is, "custom" for anything else, null if never chosen
 *   light     the accent colour (links, accent text and icons; also the fill unless
 *             `roles.submitBg` is set). "light" is a 2.0.0 name kept for compatibility.
 *   dark      accent override for dark mode, or null to derive it from `light`
 *   roles     explicit colours, each hex or null (null = derive from the accent):
 *               bubbleBg / bubbleText   user message bubble
 *               submitBg / submitText   send button and its icon
 *               link                    optional separate colour for links and accent text
 *   surface   page background choice: { kind: default|dark|light|custom, color }
 *             (`color` is only used by "custom"; see theme.js surfaceSpec)
 *   updatedAt ms timestamp, newest write wins between the live and synced copies
 * Saved favourites live under their own key ("saved") so editing colours never
 * rewrites the whole list; each holds the same colour fields plus id and name.
 */
const EMPTY_ROLES = Object.freeze(Object.fromEntries(ROLE_KEYS.map((k) => [k, null])));
const NO_SURFACE = Object.freeze({ kind: "default", color: null });

export const DEFAULT_SETTINGS = Object.freeze({
  v: SETTINGS_VERSION,
  enabled: false,
  theme: null,
  light: null,
  dark: null,
  roles: EMPTY_ROLES,
  surface: NO_SURFACE,
  updatedAt: 0,
});

const clampInt = (v, lo, hi, fallback) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
};

const normalizeRoles = (raw) => {
  const r = raw && typeof raw === "object" ? raw : {};
  return Object.fromEntries(ROLE_KEYS.map((k) => [k, normalizeHex(r[k] ?? "")]));
};

const DARK_PAGE_L = hexToOklch("#212121").L;

/** 2.0.0 stored "background tint 0..100" with the accent's hue; express it as a surface. */
function surfaceFromTint(tint, accentHex) {
  const hue = hexToOklch(accentHex ?? "")?.H;
  const t = clampInt(tint, 0, 100, 0);
  if (hue == null || t < 5) return { ...NO_SURFACE };
  return { kind: "custom", color: oklchToHex({ L: DARK_PAGE_L, C: (t / 100) * 0.045, H: hue }) };
}

function normalizeSurface(raw) {
  if (!raw || typeof raw !== "object" || !SURFACE_KINDS.includes(raw.kind)) return null;
  if (raw.kind === "custom") {
    const color = normalizeHex(raw.color ?? "");
    return color ? { kind: "custom", color } : { ...NO_SURFACE };
  }
  return { kind: raw.kind, color: null };
}

/** Coerce anything read from storage into a valid v3 settings object. */
export function normalizeSettings(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const light = normalizeHex(s.light ?? "");
  const surface = normalizeSurface(s.surface) ?? (s.tint != null ? surfaceFromTint(s.tint, light) : { ...NO_SURFACE });
  const theme = s.theme === "custom" || THEME_IDS.has(s.theme) ? s.theme : null;
  return {
    v: SETTINGS_VERSION,
    enabled: Boolean(s.enabled) && Boolean(light),
    theme,
    light,
    dark: normalizeHex(s.dark ?? ""),
    roles: normalizeRoles(s.roles),
    surface,
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
      roles: normalizeRoles(item.roles),
      surface: normalizeSurface(item.surface) ?? (item.tint != null ? surfaceFromTint(item.tint, light) : { ...NO_SURFACE }),
    });
    if (out.length >= MAX_SAVED) break;
  }
  return out;
}

/** Settings after choosing a named theme (or a saved one: anything with a look). */
export function applyLook(settings, look, theme = findTheme(look)?.id ?? "custom") {
  return {
    ...settings,
    enabled: true,
    theme,
    light: look.light,
    dark: look.dark ?? null,
    roles: { ...EMPTY_ROLES, ...look.roles },
    surface: look.surface ? { ...look.surface } : { ...NO_SURFACE },
  };
}

export const applyTheme = (settings, theme) => applyLook(settings, themeLook(theme), theme.id);

// ---------------------------------------------------------------------------
// Migration from 2.0.0 (single accent per mode + background tint)
// ---------------------------------------------------------------------------

// 2.0.0 preset ids that are named differently now.
const V2_THEME_IDS = { black: "black_pro" };

const originalById = (id) => ORIGINAL_THEMES.find((t) => t.id === id) || null;

function upgradeV2(raw) {
  const id = V2_THEME_IDS[raw.preset] ?? raw.preset;
  const theme = originalById(id);
  // A preset that was still selected means "that named theme": same name, the
  // colours the 1.x popup always gave it.
  if (theme) return { ...applyTheme({}, theme), enabled: Boolean(raw.enabled), updatedAt: raw.updatedAt };
  // Anything else was a hand-picked colour: keep it (accent per mode, tint as a surface).
  return { ...raw, theme: raw.light ? "custom" : null };
}

// ---------------------------------------------------------------------------
// Migration from 1.x (versions up to 1.1.0, Aug 2025). The old popup stored raw CSS variables:
//   themeVars:   { "--interactive-bg-accent-default": "#hex", "--theme-user-msg-bg": "#hex", ... }
//   savedThemes: [{ id, name, vars: { ...same shape... } }]
// Each colour is one of the five roles a theme has now; a theme the user picked by
// name comes back as that theme.
// ---------------------------------------------------------------------------

const V1_ACCENT_KEYS = ["--interactive-bg-accent-default", "--composer-blue-bg", "--theme-submit-btn-bg"];
const V1_SURFACE_KEYS = ["--bg-primary", "--main-surface-primary"];

const hexOf = (value) => {
  const c = parseColor(String(value ?? ""));
  return c && c.a > 0 ? toHex({ ...c, a: 1 }) : null;
};
const firstHex = (vars, keys) => keys.map((k) => hexOf(vars[k])).find(Boolean) ?? null;

/** The 1.x "Surfaces" choice, recovered from the variables it wrote. */
function v1Surface(vars) {
  const base = firstHex(vars, V1_SURFACE_KEYS);
  if (!base) return { ...NO_SURFACE };
  const second = hexOf(vars["--bg-secondary"]);
  if (base === "#0f0f10" && second === "#141416") return { kind: "dark", color: null };
  if (base === "#ffffff" && second === "#f3f3f3") return { kind: "light", color: null };
  return { kind: "custom", color: base };
}

/** The named theme a set of 1.x variables was written by. Mirrors the 1.x popup's own match. */
function v1Theme(vars, accent) {
  const bubbleBg = hexOf(vars["--theme-user-msg-bg"]);
  const submitBg = hexOf(vars["--theme-submit-btn-bg"]);
  const base = firstHex(vars, V1_SURFACE_KEYS);
  return ORIGINAL_THEMES.find((t) => t.accent === accent && t.bubbleBg === bubbleBg && t.submitBg === submitBg && (t.surface ?? null) === base) || null;
}

/** v1 themeVars -> the look they described ({ light, dark, roles, surface }), or null if no accent. */
export function fromV1Vars(vars) {
  if (!vars || typeof vars !== "object") return null;
  const light = firstHex(vars, V1_ACCENT_KEYS);
  if (!light) return null;
  const named = v1Theme(vars, light);
  if (named) return { ...themeLook(named), theme: named.id };
  return {
    light,
    dark: null,
    roles: {
      bubbleBg: hexOf(vars["--theme-user-msg-bg"]),
      bubbleText: hexOf(vars["--theme-user-msg-text"]),
      submitBg: hexOf(vars["--theme-submit-btn-bg"]),
      submitText: hexOf(vars["--theme-submit-btn-text"]),
      link: hexOf(vars["--link"]),
    },
    surface: v1Surface(vars),
    theme: "custom",
  };
}

// ---------------------------------------------------------------------------
// Curated themes (settings v4, 2026-11-11): 72 became 40. Someone whose chosen
// theme was removed or recoloured keeps exactly the colours they had, and finds
// them again in Saved themes under the old name.
// ---------------------------------------------------------------------------

const sameColours = (a, b) => JSON.stringify(normalizeSaved([{ ...a, id: "x", name: "x" }])[0]) === JSON.stringify(normalizeSaved([{ ...b, id: "x", name: "x" }])[0]);

/** The original (1.x) theme behind this id if the curated set no longer has it as it was. */
export function retiredTheme(id) {
  const original = originalById(id);
  if (!original) return null;
  const now = themeById(id);
  return now && sameColours(themeLook(now), themeLook(original)) ? null : original;
}

/**
 * settings (raw, pre-normalisation) + saved -> { settings, saved }. A selected theme
 * that was retired becomes "custom" with its colours untouched, plus a saved theme
 * of the same name (unless one with those colours is already saved, or the list is full).
 */
export function retireTheme(raw, saved) {
  const original = raw?.theme && retiredTheme(raw.theme);
  if (!original || !sameColours(raw, themeLook(original))) return { settings: raw, saved };
  const settings = { ...raw, theme: findTheme(raw)?.id ?? "custom" };
  const look = themeLook(original);
  if (saved.some((t) => sameColours(t, look)) || saved.length >= MAX_SAVED) return { settings, saved };
  return { settings, saved: [...saved, { id: `was_${original.id}`, name: original.name, ...look }] };
}

/**
 * Given everything in sync storage, return { settings, saved, migrated, removeKeys }.
 * Idempotent: once v3 "settings" exist, older keys are only cleaned up, never re-read.
 */
export function migrate(stored) {
  const data = stored && typeof stored === "object" ? stored : {};
  const removeKeys = ["themeVars", "savedThemes"].filter((k) => k in data);
  if (data.settings) {
    const v = Number(data.settings.v) || 0;
    if (v >= SETTINGS_VERSION) return { settings: normalizeSettings(data.settings), saved: normalizeSaved(data.saved), migrated: false, removeKeys };
    const raw = v < 3 ? upgradeV2(data.settings) : data.settings;
    const retired = retireTheme(raw, normalizeSaved(data.saved));
    return { settings: normalizeSettings(retired.settings), saved: normalizeSaved(retired.saved), migrated: true, removeKeys };
  }
  if (!removeKeys.length) {
    return { settings: { ...DEFAULT_SETTINGS }, saved: normalizeSaved(data.saved), migrated: false, removeKeys };
  }
  const look = fromV1Vars(data.themeVars);
  const v1Saved = normalizeSaved(
    (Array.isArray(data.savedThemes) ? data.savedThemes : []).map((t, i) => {
      const v = fromV1Vars(t?.vars);
      return v && { id: typeof t.id === "string" ? t.id : `v1_${i}`, name: t.name, ...v };
    }).filter(Boolean),
  );
  const retired = retireTheme(look ? { ...look, enabled: true, updatedAt: Date.now() } : DEFAULT_SETTINGS, v1Saved);
  return { settings: normalizeSettings(retired.settings), saved: normalizeSaved(retired.saved), migrated: true, removeKeys };
}
