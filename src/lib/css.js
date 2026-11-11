// Builds the stylesheet the content script injects. Pure: discovery + settings in, CSS text out.
import { deltaE, ensureContrast, hexToOklch, onColor, parseColor } from "./color.js";
import {
  MODES,
  REFERENCE,
  TEXT_CONTRAST,
  TEXT_CONTRAST_MORE,
  accentSurface,
  applySurface,
  resolveAccents,
  retint,
  rolesFor,
  surfaceSpec,
} from "./theme.js";

// Repeating a selector raises specificity without !important. ChatGPT's theme
// rules are (0,3,0) (`.X.X:root`); five repeats keep us ahead even if they add one.
const BOOST = 5;
const boosted = (sel) => sel.repeat(BOOST);

/**
 * Where to declare overrides.
 * - "accent": <html> plus ChatGPT's accent theme classes, i.e. exactly where its own
 *   accent setting applies. ChatGPT puts its base class on <body> to reset raw accent
 *   tokens to black/white defaults; themed colours reach the UI through tokens resolved
 *   at :root. Some controls (the "Log in" pill) rely on that reset, so we must not
 *   override accent tokens on base-class elements.
 * - "neutral": <html> plus the base classes, so tinted greys survive those resets.
 */
export function selectorFor(discovery, kind = "accent") {
  const classes = !discovery ? [] : kind === "accent" ? discovery.themeClasses : discovery.baseClasses;
  return [boosted(":root"), ...classes.map((c) => boosted("." + c))].join(",\n");
}

const lightDark = (light, dark) => (light === dark ? light : `light-dark(${light}, ${dark})`);

const near = (a, b, tol = 0.02) => {
  const ca = parseColor(a), cb = parseColor(b);
  return Boolean(ca && cb) && deltaE(ca, cb) < tol;
};

/**
 * Recolour one accent token for one mode.
 * - the reference fill becomes the fill colour exactly (the submit colour, which is
 *   the accent unless a theme picks a separate one);
 * - neutral, opaque values (text on the button) become the button's label colour;
 * - very light (light mode) / very dark (dark mode) values are surfaces: retinted;
 * - everything else is foreground: retinted, then pushed to the contrast target.
 * `ctx.accents` is what everything is retinted towards; callers pass the fill-family
 * colours for fill tokens and the accent/link colours for text tokens.
 */
export function recolorToken(hex, mode, ctx) {
  const c = parseColor(hex);
  const lch = hexToOklch(hex);
  if (!c || !lch || c.a === 0) return hex;
  const fill = ctx.accents[mode];
  const roles = ctx.roles[mode];
  // Pure greys in the accent group are "text on the button" (ChatGPT uses #fff).
  // Pale tints like #edf3fe carry very little chroma, so the cutoff is tight.
  if (lch.C < 0.008) return c.a < 1 ? hex : roles?.onSubmit ?? onColor(fill);
  const out = retint(hex, fill, ctx.referenceFill);
  if (out.slice(0, 7) === fill) return out;
  const isSurface = mode === "light" ? lch.L >= 0.85 : lch.L <= 0.35;
  if (isSurface) return accentSurface(hex, fill, ctx.tint, ctx.referenceFill);
  if (c.a < 1) return out;
  return ensureContrast(out, ctx.backdrops ? ctx.backdrops(mode) : [roles.surface, roles.tint], ctx.minText);
}

