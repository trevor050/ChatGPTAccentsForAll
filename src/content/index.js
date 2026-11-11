// Content script for chatgpt.com. Runs at document_start.
//
// 0. Synchronously re-apply the last validated stylesheet when ChatGPT's build
//    is unchanged, so the first paint already has the user's colours.
// 1. Validate the previous token map against this page's loaded stylesheets.
// 2. As ChatGPT's stylesheets load, rediscover tokens from the live CSS and
//    repaint if anything moved (ChatGPT ships hashed StyleX variable names).
// 3. Repaint whenever settings change (popup edits arrive via storage.local).
// Every step is wrapped so a ChatGPT redesign degrades to "no colours", never
// to a broken page. A coalesced pre-paint check covers late sheet activation.
import { buildCss } from "../lib/css.js";
import { discoverTokens, sameDiscovery } from "../lib/discover.js";
import { normalizeSettings } from "../lib/settings.js";
import { ext, loadState, newest, readLocal, writeLocal } from "../lib/storage.js";

const STYLE_ID = "chatgpt-accents-for-all";
const THEME_OR_ROOT = /:root|^\.([\w-]+)\.\1/;
const LEGACY_PROBES = ["--interactive-bg-accent-default", "--theme-user-msg-bg"];
// chatgpt.com's own localStorage is the only storage a content script can read
// synchronously at document_start; extension storage answers after the page may
// already have painted. It holds the last stylesheet that was validated against
// this build's CSS: { build, css }.
const PAINT_CACHE = "chatgpt-accents-for-all:paint";

let settings = null;
let tokens = null; // only ever a map discovered from this page's current CSS
let cachedTokens = null; // last stored discovery, compared to avoid rewriting it
let legacy = false;
let lastCss = null;

const pageBuild = () => document.documentElement?.dataset?.build || null;

function readPaintCache() {
  try {
    const hit = JSON.parse(localStorage.getItem(PAINT_CACHE) || "null");
    return hit && typeof hit.css === "string" && hit.css && hit.build && hit.build === pageBuild() ? hit.css : null;
  } catch { return null; }
}

let lastCached = null;
function writePaintCache(css) {
  const entry = css && pageBuild() ? JSON.stringify({ build: pageBuild(), css }) : "";
  if (entry === lastCached) return;
  lastCached = entry;
  try {
    if (entry) localStorage.setItem(PAINT_CACHE, entry);
    else localStorage.removeItem(PAINT_CACHE);
  } catch { /* storage blocked or full: only the early paint is lost */ }
}

function styleElement() {
  let el = document.getElementById(STYLE_ID);
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
  }
  // Re-attach if the page's framework replaced the document's children.
  if (!el.isConnected) (document.head || document.documentElement).appendChild(el);
  return el;
}

function paint(css) {
  const el = document.getElementById(STYLE_ID);
  if (css === lastCss && (el?.isConnected || !css)) return;
  lastCss = css;
  if (!css) { el?.remove(); return; }
  styleElement().textContent = css;
}

function render() {
  try {
    const css = settings ? buildCss(tokens, settings, { legacy }) : "";
    paint(css);
    writePaintCache(css);
  } catch (err) {
    console.debug("[ChatGPT Accents] render skipped:", err);
  }
}

/** Collect the custom-property rules discovery needs from same-origin stylesheets. */
function readRules() {
  const rules = [];
  let sawLegacy = false;
  const walk = (list, condition) => {
    for (const rule of list) {
      if (rule.cssRules && !rule.selectorText) {
        walk(rule.cssRules, rule.conditionText ? (condition ? `${condition} and ${rule.conditionText}` : rule.conditionText) : condition);
        continue;
      }
      const sel = rule.selectorText;
      const style = rule.style;
      if (!sel || !style || !style.length) continue;
      if (!sawLegacy && LEGACY_PROBES.some((p) => style.getPropertyValue(p))) sawLegacy = true;
      if (!THEME_OR_ROOT.test(sel)) continue;
      const decls = {};
      for (let i = 0; i < style.length; i++) {
        const name = style.item(i);
        if (name.startsWith("--")) decls[name] = style.getPropertyValue(name).trim();
      }
      if (Object.keys(decls).length) rules.push(condition ? { selector: sel, condition, decls } : { selector: sel, decls });
    }
  };
  for (const sheet of document.styleSheets) {
    if (sheet.ownerNode?.id === STYLE_ID) continue;
    let list;
    try { list = sheet.cssRules; } catch { continue; } // cross-origin sheet
    walk(list, "");
  }
  return { rules, sawLegacy };
}

