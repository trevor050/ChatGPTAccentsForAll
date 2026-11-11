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
async function boot(rules, tokens = cached, { build = "prod-1", readyState = "complete", page = {}, waitForStorage = false } = {}) {
  const local = { tokens, status: { ok: true } };
  const localStorage = { getItem: (k) => page[k] ?? null, setItem: (k, v) => { page[k] = String(v); }, removeItem: (k) => { delete page[k]; } };
  let answer;
  const storageAnswered = waitForStorage ? new Promise((r) => { answer = r; }) : Promise.resolve();
  const timers = new Map(), elements = new Map(), events = new Map();
  const frames = [];
  let timerId = 0;
  const root = { dataset: { build }, appendChild: (el) => { el.isConnected = true; elements.set(el.id, el); } };
  const document = {
    documentElement: root, head: root, readyState,
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
  const started = vm.runInNewContext(source, {
    document, window: { addEventListener() {} }, console, localStorage,
    buildCss, discoverTokens, sameDiscovery, normalizeSettings, newest,
    ext: { storage: { onChanged: { addListener() {} } } },
    loadState: async () => { await storageAnswered; return { settings }; }, readLocal: async () => { await storageAnswered; return local; },
    writeLocal: async (patch) => Object.assign(local, patch),
    setTimeout: (fn) => { timers.set(++timerId, fn); return timerId; },
    clearTimeout: (id) => timers.delete(id),
    requestAnimationFrame: (fn) => { frames.push(fn); return frames.length; },
  });
  if (!waitForStorage) await started;
  const flush = () => { const pending = [...timers.values()]; timers.clear(); pending.forEach((fn) => fn()); };
  const paint = () => { const pending = frames.splice(0); pending.forEach((fn) => fn()); };
  const answerStorage = async () => { answer(); await started; await new Promise((r) => setImmediate(r)); };
  return { local, page, document, answerStorage, setRules, flush, paint, load: () => events.get("load")({ target: { tagName: "LINK" } }), css: () => elements.get("chatgpt-accents-for-all")?.textContent || "" };
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
  it("catches CSS activated by a page handler after our capture-phase load listener", async () => {
    const page = await boot([]);
    page.load();
    // A preload's own onload handler activates the sheet after capture listeners.
    page.setRules(fixture.rules);
    page.paint();
    expect(page.css()).toContain("#e11d48");
  });
  it("revalidates a changed stylesheet before painting a previously valid map", async () => {
    const page = await boot(fixture.rules);
    page.setRules([]);
    page.paint();
    expect(page.css()).toBe("");
    expect(page.local.status.ok).toBe(false);
  });
});

describe("content script paints before ChatGPT's first frame", () => {
  const KEY = "chatgpt-accents-for-all:paint";
  it("applies the last validated stylesheet synchronously when the build matches", async () => {
    const page = await boot([], cached, { readyState: "loading", waitForStorage: true, page: { [KEY]: JSON.stringify({ build: "prod-1", css: "EARLY" }) } });
    // Extension storage has not answered and no site CSS exists yet.
    expect(page.css()).toBe("EARLY");
  });
  it("does not apply a stylesheet cached for another ChatGPT build", async () => {
    const page = await boot([], cached, { build: "prod-2", readyState: "loading", waitForStorage: true, page: { [KEY]: JSON.stringify({ build: "prod-1", css: "EARLY" }) } });
    expect(page.css()).toBe("");
  });
  it("keeps the early paint and reports nothing while no site CSS has loaded", async () => {
    const page = await boot([], cached, { readyState: "loading", waitForStorage: true, page: { [KEY]: JSON.stringify({ build: "prod-1", css: "EARLY" }) } });
    await page.answerStorage();
    page.paint();
    expect(page.css()).toBe("EARLY");
    expect(page.local.status.ok).toBe(true);
  });
  it("replaces the early paint once the site CSS validates", async () => {
    const page = await boot([], cached, { readyState: "loading", waitForStorage: true, page: { [KEY]: JSON.stringify({ build: "prod-1", css: "EARLY" }) } });
    page.setRules(fixture.rules);
    page.load();
    await page.answerStorage();
    expect(page.css()).toContain("#e11d48");
    expect(JSON.parse(page.page[KEY])).toEqual({ build: "prod-1", css: page.css() });
  });
  it("removes the early paint as soon as loaded site CSS rejects it, even before storage answers", async () => {
    const page = await boot([], cached, { readyState: "loading", waitForStorage: true, page: { [KEY]: JSON.stringify({ build: "prod-1", css: "EARLY" }) } });
    page.setRules([{ selector: ":root", decls: { "--x1e4keym": "#fff" } }]);
    page.load();
    expect(page.css()).toBe("");
    expect(page.page[KEY]).toBeUndefined();
    await page.answerStorage();
    expect(page.local.status.ok).toBe(false);
  });
  it("forgets the early paint when discovery fails on a finished page", async () => {
    const page = await boot([], cached, { page: { [KEY]: JSON.stringify({ build: "prod-1", css: "EARLY" }) } });
    expect(page.css()).toBe("");
    expect(page.page[KEY]).toBeUndefined();
  });
});
