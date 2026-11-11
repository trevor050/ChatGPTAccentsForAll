// @vitest-environment jsdom
/* global document, window, KeyboardEvent */
// Drives the real popup (popup.html + popup.js) against an in-memory chrome.storage:
// the theme grid with a keyboard, the switch, Advanced edits, saved themes, reload.
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEMES, THEME_GROUPS } from "../src/lib/themes.js";
import { ORIGINAL_THEMES } from "../src/lib/themes-original.js";
import { buildV1Vars, V1_PRESETS } from "./helpers/v1.js";

const html = fs.readFileSync(path.resolve(import.meta.dirname, "../src/popup/popup.html"), "utf8");
const bodyHtml = /<body>([\s\S]*?)<script/.exec(html)[1];

function fakeStorage(initial = {}) {
  const data = { sync: { ...initial.sync }, local: { ...initial.local } };
  const area = (name) => ({
    get: (keys, cb) => {
      const all = data[name];
      const want = keys == null ? Object.keys(all) : [].concat(keys);
      cb(Object.fromEntries(want.filter((k) => k in all).map((k) => [k, structuredClone(all[k])])));
    },
    set: (items, cb) => { Object.assign(data[name], structuredClone(items)); cb?.(); },
    remove: (keys, cb) => { for (const k of [].concat(keys)) delete data[name][k]; cb?.(); },
  });
  // `initial.tab`: what the active tab's content script answers ({ status }), or
  // undefined for a tab without one (not ChatGPT).
  const tabs = {
    query: (_q, cb) => cb([{ id: 7 }]),
    sendMessage: (_id, _msg, cb) => cb(initial.tab),
  };
  return { data, chrome: { storage: { sync: area("sync"), local: area("local"), onChanged: { addListener() {} } }, tabs, runtime: { getManifest: () => ({ version: "9.9.9" }) } } };
}

/** Load the popup fresh against `storage`; resolves once it has rendered. */
async function openPopup(storage = fakeStorage()) {
  vi.resetModules();
  document.body.innerHTML = bodyHtml;
  document.documentElement.removeAttribute("data-native-picker");
  globalThis.chrome = storage.chrome;
  globalThis.requestAnimationFrame = (cb) => setTimeout(cb, 0);
  await import("../src/popup/popup.js");
  await vi.waitFor(() => expect(document.body.dataset.ready).toBe("true"));
  const $ = (id) => document.getElementById(id);
  const cards = () => [...document.querySelectorAll(".theme")];
  const key = (el, k, init = {}) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init }));
  const flush = () => window.dispatchEvent(new Event("pagehide")); // popups save on close
  const settledLive = () => vi.waitFor(() => expect(storage.data.local.live).toBeDefined());
  return { $, cards, key, flush, storage, settledLive, byId: (id) => document.querySelector(`.theme[data-id="${id}"]`), tab: (id) => document.getElementById(`tab-${id}`), panel: (id) => document.getElementById(`panel-${id}`) };
}

const checked = (cards) => cards.filter((c) => c.getAttribute("aria-checked") === "true").map((c) => c.dataset.id);

