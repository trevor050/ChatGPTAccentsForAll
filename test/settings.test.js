import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, MAX_SAVED, SETTINGS_VERSION, applyLook, applyTheme, fromV1Vars, migrate, normalizeSaved, normalizeSettings, retiredTheme } from "../src/lib/settings.js";
import { contrastRatio, parseColor, deltaE } from "../src/lib/color.js";
import { REFERENCE, rolesFor, tintNeutral } from "../src/lib/theme.js";
import { THEMES, THEME_GROUPS, DEFAULT_THEME, backgroundTone, findTheme, themeById, themeLook } from "../src/lib/themes.js";
import { ORIGINAL_THEMES } from "../src/lib/themes-original.js";
import { V1_PRESETS, V1_SURFACES, buildV1Vars } from "./helpers/v1.js";

const original = V1_PRESETS.filter((p) => !p.reset);
const surfaceOf = (p) => p.extras?.["--bg-primary"] ?? null;

describe("the original themes (migration history)", () => {
  it("are the 1.1.0 themes: same names, order and colours", () => {
    expect(ORIGINAL_THEMES.map((t) => t.id)).toEqual(original.map((p) => p.id));
    for (const p of original) {
      const t = ORIGINAL_THEMES.find((x) => x.id === p.id);
      expect(t, p.id).toMatchObject({
        name: p.name, accent: p.accent, bubbleBg: p.userBg, bubbleText: p.userText, submitBg: p.submitBg, submitText: p.submitText,
      });
      expect(t.badge ?? null, `${p.id} badge`).toBe(p.badge ?? null);
      expect(t.surface ?? null, `${p.id} surface`).toBe(surfaceOf(p));
      expect(t.link ?? null, `${p.id} link`).toBe(p.extras?.["--link"] ?? null);
    }
    expect(V1_PRESETS[0]).toMatchObject({ id: "reset", name: DEFAULT_THEME.name });
    expect(ORIGINAL_THEMES).toHaveLength(72);
  });
});

// The curated set (2026-11-11). Changing it means updating this table and
// checking the retirement migration below still covers every original theme.
const CURATED = {
  classic: ["blue", "sky", "teal", "green", "lime", "yellow", "orange", "crimson", "pink", "magenta", "purple_plus", "black_pro", "slate"],
  dark: ["midnight", "ocean", "forest", "sage", "mocha", "autumn", "ember", "cosmos", "graphite", "nord"],
  light: ["pastel_sky", "lagoon", "pastel_mint", "lemonade", "sunrise", "cotton_candy", "pastel_lavender", "cream", "porcelain"],
  character: ["synthwave", "cyberpunk", "vaporwave", "miami", "gameboy", "solar", "console", "amber"],
};

describe("named themes", () => {
  it("are the curated set, in their groups", () => {
    expect(THEME_GROUPS.map((g) => g.id)).toEqual(Object.keys(CURATED));
    for (const [group, ids] of Object.entries(CURATED)) expect(THEMES.filter((t) => t.group === group).map((t) => t.id), group).toEqual(ids);
    expect(THEMES).toHaveLength(40);
  });

  it("keep Purple and Black as the formerly paywalled pair", () => {
    expect(themeById("purple_plus")).toMatchObject({ name: "Purple", badge: "plus" });
    expect(themeById("black_pro")).toMatchObject({ name: "Black", badge: "pro" });
    expect(THEMES.filter((t) => t.badge).map((t) => t.id)).toEqual(["purple_plus", "black_pro"]);
  });

  it("have unique ids and valid colours", () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
    for (const t of THEMES) {
      const s = normalizeSettings(applyTheme(DEFAULT_SETTINGS, t));
      expect(s.enabled, t.id).toBe(true);
      expect(Object.values(s.roles).filter(Boolean).length, t.id).toBeGreaterThanOrEqual(4);
      expect(findTheme(s)?.id, t.id).toBe(t.id);
    }
  });

  it("pass the contrast safety net as designed, without being adjusted", () => {
    for (const t of THEMES) {
      expect(contrastRatio(t.bubbleText, t.bubbleBg), `${t.id} bubble`).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(t.submitText, t.submitBg), `${t.id} send`).toBeGreaterThanOrEqual(3);
    }
  });

  it("are distinct at a glance (no near-duplicates)", () => {
    const d = (a, b) => deltaE(parseColor(a), parseColor(b));
    const dist = (s, t) => Math.max(d(s.accent, t.accent), d(s.bubbleBg, t.bubbleBg) * 0.8, d(s.submitBg, t.submitBg),
      s.surface && t.surface ? d(s.surface, t.surface) * 0.6 : !!s.surface !== !!t.surface ? 0.1 : 0);
    for (let i = 0; i < THEMES.length; i++) for (let j = i + 1; j < THEMES.length; j++) {
      expect(dist(THEMES[i], THEMES[j]), `${THEMES[i].id} vs ${THEMES[j].id}`).toBeGreaterThan(0.085);
    }
  });

  it("tell light and dark backgrounds apart", () => {
    expect(backgroundTone(themeById("ocean"))).toBe("dark");
    expect(backgroundTone(themeById("pastel_mint"))).toBe("light");
    expect(backgroundTone(themeById("blue"))).toBeNull();
  });
});

