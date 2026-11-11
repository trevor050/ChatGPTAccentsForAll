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
/** Same, when the OS asks for more contrast (`prefers-contrast: more`). */
export const UI_CONTRAST_MORE = 4.5;

const DEFAULT_DARK_L = hexToOklch(REFERENCE.dark.surface).L;
/** With `reshape`, ChatGPT's pure-black dark greys land this fraction of the way to the theme's own surface. */
const RESHAPE_FLOOR = 0.88;
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
 * "text" colour stays text-dark), hue is replaced, and chroma is scaled (by the square
 * root of) how colourful the user's accent is compared with ChatGPT's blue.
 */
export function retint(refHex, userFillHex, refFillHex = REFERENCE.fill) {
  const ref = hexToOklch(refHex);
  const user = hexToOklch(userFillHex);
  const refFill = hexToOklch(refFillHex);
  if (!ref || !user || !refFill) return refHex;
  const alpha = parseColor(refHex).a;
  if (deltaE(parseColor(refHex), parseColor(refFillHex)) < 0.02) return withAlpha(userFillHex, alpha);
  // Square root: muted accents still give a visible (if gentle) bubble tint.
  const scale = refFill.C > 0 ? Math.sqrt(user.C / refFill.C) : 0;
  const out = oklchToHex({ L: ref.L, C: Math.min(0.37, ref.C * scale), H: user.H });
  return withAlpha(out, alpha);
}

/**
 * Move a variant of a reference colour (a hover or pressed shade, a translucent
 * focus ring) onto a new base colour: the same lightness and chroma offsets from
 * the new base as the variant had from the old one, and the variant's alpha.
 */
export function shiftLike(variantHex, refBaseHex, targetHex) {
  const v = hexToOklch(variantHex), base = hexToOklch(refBaseHex), t = hexToOklch(targetHex);
  if (!v || !base || !t) return targetHex;
  const L = Math.min(1, Math.max(0, t.L + (v.L - base.L)));
  const C = base.C > 0.01 ? Math.min(0.37, t.C * (v.C / base.C)) : t.C;
  return withAlpha(oklchToHex({ L, C, H: t.H }), parseColor(variantHex).a);
}

function withAlpha(hex, a) {
  if (a >= 1) return hex.slice(0, 7);
  const c = parseColor(hex);
  return toHex({ ...c, a });
}

/**
 * Background tint: shift a neutral grey towards `hue` while keeping its lightness,
 * so text/background contrast barely moves. `strength` is 0..100.
 * In each mode, greys on the "surface" side (light greys in light mode, dark greys
 * in dark mode) take the full tint; greys on the "text" side stay nearly neutral.
 * The extremes have no room for chroma, so pure white dips and pure black lifts
 * a little (still far from the text colours).
 *
 * `depth` (-1..1) moves surface-side greys towards the page's extreme: positive
 * darkens in dark mode and brightens in light mode (both only ever *increase*
 * contrast with text), negative lightens dark surfaces a little. Text-side greys
 * never move.
 *
 * `reshape` (dark mode) goes one step further for a theme that has its own dark
 * background: opaque dark greys are mapped onto that background's lightness
 * (ChatGPT's #212121 becomes the theme's colour, its pure-black page a little
 * below it), keeping their order, so a warm brown theme isn't a black page with a hint of brown.
 */
export function tintNeutral(hex, hue, strength, mode = "light", depth = 0, reshape = false) {
  const c = parseColor(hex);
  if (!c || (strength <= 0 && !depth)) return hex;
  const lch = hexToOklch(hex);
  const s = Math.min(100, Math.max(0, strength)) / 100;
  const isSurfaceSide = mode === "light" ? lch.L >= 0.5 : lch.L < 0.5;
  let L = lch.L;
  const reshaped = reshape && mode === "dark" && isSurfaceSide && c.a >= 1;
  if (reshaped) L = DEFAULT_DARK_L * (1 - depth) * (RESHAPE_FLOOR + (1 - RESHAPE_FLOOR) * (L / DEFAULT_DARK_L));
  else if (depth && isSurfaceSide) L = mode === "light" ? 1 - (1 - L) * (1 - depth) : L * (1 - depth);
  if (mode === "light" && L > 0.94) L -= s * 0.03 * ((L - 0.94) / 0.06 + 0.4);
  if (mode === "dark" && L < 0.2 && !reshaped) L += s * 0.2 * (1 - L / 0.2);
  const C = s * (isSurfaceSide ? 0.045 : 0.012);
  return toHex({ ...parseColor(oklchToHex({ L, C, H: hue })), a: c.a });
}

/**
 * An accent-coloured surface (the user bubble). With background tint on, it keeps
 * at least as much colour as the tinted page so it never fades into it.
 */
export function accentSurface(refHex, fillHex, tint = 0, refFillHex = REFERENCE.fill) {
  const out = retint(refHex, fillHex, refFillHex);
  if (!tint) return out;
  const lch = hexToOklch(out);
  const alpha = parseColor(out).a;
  return withAlpha(oklchToHex({ ...lch, C: Math.max(lch.C, (Math.min(100, tint) / 100) * 0.07) }), alpha);
}

