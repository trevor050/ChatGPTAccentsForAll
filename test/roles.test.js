// Explicit theme roles (accent, bubble, send button, link), the contrast safety net,
// and how the page-surface choice maps onto light and dark mode.
import { describe, expect, it } from "vitest";
import fixture from "./fixtures/chatgpt-2026-11-10.json" with { type: "json" };
import { contrastRatio, hexToOklch } from "../src/lib/color.js";
import { buildCss } from "../src/lib/css.js";
import { discoverTokens } from "../src/lib/discover.js";
import { DEFAULT_SETTINGS, applyLook, applyTheme, normalizeSettings } from "../src/lib/settings.js";
import { REFERENCE, rolesFor, surfaceSpec, tintNeutral } from "../src/lib/theme.js";
import { THEMES, themeById, themeLook } from "../src/lib/themes.js";
import { ORIGINAL_THEMES } from "../src/lib/themes-original.js";

const discovery = discoverTokens(fixture.rules);
// Current themes, or (for engine behaviour on hand-picked colours) the original 1.x ones.
const anyTheme = (id) => themeById(id) ?? ORIGINAL_THEMES.find((t) => t.id === id);
const themed = (id, patch = {}) => normalizeSettings({ ...applyTheme(DEFAULT_SETTINGS, anyTheme(id)), ...patch });
const custom = (look) => normalizeSettings(applyLook(DEFAULT_SETTINGS, look));

// Tokens in the captured ChatGPT stylesheet (see test/fixtures and AGENTS.md).
const FILL = ["--x1e4keym", "--x1scdecw"]; // raw accent fill: the send button
const ON_FILL = ["--xjq2c5c", "--xlmsz48"]; // glyph on the fill
const BUBBLE = "--x1y9qfar", BUBBLE_TEXT = "--xn2d1jy", ACCENT_TEXT = "--xbn88x4";
const PAGE = "--x17e9krr", PAGE_TEXT = "--xlyber6";