describe("themes", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("lists ChatGPT's own plus every theme, in its group, as radio groups with one tab stop each", async () => {
    const { cards, tab, panel } = await openPopup();
    expect(cards()).toHaveLength(THEMES.length + 1);
    expect(cards()[0].textContent).toContain("ChatGPT's own");
    for (const g of THEME_GROUPS) {
      expect(tab(g.id).textContent).toBe(g.name);
      const list = panel(g.id).querySelector("[role=radiogroup]");
      const ids = [...list.querySelectorAll("[role=radio]")].map((b) => b.dataset.id);
      expect(ids).toEqual([...(g.id === "classic" ? ["default"] : []), ...THEMES.filter((t) => t.group === g.id).map((t) => t.id)]);
      expect([...list.querySelectorAll("[role=radio]")].filter((b) => b.tabIndex === 0)).toHaveLength(1);
    }
    expect(tab("saved")).toBeNull(); // only when there are saved themes
    expect(checked(cards())).toEqual(["default"]);
  });

  it("opens on the group of the chosen theme and shows one group at a time", async () => {
    const storage = fakeStorage({ sync: { settings: { v: 4, enabled: true, theme: "ocean", light: "#2dd4bf", roles: { bubbleBg: "#073642", bubbleText: "#e0fbfc", submitBg: "#0ea5a4", submitText: "#002b36", link: "#38bdf8" }, surface: { kind: "custom", color: "#0b1f26" }, updatedAt: 1 } } });
    const { tab, panel } = await openPopup(storage);
    expect(tab("dark").getAttribute("aria-selected")).toBe("true");
    expect(panel("dark").hidden).toBe(false);
    expect(panel("classic").hidden).toBe(true);
  });

  it("marks Purple and Black as the formerly paywalled ones", async () => {
    const { byId } = await openPopup();
    expect(byId("purple_plus").querySelector(".was").textContent).toBe("$20/mo free");
    expect(byId("purple_plus").querySelector(".was s").textContent).toBe("$20/mo");
    expect(byId("black_pro").querySelector(".was").textContent).toBe("$200/mo free");
    expect(byId("black_pro").getAttribute("aria-label")).toMatch(/^Black, once a ChatGPT Pro color/);
    expect(byId("blue").querySelector(".was")).toBeNull();
  });

  it("draws each theme as its colours in miniature", async () => {
    const { byId } = await openPopup();
    const ocean = byId("ocean").querySelector(".chip").style;
    expect(ocean.getPropertyValue("--chip-page")).toBe("#0b1f26");
    expect(ocean.getPropertyValue("--chip-bubble")).toBe("#073642");
    expect(ocean.getPropertyValue("--chip-send")).toBe("#0ea5a4");
    expect(ocean.getPropertyValue("--chip-accent")).toBe("#2dd4bf");
    expect(byId("blue").querySelector(".chip").style.getPropertyValue("--chip-page")).toBe(""); // ChatGPT's page
  });

  it("arrow keys move through a group's two columns and select as they go", async () => {
    const { key, flush, storage, $, byId, panel } = await openPopup();
    const items = () => [...panel("classic").querySelectorAll(".theme")];
    byId("default").focus();
    key(document.activeElement, "ArrowRight"); // ChatGPT's own -> Blue
    expect(document.activeElement.dataset.id).toBe("blue");
    expect(checked(items())).toEqual(["blue"]);
    expect($("enabled").checked).toBe(true);
    expect(items().find((c) => c.tabIndex === 0).dataset.id).toBe("blue"); // the tab stop follows selection
    key(document.activeElement, "ArrowDown"); // one row down: Teal
    expect(document.activeElement.dataset.id).toBe("teal");
    key(document.activeElement, "ArrowUp");
    key(document.activeElement, "ArrowLeft");
    expect(document.activeElement.dataset.id).toBe("default");
    expect($("enabled").checked).toBe(false);
    key(document.activeElement, "End");
    const last = THEMES.filter((t) => t.group === "classic").at(-1).id;
    expect(document.activeElement.dataset.id).toBe(last);
    key(document.activeElement, "ArrowDown"); // bottom edge: stays
    expect(document.activeElement.dataset.id).toBe(last);
    flush();
    await vi.waitFor(() => expect(storage.data.sync.settings.theme).toBe(last));
  });

  it("ignores other keys and modified arrows", async () => {
    const { byId, key, cards } = await openPopup();
    byId("default").focus();
    key(document.activeElement, "a");
    key(document.activeElement, "ArrowRight", { ctrlKey: true });
    expect(document.activeElement.dataset.id).toBe("default");
    expect(checked(cards())).toEqual(["default"]);
  });

  it("group tabs follow the arrow keys", async () => {
    const { tab, panel, key } = await openPopup();
    tab("classic").focus();
    key(tab("classic"), "ArrowRight");
    expect(document.activeElement).toBe(tab("dark"));
    expect(tab("dark").getAttribute("aria-selected")).toBe("true");
    expect(tab("classic").tabIndex).toBe(-1);
    expect(panel("dark").hidden).toBe(false);
    key(tab("dark"), "End");
    expect(tab("character").getAttribute("aria-selected")).toBe("true");
    key(tab("character"), "ArrowRight"); // wraps
    expect(tab("classic").getAttribute("aria-selected")).toBe("true");
  });

  it("choosing a theme writes all its roles, for the page and for sync", async () => {
    const { byId, flush, storage, settledLive } = await openPopup();
    byId("synthwave").click();
    await settledLive();
    const live = storage.data.local.live;
    expect(live).toMatchObject({ v: 4, enabled: true, theme: "synthwave", light: "#ff0080" });
    expect(live.roles).toMatchObject({ bubbleBg: "#1a0033", bubbleText: "#ff66cc", submitBg: "#cc0066", submitText: "#ffffff", link: "#00ffff" });
    flush();
    await vi.waitFor(() => expect(storage.data.sync.settings.theme).toBe("synthwave"));
  });

  it("ChatGPT's own turns it off but remembers the colours for the switch", async () => {
    const { byId, $, cards, flush, storage } = await openPopup();
    byId("mocha").click();
    byId("default").click();
    expect(checked(cards())).toEqual(["default"]);
    expect($("enabled").checked).toBe(false);
    $("enabled").checked = true;
    $("enabled").dispatchEvent(new Event("change"));
    expect(checked(cards())).toEqual(["mocha"]);
    flush();
    await vi.waitFor(() => expect(storage.data.sync.settings).toMatchObject({ enabled: true, theme: "mocha" }));
  });

  it("restores the selected theme on the next open", async () => {
    const storage = fakeStorage();
    const first = await openPopup(storage);
    first.byId("forest").click();
    first.flush();
    await vi.waitFor(() => expect(storage.data.sync.settings?.theme).toBe("forest"));
    const second = await openPopup(storage);
    expect(checked(second.cards())).toEqual(["forest"]);
    expect(second.tab("dark").getAttribute("aria-selected")).toBe("true");
  });

  it("Surprise me applies a different theme and shows its group", async () => {
    const { $, cards, tab } = await openPopup();
    $("random").click();
    const [id] = checked(cards());
    const theme = THEMES.find((t) => t.id === id);
    expect(theme).toBeTruthy();
    expect(tab(theme.group).getAttribute("aria-selected")).toBe("true");
  });
});

