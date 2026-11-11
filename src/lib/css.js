// Builds the stylesheet the content script injects. Pure: discovery + settings in, CSS text out.
//
// Two ChatGPT shells are supported side by side:
//   * logged-out chatgpt.com: StyleX, hashed variable names, found by discover.js;
//   * signed-in chatgpt.com: semantic variable names in a `data-theme` keyed theme
//     block, found by appshell.js.
// `buildPlan` also returns what every overridden variable should compute to, so the
// content script can check that the page actually took the colours.
import { deltaE, ensureContrast, hexToOklch, onColor, parseColor } from "./color.js";
import { appVariant } from "./appshell.js";
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
  shiftLike,
  surfaceSpec,
} from "./theme.js";

// Repeating a selector raises specificity without !important. ChatGPT's theme
// rules are (0,3,0) (`.X.X:root`); five repeats keep us ahead even if they add one.
const BOOST = 5;
const boosted = (sel) => sel.repeat(BOOST);
// For attribute and compound selectors: `:is(S)` repeated matches the same elements
// with five times the specificity.
const boostedIs = (sel) => `:is(${sel})`.repeat(BOOST);

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

/**
 * One override: `{ name, role, light, dark }` (concrete colours per mode) or
 * `{ name, role, expr }` for an alias restated verbatim.
 */
