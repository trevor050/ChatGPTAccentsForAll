// Signed-in chatgpt.com: discovery from the theme CSS captured on 2026-11-11 (style
// data only, see the fixture's "about"), and the overrides built from it.
import { describe, expect, it } from "vitest";
import signedIn from "./fixtures/chatgpt-signed-in-2026-11-11.json" with { type: "json" };
import loggedOut from "./fixtures/chatgpt-2026-11-10.json" with { type: "json" };
import { discoverAppShell, modeOfSelector, roleFromName, scopeOf } from "../src/lib/appshell.js";
import { contrastRatio } from "../src/lib/color.js";
import { buildPlan } from "../src/lib/css.js";
import { applyTheme, normalizeSettings } from "../src/lib/settings.js";
import { themeById } from "../src/lib/themes.js";

const app = discoverAppShell(signedIn.rules, signedIn.html);
const themed = (id) => ({ ...applyTheme(normalizeSettings({}), themeById(id)), enabled: true });
const SAMPLE = ["blue", "yellow", "purple_plus", "black_pro", "cyberpunk", "nord", "pastel_sky", "lemonade"];

/** Declarations of one top-level rule whose selector starts with `prefix`. */
function block(css, prefix) {
  const start = css.indexOf(prefix);
  if (start < 0) return null;
  const body = css.slice(css.indexOf("{", start) + 1, css.indexOf("}", start));
  return Object.fromEntries([...body.matchAll(/(--[\w-]+): ([^;]+);/g)].map((m) => [m[1], m[2]]));
}
const LIGHT = ':is([data-theme="light"])';
const DARK = ':is([data-theme="dark"])';

describe("selector scopes", () => {
  it("reads ChatGPT's appearance-block mode selectors", () => {
    expect(modeOfSelector(':root:not([data-theme]), [data-theme=""], [data-theme="light"]')).toBe("light");
    expect(modeOfSelector('[data-theme="dark"]')).toBe("dark");
    expect(modeOfSelector(":root, .xsajpkq")).toBeNull(); // logged-out StyleX base class
    expect(modeOfSelector('.thread [data-theme="dark"]')).toBeNull();
  });
  it("reads the preset scopes and skips other presets and window types", () => {
    const attrs = { "data-appearance-preset": "linear", "data-codex-window-type": "browser" };
    expect(scopeOf(":where(:root), :where([data-theme])", attrs)).toBe("both");
    expect(scopeOf(':where(:root[data-appearance-preset="linear"]), :where(:root[data-appearance-preset="linear"]) :where([data-theme])', attrs)).toBe("both");
    expect(scopeOf(':where(:root[data-appearance-preset="ayu"]):where([data-theme="dark"])', attrs)).toBeNull();
    expect(scopeOf(':where(:root[data-appearance-preset="ayu"]):where([data-theme="dark"])', { "data-appearance-preset": "ayu" })).toBe("dark");
    expect(scopeOf(':where(:root[data-appearance-preset="proof"]):where(:not([data-theme="dark"]))', { "data-appearance-preset": "proof" })).toBe("light");
    expect(scopeOf(':root[data-codex-window-type="extension"], :root[data-codex-window-type="extension"] [data-theme]', attrs)).toBeNull();
    expect(scopeOf(".composer-ebIxkP", attrs)).toBeNull();
  });
  it("names roles from semantic variable names", () => {
    expect(roleFromName("--color-background-user-message")).toBe("bubble");
    expect(roleFromName("--color-text-user-message")).toBe("bubbleText");
    expect(roleFromName("--color-background-composer-primary")).toBe("send");
    expect(roleFromName("--color-text-composer-primary")).toBe("sendText");
    expect(roleFromName("--color-text-on-accent")).toBe("onAccent");
    expect(roleFromName("--color-text-accent-solid")).toBe("onAccent");
    expect(roleFromName("--app-color-icon-accent")).toBe("accentText"); // "icon-accent" is not "on-accent"
    expect(roleFromName("--color-button-accent")).toBe("accentFill");
    expect(roleFromName("--color-background-other-user-message")).toBe("unrelated");
    expect(roleFromName("--chatgpt-blue-500")).toBe("unrelated");
    expect(roleFromName("--color-text-chat-accent-green")).toBe("unrelated");
  });
});

