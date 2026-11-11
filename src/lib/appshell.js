// Discovery for the signed-in ChatGPT shell (seen 2026-11-11).
//
// Signed-in chatgpt.com is a different application from the logged-out page: a
// Tailwind-style app whose colours come from semantically named custom properties
// (`--color-background-user-message`, `--color-background-composer-primary`, ...).
// ChatGPT's appearance presets write them into an inline
// `<style data-codex-app-themes>` block, inside `@layer theme`, as one rule per mode:
//
//   :root:not([data-theme]), [data-theme=""], [data-theme="light"] { ... }
//   [data-theme="dark"] { ... }
//
// An inline bootstrap script sets `<html data-theme>` from `data-appearance-mode`
// (light, dark, or the OS preference) and rewrites the block from a localStorage
// cache before first paint; the app rewrites it again when the user changes preset.
// Portals and code blocks carry their own `data-theme`, so the mode rules also
// re-declare every variable on those nested elements.
//
// This module is pure: it takes plain rule objects ({ selector, condition?, decls })
// and recognises each variable's job from its name, falling back to its value
// (colours in the preset's accent hue) so a renamed or added variable degrades to
// "derived from the accent" instead of being missed.

import { deltaE, hexToOklch, parseColor } from "./color.js";
import { parseValue, splitTopLevel } from "./discover.js";

export const APP_MODES = ["light", "dark"];

/** Selectors used when the page's own mode selectors cannot be read. */
export const DEFAULT_MODE_SELECTORS = {
  light: [':root:not([data-theme])', '[data-theme=""]', '[data-theme="light"]'],
  dark: ['[data-theme="dark"]'],
};

