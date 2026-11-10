// Content script for chatgpt.com. Runs at document_start.
//
// 1. Paint immediately from the token map cached by the previous visit.
// 2. Once ChatGPT's stylesheets load, rediscover tokens from the live CSS and
//    repaint if anything moved (ChatGPT ships hashed StyleX variable names).
// 3. Repaint whenever settings change (popup edits arrive via storage.local).
// Every step is wrapped so a ChatGPT redesign degrades to "no colours", never
// to a broken page. No MutationObserver: stylesheet load events are enough.
import { buildCss } from "../lib/css.js";
import { discoverTokens, sameDiscovery } from "../lib/discover.js";
import { normalizeSettings } from "../lib/settings.js";
import { ext, loadState, newest, readLocal, writeLocal } from "../lib/storage.js";

const STYLE_ID = "chatgpt-accents-for-all";
const THEME_OR_ROOT = /:root|^\.([\w-]+)\.\1/;
const LEGACY_PROBES = ["--interactive-bg-accent-default", "--theme-user-msg-bg"];

let settings = null;
let tokens = null;
let legacy = false;
let lastCss = null;

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

function render() {
  try {
    const css = settings ? buildCss(tokens, settings, { legacy }) : "";
    const el = document.getElementById(STYLE_ID);
    if (css === lastCss && (el?.isConnected || !css)) return;
    lastCss = css;
    if (!css) { el?.remove(); return; }
    styleElement().textContent = css;
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
    const changed = (found && !sameDiscovery(found, tokens)) || sawLegacy !== legacy;
    if (found) tokens = found;
    legacy = sawLegacy;
    if (changed) {
      render();
      if (found) writeLocal({ tokens: found });
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
    if (key !== lastStatus && rules.length) {
      lastStatus = key;
      writeLocal({ status: { ...status, at: Date.now() } });
    }
  } catch (err) {
    console.debug("[ChatGPT Accents] discovery skipped:", err);
  }
}

let timer = 0;
function scheduleRediscover(delay = 60) {
  clearTimeout(timer);
  timer = setTimeout(rediscover, delay);
}

async function start() {
  const [{ settings: s }, cached] = await Promise.all([loadState(), readLocal(["tokens"])]);
  settings = s;
  tokens = cached.tokens || null;
  render();

  // Stylesheet <link>s fire "load" (non-bubbling, so listen in capture phase).
  document.addEventListener("load", (e) => {
    if (e.target?.tagName === "LINK" || e.target?.tagName === "STYLE") scheduleRediscover();
  }, true);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => scheduleRediscover(0), { once: true });
  else scheduleRediscover(0);
  window.addEventListener("load", () => { scheduleRediscover(0); setTimeout(render, 3000); }, { once: true });
  // SPA navigations can load route stylesheets and occasionally rebuild <head>.
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { render(); scheduleRediscover(); } });

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
