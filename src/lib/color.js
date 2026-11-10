// Color math: parsing, sRGB <-> OKLab/OKLCH, WCAG contrast, contrast repair.
// Pure functions only, no DOM access, so everything here is unit tested.

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * Parse a CSS color into { r, g, b, a } with r/g/b in 0..1 (sRGB) and a in 0..1.
 * Supports #rgb, #rgba, #rrggbb, #rrggbbaa, rgb()/rgba(), oklch() and the
 * keywords `transparent`, `white`, `black`. Returns null for anything else.
 */
export function parseColor(input) {
  if (typeof input !== "string") return null;
  const s = input.trim().toLowerCase();
  if (s === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  if (s === "white") return { r: 1, g: 1, b: 1, a: 1 };
  if (s === "black") return { r: 0, g: 0, b: 0, a: 1 };

  const hex = /^#([0-9a-f]{3,8})$/.exec(s);
  if (hex) {
    let h = hex[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    const n = (i) => parseInt(h.slice(i, i + 2), 16) / 255;
    return { r: n(0), g: n(2), b: n(4), a: h.length === 8 ? n(6) : 1 };
  }

  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(s);
  if (rgb) {
    const a = rgb[4] == null ? 1 : rgb[4].endsWith("%") ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4]);
    return { r: clamp(+rgb[1] / 255, 0, 1), g: clamp(+rgb[2] / 255, 0, 1), b: clamp(+rgb[3] / 255, 0, 1), a: clamp(a, 0, 1) };
  }

  const oklch = /^oklch\(\s*([\d.]+%?)\s+([\d.]+|none)\s+([\d.]+|none)(?:\s*\/\s*([\d.]+%?))?\s*\)$/.exec(s);
  if (oklch) {
    const L = oklch[1].endsWith("%") ? parseFloat(oklch[1]) / 100 : parseFloat(oklch[1]);
    const C = oklch[2] === "none" ? 0 : parseFloat(oklch[2]);
    const H = oklch[3] === "none" ? 0 : parseFloat(oklch[3]);
    const a = oklch[4] == null ? 1 : oklch[4].endsWith("%") ? parseFloat(oklch[4]) / 100 : parseFloat(oklch[4]);
    const { r, g, b } = oklchToRgb({ L, C, H });
    return { r: clamp(r, 0, 1), g: clamp(g, 0, 1), b: clamp(b, 0, 1), a: clamp(a, 0, 1) };
  }
  return null;
}

/** Normalise user input like "abc", "#ABC" or "#aabbcc" to "#aabbcc", or null. */
export function normalizeHex(input) {
  if (typeof input !== "string") return null;
  let s = input.trim().toLowerCase();
  if (!s.startsWith("#")) s = "#" + s;
  if (/^#[0-9a-f]{3}$/.test(s)) s = "#" + [...s.slice(1)].map((c) => c + c).join("");
  return /^#[0-9a-f]{6}$/.test(s) ? s : null;
}

export function toHex({ r, g, b, a = 1 }) {
  const h = (v) => Math.round(clamp(v, 0, 1) * 255).toString(16).padStart(2, "0");
  return "#" + h(r) + h(g) + h(b) + (a < 1 ? h(a) : "");
}

// --- sRGB <-> linear <-> OKLab <-> OKLCH (Björn Ottosson's reference matrices) ---

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.sign(c) * Math.abs(c) ** (1 / 2.4) - 0.055);

export function rgbToOklab({ r, g, b }) {
  const lr = toLinear(r), lg = toLinear(g), lb = toLinear(b);
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  return {
    L: 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    a: 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    b: 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  };
}

export function oklabToRgb({ L, a, b }) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return {
    r: fromLinear(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: fromLinear(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: fromLinear(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  };
}

export function rgbToOklch(rgb) {
  const { L, a, b } = rgbToOklab(rgb);
  const C = Math.hypot(a, b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { L, C, H: C < 1e-4 ? 0 : H };
}

export function oklchToRgb({ L, C, H }) {
  const rad = (H * Math.PI) / 180;
  return oklabToRgb({ L, a: C * Math.cos(rad), b: C * Math.sin(rad) });
}

const inGamut = ({ r, g, b }, eps = 1e-4) => [r, g, b].every((v) => v >= -eps && v <= 1 + eps);

/** OKLCH -> sRGB, reducing chroma (keeping lightness and hue) until it fits sRGB. */
export function oklchToRgbInGamut({ L, C, H }) {
  const Lc = clamp(L, 0, 1);
  let rgb = oklchToRgb({ L: Lc, C, H });
  if (inGamut(rgb)) return clampRgb(rgb);
  let lo = 0, hi = C;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToRgb({ L: Lc, C: mid, H }))) lo = mid; else hi = mid;
  }
  return clampRgb(oklchToRgb({ L: Lc, C: lo, H }));
}