const ATTR = /\[data-theme(?:=(["']?)([\w-]*)\1)?\]/g;

/**
 * Which mode a selector list applies to: "light", "dark", "root" (mode-independent
 * `:root`/`html`), or null when it is something else.
 */
export function modeOfSelector(selector) {
  const parts = splitTopLevel(String(selector));
  let mode = null;
  for (const raw of parts) {
    const part = raw.trim();
    let m;
    if (/^:root:not\(\[data-theme\]\)$/.test(part)) m = "light";
    else {
      const values = [...part.matchAll(ATTR)].map((x) => x[2] ?? null);
      // `[data-theme]` alone (no value) says nothing about the mode.
      const named = values.filter((v) => v !== null);
      // `[data-theme="dark"]`, optionally on :root/html and/or with classes
      // (`.chatgpt-theme[data-theme="dark"]`), but no descendant combinators.
      if (named.length === 1 && /^(?::root|html)?(?:\.[\w-]+)*\[data-theme=(["']?)[\w-]*\1\](?:\.[\w-]+)*$/.test(part)) {
        m = named[0] === "dark" ? "dark" : named[0] === "light" || named[0] === "" ? "light" : null;
      } else if (!values.length && /^(?::root|html|:host)$/.test(part)) m = "root";
      else m = null;
    }
    if (!m) return null;
    if (mode && mode !== m) return null;
    mode = m;
  }
  return mode;
}

/**
 * Theme-scope rules beyond the simple mode selectors, as signed-in ChatGPT's main
 * stylesheet writes them (all inside `@layer theme`):
 *   :where(:root), :where([data-theme])                                  both modes
 *   :where(:root[data-appearance-preset="linear"]) :where([data-theme])  one preset
 *   :where(:root[data-appearance-preset="ayu"]):where([data-theme="dark"]), ...
 *   :where(:root[data-appearance-preset="proof"]):where(:not([data-theme="dark"]))
 * A selector part qualifies when it is built only from :root/html, data-theme,
 * data-appearance-* and window-type attributes (wrapped in :where/:is/:not, or
 * descendant `[data-theme]` scopes). Parts for another preset or window type than
 * `attrs` describes do not apply. Returns "light", "dark", "both" or null.
 */
export function scopeOf(selector, attrs = null) {
  let mode = null;
  let applies = false;
  for (const raw of splitTopLevel(String(selector))) {
    const part = raw.trim();
    const bare = part.replace(/:where\(|:is\(|:not\(|[()*,\s]/g, "");
    if (!/^(?::root|html|:host|\.chatgpt-theme|\[(?:data-theme|data-appearance-[\w-]+|data-(?:codex-)?window-type)(?:=(["']?)[^\]"']*\1)?\])+$/.test(bare)) return null;
    if (attrs && !attrsMatch(part, attrs)) continue;
    const dark = /\[data-theme=(["']?)dark\1\]/.test(part.replace(/:not\(\[data-theme=(["']?)dark\1\]\)/g, ""));
    const light = /:not\(\[data-theme=(["']?)dark\1\]\)|\[data-theme=(["']?)(?:light)?\2\]|:root:not\(\[data-theme\]\)/.test(part);
    const m = dark ? "dark" : light ? "light" : "both";
    applies = true;
    mode = mode && mode !== m ? "both" : m;
  }
  return applies ? mode : null;
}

/** Does a selector part's preset / window-type condition hold for this page? */
function attrsMatch(part, attrs) {
  for (const [, name, , value] of part.matchAll(/\[(data-appearance-preset|data-codex-window-type|data-window-type)=(["']?)([^\]"']*)\2\]/g)) {
    if (attrs[name] != null && attrs[name] !== value) return false;
  }
  if (/\.chatgpt-theme/.test(part) && attrs.chatgptThemeClass === false) return false;
  return true;
}

/** Variables whose job is too specific to leave to inheritance (see `components`). */
export const COMPONENT_VARS = /user-message|user-bubble|composer-primary|send-button|submit-button/;

const isText = (n) => /(?:^|-)(?:text|foreground|fg|ink|label|glyph|icon)(?:-|$)/.test(n);
const isVariant = (n) => /-(?:hover|active|pressed|press|selected|inactive|disabled)$/.test(n);
// Colours that only happen to share a preset's hue: diffs, status colours, syntax, charts.
const UNRELATED = /added|deleted|removed|insert|diff|decoration|error|danger|destructive|warning|caution|success|positive|negative|syntax|chart|editor-|ads-|scrim|shadow|elevation|mode-toggle|codex-titlebar/;

/**
 * Role of one variable, from its name. Returns null when the name says nothing
 * (value-based classification then decides).
 *   bubble, bubbleText    the user's message bubble and its text
 *   send, sendText        the composer's primary (send / voice) button and its glyph
 *   onAccent              text drawn on accent-filled controls
 *   selection             text selection and highlight backgrounds
 *   accentText            accent-coloured text, icons and links
 *   accentSurface         pale (light mode) or deep (dark mode) accent backgrounds
 *   accentFill            solid accent fills (the preset's accent itself)
 */
// Palette primitives (`--chatgpt-blue-500`, `--color-slate-700`) and ChatGPT's own
// per-colour swatches (`--color-text-chat-accent-green`): named colours, not jobs.
const COLOR_WORDS = "red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|magenta|slate|gray|grey|zinc|neutral|stone|black|white";
const PRIMITIVE = new RegExp(`-\\d{2,3}$|-(?:${COLOR_WORDS})$|chat-accent-(?:${COLOR_WORDS})`);

export function roleFromName(name) {
  const n = name.toLowerCase();
  // Other people's messages (shared and group chats) keep ChatGPT's own look.
  if (/(?:^|-)other-/.test(n) || PRIMITIVE.test(n)) return "unrelated";
  if (/user-message|user-bubble/.test(n)) return isText(n) ? "bubbleText" : "bubble";
  if (/composer-primary|send-button|submit-button/.test(n)) return isText(n) ? "sendText" : "send";
  if (UNRELATED.test(n)) return "unrelated";
  if (/(?:^|-)on-accent(?:-|$)/.test(n) || (/accent-solid|accent-action|button-accent/.test(n) && isText(n))) return "onAccent";
  if (/text-selection|(?:^|-)selection(?:-|$)|highlight/.test(n)) return "selection";
  if (/accent|(?:^|-)link(?:-|$)/.test(n)) {
    if (isText(n) || /(?:^|-)link(?:-|$)/.test(n)) return "accentText";
    if (/background|(?:^|-)bg(?:-|$)|surface|subtle|tint|soft|muted/.test(n) && !/solid|button/.test(n)) return "accentSurface";
    if (/border|focus|ring|outline/.test(n)) return "accentText";
    return "accentFill";
  }
  return null;
}

/** Roles that are set even when ChatGPT declares them as an alias (var()/expression). */
export const FORCED_ROLES = new Set(["bubble", "bubbleText", "send", "sendText", "onAccent"]);

const chroma = (hex) => hexToOklch(hex)?.C ?? 0;
const hueOf = (hex) => hexToOklch(hex)?.H ?? 0;
const hueGap = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
const literal = (raw) => { const p = parseValue(raw); return p.kind === "color" ? p : null; };

/** The preset's accent in one mode: its base-accent variable, else the most common saturated accent colour. */
function anchorFor(decls) {
  for (const name of ["--codex-base-accent", "--color-accent", "--accent"]) {
    const p = decls[name] && literal(decls[name]);
    if (p) return p.light;
  }
  const counts = new Map();
  for (const [name, raw] of Object.entries(decls)) {
    if (!/accent/.test(name) || UNRELATED.test(name)) continue;
    const p = literal(raw);
    if (p && (parseColor(p.light)?.a ?? 0) >= 1 && chroma(p.light) > 0.06) counts.set(p.light, (counts.get(p.light) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** The page surface in one mode, for contrast checks. */
function surfaceFor(decls) {
  for (const name of ["--app-color-background-surface", "--codex-base-surface", "--color-background-panel", "--color-background-surface", "--main-surface-primary"]) {
    const p = decls[name] && literal(decls[name]);
    if (p && (parseColor(p.light)?.a ?? 0) >= 1) return p.light;
  }
  return null;
}

/**
 * @param {Array<{selector: string, condition?: string, decls: Record<string,string>}>} rules
 * @param {object|null} attrs  the page's <html> theme attributes ({ "data-appearance-preset": "linear", ... }),
 *   used to ignore rules for other presets; null accepts every preset.
 * @returns {null | {
 *   selectors: { light: string[], dark: string[] },
 *   anchor: { light: string|null, dark: string|null },
 *   surface: { light: string|null, dark: string|null },
 *   vars: Record<string, { role: string, light: object|null, dark: object|null }>,
 *   components: Array<{ selector: string, names: string[] }>
 * }}
 * Each var's light/dark entry is the parsed value ({kind:"color",light,dark} or
 * {kind:"expr",value}) declared for that mode, or null if that mode never declares it.
 * `components` are rules that re-declare the bubble or send-button variables on a
 * component element (`.composer-x { --color-background-composer-primary: ... }`),
 * where a value set on <html> would be shadowed.
 */
export function discoverAppShell(rules, attrs = null) {
  const simple = { light: {}, dark: {} };
  const scoped = { light: {}, dark: {} };
  const selectors = { light: new Set(), dark: new Set() };
  const components = [];
  for (const r of rules) {
    if (r.condition || !r.decls) continue;
    const mode = modeOfSelector(r.selector);
    if (mode === "light" || mode === "dark") {
      Object.assign(simple[mode], r.decls);
      for (const part of splitTopLevel(r.selector)) selectors[mode].add(part.trim());
      continue;
    }
    const scope = mode === "root" ? "both" : scopeOf(r.selector, attrs);
    if (scope) {
      for (const [name, raw] of Object.entries(r.decls)) {
        const p = parseValue(raw);
        for (const m of APP_MODES) {
          if (scope !== "both" && scope !== m) continue;
          // Split light-dark pairs so each mode keeps its own literal.
          scoped[m][name] = p.kind === "color" && p.light !== p.dark ? (m === "light" ? p.light : p.dark) : raw;
        }
      }
      continue;
    }
    const names = Object.keys(r.decls).filter((n) => COMPONENT_VARS.test(n));
    // Other people's messages (shared and group chats) keep ChatGPT's own look.
    if (names.length && !/other/i.test(r.selector) && !names.some((n) => /other/i.test(n + r.decls[n]))) {
      if (!components.some((c) => c.selector === r.selector)) components.push({ selector: r.selector, names });
    }
  }
  // Recognised only when the mode rules carry the semantic bubble or send-button
  // variables: data-theme rules alone are common on the web and prove nothing.
  const named = Object.keys({ ...simple.light, ...simple.dark }).map(roleFromName);
  if (!named.includes("bubble") && !named.includes("send")) return null;
  if (!selectors.light.size || !selectors.dark.size) return null;

  // The simple mode rules (the appearance block) out-rank the :where() scopes.
  const decls = Object.fromEntries(APP_MODES.map((m) => [m, { ...scoped[m], ...simple[m] }]));
  const anchor = { light: anchorFor(decls.light), dark: anchorFor(decls.dark) };
  const surface = { light: surfaceFor(decls.light), dark: surfaceFor(decls.dark) };

  const vars = {};
  const names = new Set([...Object.keys(decls.light), ...Object.keys(decls.dark)]);
  for (const name of names) {
    const per = {};
    for (const mode of APP_MODES) {
      const raw = decls[mode][name];
      if (raw == null) { per[mode] = null; continue; }
      const p = parseValue(raw);
      per[mode] = p.kind === "color" ? { kind: "color", light: p[mode], dark: p[mode] } : p;
    }
    const role = classify(name, per, anchor);
    if (role) vars[name] = { role, light: per.light ?? null, dark: per.dark ?? null };
  }
  const known = new Set(Object.keys(vars));
  return {
    selectors: { light: [...selectors.light], dark: [...selectors.dark] },
    anchor,
    surface,
    vars,
    components: components.map((c) => ({ ...c, names: c.names.filter((n) => known.has(n)) })).filter((c) => c.names.length),
  };
}

/** A variable's job, from its name and then from its values. Null = leave it alone. */
function classify(name, per, anchor) {
  const fromName = roleFromName(name);
  if (fromName === "unrelated") return null;
  const colours = APP_MODES.map((m) => (per[m]?.kind === "color" ? per[m].light : null));
  if (fromName) {
    // Name says accent but nothing to recolour (e.g. `initial`, a number): skip.
    if (!FORCED_ROLES.has(fromName) && !colours.some(Boolean)) return null;
    return fromName;
  }
  if (!colours.some(Boolean)) return null;
  // Same hue as the preset's accent: an accent use under a name we don't know.
  const accentLike = APP_MODES.some((m, i) => {
    const hex = colours[i], a = anchor[m];
    return hex && a && chroma(a) > 0.04 && chroma(hex) > 0.03 && hueGap(hueOf(hex), hueOf(a)) < 20;
  });
  if (accentLike) {
    const fillLike = APP_MODES.some((m, i) => colours[i] && anchor[m] && deltaE(parseColor(colours[i]), parseColor(anchor[m])) < 0.02);
    if (fillLike) return "accentFill";
    const surfaceLike = APP_MODES.every((m, i) => {
      const lch = colours[i] && hexToOklch(colours[i]);
      return !lch || (m === "light" ? lch.L >= 0.85 : lch.L <= 0.35);
    });
    return surfaceLike ? "accentSurface" : "accentText";
  }
  // Neutral greys (surfaces, text, borders): only touched by the surface option.
  if (colours.every((hex) => !hex || chroma(hex) < 0.02) && /background|surface|panel|shell|control|elevated|border|text|icon|foreground|ink|card/.test(name)) return "neutral";
  return null;
}

export const appVariant = (name) => isVariant(name.toLowerCase());