const declsOf = (css) => {
  const main = css.split("@media")[0];
  return Object.fromEntries([...main.matchAll(/(--[\w-]+): ([^;]+);/g)].map((m) => [m[1], m[2]]));
};
const pair = (v) => {
  const m = /^light-dark\((#[0-9a-f]+), (#[0-9a-f]+)\)$/.exec(v);
  return m ? { light: m[1], dark: m[2] } : { light: v, dark: v };
};
const css = (settings) => declsOf(buildCss(discovery, settings));
const hueGap = (a, b) => { const d = Math.abs(hexToOklch(a).H - hexToOklch(b).H); return Math.min(d, 360 - d); };

describe("explicit roles drive ChatGPT's tokens", () => {
  it("a theme's own colours land exactly where they belong", () => {
    const d = css(themed("sunset"));
    for (const name of FILL) expect(d[name]).toBe("#f97316"); // send button: the theme's submit colour
    for (const name of ON_FILL) expect(d[name]).toBe("#111111"); // its glyph
    expect(d[BUBBLE]).toBe("#7c2d12"); // user bubble, in both modes
    expect(d[BUBBLE_TEXT]).toBe("#fde2e4");
    expect(d["--x4sldyk"]).toBe("var(--x1e4keym)"); // aliases still follow the fill
  });

  it("accent text follows the accent, not the send button colour", () => {
    // Sunset: pink accent, orange send button.
    const text = pair(css(themed("sunset"))[ACCENT_TEXT]);
    expect(hueGap(text.light, "#fb7185")).toBeLessThan(hueGap(text.light, "#f97316"));
  });

  it("an optional link colour steers accent text", () => {
    // Ocean: teal accent, sky-blue links.
    const text = pair(css(themed("ocean"))[ACCENT_TEXT]);
    expect(hueGap(text.dark, "#38bdf8")).toBeLessThan(hueGap(text.dark, "#2dd4bf"));
  });

  it("roles left empty fall back to deriving from the accent", () => {
    const d = css(custom({ light: "#e11d48" }));
    for (const name of FILL) expect(d[name]).toBe("#e11d48");
    expect(pair(d[BUBBLE]).light).not.toBe("#e11d48"); // a tint of it, as in 2.0.0
    expect(contrastRatio(pair(d[BUBBLE_TEXT]).light, pair(d[BUBBLE]).light)).toBeGreaterThanOrEqual(4.5);
  });

  it("an explicit role can be set on its own", () => {
    const s = custom({ light: "#e11d48", roles: { submitBg: "#112233" } });
    const d = css(s);
    for (const name of FILL) expect(d[name]).toBe("#112233");
    expect(pair(d[BUBBLE]).light).toBe(rolesFor("light", s).tint); // bubble still derived from the accent
  });

  it("the same colours in light and dark mode stay one plain value", () => {
    expect(css(themed("blue"))[BUBBLE]).not.toContain("light-dark");
  });

  it("is restated for old ChatGPT's named tokens too", () => {
    const legacy = buildCss(null, themed("sunset"), { legacy: true });
    expect(legacy).toContain("--theme-submit-btn-bg: #f97316;");
    expect(legacy).toContain("--theme-user-msg-bg: #7c2d12;");
    expect(legacy).toContain("--theme-user-msg-text: #fde2e4;");
  });
});

// The 1.x themes were designed without a contrast rule. The engine's rule: bubble text
// 4.5:1 on its bubble; the send button's glyph (a graphic, WCAG 1.4.11) 3:1 on the button;
// the OS "more contrast" setting raises those to 7:1 and 4.5:1.
describe("contrast safety net", () => {
  // Themes whose designed pair fails the rule, and the only ones the engine touches.
  const ADJUSTED = {
    gameboy: ["bubbleText"],
    mint: ["submitText"],
    pastel_mint: ["submitText"],
    pastel_peach: ["submitText"],
    pastel_rose: ["submitText"],
    pastel_sand: ["submitText"],
    frost: ["submitText"],
  };

  it("leaves every curated theme exactly as designed", () => {
    for (const t of THEMES) {
      const r = rolesFor("light", themed(t.id));
      expect([r.onTint, r.onSubmit], t.id).toEqual([t.bubbleText, t.submitText]);
    }
  });

  it("touches only the original themes whose designed pair failed the rule", () => {
    for (const t of ORIGINAL_THEMES) {
      const r = rolesFor("light", normalizeSettings(applyTheme(DEFAULT_SETTINGS, t)));
      const changed = [];
      if (r.onTint !== t.bubbleText) changed.push("bubbleText");
      if (r.onSubmit !== t.submitText) changed.push("submitText");
      expect(changed, t.id).toEqual(ADJUSTED[t.id] ?? []);
      expect(rolesFor("dark", normalizeSettings(applyTheme(DEFAULT_SETTINGS, t))).onTint, `${t.id} dark`).toBe(r.onTint); // same in both modes
    }
  });

  it("makes every theme meet the rule, in both modes and in more-contrast mode", () => {
    for (const t of [...THEMES, ...ORIGINAL_THEMES]) for (const mode of ["light", "dark"]) {
      const r = rolesFor(mode, themed(t.id));
      expect(contrastRatio(r.onTint, r.tint), `${t.id} ${mode} bubble`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(r.onSubmit, r.submit), `${t.id} ${mode} send`).toBeGreaterThanOrEqual(3);
      const more = rolesFor(mode, themed(t.id), 7);
      // A mid-tone bubble can't reach 7:1 with any text; then the best possible is the target.
      const best = Math.max(contrastRatio("#ffffff", more.tint), contrastRatio("#000000", more.tint));
      expect(contrastRatio(more.onTint, more.tint), `${t.id} ${mode} bubble (more)`).toBeGreaterThanOrEqual(Math.min(7, best) - 0.3);
      expect(contrastRatio(more.onSubmit, more.submit), `${t.id} ${mode} send (more)`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("holds in the generated stylesheet, not only in the role maths", () => {
    for (const t of THEMES) {
      const d = css(themed(t.id));
      for (const mode of ["light", "dark"]) {
        expect(contrastRatio(pair(d[BUBBLE_TEXT])[mode], pair(d[BUBBLE])[mode]), `${t.id} bubble`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(pair(d[ON_FILL[0]])[mode], pair(d[FILL[0]])[mode]), `${t.id} send`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("keeps the hue of coloured text it has to move, and flips a failing white label to dark", () => {
    const gb = rolesFor("light", themed("gameboy"));
    expect(hueGap(gb.onTint, "#8bac0f")).toBeLessThan(8);
    expect(hexToOklch(gb.onTint).L).toBeGreaterThan(hexToOklch("#8bac0f").L); // lifted against the dark bubble
    expect(rolesFor("light", themed("mint")).onSubmit).toBe("#0d0d0d");
  });

  it("applies to hand-picked colours too, and never touches a passing pair", () => {
    const bad = rolesFor("light", custom({ light: "#336699", roles: { bubbleBg: "#ffee99", bubbleText: "#fff7bb", submitBg: "#112233", submitText: "#ffffff" } }));
    expect(contrastRatio(bad.onTint, bad.tint)).toBeGreaterThanOrEqual(4.5);
    expect(bad.onSubmit).toBe("#ffffff");
    const fine = rolesFor("light", custom({ light: "#336699", roles: { bubbleBg: "#223344", bubbleText: "#e1e8ef", submitBg: "#ffee99", submitText: "#331100" } }));
    expect([fine.onTint, fine.onSubmit]).toEqual(["#e1e8ef", "#331100"]);
  });

  it("derives a readable bubble text when only the bubble colour is chosen", () => {
    const r = rolesFor("light", custom({ light: "#336699", roles: { bubbleBg: "#fde68a" } }));
    expect(contrastRatio(r.onTint, "#fde68a")).toBeGreaterThanOrEqual(4.5);
  });

  it("does not let accent text collide with a bubble the user picked", () => {
    // Accent text sits on the page, so only the page has to be its backdrop.
    const s = themed("pastel_sky"); // light bubble + dark accent text on a light page
    const r = rolesFor("light", s);
    expect(contrastRatio(r.text, r.surface)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("surfaces", () => {
  const withSurface = (surface) => normalizeSettings({ ...themed("blue"), surface });
  const dark = (kind, color = null) => css(withSurface({ kind, color }));

  it("Default leaves ChatGPT's greys alone", () => {
    expect(buildCss(discovery, themed("blue"))).not.toContain(".xsajpkq");
    expect(surfaceSpec(themed("blue"))).toBeNull();
  });

  it("Dark deepens dark mode and never forces a dark page in light mode", () => {
    const d = dark("dark");
    const page = pair(d[PAGE]);
    expect(page.light).toBe(discovery.neutrals[PAGE].light); // light mode: ChatGPT's own page
    expect(hexToOklch(page.dark).L).toBeLessThan(hexToOklch(discovery.neutrals[PAGE].dark).L);
    expect(pair(d[PAGE_TEXT]).dark).toBe(discovery.neutrals[PAGE_TEXT].dark); // text-side greys never move
  });

  it("Light brightens light mode and leaves dark mode alone", () => {
    const page = pair(dark("light")[PAGE]);
    expect(page.dark).toBe(discovery.neutrals[PAGE].dark);
    expect(hexToOklch(page.light).L).toBeGreaterThanOrEqual(hexToOklch(discovery.neutrals[PAGE].light).L - 1e-6);
  });

  it("Custom reshapes the mode it belongs to and only tints the other", () => {
    const ocean = pair(css(themed("ocean"))[PAGE]);
    const sample = hexToOklch(ocean.dark);
    expect(hueGap(ocean.dark, "#0b1f26")).toBeLessThan(25);
    expect(sample.L).toBeLessThan(hexToOklch(REFERENCE.dark.surface).L); // darker, like the original #0b1f26
    // Light mode: same hue, lightness kept (a tint, not a dark page).
    expect(hexToOklch(ocean.light).L).toBeGreaterThan(0.9);
    const pastel = pair(css(themed("pastel_mint"))[PAGE]);
    expect(hexToOklch(pastel.dark).L).toBeLessThan(0.35); // dark mode stays a dark page
  });

  it("keeps body text readable on every theme's page, in both modes", () => {
    for (const t of THEMES) {
      const d = css(themed(t.id));
      const surface = pair(d[PAGE] ?? discovery.neutrals[PAGE].light);
      const text = pair(d[PAGE_TEXT] ?? discovery.neutrals[PAGE_TEXT].light);
      const base = discovery.neutrals;
      const s = (mode) => (d[PAGE] ? surface[mode] : base[PAGE][mode]);
      const x = (mode) => (d[PAGE_TEXT] ? text[mode] : base[PAGE_TEXT][mode]);
      expect(contrastRatio(x("light"), s("light")), `${t.id} light`).toBeGreaterThan(12);
      expect(contrastRatio(x("dark"), s("dark")), `${t.id} dark`).toBeGreaterThan(12);
    }
  });

  it("a theme's own dark background reaches ChatGPT's pure-black page too", () => {
    const BLACK_PAGE = "--xxsqvjy"; // #000 in dark mode on logged-out chatgpt.com
    const mocha = pair(css(themed("mocha"))[BLACK_PAGE]);
    const L = hexToOklch(mocha.dark).L;
    expect(L).toBeGreaterThan(0.17); // the warm brown theme isn't a black page...
    expect(L).toBeLessThan(hexToOklch("#221b18").L + 0.01); // ...and never lighter than its own background
    expect(hexToOklch(mocha.light).L).toBeGreaterThan(0.95); // light mode: a tint only, still a light page
    for (const t of THEMES) {
      const d = css(themed(t.id));
      const page = d[BLACK_PAGE] ? pair(d[BLACK_PAGE]).dark : "#000000";
      const text = d[PAGE_TEXT] ? pair(d[PAGE_TEXT]).dark : discovery.neutrals[PAGE_TEXT].dark;
      expect(contrastRatio(text, page), `${t.id} on the logged-out page`).toBeGreaterThan(10);
    }
  });

  it("depth only ever increases contrast with text", () => {
    const text = { light: "#0d0d0d", dark: "#ffffff" };
    for (const mode of ["light", "dark"]) {
      const base = REFERENCE[mode].surface;
      const before = contrastRatio(text[mode], base);
      for (const depth of [0.2, 0.5, 0.85]) {
        expect(contrastRatio(text[mode], tintNeutral(base, 200, 0, mode, depth)), `${mode} ${depth}`).toBeGreaterThanOrEqual(before - 0.01);
      }
    }
  });

  it("a saved or custom look round-trips through the engine", () => {
    const look = { ...themeLook(themeById("synthwave")), surface: { kind: "custom", color: "#0a0014" } };
    const s = custom(look);
    expect(s.surface).toEqual({ kind: "custom", color: "#0a0014" });
    expect(surfaceSpec(s).darkDepth).toBeGreaterThan(0.3);
  });
});
