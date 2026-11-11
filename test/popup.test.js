// @vitest-environment jsdom
/* global document, window, KeyboardEvent */
// Drives the real popup (popup.html + popup.js) against an in-memory chrome.storage:
// the theme grid with a keyboard, the switch, Advanced edits, saved themes, reload.
import fs from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { THEMES } from "../src/lib/themes.js";
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
  const cards = () => [...document.querySelectorAll(".theme-card")];
  const key = (el, k, init = {}) => el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init }));
  const flush = () => window.dispatchEvent(new Event("pagehide")); // popups save on close
  const settledLive = () => vi.waitFor(() => expect(storage.data.local.live).toBeDefined());
  return { $, cards, key, flush, storage, settledLive, byId: (id) => document.querySelector(`.theme-card[data-id="${id}"]`) };
}

const checked = (cards) => cards.filter((c) => c.getAttribute("aria-checked") === "true").map((c) => c.dataset.id);

describe("theme grid", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("shows Default plus every original theme, as a radio group with one tab stop", async () => {
    const { cards, $ } = await openPopup();
    expect(cards()).toHaveLength(THEMES.length + 1);
    expect(cards()[0].textContent).toContain("Default");
    expect($("themeGrid").getAttribute("role")).toBe("radiogroup");
    expect(cards().every((c) => c.getAttribute("role") === "radio")).toBe(true);
    expect(checked(cards())).toEqual(["default"]);
    expect(cards().filter((c) => c.tabIndex === 0)).toHaveLength(1);
    expect(cards()[0].tabIndex).toBe(0);
  });

  it("names, badges and colours match the original cards", async () => {
    const { byId } = await openPopup();
    const purple = byId("purple_plus");
    expect(purple.querySelector(".badge.plus").textContent).toBe("Plus");
    expect(byId("black_pro").querySelector(".badge.pro").textContent).toBe("Pro");
    expect(byId("ocean").querySelector(".badge.bg-dark").textContent).toBe("Background: Dark");
    expect(byId("pastel_sky").querySelector(".badge.bg-light").textContent).toBe("Background: Light");
    expect(byId("blue").querySelectorAll(".pill")).toHaveLength(3);
    expect(byId("blue").querySelector(".dot").style.background).toBe("rgb(29, 116, 255)");
    // a theme with a background shows it as the middle pill, otherwise the bubble
    expect(byId("ocean").querySelectorAll(".pill")[1].style.background).toBe("rgb(11, 31, 38)");
    expect(byId("blue").querySelectorAll(".pill")[1].style.background).toBe("rgb(11, 58, 122)");
  });

  it("arrow keys move through the grid and select as they go", async () => {
    const { cards, key, flush, storage, $ } = await openPopup();
    cards()[0].focus();
    key(document.activeElement, "ArrowRight"); // Default -> Blue
    expect(document.activeElement.dataset.id).toBe("blue");
    expect(checked(cards())).toEqual(["blue"]);
    expect($("enabled").checked).toBe(true);
    expect(cards().find((c) => c.tabIndex === 0).dataset.id).toBe("blue"); // the tab stop follows selection

    key(document.activeElement, "ArrowDown"); // one row down in a 2-column grid: Yellow
    expect(document.activeElement.dataset.id).toBe("yellow");
    key(document.activeElement, "ArrowUp");
    expect(document.activeElement.dataset.id).toBe("blue");
    key(document.activeElement, "ArrowLeft");
    expect(document.activeElement.dataset.id).toBe("default");
    expect(checked(cards())).toEqual(["default"]);
    expect($("enabled").checked).toBe(false);

    key(document.activeElement, "ArrowLeft"); // wraps to the last theme
    expect(document.activeElement.dataset.id).toBe(THEMES.at(-1).id);
    key(document.activeElement, "Home");
    expect(document.activeElement.dataset.id).toBe("default");
    key(document.activeElement, "End");
    expect(document.activeElement.dataset.id).toBe(THEMES.at(-1).id);
    key(document.activeElement, "ArrowDown"); // bottom edge: stays
    expect(document.activeElement.dataset.id).toBe(THEMES.at(-1).id);

    flush();
    await vi.waitFor(() => expect(storage.data.sync.settings.theme).toBe(THEMES.at(-1).id));
  });

  it("ignores other keys and modified arrows", async () => {
    const { cards, key } = await openPopup();
    cards()[0].focus();
    key(document.activeElement, "a");
    key(document.activeElement, "ArrowRight", { ctrlKey: true });
    expect(document.activeElement.dataset.id).toBe("default");
    expect(checked(cards())).toEqual(["default"]);
  });

  it("choosing a theme writes all its roles, for the page and for sync", async () => {
    const { byId, flush, storage, settledLive } = await openPopup();
    byId("sunset").click();
    await settledLive();
    const live = storage.data.local.live;
    expect(live).toMatchObject({ v: 3, enabled: true, theme: "sunset", light: "#fb7185" });
    expect(live.roles).toMatchObject({ bubbleBg: "#7c2d12", bubbleText: "#fde2e4", submitBg: "#f97316", submitText: "#111111" });
    flush();
    await vi.waitFor(() => expect(storage.data.sync.settings.theme).toBe("sunset"));
  });

  it("Default turns it off but remembers the colours for the switch", async () => {
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
    expect(second.cards().find((c) => c.tabIndex === 0).dataset.id).toBe("forest");
  });
});

