import { describe, expect, it } from "vitest";
import {
  contrastRatio, ensureContrast, hexToHsv, hexToOklch, hsvToHex, normalizeHex, oklchToHex, onColor, parseColor, toHex,
} from "../src/lib/color.js";

describe("parseColor", () => {
  it("reads hex in all lengths", () => {
    expect(toHex(parseColor("#abc"))).toBe("#aabbcc");
    expect(toHex(parseColor("#3566F0"))).toBe("#3566f0");
    expect(parseColor("#0000001a").a).toBeCloseTo(0x1a / 255, 5);
    expect(parseColor("#fff3").a).toBeCloseTo(0x33 / 255, 5);
  });
  it("reads rgb(), oklch() and keywords", () => {
    expect(toHex(parseColor("rgb(53, 102, 240)"))).toBe("#3566f0");
    expect(toHex(parseColor("rgba(0 0 0 / 50%)"))).toBe("#00000080");
    expect(toHex(parseColor("oklch(100% 0 none)"))).toBe("#ffffff");
    expect(parseColor("transparent").a).toBe(0);
  });
  it("rejects junk", () => {
    expect(parseColor("var(--x)")).toBeNull();
    expect(parseColor("#12")).toBeNull();
    expect(parseColor(undefined)).toBeNull();
  });
});

describe("normalizeHex", () => {
  it("accepts user-ish input", () => {
    expect(normalizeHex("ABC")).toBe("#aabbcc");
    expect(normalizeHex(" #E11D48 ")).toBe("#e11d48");
    expect(normalizeHex("#e11d4")).toBeNull();
    expect(normalizeHex("red")).toBeNull();
  });
});

describe("OKLCH round trip", () => {
  it.each(["#3566f0", "#0d0d0d", "#ffffff", "#e11d48", "#eab308", "#10b981"])("%s survives", (hex) => {
    expect(oklchToHex(hexToOklch(hex))).toBe(hex);
  });
  it("matches published OKLCH for ChatGPT blue", () => {
    const { L, C, H } = hexToOklch("#3566f0");
    expect(L).toBeCloseTo(0.5609, 3);
    expect(C).toBeCloseTo(0.2145, 3);
    expect(H).toBeCloseTo(265.13, 1);
  });
  it("gamut-maps instead of clipping hue", () => {
    const hex = oklchToHex({ L: 0.9, C: 0.4, H: 265 });
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(Math.abs(hexToOklch(hex).H - 265)).toBeLessThan(3);
  });
});

describe("WCAG contrast", () => {
  it("matches known ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ffffff", "#ffffff")).toBeCloseTo(1, 5);
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2);
  });
  it("composites translucent foregrounds", () => {
    expect(contrastRatio("#00000000", "#ffffff")).toBeCloseTo(1, 5);
  });
  it("onColor always reaches AA", () => {
    for (let i = 0; i < 4096; i += 7) {
      const hex = "#" + [i >> 8, (i >> 4) & 15, i & 15].map((n) => (n * 17).toString(16).padStart(2, "0")).join("");
      expect(contrastRatio(onColor(hex), hex)).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("ensureContrast", () => {
  it("leaves passing colours alone", () => {
    expect(ensureContrast("#2451da", ["#ffffff"], 4.5)).toBe("#2451da");
  });
  it("darkens on light backgrounds and lightens on dark ones, keeping hue", () => {
    const onWhite = ensureContrast("#ffd400", ["#ffffff"], 4.5);
    expect(contrastRatio(onWhite, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(hexToOklch(onWhite).L).toBeLessThan(hexToOklch("#ffd400").L);
    expect(Math.abs(hexToOklch(onWhite).H - hexToOklch("#ffd400").H)).toBeLessThan(12);

    const onDark = ensureContrast("#1e3a8a", ["#212121"], 4.5);
    expect(contrastRatio(onDark, "#212121")).toBeGreaterThanOrEqual(4.5);
    expect(hexToOklch(onDark).L).toBeGreaterThan(hexToOklch("#1e3a8a").L);
  });
  it("satisfies several backgrounds at once", () => {
    const out = ensureContrast("#7aa7ff", ["#ffffff", "#edf3fe"], 4.5);
    expect(contrastRatio(out, "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(out, "#edf3fe")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("HSV", () => {
  it.each(["#3566f0", "#000000", "#ffffff", "#e11d48", "#808080"])("%s round trips", (hex) => {
    expect(hsvToHex(hexToHsv(hex))).toBe(hex);
  });
});