describe("customize", () => {
  const open = async (storage) => {
    const p = await openPopup(storage);
    p.$("openCustomize").click();
    return p;
  };

  it("is a second view with a way back, by button or Escape", async () => {
    const { $, key } = await open();
    expect($("customizeView").hidden).toBe(false);
    expect($("themesView").hidden).toBe(true);
    expect(document.activeElement).toBe($("back"));
    $("back").click();
    expect($("themesView").hidden).toBe(false);
    expect(document.activeElement).toBe($("openCustomize"));
    $("openCustomize").click();
    key(document.activeElement, "Escape");
    expect($("customizeView").hidden).toBe(true);
  });

  it("shows the chosen theme's five colours and surface", async () => {
    const { byId, $ } = await openPopup();
    byId("ocean").click();
    $("openCustomize").click();
    expect($("accentHex").value).toBe("#2dd4bf");
    expect($("bubbleBgHex").value).toBe("#073642");
    expect($("bubbleTextHex").value).toBe("#e0fbfc");
    expect($("submitBgHex").value).toBe("#0ea5a4");
    expect($("submitTextHex").value).toBe("#002b36");
    expect($("surface-custom").checked).toBe(true);
    expect($("customSurfaceRow").classList.contains("hidden")).toBe(false);
    expect($("surfaceColorHex").value).toBe("#0b1f26");
  });

  it("edits preview live and only reach the page when applied", async () => {
    const { byId, $, storage, flush } = await openPopup();
    byId("blue").click();
    $("openCustomize").click();
    $("bubbleBgHex").value = "#aa3300";
    $("bubbleBgHex").dispatchEvent(new Event("input"));
    expect($("preview").parentElement.style.getPropertyValue("--p-bubble")).toBe("#aa3300");
    expect(storage.data.local.live?.roles.bubbleBg).not.toBe("#aa3300"); // not applied yet
    $("save").click();
    flush();
    await vi.waitFor(() => expect(storage.data.sync.settings.roles.bubbleBg).toBe("#aa3300"));
    expect(storage.data.sync.settings.theme).toBe("custom");
    expect(document.querySelector('.theme[aria-checked="true"]')).toBeNull(); // no named theme matches
    expect($("applied").textContent).toBe("Applied");
  });

  it("flags a bad hex without losing the last good colour", async () => {
    const { byId, $ } = await openPopup();
    byId("blue").click();
    $("accentHex").value = "#12";
    $("accentHex").dispatchEvent(new Event("input"));
    expect($("accentHex").getAttribute("aria-invalid")).toBe("true");
    $("accentHex").dispatchEvent(new Event("change"));
    expect($("accentHex").value).toBe("#1d74ff");
    $("accentHex").value = "abc";
    $("accentHex").dispatchEvent(new Event("change")); // short form expands when left
    expect($("accentHex").value).toBe("#aabbcc");
  });

  it("explains surfaces per mode and the preview toggles light and dark", async () => {
    const { $ } = await open();
    $("surface-dark").checked = true;
    $("surface-dark").dispatchEvent(new Event("change"));
    expect($("surfaceNote").textContent).toContain("Light mode keeps ChatGPT's own page");
    const vars = () => $("preview").parentElement.style;
    $("pv-dark").click();
    const dark = vars().getPropertyValue("--p-surface");
    $("pv-light").click();
    expect(vars().getPropertyValue("--p-surface")).not.toBe(dark);
    expect($("pv-light").getAttribute("aria-pressed")).toBe("true");
    expect($("pv-dark").getAttribute("aria-pressed")).toBe("false");
  });

  it("makes, saves, reloads and applies a custom theme, which gets its own group", async () => {
    const storage = fakeStorage();
    const first = await openPopup(storage);
    first.byId("green").click();
    first.$("openCustomize").click();
    first.$("accentHex").value = "#123abc";
    first.$("accentHex").dispatchEvent(new Event("input"));
    first.$("saveName").value = "Mine";
    first.$("saveThemeBtn").click();
    first.$("saveName").value = "Mine";
    first.$("saveThemeBtn").click();
    await vi.waitFor(() => expect(storage.data.sync.saved).toHaveLength(2));
    expect(storage.data.sync.saved.map((s) => s.name)).toEqual(["Mine", "Mine (2)"]);
    expect(storage.data.sync.saved[0]).toMatchObject({ light: "#123abc", roles: { bubbleBg: "#064e3b" } });
    expect(first.tab("saved").textContent).toBe("Saved");

    const second = await openPopup(storage);
    expect([...second.panel("saved").querySelectorAll(".theme .name")].map((n) => n.textContent)).toEqual(["Mine", "Mine (2)"]);
    second.panel("saved").querySelector(".theme").click();
    expect(second.$("accentHex").value).toBe("#123abc");
    second.flush();
    await vi.waitFor(() => expect(storage.data.sync.settings).toMatchObject({ enabled: true, theme: "custom", light: "#123abc" }));
    expect(second.panel("saved").querySelector(".theme").getAttribute("aria-checked")).toBe("true");
    document.querySelector('.saved-list button[aria-label="Delete Mine"]').click();
    await vi.waitFor(() => expect(storage.data.sync.saved).toHaveLength(1));
    expect(second.panel("saved").querySelectorAll(".theme")).toHaveLength(1);
  });

  it("Reset goes back to ChatGPT's colors", async () => {
    const { byId, $, cards } = await openPopup();
    byId("pink").click();
    $("reset").click();
    expect(checked(cards())).toEqual(["default"]);
    expect($("enabled").checked).toBe(false);
  });

  it("Surprise me fills the palette with a real theme without applying it", async () => {
    const { $, cards } = await open();
    $("randomDraft").click();
    expect(THEMES.some((t) => t.accent === $("accentHex").value)).toBe(true);
    expect(checked(cards())).toEqual(["default"]);
  });
});