function accentDeclarations(discovery, settings, minText) {
  const accents = resolveAccents(settings);
  const r = settings.roles || {};
  const roles = { light: rolesFor("light", settings, minText), dark: rolesFor("dark", settings, minText) };
  const fills = Object.fromEntries(MODES.map((m) => [m, roles[m].submit]));
  const textAccents = r.link ? { light: r.link, dark: r.link } : accents;
  const ctx = {
    referenceFill: discovery.referenceFill,
    tint: surfaceSpec(settings)?.strength ?? 0,
    roles,
    minText,
    // A bubble the user picked is not part of what accent text must stand out from.
    backdrops: (m) => (roles[m].explicitBubble ? [roles[m].surface] : [roles[m].surface, roles[m].tint]),
  };
  const lines = [];
  for (const [name, token] of Object.entries(discovery.accent)) {
    if (token.kind === "expr") {
      // Aliases and color-mix() expressions reference other accent tokens we
      // override, so restating them (outranking ChatGPT's defaults) is enough.
      lines.push(`${name}: ${token.value};`);
      continue;
    }
    // Which job does this token do? Recognised from how ChatGPT's own blue palette
    // uses it (REFERENCE), so a repaint of that palette degrades to "derived from
    // the accent" rather than to a wrong colour.
    const isFillFamily = near(token.light, discovery.referenceFill) || near(token.dark, discovery.referenceFill);
    const isBubbleBg = !isFillFamily && near(token.light, REFERENCE.light.tint, 0.03) && near(token.dark, REFERENCE.dark.tint, 0.03);
    const isBubbleText = !isFillFamily && near(token.light, REFERENCE.light.onTint) && near(token.dark, REFERENCE.dark.onTint);
    const values = MODES.map((m) => {
      if (isBubbleBg) return roles[m].tint;
      if (isBubbleText) return roles[m].onTint;
      return recolorToken(token[m], m, { ...ctx, accents: isFillFamily ? fills : textAccents });
    });
    lines.push(`${name}: ${lightDark(values[0], values[1])};`);
  }
  return lines;
}

function neutralDeclarations(discovery, settings) {
  const spec = surfaceSpec(settings);
  if (!spec) return [];
  return Object.entries(discovery.neutrals).map(([name, t]) => {
    const light = applySurface(t.light, "light", spec);
    const dark = applySurface(t.dark, "dark", spec);
    return `${name}: ${lightDark(light, dark)};`;
  });
}

/**
 * Old ChatGPT (and possibly parts of the logged-in app) used readable token
 * names. Only emitted when the page still defines them.
 */
export function legacyDeclarations(settings, minText = TEXT_CONTRAST) {
  const l = rolesFor("light", settings, minText), d = rolesFor("dark", settings, minText);
  const v = (k) => lightDark(l[k], d[k]);
  const accent = lightDark(l.fill, d.fill);
  const map = {
    "--interactive-bg-accent-default": accent,
    "--interactive-bg-accent-inactive": accent,
    "--interactive-bg-accent-selected": accent,
    "--composer-blue-bg": accent,
    "--theme-submit-btn-bg": v("submit"),
    "--theme-submit-btn-text": v("onSubmit"),
    "--composer-blue-text": v("onSubmit"),
    "--interactive-bg-accent-hover": `color-mix(in srgb, ${accent} 88%, #000)`,
    "--interactive-bg-accent-press": `color-mix(in srgb, ${accent} 78%, #000)`,
    "--composer-blue-hover": `color-mix(in srgb, ${accent} 88%, #000)`,
    "--text-accent": v("text"),
    "--icon-accent": v("text"),
    "--link": v("text"),
    "--link-hover": v("text"),
    "--theme-user-msg-bg": v("tint"),
    "--theme-user-msg-text": v("onTint"),
    "--theme-user-selection-bg": v("tint"),
  };
  return Object.entries(map).map(([k, val]) => `${k}: ${val};`);
}

/**
 * The whole stylesheet. `options.legacy` adds the old named tokens.
 * Returns "" when there is nothing to apply.
 */
export function buildCss(discovery, settings, options = {}) {
  if (!settings?.enabled || !settings.light) return "";
  const rule = (sel, lines) => `${sel} {\n  ${lines.join("\n  ")}\n}`;
  const accentSel = selectorFor(discovery, "accent");
  const accent = [
    ...(discovery ? accentDeclarations(discovery, settings, TEXT_CONTRAST) : []),
    ...(options.legacy ? legacyDeclarations(settings, TEXT_CONTRAST) : []),
  ];
  const neutral = discovery ? neutralDeclarations(discovery, settings) : [];
  const blocks = [];
  if (accent.length) blocks.push(rule(accentSel, accent));
  if (neutral.length) blocks.push(rule(selectorFor(discovery, "neutral"), neutral));
  if (!blocks.length) return "";

  // Users who ask the OS for more contrast get AAA-level text colours.
  const more = [
    ...(discovery ? accentDeclarations(discovery, settings, TEXT_CONTRAST_MORE) : []),
    ...(options.legacy ? legacyDeclarations(settings, TEXT_CONTRAST_MORE) : []),
  ].filter((line) => !accent.includes(line));
  if (more.length) blocks.push(`@media (prefers-contrast: more) {\n${rule(accentSel, more)}\n}`);
  return blocks.join("\n\n") + "\n";
}