describe("tabs", () => {
  it("arrow keys switch Basic and Advanced; the hidden panel is inert", async () => {
    const { $, key } = await openPopup();
    expect($("seg-basic").getAttribute("aria-selected")).toBe("true");
    expect($("advanced").hasAttribute("inert")).toBe(true);
    $("seg-basic").focus();
    key($("seg-basic"), "ArrowRight");
    expect(document.activeElement).toBe($("seg-advanced"));
    expect($("seg-advanced").getAttribute("aria-selected")).toBe("true");
    expect($("advanced").hasAttribute("inert")).toBe(false);
    expect($("basic").hasAttribute("inert")).toBe(true);
    expect($("seg-basic").tabIndex).toBe(-1);
    key($("seg-advanced"), "Home");
    expect($("seg-basic").getAttribute("aria-selected")).toBe("true");
  });
});

describe("advanced", () => {
  it("shows the chosen theme's five colours and surface", async () => {
    const { byId, $ } = await openPopup();
    byId("ocean").click();
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
    $("bubbleBgHex").value = "#aa3300";
    $("bubbleBgHex").dispatchEvent(new Event("input"));
    expect($("preview").style.getPropertyValue("--p-bubble")).toBe("#aa3300");
    expect(storage.data.local.live?.roles.bubbleBg).not.toBe("#aa3300"); // not applied yet
    $("save").click();
    flush();
    await vi.waitFor(() => expect(storage.data.sync.settings.roles.bubbleBg).toBe("#aa3300"));
    expect(storage.data.sync.settings.theme).toBe("custom");
    expect(document.querySelector('.theme-card[aria-checked="true"]')).toBeNull(); // no named theme matches
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
    const { $ } = await openPopup();
    $("surface-dark").checked = true;
    $("surface-dark").dispatchEvent(new Event("change"));
    expect($("surfaceNote").textContent).toContain("Light mode keeps ChatGPT's own page");
    $("pv-dark").click();
    const dark = $("preview").style.getPropertyValue("--p-surface");
    $("pv-light").click();
    expect($("preview").style.getPropertyValue("--p-surface")).not.toBe(dark);
    expect($("pv-light").getAttribute("aria-pressed")).toBe("true");
    expect($("pv-dark").getAttribute("aria-pressed")).toBe("false");
  });

  it("makes, saves, reloads and applies a custom theme", async () => {
    const storage = fakeStorage();
    const first = await openPopup(storage);
    first.byId("green").click();
    first.$("accentHex").value = "#123abc";
    first.$("accentHex").dispatchEvent(new Event("input"));
    first.$("saveName").value = "Mine";
    first.$("saveThemeBtn").click();
    first.$("saveName").value = "Mine";
    first.$("saveThemeBtn").click();
    await vi.waitFor(() => expect(storage.data.sync.saved).toHaveLength(2));
    expect(storage.data.sync.saved.map((s) => s.name)).toEqual(["Mine", "Mine (2)"]);
    expect(storage.data.sync.saved[0]).toMatchObject({ light: "#123abc", roles: { bubbleBg: "#064e3b" } });

    const second = await openPopup(storage);
    expect([...document.querySelectorAll(".saved-row .name")].map((n) => n.textContent)).toEqual(["Mine", "Mine (2)"]);
    document.querySelector('.saved-row button[aria-label="Apply Mine"]').click();
    expect(second.$("accentHex").value).toBe("#123abc");
    second.flush();
    await vi.waitFor(() => expect(storage.data.sync.settings).toMatchObject({ enabled: true, theme: "custom", light: "#123abc" }));
    document.querySelector('.saved-row button[aria-label="Delete Mine"]').click();
    await vi.waitFor(() => expect(storage.data.sync.saved).toHaveLength(1));
  });

  it("Reset goes back to ChatGPT's colors", async () => {
    const { byId, $, cards } = await openPopup();
    byId("pink").click();
    $("reset").click();
    expect(checked(cards())).toEqual(["default"]);
    expect($("enabled").checked).toBe(false);
  });

  it("Surprise me fills the palette with a real theme without applying it", async () => {
    const { $, cards } = await openPopup();
    $("random").click();
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

  it("a 2.0.0 custom colour shows as custom, with its accent in Advanced", async () => {
    const storage = fakeStorage({ sync: { settings: { v: 2, enabled: true, light: "#0e7490", dark: "#2dd4bf", tint: 0, preset: null, updatedAt: 5 } } });
    const { cards, $ } = await openPopup(storage);
    expect(checked(cards())).toEqual([]);
    expect($("accentHex").value).toBe("#0e7490");
  });
});

describe("paused warning", () => {
  const ON = { sync: { settings: { v: 3, enabled: true, light: "#e11d48", updatedAt: 1 } } };
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
