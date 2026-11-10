// Builds the stylesheet the content script injects. Pure: discovery + settings in, CSS text out.
import { ensureContrast, hexToOklch, onColor, parseColor } from "./color.js";
import {
  MODES,
  TEXT_CONTRAST,
  TEXT_CONTRAST_MORE,
  resolveAccents,
  retint,
  rolesFor,
  tintHue,
  tintNeutral,
} from "./theme.js";

// Repeating a selector raises specificity without !important. ChatGPT's theme
// rules are (0,3,0) (`.X.X:root`); five repeats keep us ahead even if they add one.
const BOOST = 5;
const boosted = (sel) => sel.repeat(BOOST);

/** Selector list covering <html> and any element carrying one of ChatGPT's theme/base classes. */
export function selectorFor(discovery) {
  const classes = discovery ? [...discovery.themeClasses, ...discovery.baseClasses] : [];
  return [boosted(":root"), ...classes.map((c) => boosted("." + c))].join(",\n");
}

const lightDark = (light, dark) => (light === dark ? light : `light-dark(${light}, ${dark})`);

/**
 * Recolour one accent token for one mode.
 * - the reference fill becomes the user's accent exactly;
 * - neutral, opaque values (text on the button) become black or white for contrast;
 * - very light (light mode) / very dark (dark mode) values are surfaces: retinted;
 * - everything else is foreground: retinted, then pushed to the contrast target.
 */
export function recolorToken(hex, mode, ctx) {
  const c = parseColor(hex);
  const lch = hexToOklch(hex);
  if (!c || !lch || c.a === 0) return hex;
  const fill = ctx.accents[mode];
  // Pure greys in the accent group are "text on the button" (ChatGPT uses #fff).
  // Pale tints like #edf3fe carry very little chroma, so the cutoff is tight.
  if (lch.C < 0.008) return c.a < 1 ? hex : onColor(fill);
  const out = retint(hex, fill, ctx.referenceFill);
  if (out.slice(0, 7) === fill) return out;
  const isSurface = mode === "light" ? lch.L >= 0.85 : lch.L <= 0.35;
  if (isSurface || c.a < 1) return out;
  const roles = ctx.roles[mode];
  return ensureContrast(out, [roles.surface, roles.tint], ctx.minText);
}

function accentDeclarations(discovery, settings, minText) {
  const ctx = {
    accents: resolveAccents(settings),
    referenceFill: discovery.referenceFill,
    roles: { light: rolesFor("light", settings, minText), dark: rolesFor("dark", settings, minText) },
    minText,
  };
  const lines = [];
  for (const [name, token] of Object.entries(discovery.accent)) {
    if (token.kind === "expr") {
      // Aliases and color-mix() expressions reference other accent tokens we
      // override, so restating them (outranking ChatGPT's defaults) is enough.
      lines.push(`${name}: ${token.value};`);
      continue;
    }
    const [light, dark] = MODES.map((m) => recolorToken(token[m], m, ctx));
    lines.push(`${name}: ${lightDark(light, dark)};`);
  }
  return lines;
}

function neutralDeclarations(discovery, settings) {
  if (!settings.tint) return [];
  const hue = tintHue(settings);
  return Object.entries(discovery.neutrals).map(([name, t]) => {
    const light = tintNeutral(t.light, hue, settings.tint);
    const dark = tintNeutral(t.dark, hue, settings.tint);
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
  const map = {
    "--interactive-bg-accent-default": v("fill"),
    "--interactive-bg-accent-inactive": v("fill"),
    "--interactive-bg-accent-selected": v("fill"),
    "--composer-blue-bg": v("fill"),
    "--theme-submit-btn-bg": v("fill"),
    "--theme-submit-btn-text": v("onFill"),
    "--composer-blue-text": v("onFill"),
    "--interactive-bg-accent-hover": `color-mix(in srgb, ${v("fill")} 88%, #000)`,
    "--interactive-bg-accent-press": `color-mix(in srgb, ${v("fill")} 78%, #000)`,
    "--composer-blue-hover": `color-mix(in srgb, ${v("fill")} 88%, #000)`,
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
  const sel = selectorFor(discovery);
  const blocks = [];
  const decls = [
    ...(discovery ? accentDeclarations(discovery, settings, TEXT_CONTRAST) : []),
    ...(discovery ? neutralDeclarations(discovery, settings) : []),
    ...(options.legacy ? legacyDeclarations(settings, TEXT_CONTRAST) : []),
  ];
  if (!decls.length) return "";
  blocks.push(`${sel} {\n  ${decls.join("\n  ")}\n}`);

  // Users who ask the OS for more contrast get AAA-level text colours.
  const more = [
    ...(discovery ? accentDeclarations(discovery, settings, TEXT_CONTRAST_MORE) : []),
    ...(options.legacy ? legacyDeclarations(settings, TEXT_CONTRAST_MORE) : []),
  ].filter((line) => !decls.includes(line));
  if (more.length) blocks.push(`@media (prefers-contrast: more) {\n${sel} {\n  ${more.join("\n  ")}\n}\n}`);
  return blocks.join("\n\n") + "\n";
}