describe("opening with 1.1.0 and 2.0.0 data", () => {
  it("a 1.1.0 user's theme comes back selected, under the same name", async () => {
    const ocean = V1_PRESETS.find((p) => p.id === "ocean");
    const storage = fakeStorage({ sync: { themeVars: buildV1Vars(ocean) } });
    const { cards, $, flush } = await openPopup(storage);
    expect(checked(cards())).toEqual(["ocean"]);
    expect($("enabled").checked).toBe(true);
    flush();
    await vi.waitFor(() => expect(storage.data.sync.themeVars).toBeUndefined());
    expect(storage.data.sync.settings.theme).toBe("ocean");
  });

  it("a 2.0.0 user who had a preset lands on that named theme", async () => {
    const storage = fakeStorage({ sync: { settings: { v: 2, enabled: true, light: "#e11d48", dark: null, tint: 0, preset: "crimson", updatedAt: 5 } } });
    const { cards } = await openPopup(storage);
    expect(checked(cards())).toEqual(["crimson"]);
  });

  it("someone whose theme was retired keeps its colours, selected under Saved", async () => {
    const deep = ORIGINAL_THEMES.find((t) => t.id === "material_indigo");
    const settings = { v: 3, enabled: true, theme: deep.id, light: deep.accent, dark: null, roles: { bubbleBg: deep.bubbleBg, bubbleText: deep.bubbleText, submitBg: deep.submitBg, submitText: deep.submitText, link: null }, surface: { kind: "custom", color: deep.surface }, updatedAt: 5 };
    const storage = fakeStorage({ sync: { settings } });
    const { tab, panel } = await openPopup(storage);
    expect(tab("saved").getAttribute("aria-selected")).toBe("true");
    const item = panel("saved").querySelector(".theme");
    expect(item.textContent).toContain("Material Deep");
    expect(item.getAttribute("aria-checked")).toBe("true");
    expect(storage.data.sync.settings).toMatchObject({ v: 4, theme: "custom", light: deep.accent });
  });

  it("a 2.0.0 custom colour shows as custom, with its accent in Customize", async () => {
    const storage = fakeStorage({ sync: { settings: { v: 2, enabled: true, light: "#0e7490", dark: "#2dd4bf", tint: 0, preset: null, updatedAt: 5 } } });
    const { cards, $ } = await openPopup(storage);
    expect(checked(cards())).toEqual([]);
    expect($("accentHex").value).toBe("#0e7490");
  });
});