describe("curation keeps everyone's colours (settings v3 -> v4)", () => {
  const v3 = (t) => ({ ...applyTheme(DEFAULT_SETTINGS, t), v: 3, updatedAt: 5 });
  it.each(ORIGINAL_THEMES.map((t) => [t.name, t]))("%s", (_name, t) => {
    const m = migrate({ settings: v3(t), saved: [] });
    expect(m.migrated).toBe(true);
    expect(m.settings.v).toBe(SETTINGS_VERSION);
    // Exactly the colours they had, whatever happened to the preset.
    expect(m.settings).toMatchObject({ enabled: true, light: t.accent, roles: themeLook(t).roles, surface: themeLook(t).surface });
    if (retiredTheme(t.id)) {
      expect(m.settings.theme).toBe("custom");
      expect(m.saved).toHaveLength(1);
      expect(m.saved[0]).toMatchObject({ name: t.name, light: t.accent, roles: themeLook(t).roles, surface: themeLook(t).surface });
    } else {
      expect(m.settings.theme).toBe(t.id);
      expect(m.saved).toEqual([]);
    }
  });
  it("retires exactly the removed and recoloured themes", () => {
    const retired = ORIGINAL_THEMES.filter((t) => retiredTheme(t.id)).map((t) => t.id);
    expect(retired).toHaveLength(72 - 35); // 35 kept as they were; 3 recoloured, 34 removed
    expect(retired).toEqual(expect.arrayContaining(["pastel_mint", "cotton_candy", "gameboy", "material_indigo", "black_bg"]));
  });
  it("does not save a duplicate, and respects a full saved list", () => {
    const t = ORIGINAL_THEMES.find((x) => x.id === "material_indigo");
    const already = migrate({ settings: v3(t), saved: [{ id: "s1", name: "Mine", ...themeLook(t) }] });
    expect(already.saved.map((s) => s.name)).toEqual(["Mine"]);
    const full = Array.from({ length: MAX_SAVED }, (_, i) => ({ id: `s${i}`, name: `n${i}`, light: "#123456" }));
    const m = migrate({ settings: v3(t), saved: full });
    expect(m.saved).toHaveLength(MAX_SAVED);
    expect(m.settings).toMatchObject({ theme: "custom", light: t.accent });
  });
  it("leaves a hand-made theme and 'off' alone", () => {
    const custom = { ...DEFAULT_SETTINGS, v: 3, enabled: true, theme: "custom", light: "#12ab34" };
    expect(migrate({ settings: custom }).settings).toMatchObject({ theme: "custom", light: "#12ab34" });
    expect(migrate({ settings: custom }).saved).toEqual([]);
    expect(migrate({ settings: { ...DEFAULT_SETTINGS, v: 3 } }).settings).toMatchObject({ enabled: false, theme: null });
  });
  it("is idempotent once v4", () => {
    const first = migrate({ settings: v3(ORIGINAL_THEMES.find((x) => x.id === "cobalt")), saved: [] });
    const second = migrate({ settings: first.settings, saved: first.saved });
    expect(second.migrated).toBe(false);
    expect(second.saved).toHaveLength(1);
  });
});

