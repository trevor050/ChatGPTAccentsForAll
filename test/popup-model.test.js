import { describe, expect, it } from "vitest";
import { DRAFT_DEFAULTS, draftFromSettings, lookFromDraft, nextGridIndex, nextTabIndex, surfaceNote } from "../src/popup/model.js";
import { DEFAULT_SETTINGS, applyLook, normalizeSettings } from "../src/lib/settings.js";
import { themeById, themeLook } from "../src/lib/themes.js";

describe("grid keyboard model (two columns)", () => {
  it("moves by one with wrap, by a row without wrap, and to the ends", () => {
    expect(nextGridIndex("ArrowRight", 0, 5)).toBe(1);
    expect(nextGridIndex("ArrowRight", 4, 5)).toBe(0);
    expect(nextGridIndex("ArrowLeft", 0, 5)).toBe(4);
    expect(nextGridIndex("ArrowDown", 1, 5)).toBe(3);
    expect(nextGridIndex("ArrowDown", 3, 5)).toBe(3); // 5 would be past the end
    expect(nextGridIndex("ArrowUp", 3, 5)).toBe(1);
    expect(nextGridIndex("ArrowUp", 1, 5)).toBe(1);
    expect(nextGridIndex("Home", 3, 5)).toBe(0);
    expect(nextGridIndex("End", 0, 5)).toBe(4);
  });
  it("leaves other keys and empty grids alone", () => {
    expect(nextGridIndex("Enter", 0, 5)).toBeNull();
    expect(nextGridIndex("ArrowDown", 0, 0)).toBeNull();
  });
  it("tabs wrap and jump", () => {
    expect(nextTabIndex("ArrowRight", 1, 2)).toBe(0);
    expect(nextTabIndex("ArrowLeft", 0, 2)).toBe(1);
    expect(nextTabIndex("End", 0, 2)).toBe(1);
    expect(nextTabIndex("x", 0, 2)).toBeNull();
  });
});

describe("advanced draft", () => {
  it("starts from the 1.x defaults when nothing is chosen", () => {
    expect(draftFromSettings(DEFAULT_SETTINGS)).toEqual(DRAFT_DEFAULTS);
  });
  it("round-trips a theme's colours", () => {
    const look = themeLook(themeById("synthwave"));
    const draft = draftFromSettings(normalizeSettings(applyLook(DEFAULT_SETTINGS, look)));
    expect(draft).toMatchObject({ accent: "#ff0080", bubbleBg: "#1a0033", bubbleText: "#ff66cc", submitBg: "#cc0066", submitText: "#ffffff", link: "#00ffff", surfaceKind: "custom", surfaceColor: "#0a0014" });
    expect(lookFromDraft(draft)).toEqual(look);
  });
  it("shows what the engine derives for roles a look leaves empty", () => {
    const draft = draftFromSettings(normalizeSettings({ enabled: true, light: "#e11d48" }));
    expect(draft.submitBg).toBe("#e11d48");
    expect(draft.bubbleBg).toMatch(/^#[0-9a-f]{6}$/);
  });
  it("describes each surface choice", () => {
    expect(surfaceNote({ surfaceKind: "default" })).toMatch(/ChatGPT's own page/);
    expect(surfaceNote({ surfaceKind: "dark" })).toMatch(/dark mode/i);
    expect(surfaceNote({ surfaceKind: "light" })).toMatch(/light mode/i);
    expect(surfaceNote({ surfaceKind: "custom", surfaceColor: "#0b1f26" })).toMatch(/Dark/);
    expect(surfaceNote({ surfaceKind: "custom", surfaceColor: "#f0fdf4" })).toMatch(/Light/);
  });
});
