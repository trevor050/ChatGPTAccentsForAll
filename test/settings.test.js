import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, MAX_SAVED, PRESETS, fromV1Vars, migrate, normalizeSaved, normalizeSettings } from "../src/lib/settings.js";
import { contrastRatio } from "../src/lib/color.js";
import { resolveAccents, REFERENCE } from "../src/lib/theme.js";

// Real v1 payloads, as written by the 1.1.0 popup (presets "Blue", "Black" and "Ocean").
const V1_BLUE = {
  "--interactive-bg-accent-default": "#1d74ff", "--interactive-bg-accent-hover": "#1b6beb",
  "--composer-blue-bg": "#1d74ff", "--theme-user-msg-bg": "#0b3a7a", "--theme-user-msg-text": "#e6f0ff",
  "--theme-submit-btn-bg": "#0b5fff", "--theme-secondary-btn-bg": "#11468f",
};
const V1_BLACK = { "--interactive-bg-accent-default": "#111213", "--theme-submit-btn-bg": "#151516" };
const V1_OCEAN = {
  "--interactive-bg-accent-default": "#2dd4bf", "--theme-submit-btn-bg": "#0ea5a4",
  "--bg-primary": "#0b1f26", "--bg-secondary": "#0f2730", "--message-surface": "rgba(16,49,58,0.85)",
};

describe("v1 -> v2 migration", () => {
  it("keeps the user's accent", () => {
    const m = migrate({ themeVars: V1_BLUE });
    expect(m.migrated).toBe(true);
    expect(m.settings).toMatchObject({ v: 2, enabled: true, light: "#1d74ff", dark: null, tint: 0 });
    expect(m.removeKeys).toEqual(["themeVars"]);
  });

  it("maps black to black (and white in dark mode, like ChatGPT's own default)", () => {
    const m = migrate({ themeVars: V1_BLACK });
    expect(m.settings.light).toBe("#111213");
    expect(resolveAccents(m.settings).dark).toBe("#ffffff");
  });

  it("turns v1 background themes into a tint", () => {
    const m = migrate({ themeVars: V1_OCEAN });
    expect(m.settings.light).toBe("#2dd4bf");
    expect(m.settings.tint).toBeGreaterThan(30);
    expect(fromV1Vars({ ...V1_OCEAN, "--bg-primary": "#0f0f10" }).tint).toBe(0);
  });

  it("converts saved themes", () => {
    const m = migrate({
      themeVars: V1_BLUE,
      savedThemes: [
        { id: "t_1", name: "Work", vars: V1_BLUE },
        { id: "t_2", name: "Night", vars: V1_OCEAN },
        { id: "t_3", name: "Broken", vars: {} },
      ],
    });
    expect(m.saved.map((s) => s.name)).toEqual(["Work", "Night"]);
    expect(m.saved[1]).toMatchObject({ light: "#2dd4bf", dark: null });
    expect(m.removeKeys).toEqual(["themeVars", "savedThemes"]);
  });

  it("treats 'Default' (no themeVars) as off", () => {
    const m = migrate({ savedThemes: [] });
    expect(m.settings.enabled).toBe(false);
    expect(m.settings.light).toBeNull();
  });

  it("is idempotent once v2 settings exist", () => {
    const first = migrate({ themeVars: V1_BLUE });
    const second = migrate({ settings: first.settings, saved: first.saved, themeVars: V1_OCEAN });
    expect(second.migrated).toBe(false);
    expect(second.settings.light).toBe("#1d74ff");
    expect(second.removeKeys).toEqual(["themeVars"]);
  });

  it("starts fresh installs off", () => {
    expect(migrate({}).settings).toEqual({ ...DEFAULT_SETTINGS });
  });
});

describe("normalizeSettings", () => {
  it("repairs garbage", () => {
    expect(normalizeSettings({ enabled: true, light: "nope", tint: 900, preset: "lol" }))
      .toMatchObject({ enabled: false, light: null, tint: 100, preset: null });
    expect(normalizeSettings(null)).toMatchObject({ enabled: false });
  });
  it("caps and cleans saved lists", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `x${i}`, name: "", light: "#123456" }));
    const out = normalizeSaved([...many, { light: "bad" }]);
    expect(out).toHaveLength(MAX_SAVED);
    expect(out[0].name).toBe("#123456");
  });
});

describe("presets", () => {
  it("have unique ids and valid colours", () => {
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
    for (const p of PRESETS) expect(normalizeSettings({ enabled: true, ...p }).light).toBe(p.light);
  });
  it("stay visible as buttons on ChatGPT's surfaces", () => {
    for (const p of PRESETS) {
      const a = resolveAccents(p);
      expect(contrastRatio(a.light, REFERENCE.light.surface), `${p.id} light`).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(a.dark, REFERENCE.dark.surface), `${p.id} dark`).toBeGreaterThanOrEqual(3);
    }
  });
});