describe("migration from 1.1.0", () => {
  it.each(original.map((p) => [p.name, p]))("%s comes back with its colours (and its name, as a theme or saved)", (_name, p) => {
    const m = migrate({ themeVars: buildV1Vars(p) });
    expect(m.migrated).toBe(true);
    expect(m.removeKeys).toEqual(["themeVars"]);
    const kept = !retiredTheme(p.id);
    expect(m.settings).toMatchObject({ v: SETTINGS_VERSION, enabled: true, theme: kept ? p.id : "custom", light: p.accent, dark: null });
    if (!kept) expect(m.saved.map((t) => t.name)).toEqual([p.name]);
    expect(m.settings.roles).toMatchObject({ bubbleBg: p.userBg, bubbleText: p.userText, submitBg: p.submitBg, submitText: p.submitText });
    expect(m.settings.surface.color).toBe(surfaceOf(p));
  });

  it("keeps Obsidian and Black apart even though they share colours", () => {
    const obsidian = migrate({ themeVars: buildV1Vars(original.find((p) => p.id === "black_bg")) });
    expect(obsidian.settings.theme).toBe("custom");
    expect(obsidian.saved.map((t) => t.name)).toEqual(["Obsidian"]);
    expect(migrate({ themeVars: buildV1Vars(original.find((p) => p.id === "black_pro")) }).settings.theme).toBe("black_pro");
  });

  it("treats Default (no themeVars) as off", () => {
    const m = migrate({ savedThemes: [] });
    expect(m.migrated).toBe(true);
    expect(m.settings).toMatchObject({ enabled: false, light: null, theme: null });
  });

  it("keeps a hand-made Advanced theme's five colours", () => {
    const vars = { ...buildV1Vars({ accent: "#12ab34", userBg: "#222244", userText: "#ffeecc", submitBg: "#cc3300" }), "--theme-submit-btn-text": "#fafafa" };
    const { settings } = migrate({ themeVars: vars });
    expect(settings).toMatchObject({ enabled: true, theme: "custom", light: "#12ab34" });
    expect(settings.roles).toEqual({ bubbleBg: "#222244", bubbleText: "#ffeecc", submitBg: "#cc3300", submitText: "#fafafa", link: null });
    expect(settings.surface).toEqual({ kind: "default", color: null });
  });

  it("recovers the Surfaces choice: Dark, Light and Custom", () => {
    const core = { accent: "#12ab34", userBg: "#222244", userText: "#ffeecc", submitBg: "#cc3300" };
    const surfaceOfVars = (extras) => migrate({ themeVars: buildV1Vars({ ...core, extras }) }).settings.surface;
    expect(surfaceOfVars(V1_SURFACES.dark)).toEqual({ kind: "dark", color: null });
    expect(surfaceOfVars(V1_SURFACES.light)).toEqual({ kind: "light", color: null });
    expect(surfaceOfVars(V1_SURFACES.custom("#10202a"))).toEqual({ kind: "custom", color: "#10202a" });
  });

  it("converts saved themes, including ones that are a named theme", () => {
    const m = migrate({
      themeVars: buildV1Vars(original[0]),
      savedThemes: [
        { id: "t_1", name: "Work", vars: buildV1Vars({ accent: "#12ab34", userBg: "#222244", userText: "#ffeecc", submitBg: "#cc3300" }) },
        { id: "t_2", name: "Night", vars: buildV1Vars(original.find((p) => p.id === "ocean")) },
        { id: "t_3", name: "Broken", vars: {} },
      ],
    });
    expect(m.saved.map((s) => s.name)).toEqual(["Work", "Night"]);
    expect(m.saved[0]).toMatchObject({ light: "#12ab34", roles: { bubbleBg: "#222244", submitBg: "#cc3300" } });
    expect(m.saved[1]).toMatchObject({ light: "#2dd4bf", roles: { bubbleBg: "#073642", submitText: "#002b36", link: "#38bdf8" }, surface: { kind: "custom", color: "#0b1f26" } });
    expect(m.removeKeys).toEqual(["themeVars", "savedThemes"]);
  });

  it("is idempotent once current settings exist", () => {
    const first = migrate({ themeVars: buildV1Vars(original[1]) });
    const second = migrate({ settings: first.settings, saved: first.saved, themeVars: buildV1Vars(original[2]) });
    expect(second.migrated).toBe(false);
    expect(second.settings.theme).toBe(original[1].id);
    expect(second.removeKeys).toEqual(["themeVars"]);
  });

  it("starts fresh installs off", () => {
    expect(migrate({}).settings).toEqual({ ...DEFAULT_SETTINGS });
  });

  it("ignores payloads with no accent", () => {
    expect(fromV1Vars({})).toBeNull();
    expect(fromV1Vars(null)).toBeNull();
  });
});

