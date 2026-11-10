// Turns user settings into concrete colours. Pure functions, no DOM.
import {
  contrastRatio,
  deltaE,
  ensureContrast,
  hexToOklch,
  oklchToHex,
  onColor,
  parseColor,
  toHex,
} from "./color.js";

/**
 * ChatGPT's own blue accent theme, captured from chatgpt.com on 2026-11-10.
 * Used as the reference palette that user colours are mapped onto, and for the
 * popup preview. If ChatGPT redesigns its accent palette, update these values
 * (see AGENTS.md, "When ChatGPT changes").
 */
export const REFERENCE = {
  fill: "#3566f0",
  light: { surface: "#ffffff", tint: "#edf3fe", text: "#2451da", onTint: "#2451da" },
  dark: { surface: "#212121", tint: "#020562", text: "#b0c9fe", onTint: "#dae6fd" },
};

export const MODES = ["light", "dark"];

/** Minimum contrast for text the extension recolours (WCAG AA body text). */
export const TEXT_CONTRAST = 4.5;
/** Used inside `@media (prefers-contrast: more)` (WCAG AAA). */
export const TEXT_CONTRAST_MORE = 7;
/** Non-text UI (buttons) against the page, WCAG 1.4.11. Only used for auto-derived colours. */
export const UI_CONTRAST = 3;

const ACHROMATIC = 0.025;
const isAchromatic = (lch) => lch.C < ACHROMATIC;

/**
 * Dark-mode accent derived from the light one. ChatGPT keeps the same fill in both
 * modes, so we do too, unless it would vanish against the dark page. Near-greys
 * are mirrored (black in light mode becomes white in dark mode, like ChatGPT's
 * own default accent).
 */
export function deriveDarkAccent(lightHex) {
  const lch = hexToOklch(lightHex);
  if (!lch) return lightHex;
  if (isAchromatic(lch)) {
    if (lch.L >= 0.6) return oklchToHex(lch);
    if (lch.L < 0.25) return "#ffffff";
    return oklchToHex({ L: 1 - lch.L + 0.16, C: lch.C, H: lch.H });
  }
  if (contrastRatio(lightHex, REFERENCE.dark.surface) >= UI_CONTRAST) return oklchToHex(lch);
  return ensureContrast(lightHex, [REFERENCE.dark.surface], UI_CONTRAST);
}

/** The accent fill for each mode, honouring an explicit dark choice. */
export function resolveAccents(settings) {
  const light = settings.light;
  const dark = settings.dark || deriveDarkAccent(light);
  return { light, dark };
}

/**
 * Map one colour from ChatGPT's reference palette onto the user's accent.
 * Lightness is preserved (so a "very light tint" stays very light and a
 * "text" colour stays text-dark), hue is replaced, and chroma is scaled by how
 * colourful the user's accent is compared with ChatGPT's blue.
 */
export function retint(refHex, userFillHex, refFillHex = REFERENCE.fill) {
  const ref = hexToOklch(refHex);
  const user = hexToOklch(userFillHex);
  const refFill = hexToOklch(refFillHex);
  if (!ref || !user || !refFill) return refHex;
  const alpha = parseColor(refHex).a;
  if (deltaE(parseColor(refHex), parseColor(refFillHex)) < 0.02) return withAlpha(userFillHex, alpha);
  const scale = refFill.C > 0 ? user.C / refFill.C : 0;
  const out = oklchToHex({ L: ref.L, C: Math.min(0.37, ref.C * scale), H: user.H });
  return withAlpha(out, alpha);
}

function withAlpha(hex, a) {
  if (a >= 1) return hex.slice(0, 7);
  const c = parseColor(hex);
  return toHex({ ...c, a });
}

/**
 * Background tint: shift a neutral grey towards `hue` while keeping its lightness,
 * so text/background contrast barely moves. `strength` is 0..100.
 * Pure white has no room for chroma, so near-white surfaces dip very slightly.
 */
export function tintNeutral(hex, hue, strength) {
  const c = parseColor(hex);
  if (!c || strength <= 0) return hex;
  const lch = hexToOklch(hex);
  const s = Math.min(100, strength) / 100;
  const L = lch.L > 0.94 ? lch.L - s * 0.03 * ((lch.L - 0.94) / 0.06 + 0.4) : lch.L;
  // Text-extreme greys (near black) take less colour so body copy stays neutral.
  const C = s * (lch.L < 0.22 ? 0.012 : 0.045);
  return toHex({ ...parseColor(oklchToHex({ L, C, H: hue })), a: c.a });
}

/** Hue used for background tinting: the light accent's hue. */
export function tintHue(settings) {
  return hexToOklch(settings.light)?.H ?? 0;
}

/**
 * Concrete role colours for one mode. Used for the popup preview, for legacy
 * named tokens, and as contrast backdrops when recolouring discovered tokens.
 */
export function rolesFor(mode, settings, minText = TEXT_CONTRAST) {
  const ref = REFERENCE[mode];
  const fill = resolveAccents(settings)[mode];
  const hue = tintHue(settings);
  const surface = tintNeutral(ref.surface, hue, settings.tint);
  const tint = retint(ref.tint, fill);
  return {
    fill,
    onFill: onColor(fill),
    surface,
    tint,
    text: ensureContrast(retint(ref.text, fill), [surface, tint], minText),
    onTint: ensureContrast(retint(ref.onTint, fill), [tint], minText),
  };
}