describe("discoverAppShell on signed-in chatgpt.com", () => {
  it("finds the bubble and send-button variables and the mode selectors", () => {
    expect(app).not.toBeNull();
    expect(app.vars["--color-background-user-message"].role).toBe("bubble");
    expect(app.vars["--color-text-user-message"].role).toBe("bubbleText");
    expect(app.vars["--color-background-composer-primary"].role).toBe("send");
    expect(app.vars["--color-text-composer-primary"].role).toBe("sendText");
    expect(app.vars["--color-accent"].role).toBe("accentFill");
    expect(app.vars["--color-text-accent"].role).toBe("accentText");
    expect(app.selectors.dark).toEqual(['[data-theme="dark"]']);
    expect(app.selectors.light).toEqual(expect.arrayContaining(['[data-theme="light"]', ":root:not([data-theme])"]));
  });
  it("reads the active preset's values (linear), not another preset's", () => {
    expect(app.anchor).toEqual({ light: "#5e6ad2", dark: "#606acc" });
    expect(app.vars["--color-accent"].light).toMatchObject({ kind: "color", light: "#5e6ad2" });
    expect(app.vars["--color-accent"].dark).toMatchObject({ kind: "color", light: "#606acc" });
    const dracula = discoverAppShell(signedIn.rules, { ...signedIn.html, "data-appearance-preset": "dracula" });
    expect(dracula.vars["--color-accent"].dark).toMatchObject({ kind: "color", light: "#ff79c6" });
  });
  it("finds components that re-declare the send and bubble variables", () => {
    const selectors = app.components.map((c) => c.selector);
    expect(selectors).toContain(".composer-ebIxkP");
    expect(selectors.some((s) => /other/i.test(s))).toBe(false);
  });
  it("ignores palette primitives and other people's messages", () => {
    expect(Object.keys(app.vars).some((n) => /-\d{2,3}$|chat-accent-|other-user/.test(n))).toBe(false);
  });
  it("does not mistake the logged-out page for the signed-in shell", () => {
    expect(discoverAppShell(loggedOut.rules)).toBeNull();
  });
  it("does not recognise the old shell's names alone", () => {
    expect(discoverAppShell(signedIn.reconstructed.legacySheet)).toBeNull();
  });
});