// ---------------------------------------------------------------------------
// Page surfaces ("Default / Dark / Light / Custom")
// ---------------------------------------------------------------------------

/** Base colours behind the "Dark" and "Light" surface choices (as in the 1.x popup). */
export const SURFACE_COLORS = { dark: "#0f0f10", light: "#ffffff" };
const CHROMA_AT_FULL_TINT = 0.045;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/**
 * What a surface choice means for ChatGPT's neutral palette, or null for "Default".
 *
 * The page is never forced dark in light mode (or the reverse): dark text on a
 * forced-dark page was unreadable in 1.x. Instead the chosen colour contributes
 *   - its hue and colourfulness to BOTH modes, as a tint that keeps every
 *     lightness (so text contrast is unchanged), and
 *   - its lightness only to the mode it belongs to: a dark colour deepens (or lifts)
 *     dark mode's greys, a near-white colour brightens light mode's greys.
 * Returns { hue, strength, darkDepth, lightDepth, reshapeDark }.
 */
export function surfaceSpec(settings) {
  const surface = settings?.surface;
  if (!surface || surface.kind === "default") return null;
  const color = surface.kind === "custom" ? surface.color : SURFACE_COLORS[surface.kind];
  const lch = color && hexToOklch(color);
  if (!lch) return null;
  const strength = lch.C < 0.004 ? 0 : Math.min(100, (lch.C / CHROMA_AT_FULL_TINT) * 100);
  return {
    hue: lch.H,
    strength,
    darkDepth: lch.L < 0.5 ? clamp(1 - lch.L / DEFAULT_DARK_L, -0.3, 0.85) : 0,
    reshapeDark: lch.L < 0.5,
    lightDepth: lch.L >= 0.5 ? clamp((lch.L - 0.95) / 0.05, 0, 1) * 0.5 : 0,
  };
}

/** Tint one neutral colour (any role) the way the user's surface choice asks. */
export function applySurface(hex, mode, spec) {
  if (!spec) return hex;
  return tintNeutral(hex, spec.hue, spec.strength, mode, mode === "dark" ? spec.darkDepth : spec.lightDepth, spec.reshapeDark);
}

/**
 * Safety net for a chosen text/background pair: returned unchanged when it already
 * reaches `min`. Otherwise a coloured text keeps its hue and moves only as far as
 * it must; a grey or white one (no hue to keep) becomes whichever of white, near-black
 * or black reads best, so a failing white label turns dark instead of a muddy grey.
 */
export function readable(text, bg, min) {
  if (contrastRatio(text, bg) >= min) return text;
  if ((hexToOklch(text)?.C ?? 0) < 0.02) {
    const alt = onColor(bg);
    if (contrastRatio(alt, bg) >= min) return alt;
  }
  return ensureContrast(text, [bg], min);
}

/**
 * Concrete role colours for one mode. Used for the popup preview, for legacy
 * named tokens, and as contrast backdrops when recolouring discovered tokens.
 *
 * Every role can be chosen explicitly through `settings.roles`; any role left
 * null is derived from the accent. Explicit pairs are only touched when they would
 * be unreadable (body text below `minText`, the send-button glyph below the
 * non-text UI minimum), so a theme renders as designed whenever it already passes.
 *
 *   fill      accent colour (what accent text, links and icons are derived from)
 *   submit    background of the accent-filled controls, the send button
 *   onSubmit  its icon/label colour
 *   tint      user bubble background      onTint  user bubble text
 *   text      accent-coloured text on the page (links)
 *   surface   page background (ChatGPT's reference one unless `page.surface` is given)
 */
export function rolesFor(mode, settings, minText = TEXT_CONTRAST, page = {}) {
  const ref = REFERENCE[mode];
  const r = settings.roles || {};
  const fill = resolveAccents(settings)[mode];
  const spec = surfaceSpec(settings);
  // `page.surface`: the actual page background when the shell declares one (signed-in ChatGPT).
  const surface = applySurface(page.surface || ref.surface, mode, spec);
  const strength = spec?.strength ?? 0;
  const minUi = minText > TEXT_CONTRAST ? UI_CONTRAST_MORE : UI_CONTRAST;

  const submit = r.submitBg || fill;
  const onSubmit = r.submitText ? readable(r.submitText, submit, minUi) : onColor(submit);

  const explicitBubble = Boolean(r.bubbleBg);
  const tint = r.bubbleBg || accentSurface(ref.tint, fill, strength);
  const onTint = readable(r.bubbleText || (explicitBubble ? onColor(tint) : retint(ref.onTint, fill)), tint, minText);

  const linkBase = r.link || fill;
  // Accent text lives on the page; it only also has to work on the bubble when
  // the bubble itself is derived from the accent.
  const text = ensureContrast(retint(ref.text, linkBase), explicitBubble ? [surface] : [surface, tint], minText);
  return { fill, submit, onSubmit, onFill: onSubmit, surface, tint, onTint, text, explicitBubble };
}
