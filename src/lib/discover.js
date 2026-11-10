// Finds ChatGPT's accent and neutral colour tokens from its CSS, without relying
// on any specific class or variable name. Pure: takes plain rule objects
// ({ selector, condition?, decls }) so it can be tested against captured CSS.
//
// What it looks for (ChatGPT ships StyleX; names are hashes that can change):
//   * Theme classes: rules shaped `.X.X, .X.X:root { --a: ...; --b: ... }`.
//     ChatGPT's built-in accent setting toggles one of these on <html>.
//   * The accent group: the cluster of theme classes that override the same
//     variables with many different hues (blue, green, pink, ...).
//   * Base classes: `:root, .Y { ... }` rules that give those variables defaults.
//   * Neutrals: achromatic colours declared by the base classes (surfaces, text,
//     borders), used for the optional background tint.

import { deltaE, hexToOklch, parseColor, toHex } from "./color.js";

const THEME_SELECTOR = /^\.([\w-]+)\.\1\s*,\s*\.\1\.\1:root$/;
const ROOT_SELECTOR = /^:root\s*,\s*\.([\w-]+)$/;

/** Split on top-level commas (ignoring commas inside parentheses). */
export function splitTopLevel(str) {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of str) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

const toHexColor = (s) => {
  const c = parseColor(s);
  return c ? toHex(c) : null;
};

/**
 * Classify a custom property value.
 *   { kind: "color", light, dark }  literal colour(s), light/dark may differ
 *   { kind: "expr", value }         anything else (var() alias, color-mix, ...)
 * Understands lightningcss's light-dark polyfill
 * `var(--lightningcss-light,A)var(--lightningcss-dark,B)` and native `light-dark(A, B)`.
 */
export function parseValue(raw) {
  const value = String(raw).trim();
  const poly = /^var\(\s*--lightningcss-light\s*,(.*)\)\s*var\(\s*--lightningcss-dark\s*,(.*)\)$/.exec(value);
  if (poly) {
    const light = toHexColor(poly[1]), dark = toHexColor(poly[2]);
    return light && dark ? { kind: "color", light, dark } : { kind: "expr", value };
  }
  const native = /^light-dark\((.*)\)$/.exec(value);
  if (native) {
    const parts = splitTopLevel(native[1]);
    const light = parts.length === 2 && toHexColor(parts[0]);
    const dark = parts.length === 2 && toHexColor(parts[1]);
    return light && dark ? { kind: "color", light, dark } : { kind: "expr", value };
  }
  const single = toHexColor(value);
  if (single) return { kind: "color", light: single, dark: single };
  return { kind: "expr", value };
}

const chroma = (hex) => hexToOklch(hex)?.C ?? 0;
const hue = (hex) => hexToOklch(hex)?.H ?? 0;
const opaque = (hex) => (parseColor(hex)?.a ?? 0) >= 1;

/** Most saturated literal colour declared by a theme class: its "brand" colour. */
function signatureColor(decls) {
  let best = null;
  for (const v of Object.values(decls)) {
    const p = parseValue(v);
    if (p.kind !== "color") continue;
    for (const hex of [p.light, p.dark]) if (opaque(hex) && (!best || chroma(hex) > chroma(best))) best = hex;
  }
  return best;
}

/**
 * @param {Array<{selector: string, condition?: string, decls: Record<string,string>}>} rules
 * @returns {null | {
 *   themeClasses: string[], baseClasses: string[], referenceClass: string,
 *   referenceFill: string, accent: Record<string, object>, neutrals: Record<string, object>
 * }}
 */
