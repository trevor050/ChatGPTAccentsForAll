import { describe, expect, it } from "vitest";
import fixture from "./fixtures/chatgpt-2026-11-10.json" with { type: "json" };
import { contrastRatio } from "../src/lib/color.js";
import { buildCss, recolorToken } from "../src/lib/css.js";
import { discoverTokens } from "../src/lib/discover.js";
import { normalizeSettings } from "../src/lib/settings.js";
import { REFERENCE, deriveDarkAccent, resolveAccents, rolesFor, tintNeutral } from "../src/lib/theme.js";

const discovery = discoverTokens(fixture.rules);
const settingsFor = (light, extra = {}) => normalizeSettings({ enabled: true, light, ...extra });

// Awkward picks on purpose: near-white, near-black, neon, pale, grey.
const PICKS = ["#e11d48", "#eab308", "#fff59d", "#0d0d0d", "#ffffff", "#00ff41", "#1e3a8a", "#ffc0cb", "#808080", "#3566f0"];

const declsOf = (css) => {
  const main = css.split("@media")[0]; // accent + neutral blocks
  return Object.fromEntries([...main.matchAll(/(--[\w-]+): ([^;]+);/g)].map((m) => [m[1], m[2]]));
};
const pair = (v) => {
  const m = /^light-dark\((#[0-9a-f]+), (#[0-9a-f]+)\)$/.exec(v);
  return m ? { light: m[1], dark: m[2] } : { light: v, dark: v };
};

describe("buildCss", () => {
  it("emits nothing when disabled or unset", () => {
    expect(buildCss(discovery, normalizeSettings({}))).toBe("");
    expect(buildCss(discovery, settingsFor("#e11d48", { enabled: false }))).toBe("");
  });

  it("outranks ChatGPT's theme selectors", () => {
    const css = buildCss(discovery, settingsFor("#e11d48"));
    expect(css).toContain(":root:root:root:root:root");
    expect(css).toContain(".x13qp82k.x13qp82k.x13qp82k.x13qp82k.x13qp82k");
  });

  it("leaves accent tokens alone where ChatGPT resets them (base class on <body>)", () => {
    const [accentBlock, neutralBlock] = buildCss(discovery, settingsFor("#e11d48", { tint: 50 })).split("\n\n");
    expect(accentBlock).toContain("--x1e4keym");
    expect(accentBlock).not.toContain(".xsajpkq");
    expect(neutralBlock).toContain(".xsajpkq.xsajpkq");
    expect(neutralBlock).not.toContain("--x1e4keym");
  });

  it("uses the exact picked colour as the fill", () => {
    const d = declsOf(buildCss(discovery, settingsFor("#e11d48")));
    expect(d["--x1e4keym"]).toBe("#e11d48");
    expect(d["--x4sldyk"]).toBe("var(--x1e4keym)");
  });

  it.each(PICKS)("keeps every recoloured text token readable for %s", (pick) => {
    const s = settingsFor(pick);
    const d = declsOf(buildCss(discovery, s));
    const accents = resolveAccents(s);
    for (const mode of ["light", "dark"]) {
      const roles = rolesFor(mode, s);
      // text on the button
      expect(contrastRatio(pair(d["--xjq2c5c"])[mode], accents[mode])).toBeGreaterThanOrEqual(4.5);
      // accent text on the page and inside the user bubble
      for (const name of ["--xbn88x4", "--xn2d1jy"]) {
        const fg = pair(d[name])[mode];
        expect(contrastRatio(fg, roles.surface), `${name} ${mode}`).toBeGreaterThanOrEqual(4.5);
        expect(contrastRatio(fg, pair(d["--x1y9qfar"])[mode]), `${name} on bubble ${mode}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("asks for AAA contrast under prefers-contrast: more", () => {
    const css = buildCss(discovery, settingsFor("#eab308"));
    const more = css.split("@media (prefers-contrast: more)")[1];
    expect(more).toBeDefined();
    const fg = pair(/--xbn88x4: ([^;]+);/.exec(more)[1]).light;
    expect(contrastRatio(fg, "#ffffff")).toBeGreaterThanOrEqual(7);
  });

  it("tints neutrals only when asked, without hurting body text contrast", () => {
    expect(declsOf(buildCss(discovery, settingsFor("#0e7490")))["--x17e9krr"]).toBeUndefined();
    const d = declsOf(buildCss(discovery, settingsFor("#0e7490", { tint: 100 })));
    const surface = pair(d["--x17e9krr"]), text = pair(d["--xlyber6"]);
    expect(surface.dark).not.toBe("#212121");
    expect(contrastRatio(text.light, surface.light)).toBeGreaterThan(15);
    expect(contrastRatio(text.dark, surface.dark)).toBeGreaterThan(12);
  });

  it("adds legacy named tokens only on request", () => {
    expect(buildCss(discovery, settingsFor("#e11d48"))).not.toContain("--theme-user-msg-bg");
    expect(buildCss(null, settingsFor("#e11d48"), { legacy: true })).toContain("--theme-user-msg-bg");
    expect(buildCss(null, settingsFor("#e11d48"))).toBe("");
  });
});

describe("theme helpers", () => {
  it("derives a visible dark-mode accent", () => {
    expect(deriveDarkAccent("#e11d48")).toBe("#e11d48");
    expect(deriveDarkAccent("#0d0d0d")).toBe("#ffffff");
    expect(contrastRatio(deriveDarkAccent("#1e1b4b"), REFERENCE.dark.surface)).toBeGreaterThanOrEqual(3);
  });
  it("honours an explicit dark accent", () => {
    expect(resolveAccents(settingsFor("#e11d48", { dark: "#00ff41" })).dark).toBe("#00ff41");
  });
  it("recolours translucent and transparent values safely", () => {
    const ctx = { accents: { light: "#e11d48", dark: "#e11d48" }, referenceFill: "#3566f0", roles: { light: rolesFor("light", settingsFor("#e11d48")) }, minText: 4.5 };
    expect(recolorToken("#0000", "light", ctx)).toBe("#0000");
    expect(recolorToken("#3566f0", "light", ctx)).toBe("#e11d48");
  });
  it("tint keeps lightness roughly where it was", () => {
    expect(tintNeutral("#212121", 200, 0)).toBe("#212121");
    expect(contrastRatio(tintNeutral("#212121", 200, 100, "dark"), "#212121")).toBeLessThan(1.15);
    // Pure black backgrounds lift slightly so the tint shows, staying far from white text.
    expect(tintNeutral("#000000", 200, 70, "dark")).not.toBe("#000000");
    expect(contrastRatio("#ffffff", tintNeutral("#000000", 200, 100, "dark"))).toBeGreaterThan(15);
  });
});