function accentEntries(discovery, settings, minText) {
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
  const entries = [];
  for (const [name, token] of Object.entries(discovery.accent)) {
    if (token.kind === "expr") {
      // Aliases and color-mix() expressions reference other accent tokens we
      // override, so restating them (outranking ChatGPT's defaults) is enough.
      entries.push({ name, role: "accent", expr: token.value });
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
    const role = isBubbleBg ? "bubble" : isBubbleText ? "bubbleText" : isFillFamily ? "send" : "accent";
    entries.push({ name, role, light: values[0], dark: values[1] });
  }
  return entries;
}

function neutralEntries(discovery, settings) {
  const spec = surfaceSpec(settings);
  if (!spec) return [];
  return Object.entries(discovery.neutrals).map(([name, t]) => ({
    name, role: "surface", light: applySurface(t.light, "light", spec), dark: applySurface(t.dark, "dark", spec),
  }));
}

/**
 * Old ChatGPT (and possibly parts of the logged-in app) used readable token
 * names. Only emitted when the page still defines them.
 */
function legacyEntries(settings, minText = TEXT_CONTRAST) {
  const l = rolesFor("light", settings, minText), d = rolesFor("dark", settings, minText);
  const both = (k, role) => ({ role, light: l[k], dark: d[k] });
  const accent = lightDark(l.fill, d.fill);
  const fill = { role: "accent", light: l.fill, dark: d.fill };
  const mix = (pct) => ({ role: "accent", expr: `color-mix(in srgb, ${accent} ${pct}%, #000)` });
  const map = {
    "--interactive-bg-accent-default": fill,
    "--interactive-bg-accent-inactive": fill,
    "--interactive-bg-accent-selected": fill,
    "--composer-blue-bg": fill,
    "--theme-submit-btn-bg": both("submit", "send"),
    "--theme-submit-btn-text": both("onSubmit", "sendText"),
    "--composer-blue-text": both("onSubmit", "sendText"),
    "--interactive-bg-accent-hover": mix(88),
    "--interactive-bg-accent-press": mix(78),
    "--composer-blue-hover": mix(88),
    "--text-accent": both("text", "accent"),
    "--icon-accent": both("text", "accent"),
    "--link": both("text", "accent"),
    "--link-hover": both("text", "accent"),
    "--theme-user-msg-bg": both("tint", "bubble"),
    "--theme-user-msg-text": both("onTint", "bubbleText"),
    "--theme-user-selection-bg": both("tint", "selection"),
  };
  return Object.entries(map).map(([name, e]) => ({ name, ...e }));
}

/** Kept for callers and tests that want the old declaration list. */
export const legacyDeclarations = (settings, minText = TEXT_CONTRAST) => legacyEntries(settings, minText).map(declaration);

// ---------------------------------------------------------------------------
// Signed-in shell
// ---------------------------------------------------------------------------

const VARIANT_SUFFIX = /-(?:hover|active|pressed|press|selected|inactive|disabled)$/;

/** The colour one signed-in variable gets in one mode, or null to leave it alone. */
function appValue(name, v, mode, ctx) {
  const parsed = v[mode];
  if (!parsed) return null;
  const orig = parsed.kind === "color" ? parsed.light : null;
  const R = ctx.roles[mode];
  const fill = ctx.accents[mode];
  const anchor = ctx.app.anchor[mode];
  const chromaticAnchor = Boolean(anchor && (hexToOklch(anchor)?.C ?? 0) > 0.04);
  // Literal value of the same variable without its -hover/-active suffix, if any.
  const baseOf = () => {
    if (!appVariant(name)) return null;
    const base = ctx.app.vars[name.replace(VARIANT_SUFFIX, "")]?.[mode];
    return base?.kind === "color" ? base.light : null;
  };
  switch (v.role) {
    case "bubble": return R.tint;
    case "bubbleText": return R.onTint;
    case "send": {
      const base = baseOf();
      return orig && base ? shiftLike(orig, base, R.submit) : R.submit;
    }
    case "sendText": return R.onSubmit;
    case "onAccent": return onColor(fill);
    case "accentFill": {
      if (!orig) return null;
      const base = baseOf() || (chromaticAnchor ? anchor : null);
      if (!base || near(orig, base)) return parseColor(orig).a < 1 ? shiftLike(orig, base || orig, fill) : fill;
      return shiftLike(orig, base, fill);
    }
    case "accentText": {
      if (!orig) return null;
      const out = chromaticAnchor ? retint(orig, ctx.textAccents[mode], anchor) : retint(REFERENCE[mode].text, ctx.textAccents[mode]);
      if (parseColor(out).a < 1) return out;
      return ensureContrast(out, R.explicitBubble ? [R.surface] : [R.surface, R.tint], ctx.minText);
    }
    case "accentSurface":
    case "selection":
      if (!orig) return null;
      return chromaticAnchor
        ? accentSurface(orig, fill, ctx.strength, anchor)
        : accentSurface(REFERENCE[mode].tint, fill, ctx.strength);
    case "neutral":
      return orig && ctx.spec ? applySurface(orig, mode, ctx.spec) : null;
    default: return null;
  }
}

function appEntries(app, settings, minText) {
  const spec = surfaceSpec(settings);
  const accents = resolveAccents(settings);
  const link = settings.roles?.link;
  const roles = Object.fromEntries(MODES.map((m) => [m, rolesFor(m, settings, minText, { surface: app.surface[m] })]));
  const ctx = {
    app, roles, accents, spec, minText,
    strength: spec?.strength ?? 0,
    textAccents: link ? { light: link, dark: link } : accents,
  };
  const entries = [];
  for (const [name, v] of Object.entries(app.vars)) {
    const light = appValue(name, v, "light", ctx);
    const dark = appValue(name, v, "dark", ctx);
    if (light == null && dark == null) continue;
    entries.push({ name, role: v.role === "neutral" ? "surface" : v.role, light, dark, perMode: true });
  }
  return entries;
}

/** Light and dark selectors for the signed-in shell's overrides, mirroring ChatGPT's own. */
export function appSelectors(app) {
  return Object.fromEntries(MODES.map((m) => [m, app.selectors[m].map(boostedIs).join(",\n")]));
}

// ---------------------------------------------------------------------------

function declaration(e) {
  return `${e.name}: ${e.expr ?? lightDark(e.light, e.dark)};`;
}

const rule = (sel, lines) => `${sel} {\n  ${lines.join("\n  ")}\n}`;

/** All rule blocks for one contrast level, as [selector, lines] pairs keyed by block. */
function blocksFor(discovery, settings, options, minText) {
  const out = {};
  const accent = [
    ...(discovery ? accentEntries(discovery, settings, minText) : []),
    ...(options.legacy ? legacyEntries(settings, minText) : []),
  ];
  if (accent.length) out.accent = { sel: selectorFor(discovery, "accent"), entries: accent };
  const neutral = discovery ? neutralEntries(discovery, settings) : [];
  if (neutral.length) out.neutral = { sel: selectorFor(discovery, "neutral"), entries: neutral };
  if (options.app) {
    const app = appEntries(options.app, settings, minText);
    const sels = appSelectors(options.app);
    for (const m of MODES) {
      const lines = app.filter((e) => e[m] != null).map((e) => ({ name: e.name, role: e.role, light: e[m], dark: e[m] }));
      if (lines.length) out["app-" + m] = { sel: sels[m], entries: lines };
    }
    // Components that re-declare the bubble / send variables for their subtree.
    // light-dark() follows the color-scheme ChatGPT sets for each data-theme scope.
    const byName = Object.fromEntries(app.map((e) => [e.name, e]));
    options.app.components?.forEach((c, i) => {
      const lines = c.names.map((n) => byName[n]).filter((e) => e?.light && e?.dark).map((e) => ({ name: e.name, role: e.role, light: e.light, dark: e.dark }));
      if (lines.length) out["app-component-" + i] = { sel: boostedIs(c.selector), entries: lines };
    });
  }
  return out;
}

/**
 * The whole stylesheet plus what it should do.
 *   options.legacy  also set the old named tokens (only when the page declares them)
 *   options.app     signed-in shell discovery (appshell.js), or null
 * Returns { css, expect } where `expect[name] = { role, light, dark }` lists every
 * variable set to a concrete colour, with the value it should compute to in each
 * mode. `css` is "" when there is nothing to apply.
 */
export function buildPlan(discovery, settings, options = {}) {
  const none = { css: "", expect: {} };
  if (!settings?.enabled || !settings.light) return none;
  const main = blocksFor(discovery, settings, options, TEXT_CONTRAST);
  if (!Object.keys(main).length) return none;

  const expect = {};
  for (const [key, b] of Object.entries(main)) for (const e of b.entries) {
    if (e.expr || e.light == null) continue;
    const prev = expect[e.name];
    if (key === "app-light") expect[e.name] = { role: e.role, light: e.light, dark: prev?.dark ?? null };
    else if (key === "app-dark") expect[e.name] = { role: e.role, light: prev?.light ?? null, dark: e.dark };
    else expect[e.name] = { role: e.role, light: e.light, dark: e.dark };
  }

  const blocks = Object.values(main).map((b) => rule(b.sel, b.entries.map(declaration)));
  // Users who ask the OS for more contrast get AAA-level text colours.
  const more = blocksFor(discovery, settings, options, TEXT_CONTRAST_MORE);
  const extra = [];
  for (const [key, b] of Object.entries(more)) {
    const base = new Set((main[key]?.entries ?? []).map(declaration));
    const lines = b.entries.map(declaration).filter((l) => !base.has(l));
    if (lines.length) extra.push(rule(b.sel, lines));
  }
  if (extra.length) blocks.push(`@media (prefers-contrast: more) {\n${extra.join("\n")}\n}`);
  return { css: blocks.join("\n\n") + "\n", expect };
}

/** The stylesheet text only. */
export const buildCss = (discovery, settings, options = {}) => buildPlan(discovery, settings, options).css;
