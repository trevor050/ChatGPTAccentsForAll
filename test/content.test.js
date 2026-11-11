import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import fixture from "./fixtures/chatgpt-2026-11-10.json" with { type: "json" };
import { buildCss } from "../src/lib/css.js";
import { discoverTokens, sameDiscovery } from "../src/lib/discover.js";
import { normalizeSettings } from "../src/lib/settings.js";
import { newest } from "../src/lib/storage.js";

const source = readFileSync(new URL("../src/content/index.js", import.meta.url), "utf8").replace(/^import .*;$/gm, "");
const settings = normalizeSettings({ enabled: true, light: "#e11d48", tint: 80 });
const cached = discoverTokens(fixture.rules);

// Run the actual content script with a minimal CSSOM/storage boundary. No browser
// dependency: these regressions must also run in the normal CI unit suite.
async function boot(rules, tokens = cached) {
  const local = { tokens, status: { ok: true } };
  const timers = new Map(), elements = new Map(), events = new Map();
  let timerId = 0;
  const root = { dataset: {}, appendChild: (el) => { el.isConnected = true; elements.set(el.id, el); } };
  const document = {
    documentElement: root, head: root, readyState: "complete",
    styleSheets: [],
    getElementById: (id) => elements.get(id),
    createElement: () => ({ isConnected: false, textContent: "", remove() { elements.delete(this.id); this.isConnected = false; } }),
    addEventListener: (name, callback) => events.set(name, callback),
  };
  const setRules = (next) => {
    document.styleSheets = [{ cssRules: next.map(({ selector, decls }) => ({
      selectorText: selector,
      style: { length: Object.keys(decls).length, item: (i) => Object.keys(decls)[i], getPropertyValue: (name) => decls[name] || "" },
    })) }];
  };
  setRules(rules);
  await vm.runInNewContext(source, {
    document, window: { addEventListener() {} }, console,
    buildCss, discoverTokens, sameDiscovery, normalizeSettings, newest,
    ext: { storage: { onChanged: { addListener() {} } } },
    loadState: async () => ({ settings }), readLocal: async () => local,
    writeLocal: async (patch) => Object.assign(local, patch),
    setTimeout: (fn) => { timers.set(++timerId, fn); return timerId; },
    clearTimeout: (id) => timers.delete(id),
  });
  const flush = () => { const pending = [...timers.values()]; timers.clear(); pending.forEach((fn) => fn()); };
  return { local, setRules, flush, load: () => events.get("load")({ target: { tagName: "LINK" } }), css: () => elements.get("chatgpt-accents-for-all")?.textContent || "" };
}

describe("content script fails closed when ChatGPT changes", () => {
  it("does not apply an unverified cache before current styles are discovered", async () => {
    const page = await boot([]);
    expect(page.css()).toBe("");
  });
  it.each([{ rules: [] }, { rules: [{ selector: ":root", decls: { "--x1e4keym": "#fff" } }] }])("clears stale styling and reports failure for unsupported styles (%j)", async ({ rules }) => {
    const page = await boot(rules);
    page.flush();
    expect(page.css()).toBe("");
    expect(page.local.status.ok).toBe(false);
    expect(page.local.tokens).toBeNull();
  });
  it("reports a fresh empty stylesheet as unsupported", async () => {
    const page = await boot([], null);
    page.flush();
    expect(page.local.status.ok).toBe(false);
  });
  it("removes a previously valid override when a later stylesheet removes themes", async () => {
    const page = await boot(fixture.rules);
    page.flush();
    expect(page.css()).toContain("#e11d48");
    page.setRules([]);
    page.load();
    page.flush();
    expect(page.css()).toBe("");
    expect(page.local.status.ok).toBe(false);
  });
  it("recovers when supported CSS arrives after an empty stylesheet", async () => {
    const page = await boot([]);
    page.flush();
    page.setRules(fixture.rules);
    page.load();
    page.flush();
    expect(page.local.status.ok).toBe(true);
    expect(page.css()).toContain("#e11d48");
  });
  it("validates loaded styles synchronously before the browser's next paint", async () => {
    const page = await boot([]);
    page.setRules(fixture.rules);
    page.load();
    expect(page.css()).toContain("#e11d48");
  });
});