export function discoverTokens(rules) {
  // Only unconditional rules define the canonical sRGB values. Media variants
  // (p3 gamut, prefers-contrast) are beaten by our selector specificity anyway.
  const plain = rules.filter((r) => !r.condition && r.decls);

  const themes = new Map(); // class -> merged decls
  const bases = new Map(); // class -> merged decls
  for (const r of plain) {
    const sel = r.selector.trim();
    const t = THEME_SELECTOR.exec(sel);
    if (t) { themes.set(t[1], { ...themes.get(t[1]), ...r.decls }); continue; }
    const b = ROOT_SELECTOR.exec(sel);
    if (b) bases.set(b[1], { ...bases.get(b[1]), ...r.decls });
  }

  // Cluster theme classes that override the same variables (union-find).
  const parent = new Map([...themes.keys()].map((k) => [k, k]));
  const find = (k) => (parent.get(k) === k ? k : find(parent.get(k)));
  const byVar = new Map();
  for (const [cls, decls] of themes) for (const name of Object.keys(decls)) {
    if (!byVar.has(name)) byVar.set(name, []);
    byVar.get(name).push(cls);
  }
  for (const classes of byVar.values()) for (const c of classes.slice(1)) parent.set(find(c), find(classes[0]));
  const clusters = new Map();
  for (const cls of themes.keys()) {
    const root = find(cls);
    if (!clusters.has(root)) clusters.set(root, []);
    clusters.get(root).push(cls);
  }

  // The accent cluster: many classes whose signature colours span many hues.
  let accentClasses = null, bestScore = 0;
  for (const classes of clusters.values()) {
    const sigs = classes.map((c) => signatureColor(themes.get(c))).filter((h) => h && chroma(h) > 0.08);
    const hueBuckets = new Set(sigs.map((h) => Math.round(hue(h) / 30) % 12));
    if (classes.length < 4 || hueBuckets.size < 4) continue;
    const score = hueBuckets.size * 100 + classes.length;
    if (score > bestScore) { bestScore = score; accentClasses = classes; }
  }
  if (!accentClasses) return null;

  // The fill (button colour) of a theme is the saturated colour it uses in BOTH
  // modes; text and tint colours come as light/dark pairs. Falls back to the
  // most frequent saturated colour if a theme has no mode-invariant one.
  const fillOf = (decls) => {
    const invariant = new Map(), any = new Map();
    for (const v of Object.values(decls)) {
      const p = parseValue(v);
      if (p.kind !== "color") continue;
      for (const hex of new Set([p.light, p.dark])) {
        if (!opaque(hex) || chroma(hex) <= 0.08) continue;
        any.set(hex, (any.get(hex) || 0) + 1);
        if (p.light === p.dark) invariant.set(hex, (invariant.get(hex) || 0) + 1);
      }
    }
    const pick = (m) => [...m.entries()].sort((a, b) => b[1] - a[1] || chroma(b[0]) - chroma(a[0]))[0]?.[0];
    return { fill: pick(invariant) || pick(any), invariant: invariant.size > 0 };
  };

  // Reference theme: prefer one with a mode-invariant fill, then the one closest
  // to ChatGPT's default blue (hue ~265), whose lightness steps are the most
  // neutral template for mapping other hues. Class name breaks ties.
  const hueDistance = (h) => Math.min(Math.abs(h - 265), 360 - Math.abs(h - 265));
  const info = new Map(accentClasses.map((c) => [c, fillOf(themes.get(c))]));
  const ranked = accentClasses.filter((c) => info.get(c).fill).sort((a, b) => {
    const ia = info.get(a), ib = info.get(b);
    return Number(ib.invariant) - Number(ia.invariant)
      || hueDistance(hue(ia.fill)) - hueDistance(hue(ib.fill))
      || a.localeCompare(b);
  });
  const referenceClass = ranked[0];
  if (!referenceClass) return null;
  const refDecls = themes.get(referenceClass);
  const referenceFill = info.get(referenceClass).fill;

  // Every variable the accent group touches, described by the reference theme
  // (falling back to whichever theme declares it).
  const accent = {};
  const names = new Set(accentClasses.flatMap((c) => Object.keys(themes.get(c))));
  for (const name of names) {
    const source = name in refDecls ? refDecls : themes.get(accentClasses.find((c) => name in themes.get(c)));
    accent[name] = parseValue(source[name]);
  }

  // Base classes: `:root, .Y` groups that give the accent variables defaults.
  const baseClasses = [...bases.entries()].filter(([, d]) => Object.keys(d).some((n) => names.has(n))).map(([c]) => c);

  // Neutrals in those base groups: achromatic literal colours, excluding accent vars.
  const neutrals = {};
  for (const cls of baseClasses) for (const [name, raw] of Object.entries(bases.get(cls))) {
    if (names.has(name)) continue;
    const p = parseValue(raw);
    if (p.kind !== "color") continue;
    const visible = parseColor(p.light).a > 0 || parseColor(p.dark).a > 0;
    if (visible && chroma(p.light) < 0.02 && chroma(p.dark) < 0.02) neutrals[name] = p;
  }

  return { themeClasses: [...accentClasses].sort(), baseClasses: baseClasses.sort(), referenceClass, referenceFill, accent, neutrals };
}

/** True when two discoveries would produce the same CSS (used to skip rewrites). */
export function sameDiscovery(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Exposed for tests: is `hex` (approximately) the reference fill? */
export const isFill = (hex, fill) => deltaE(parseColor(hex), parseColor(fill)) < 0.02;