describe("signed-in overrides", () => {
  it.each(SAMPLE)("%s: bubble and send button get the theme's colours in light and dark", (id) => {
    const t = themeById(id);
    const css = buildPlan(null, themed(id), { app }).css;
    for (const mode of [LIGHT, DARK]) {
      const d = block(css, mode);
      expect(d["--color-background-user-message"]).toBe(t.bubbleBg);
      expect(d["--color-background-composer-primary"]).toBe(t.submitBg);
      // Text is the theme's own unless the safety net had to move it.
      expect(contrastRatio(d["--color-text-user-message"], d["--color-background-user-message"])).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(d["--color-text-composer-primary"], d["--color-background-composer-primary"])).toBeGreaterThanOrEqual(3);
    }
  });
  it.each(SAMPLE)("%s: accent text stays readable on the shell's page surface", (id) => {
    const css = buildPlan(null, themed(id), { app }).css;
    const light = block(css, LIGHT), dark = block(css, DARK);
    for (const name of ["--color-text-accent", "--app-color-text-accent"]) {
      expect(contrastRatio(light[name], "#fcfcfd")).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(dark[name], "#0f0f11")).toBeGreaterThanOrEqual(4.5);
    }
  });
  it("mirrors ChatGPT's mode selectors with enough specificity, outside any layer", () => {
    const css = buildPlan(null, themed("yellow"), { app }).css;
    expect(css).toContain(':is([data-theme="dark"]):is([data-theme="dark"]):is([data-theme="dark"]):is([data-theme="dark"]):is([data-theme="dark"])');
    expect(css).toContain(":is(:root:not([data-theme]))");
    expect(css).not.toContain("@layer");
  });
  it("overrides the send button inside components that re-declare it", () => {
    const css = buildPlan(null, themed("yellow"), { app }).css;
    expect(block(css, ":is(.composer-ebIxkP)")["--color-background-composer-primary"]).toBe("#d97706");
  });
  it("only sets the old shell's names when the page declares them", () => {
    expect(buildPlan(null, themed("yellow"), { app }).css).not.toContain("--theme-user-msg-bg");
  });
  it("lists every concrete override with its intended colours for the effect check", () => {
    const { expect: want } = buildPlan(null, themed("yellow"), { app });
    expect(want["--color-background-composer-primary"]).toMatchObject({ role: "send", light: "#d97706", dark: "#d97706" });
    expect(want["--color-background-user-message"]).toMatchObject({ role: "bubble", light: "#78350f" });
  });
  it("tints the shell's surfaces when a page background is chosen, and only then", () => {
    const plain = block(buildPlan(null, themed("yellow"), { app }).css, DARK);
    expect(plain["--app-color-background-surface"]).toBeUndefined();
    const tinted = block(buildPlan(null, themed("cyberpunk"), { app }).css, DARK);
    expect(tinted["--app-color-background-surface"]).toMatch(/^#[0-9a-f]{6}$/);
    expect(tinted["--app-color-background-surface"]).not.toBe("#0f0f11");
  });

  // ChatGPT ships ~30 appearance presets. Only "linear" was captured with its
  // appearance block; other presets are reconstructed by repainting that block's
  // accent, which is how their main-stylesheet rules differ too.
  it.each([["dracula", "#ff79c6"], ["github", "#1f6feb"], ["matrix", "#1eff5a"], ["xcode", "#5482ff"]])("preset %s: same roles, the theme's colours", (preset, accent) => {
    const rules = signedIn.rules.map((r) => (/data-theme/.test(r.selector) && !/:where/.test(r.selector)
      ? { ...r, decls: Object.fromEntries(Object.entries(r.decls).map(([k, v]) => [k, v.replace(/#5e6ad2|#606acc/g, accent)])) }
      : r));
    const shell = discoverAppShell(rules, { ...signedIn.html, "data-appearance-preset": preset });
    expect(shell.anchor.dark).toBe(accent);
    const d = block(buildPlan(null, themed("teal"), { app: shell }).css, DARK);
    expect(d["--color-background-composer-primary"]).toBe(themeById("teal").submitBg);
    expect(d["--color-background-user-message"]).toBe(themeById("teal").bubbleBg);
  });
});

describe("logged-out chatgpt.com, 2026-11-11", async () => {
  const loggedOutNew = (await import("./fixtures/chatgpt-logged-out-2026-11-11.json", { with: { type: "json" } })).default;
  const shell = discoverAppShell(loggedOutNew.rules, loggedOutNew.html);
  it("is the same shell as signed-in now (chatgpt-theme class, codex preset)", () => {
    expect(loggedOutNew.html).toMatchObject({ chatgptThemeClass: true, "data-appearance-preset": "codex" });
    expect(shell.vars["--color-background-composer-primary"].role).toBe("send");
    expect(shell.vars["--color-background-user-message"].role).toBe("bubble");
  });
  it.each(SAMPLE)("%s: recolours the send button and bubble in both modes", (id) => {
    const css = buildPlan(null, themed(id), { app: shell }).css;
    for (const mode of [LIGHT, DARK]) {
      expect(block(css, mode)["--color-background-composer-primary"]).toBe(themeById(id).submitBg);
      expect(block(css, mode)["--color-background-user-message"]).toBe(themeById(id).bubbleBg);
    }
  });
});
