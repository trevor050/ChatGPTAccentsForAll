import { describe, expect, it } from "vitest";
import signedIn from "./fixtures/chatgpt-signed-in-2026-11-11.json" with { type: "json" };
import { discoverAppShell } from "../src/lib/appshell.js";
import { buildPlan } from "../src/lib/css.js";
import { judgeEffect, planProbes, probeable, resolveAlias, sameColor, varRef } from "../src/lib/effect.js";
import { applyTheme, normalizeSettings } from "../src/lib/settings.js";
import { themeById } from "../src/lib/themes.js";

const EXPECT = {
  "--bubble": { role: "bubble", light: "#78350f", dark: "#78350f" },
  "--send": { role: "send", light: "#d97706", dark: "#d97706" },
  "--glyph": { role: "sendText", light: "#ffffff", dark: "#ffffff" },
};
const sample = (role, name, actual, base) => ({ role, name, selector: ".x", prop: "background-color", actual, ...(base ? { base } : {}) });

describe("effect helpers", () => {
  it("parses exact var() references only", () => {
    expect(varRef("var(--a)")).toBe("--a");
    expect(varRef("var( --a , #fff)")).toBe("--a");
    expect(varRef("color-mix(in srgb, var(--a) 50%, transparent)")).toBeNull();
  });
  it("probes resting elements, not states or pseudo-elements", () => {
    expect(probeable(".bg-user-message")).toBe(true);
    expect(probeable(':is(.a):not([data-x="1"])')).toBe(true);
    expect(probeable(".a:hover")).toBe(false);
    expect(probeable(".a::before")).toBe(false);
  });
  it("follows aliases to an overridden variable", () => {
    expect(resolveAlias("--a", { "--a": "--b", "--b": "--send" }, EXPECT)).toBe("--send");
    expect(resolveAlias("--a", { "--a": "--a" }, EXPECT)).toBeNull();
  });
  it("compares computed colours with hex", () => {
    expect(sameColor("rgb(217, 119, 6)", "#d97706")).toBe(true);
    expect(sameColor("rgba(217, 119, 6, 0.5)", "#d97706")).toBe(false);
    expect(sameColor("rgb(96, 106, 204)", "#d97706")).toBe(false);
  });
});

describe("judgeEffect", () => {
  it("is empty when nothing on the page uses our variables", () => {
    expect(judgeEffect([], EXPECT).state).toBe("empty");
  });
  it("passes when the elements changed to our colours", () => {
    const r = judgeEffect([sample("send", "--send", "rgb(217, 119, 6)", "rgb(96, 106, 204)"), sample("bubble", "--bubble", "rgb(120, 53, 15)", "rgb(24, 26, 51)")], EXPECT);
    expect(r.state).toBe("pass");
    expect(r.mismatches).toEqual([]);
  });
  it("fails when the elements still show ChatGPT's colours", () => {
    const r = judgeEffect([sample("send", "--send", "rgb(96, 106, 204)", "rgb(96, 106, 204)"), sample("bubble", "--bubble", "rgb(24, 26, 51)", "rgb(24, 26, 51)")], EXPECT);
    expect(r.state).toBe("fail");
    expect(r.mismatches[0]).toMatchObject({ role: "send", actual: "rgb(96, 106, 204)" });
  });
  it("ignores a colour that is ours and ChatGPT's at once (it proves nothing)", () => {
    // White glyph wanted, white glyph already there: without this, a page that
    // ignores us would look healthy (seen on the real signed-in page).
    const r = judgeEffect([sample("sendText", "--glyph", "rgb(255, 255, 255)", "rgb(255, 255, 255)"), sample("send", "--send", "rgb(96, 106, 204)", "rgb(96, 106, 204)")], EXPECT);
    expect(r.state).toBe("fail");
    expect(r.roles.sendText).toBeUndefined();
  });
  it("is partial when the send button or bubble did not change but something else did", () => {
    const r = judgeEffect([sample("bubble", "--bubble", "rgb(120, 53, 15)", "rgb(24, 26, 51)"), sample("send", "--send", "rgb(96, 106, 204)", "rgb(96, 106, 204)")], EXPECT);
    expect(r.state).toBe("partial");
    expect(r.roles).toEqual({ bubble: "pass", send: "fail" });
  });
});

describe("probes on signed-in chatgpt.com", () => {
  const app = discoverAppShell(signedIn.rules, signedIn.html);
  const settings = { ...applyTheme(normalizeSettings({}), themeById("yellow")), enabled: true };
  const plan = buildPlan(null, settings, { app });
  const probes = planProbes(signedIn.usages, signedIn.aliases, plan.expect, { perRole: 80 });
  it("finds the utility classes ChatGPT draws the bubble and send button with", () => {
    expect(probes).toEqual(expect.arrayContaining([
      expect.objectContaining({ selector: ".bg-user-message", role: "bubble" }),
      expect.objectContaining({ selector: ".bg-composer-primary", role: "send" }),
      expect.objectContaining({ selector: ".text-composer-primary", role: "sendText" }),
    ]));
  });
  it("old-shell names never reach the bubble or send button on this page", () => {
    const legacyOnly = buildPlan(null, settings, { legacy: true });
    const roles = new Set(planProbes(signedIn.usages, signedIn.aliases, legacyOnly.expect).map((p) => p.role));
    expect(roles.has("bubble") || roles.has("send")).toBe(false);
  });
});