describe("paused warning", () => {
  const ON = { sync: { settings: { v: 4, enabled: true, light: "#e11d48", updatedAt: 1 } } };
  const failed = { ok: false, reason: "no-effect", effect: { state: "fail", roles: { send: "fail" } } };

  it("describes the ChatGPT tab the popup is attached to", async () => {
    const off = await openPopup(fakeStorage({ tab: { status: failed } }));
    expect(off.$("status").hidden).toBe(true); // colors are off: nothing to warn about
    const on = await openPopup(fakeStorage({ ...ON, tab: { status: failed } }));
    expect(on.$("status").hidden).toBe(false);
    expect(on.$("statusText").textContent).toMatch(/paused/i);
    expect(on.$("status").getAttribute("role")).toBe("status");
    const fine = await openPopup(fakeStorage({ ...ON, tab: { status: { ok: true, effect: { state: "pass", roles: { send: "pass" } } } } }));
    expect(fine.$("status").hidden).toBe(true);
  });

  it("does not repeat another tab's result when the active tab is not ChatGPT", async () => {
    // A popup opened as its own tab, or over any other site: no content script answers.
    const page = await openPopup(fakeStorage({ ...ON, local: { status: failed } }));
    expect(page.$("status").hidden).toBe(true);
  });

  it("stays quiet while the tab is still checking", async () => {
    const page = await openPopup(fakeStorage({ ...ON, tab: { status: { ok: true, effect: { state: "pending" } } } }));
    expect(page.$("status").hidden).toBe(true);
  });

  it("names the parts that did not take the colors", async () => {
    const page = await openPopup(fakeStorage({ ...ON, tab: { status: { ok: true, reason: "partial", effect: { state: "partial", roles: { send: "fail", bubble: "pass" } } } } }));
    expect(page.$("status").hidden).toBe(false);
    expect(page.$("statusText").textContent).toMatch(/send button/);
  });

  it("copies a diagnostics report from the warning and from Advanced", async () => {
    const writes = [];
    Object.defineProperty(globalThis.navigator, "clipboard", { configurable: true, value: { writeText: async (t) => { writes.push(t); } } });
    const page = await openPopup(fakeStorage({ ...ON, tab: { status: { ...failed, shell: "signed-in", page: { "data-appearance-preset": "linear" } } } }));
    page.$("copyDiagWarn").click();
    await vi.waitFor(() => expect(writes).toHaveLength(1));
    expect(writes[0]).toMatch(/ChatGPT Accents 9\.9\.9 diagnostics/);
    expect(writes[0]).toMatch(/status from: this ChatGPT tab/);
    expect(writes[0]).toMatch(/data-appearance-preset=linear/);
    page.$("copyDiag").click();
    await vi.waitFor(() => expect(writes).toHaveLength(2));
  });
});