let lastStatus = "";
function rediscover() {
  try {
    const { rules, sawLegacy } = readRules();
    const found = discoverTokens(rules);
    // Nothing themeable has loaded yet while the document is still loading: that
    // proves nothing either way, so keep the current paint and decide later.
    if (!found && !sawLegacy && !rules.length && document.readyState !== "complete") return;
    // A cached map is only a candidate. Never keep styling a new site version
    // with yesterday's tokens when its current CSS no longer matches.
    tokens = found;
    legacy = sawLegacy;
    if (!settings) {
      // Extension storage has not answered yet. If this page's CSS already
      // rejects the map, drop the early paint now rather than after the read.
      if (!found && !sawLegacy) { paint(""); writePaintCache(""); }
      return;
    }
    render();
    if (!sameDiscovery(found, cachedTokens)) {
      cachedTokens = found;
      writeLocal({ tokens: found });
    }
    const status = {
      ok: Boolean(tokens) || legacy,
      accentTokens: tokens ? Object.keys(tokens.accent).length : 0,
      neutralTokens: tokens ? Object.keys(tokens.neutrals).length : 0,
      legacy,
      rules: rules.length,
      build: document.documentElement.dataset.build || null,
    };
    const key = JSON.stringify(status);
    if (key !== lastStatus) {
      lastStatus = key;
      writeLocal({ status: { ...status, at: Date.now() } });
    }
  } catch (err) {
    console.debug("[ChatGPT Accents] discovery skipped:", err);
  }
}

let beforePaintPending = false;
function rediscoverBeforePaint() {
  if (beforePaintPending) return;
  beforePaintPending = true;
  requestAnimationFrame(() => {
    beforePaintPending = false;
    rediscover();
  });
}

async function start() {
  // Same build as the last validated paint: apply it before the first frame.
  // The CSS below re-validates it and removes it if this page disagrees.
  try { const early = readPaintCache(); if (early) paint(early); } catch { /* never block the page */ }

  // Stylesheet <link>s fire "load" (non-bubbling, so listen in capture phase).
  // Validate in this event, before rendering, instead of painting the site's
  // default accent for a debounce interval after a new stylesheet arrives.
  // Registered before the async storage read below so no load is missed.
  document.addEventListener("load", (e) => {
    if (e.target?.tagName === "LINK" || e.target?.tagName === "STYLE") {
      rediscover();
      // A page's own target/bubble listener can activate a preloaded stylesheet
      // after this capture listener. Check again before that sheet is painted.
      rediscoverBeforePaint();
    }
  }, true);

  const [{ settings: s }, cached] = await Promise.all([loadState(), readLocal(["tokens"])]);
  settings = s;
  cachedTokens = cached.tokens || null;
  // Reading extension storage is asynchronous, so styles may already be ready.
  rediscover();
  rediscoverBeforePaint();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { rediscover(); rediscoverBeforePaint(); }, { once: true });
  window.addEventListener("load", () => { rediscover(); rediscoverBeforePaint(); setTimeout(render, 3000); }, { once: true });
  // SPA navigations can load route stylesheets and occasionally rebuild <head>.
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { rediscover(); rediscoverBeforePaint(); } });

  ext.storage.onChanged.addListener((changes, area) => {
    const next = area === "local" ? changes.live?.newValue : area === "sync" ? changes.settings?.newValue : null;
    if (!next) return;
    // The popup writes the same settings to local (instantly) and sync (debounced);
    // whichever is newer wins, so a late sync echo never undoes a newer live edit.
    const incoming = normalizeSettings(next);
    if (newest(settings, incoming) !== incoming && incoming.updatedAt !== settings?.updatedAt) return;
    settings = incoming;
    render();
  });
}

start().catch((err) => console.debug("[ChatGPT Accents] failed to start:", err));