const clampRgb = ({ r, g, b }) => ({ r: clamp(r, 0, 1), g: clamp(g, 0, 1), b: clamp(b, 0, 1) });

export const oklchToHex = (lch) => toHex(oklchToRgbInGamut(lch));
export const hexToOklch = (hex) => {
  const c = parseColor(hex);
  return c ? rgbToOklch(c) : null;
};

/** Perceptual distance (Euclidean in OKLab). ~0.02 is "the same colour" for our purposes. */
export function deltaE(c1, c2) {
  const a = rgbToOklab(c1), b = rgbToOklab(c2);
  return Math.hypot(a.L - b.L, a.a - b.a, a.b - b.b);
}

// --- WCAG 2.x contrast ---

export function relativeLuminance({ r, g, b }) {
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/** Composite a (possibly translucent) colour over an opaque backdrop. */
export function flatten(color, backdrop) {
  const a = color.a ?? 1;
  if (a >= 1) return color;
  return {
    r: color.r * a + backdrop.r * (1 - a),
    g: color.g * a + backdrop.g * (1 - a),
    b: color.b * a + backdrop.b * (1 - a),
    a: 1,
  };
}

export function contrastRatio(fg, bg) {
  const f = typeof fg === "string" ? parseColor(fg) : fg;
  const b = typeof bg === "string" ? parseColor(bg) : bg;
  if (!f || !b) return 1;
  const l1 = relativeLuminance(flatten(f, b)), l2 = relativeLuminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

export const NEAR_BLACK = "#0d0d0d";
export const WHITE = "#ffffff";

/**
 * Best readable text colour on top of `bg`: white or ChatGPT's near-black,
 * falling back to pure black for the few mid-tones where #0d0d0d misses 4.5:1.
 * max(white, black) contrast is >= 4.58 for every opaque colour, so this always passes AA.
 */
export function onColor(bg) {
  const white = contrastRatio(WHITE, bg), dark = contrastRatio(NEAR_BLACK, bg);
  const preferred = white >= dark ? WHITE : NEAR_BLACK;
  if (Math.max(white, dark) >= 4.5) return preferred;
  return contrastRatio("#000000", bg) > white ? "#000000" : WHITE;
}

/**
 * Return `fg` (hex) adjusted so it reaches `min` contrast against every colour in `bgs`.
 * Keeps hue, moves OKLCH lightness the shortest way that works (darker on light
 * backgrounds, lighter on dark ones), shedding chroma only where sRGB forces it.
 * If no lightness can satisfy all backgrounds, returns the best one found.
 */
export function ensureContrast(fg, bgs, min = 4.5) {
  const list = (Array.isArray(bgs) ? bgs : [bgs]).filter(Boolean);
  const worst = (hex) => Math.min(...list.map((bg) => contrastRatio(hex, bg)));
  const start = hexToOklch(fg);
  if (!start || !list.length) return fg;
  const original = oklchToHex(start);
  if (worst(original) >= min) return original;

  let best = original, bestScore = worst(original);
  // Probe both directions in small steps; the first lightness that passes wins.
  for (let step = 1; step <= 100; step++) {
    for (const dir of [-1, 1]) {
      const L = start.L + dir * step * 0.01;
      if (L < 0 || L > 1) continue;
      const hex = oklchToHex({ L, C: start.C, H: start.H });
      const score = worst(hex);
      if (score >= min) return hex;
      if (score > bestScore) { best = hex; bestScore = score; }
    }
  }
  return best;
}

// --- HSV, for the popup's picker (h 0..360, s/v 0..1) ---

export function hexToHsv(hex) {
  const c = parseColor(hex);
  if (!c) return null;
  const max = Math.max(c.r, c.g, c.b), min = Math.min(c.r, c.g, c.b), d = max - min;
  let h = 0;
  if (d) {
    if (max === c.r) h = ((c.g - c.b) / d) % 6;
    else if (max === c.g) h = (c.b - c.r) / d + 2;
    else h = (c.r - c.g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

export function hsvToHex({ h, s, v }) {
  const f = (n) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return toHex({ r: f(5), g: f(3), b: f(1) });
}