describe("migration from 2.0.0", () => {
  const V2 = { v: 2, enabled: true, light: "#e11d48", dark: null, tint: 0, preset: "crimson", updatedAt: 1234 };

  it("a preset that was still selected becomes the same-named theme", () => {
    const m = migrate({ settings: V2 });
    expect(m.migrated).toBe(true);
    expect(m.settings).toMatchObject({ v: SETTINGS_VERSION, enabled: true, theme: "crimson", light: "#ef4444", updatedAt: 1234 });
    expect(m.settings.roles.bubbleBg).toBe("#7f1d1d");
    expect(findTheme(m.settings)?.id).toBe("crimson");
  });

  it("maps the renamed Black preset", () => {
    expect(migrate({ settings: { ...V2, preset: "black", light: "#0d0d0d" } }).settings.theme).toBe("black_pro");
  });

  it("a hand-picked colour stays hand-picked, with its dark accent and tint", () => {
    const m = migrate({ settings: { ...V2, preset: null, light: "#0e7490", dark: "#2dd4bf", tint: 70 } });
    expect(m.settings).toMatchObject({ enabled: true, theme: "custom", light: "#0e7490", dark: "#2dd4bf" });
    expect(Object.values(m.settings.roles).every((v) => v === null)).toBe(true);
    expect(m.settings.surface.kind).toBe("custom");
    // The tint comes out the way 2.0.0 painted it (same hue, same strength, same lightness).
    const surface = rolesFor("dark", m.settings).surface;
    const old = tintNeutral(REFERENCE.dark.surface, 213, 70, "dark");
    expect(deltaE(parseColor(surface), parseColor(old))).toBeLessThan(0.02);
  });

  it("keeps 'off' off and a tint of zero as no surface", () => {
    expect(migrate({ settings: { v: 2, enabled: false, light: null, dark: null, tint: 0, preset: null } }).settings)
      .toMatchObject({ enabled: false, light: null, theme: null, surface: { kind: "default" } });
    expect(migrate({ settings: { ...V2, preset: null, tint: 0 } }).settings.surface).toEqual({ kind: "default", color: null });
  });

  it("upgrades saved favourites", () => {
    const saved = normalizeSaved([{ id: "s1", name: "Mine", light: "#0e7490", dark: "#2dd4bf", tint: 70 }]);
    expect(saved[0]).toMatchObject({ name: "Mine", light: "#0e7490", dark: "#2dd4bf", surface: { kind: "custom" } });
    expect(saved[0].roles.bubbleBg).toBeNull();
    expect(migrate({ settings: V2, saved: [{ id: "s1", light: "#0e7490", tint: 0 }] }).saved[0].light).toBe("#0e7490");
  });

  it("an old live copy still reads as a valid current one", () => {
    expect(normalizeSettings({ v: 2, enabled: true, light: "#e11d48", tint: 40, preset: "crimson" }))
      .toMatchObject({ v: SETTINGS_VERSION, enabled: true, light: "#e11d48", surface: { kind: "custom" } });
  });
});

describe("normalizeSettings", () => {
  it("repairs garbage", () => {
    expect(normalizeSettings({ enabled: true, light: "nope", theme: "lol", roles: { bubbleBg: 5 }, surface: { kind: "weird" } }))
      .toMatchObject({ enabled: false, light: null, theme: null, roles: { bubbleBg: null }, surface: { kind: "default" } });
    expect(normalizeSettings(null)).toMatchObject({ enabled: false });
    expect(normalizeSettings({ light: "#fff", surface: { kind: "custom", color: "oops" } }).surface).toEqual({ kind: "default", color: null });
  });

  it("round-trips a theme through applyLook", () => {
    const s = normalizeSettings(applyLook(DEFAULT_SETTINGS, themeLook(themeById("mocha"))));
    expect(s).toMatchObject({ enabled: true, theme: "mocha", light: "#d6b28d", surface: { kind: "custom", color: "#221b18" } });
  });

  it("caps and cleans saved lists, and fits the sync item quota", () => {
    const full = { roles: { bubbleBg: "#123456", bubbleText: "#123456", submitBg: "#123456", submitText: "#123456", link: "#123456" }, surface: { kind: "custom", color: "#123456" }, dark: "#123456" };
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `s${Date.now().toString(36)}abc${i}`, name: "n".repeat(40), light: "#123456", ...full }));
    const out = normalizeSaved([...many, { light: "bad" }]);
    expect(out).toHaveLength(MAX_SAVED);
    expect(JSON.stringify({ saved: out }).length).toBeLessThan(8000); // chrome.storage.sync: 8 KB per item
    expect(normalizeSaved([{ light: "#123456" }])[0].name).toBe("#123456");
  });
});
