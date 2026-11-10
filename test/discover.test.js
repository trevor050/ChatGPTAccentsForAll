import { describe, expect, it } from "vitest";
import fixture from "./fixtures/chatgpt-2026-11-10.json" with { type: "json" };
import { discoverTokens, parseValue, splitTopLevel } from "../src/lib/discover.js";

describe("parseValue", () => {
  it("reads the lightningcss light-dark polyfill", () => {
    expect(parseValue("var(--lightningcss-light,#edf3fe)var(--lightningcss-dark,#020562)"))
      .toEqual({ kind: "color", light: "#edf3fe", dark: "#020562" });
  });
  it("reads native light-dark()", () => {
    expect(parseValue("light-dark(oklch(100% 0 none), #212121)")).toEqual({ kind: "color", light: "#ffffff", dark: "#212121" });
  });
  it("keeps aliases and mixes as expressions", () => {
    expect(parseValue("var(--x1e4keym)").kind).toBe("expr");
    expect(parseValue("color-mix(in srgb, var(--x4sldyk) 88%, #000)").kind).toBe("expr");
    expect(parseValue("var(--lightningcss-light,var(--x7fwydj))var(--lightningcss-dark,var(--x1mzx15b))").kind).toBe("expr");
  });
  it("splits only top-level commas", () => {
    expect(splitTopLevel("oklch(1 2 3), rgb(1, 2, 3)")).toEqual(["oklch(1 2 3)", "rgb(1, 2, 3)"]);
  });
});

describe("discoverTokens on chatgpt.com CSS captured 2026-11-10", () => {
  const found = discoverTokens(fixture.rules);

  it("finds the accent theme cluster ChatGPT's own setting toggles", () => {
    expect(found).not.toBeNull();
    expect(found.themeClasses).toHaveLength(10);
    // The class ChatGPT puts on <html> for its default blue accent.
    expect(found.themeClasses).toContain("x13qp82k");
    expect(fixture.htmlClasses).toContain("x13qp82k");
  });

  it("uses the blue theme as reference and its button colour as the fill", () => {
    expect(found.referenceClass).toBe("x13qp82k");
    expect(found.referenceFill).toBe("#3566f0");
  });

  it("collects every accent token and the base classes that default them", () => {
    expect(Object.keys(found.accent)).toHaveLength(15);
    expect(found.accent["--x1y9qfar"]).toEqual({ kind: "color", light: "#edf3fe", dark: "#020562" });
    expect(found.accent["--x4sldyk"]).toEqual({ kind: "expr", value: "var(--x1e4keym)" });
    expect(found.baseClasses).toContain("xsajpkq");
  });

  it("collects neutral surfaces but not status colours", () => {
    expect(found.neutrals["--x17e9krr"]).toEqual({ kind: "color", light: "#ffffff", dark: "#212121" });
    expect(found.neutrals["--x701wd9"]).toBeUndefined(); // red error colour
    expect(found.neutrals["--x9vd42p"]).toEqual({ kind: "color", light: "#fcfcfc", dark: "#000000" }); // sidebar, other group
    expect(found.neutrals["--x1ov5pza"]).toBeUndefined(); // constant #fff primitive
    expect(Object.keys(found.neutrals).length).toBeGreaterThan(10);
  });

  it("does not depend on rule order", () => {
    expect(discoverTokens([...fixture.rules].reverse())).toEqual(found);
  });

  it("survives renamed hashes", () => {
    const rename = (s) => s.replace(/x13qp82k/g, "xRENAMED1").replace(/--x1e4keym/g, "--xRENAMED2");
    const renamed = fixture.rules.map((r) => ({
      ...r,
      selector: rename(r.selector),
      decls: Object.fromEntries(Object.entries(r.decls).map(([k, v]) => [rename(k), rename(v)])),
    }));
    const again = discoverTokens(renamed);
    expect(again.referenceClass).toBe("xRENAMED1");
    expect(again.accent["--xRENAMED2"]).toBeDefined();
  });

  it("returns null when there is no accent system", () => {
    expect(discoverTokens([])).toBeNull();
    expect(discoverTokens(fixture.rules.filter((r) => !/x13qp82k|x42czut|xdzwo6c|x1marltc|xlwh8ez|xrf8t27|xxpg8uy/.test(r.selector)))).toBeNull();
  });
});
