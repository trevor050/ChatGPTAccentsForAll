// Content script for chatgpt.com. Runs at document_start.
//
// 0. Synchronously re-apply the last stylesheet when ChatGPT's build is unchanged,
//    so the first paint already has the user's colours.
// 1. Validate it against this page's loaded stylesheets.
// 2. As ChatGPT's stylesheets load (or its theme block is rewritten), rediscover
//    tokens from the live CSS and repaint if anything moved. Two shells are known:
//    logged-out (StyleX, hashed names: discover.js) and signed-in (semantic names
//    in a data-theme keyed theme block: appshell.js).
// 3. Effect check: after painting, confirm that elements ChatGPT styles with the
//    overridden variables really computed to our colours. If nothing did, take the
//    overrides off and report "paused" (familiar names alone prove nothing).
// 4. Repaint whenever settings change (popup edits arrive via storage.local).
// Every step is wrapped so a ChatGPT redesign degrades to "no colours", never
// to a broken page.
import { COMPONENT_VARS, discoverAppShell } from "../lib/appshell.js";
import { buildPlan } from "../lib/css.js";
import { discoverTokens, sameDiscovery } from "../lib/discover.js";
import { COLOR_PROPS, judgeEffect, planProbes, sameColor, varRef } from "../lib/effect.js";
import { normalizeSettings } from "../lib/settings.js";
import { ext, loadState, newest, readLocal, writeLocal } from "../lib/storage.js";

const STYLE_ID = "chatgpt-accents-for-all";
const THEME_OR_ROOT = /:root|^\.([\w-]+)\.\1|\[data-theme|\[data-appearance|^html\b/;
const LEGACY_PROBES = ["--interactive-bg-accent-default", "--theme-user-msg-bg"];
// chatgpt.com's own localStorage is the only storage a content script can read
// synchronously at document_start; extension storage answers after the page may
// already have painted. It holds the last stylesheet painted for this build: { build, css }.
const PAINT_CACHE = "chatgpt-accents-for-all:paint";
// Page attributes worth reporting in diagnostics. Never account or user ids.
const REPORTED_ATTRS = ["data-theme", "data-appearance-mode", "data-appearance-preset", "data-window-type", "data-codex-window-type", "data-codex-window-chrome"];
// When to look at the page after painting (ms). An empty page (nothing on it uses
// our variables yet) is retried; the last attempt decides.
const EFFECT_DELAYS = [700, 2500, 7000];

let settings = null;
let tokens = null; // only ever a map discovered from this page's current CSS
let app = null; // signed-in shell discovery, same rule
let cachedTokens = null; // last stored discovery, compared to avoid rewriting it
let legacy = false;
let ruleCount = 0;
let lastCss = null;
let plan = { css: "", expect: {} };
let effect = null; // last effect check verdict for `lastCss`
let pausedCss = null; // a stylesheet that was painted and had no effect

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
    const next = settings ? buildPlan(tokens, settings, { legacy, app }) : { css: "", expect: {} };
    const changed = next.css !== plan.css;
    plan = next;
    if (next.css && next.css === pausedCss) {
      // Painted before and nothing on the page took it: stay off.
      paint("");
      writePaintCache("");
      return;
    }
    paint(next.css);
    writePaintCache(next.css);
    if (changed) {
      effect = next.css ? { state: "pending" } : null;
      if (next.css) scheduleEffectCheck(true);
      publishStatus();
    }
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
      const scope = THEME_OR_ROOT.test(sel);
      const decls = {};
      for (let i = 0; i < style.length; i++) {
        const name = style.item(i);
        // Outside theme scopes, only components that re-declare bubble/send variables matter.
        if (name.startsWith("--") && (scope || COMPONENT_VARS.test(name))) decls[name] = style.getPropertyValue(name).trim();
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

/**
 * Every colour declaration that is exactly `var(--x)`, and every custom property
 * that is exactly an alias of another: where on the page our variables show up.
 */
function readUsages() {
  const usages = [], aliases = {};
  const walk = (list) => {
    for (const rule of list) {
      if (rule.cssRules && !rule.selectorText) { walk(rule.cssRules); continue; }
      const sel = rule.selectorText, style = rule.style;
      if (!sel || !style || !style.length) continue;
      for (let i = 0; i < style.length; i++) {
        const name = style.item(i);
        if (name.startsWith("--")) {
          const ref = varRef(style.getPropertyValue(name));
          if (ref && !(name in aliases)) aliases[name] = ref;
        } else if (COLOR_PROPS.has(name)) {
          const ref = varRef(style.getPropertyValue(name));
          if (ref) usages.push({ selector: sel, prop: name, ref });
        }
      }
      // Shorthands do not show up in item(); their longhands read "" when set via var().
      for (const [short, prop] of [["background", "background-color"], ["border-color", "border-top-color"]]) {
        const ref = varRef(style.getPropertyValue(short));
        if (ref) usages.push({ selector: sel, prop, ref });
      }
    }
  };
  for (const sheet of document.styleSheets) {
    if (sheet.ownerNode?.id === STYLE_ID) continue;
    let list;
    try { list = sheet.cssRules; } catch { continue; }
    walk(list);
  }
  return { usages, aliases };
}

/** Probe the page: which overridden variables actually reached an element? */
function measureEffect(expect) {
  const { usages, aliases } = readUsages();
  const probes = planProbes(usages, aliases, expect, { perRole: 80 });
  const targets = [];
  const found = {};
  for (const p of probes) {
    if ((found[p.role] || 0) >= 4) continue;
    let els;
    try { els = document.querySelectorAll(p.selector); } catch { continue; }
    for (let i = 0; i < Math.min(els.length, 2); i++) {
      targets.push({ p, el: els[i] });
      found[p.role] = (found[p.role] || 0) + 1;
    }
  }
  const read = () => targets.map(({ p, el }) => getComputedStyle(el).getPropertyValue(p.prop).trim());
  const actual = read();
  // The same elements without our stylesheet. Switched off and on within this
  // task, so the page never paints the stock colours.
  let base = null;
  const sheet = document.getElementById(STYLE_ID)?.sheet;
  if (sheet) {
    try { sheet.disabled = true; base = read(); } finally { sheet.disabled = false; }
  }
  const samples = targets.map(({ p }, i) => ({ ...p, actual: actual[i], ...(base ? { base: base[i] } : {}) }));
  const verdict = judgeEffect(samples, expect);
  // Diagnostics: do the key variables themselves hold our value at <html>?
  const vars = {};
  try {
    const cs = getComputedStyle(document.documentElement);
    for (const [name, want] of Object.entries(expect)) {
      if (!["bubble", "send", "bubbleText", "sendText"].includes(want.role)) continue;
      const v = cs.getPropertyValue(name).trim();
      vars[name] = !v ? "unset" : sameColor(v, want.light) || sameColor(v, want.dark) || v.includes(want.light) ? "ours" : "theirs";
    }
  } catch { /* diagnostics only */ }
  return { ...verdict, vars, probes: probes.length };
}

let effectTimer = 0, effectAttempt = 0;
function scheduleEffectCheck(restart) {
  if (restart) effectAttempt = 0;
  clearTimeout(effectTimer);
  effectTimer = setTimeout(runEffectCheck, EFFECT_DELAYS[Math.min(effectAttempt, EFFECT_DELAYS.length - 1)]);
}

function runEffectCheck() {
  try {
    if (!lastCss || !plan.css || lastCss !== plan.css) return;
    if (document.readyState !== "complete") { scheduleEffectCheck(false); return; }
    const result = measureEffect(plan.expect);
    effectAttempt++;
    if (result.state === "pass" || result.state === "partial") {
      effect = result;
    } else if (result.state === "empty" && effect?.state === "pass") {
      // Seen working on this page already; a route without those elements changes nothing.
    } else if (effectAttempt < EFFECT_DELAYS.length) {
      effect = { ...result, state: "pending" };
      scheduleEffectCheck(false);
    } else {
      // Painted, waited, and nothing on the page took the colours: take them off.
      effect = result;
      pausedCss = lastCss;
      paint("");
      writePaintCache("");
    }
    publishStatus();
  } catch (err) {
    console.debug("[ChatGPT Accents] effect check skipped:", err);
  }
}

/** The <html> attributes that select ChatGPT's appearance preset (for discovery). */
function themeAttributes() {
  const html = document.documentElement;
  if (!html?.getAttribute) return null;
  const out = {};
  for (const name of ["data-appearance-preset", "data-codex-window-type", "data-window-type"]) {
    const v = html.getAttribute(name);
    if (v != null) out[name] = v;
  }
  out.chatgptThemeClass = Boolean(html.classList?.contains("chatgpt-theme"));
  return out;
}

function pageAttributes() {
  const html = document.documentElement;
  const out = {};
  for (const name of REPORTED_ATTRS) {
    const v = html?.getAttribute?.(name);
    if (v != null) out[name] = String(v).slice(0, 40);
  }
  const classes = html?.classList ? [...html.classList] : [];
  out.chatgptThemeClass = classes.includes("chatgpt-theme");
  if (tokens) out.styleXTheme = classes.find((c) => tokens.themeClasses.includes(c)) || null;
  try { out.colorScheme = getComputedStyle(html).colorScheme || null; } catch { /* diagnostics only */ }
  return out;
}

let lastStatus = "";
let currentStatus = null; // this tab's status, for the popup attached to this tab
function publishStatus() {
  if (!settings) return;
  const recognized = Boolean(tokens) || Boolean(app) || legacy;
  const paused = Boolean(pausedCss) && pausedCss === plan.css;
  const roleCounts = {};
  if (app) for (const v of Object.values(app.vars)) roleCounts[v.role] = (roleCounts[v.role] || 0) + 1;
  const status = {
    ok: recognized && !paused,
    reason: !recognized ? "unrecognized" : paused ? "no-effect" : effect?.state === "partial" ? "partial" : null,
    shell: app ? "signed-in" : tokens ? "logged-out" : legacy ? "legacy" : "unknown",
    accentTokens: tokens ? Object.keys(tokens.accent).length : 0,
    neutralTokens: tokens ? Object.keys(tokens.neutrals).length : 0,
    appVars: app ? Object.keys(app.vars).length : 0,
    appRoles: roleCounts,
    legacy,
    rules: ruleCount,
    build: pageBuild(),
    overridden: Object.keys(plan.expect),
    effect: effect ? { state: paused ? "fail" : effect.state, roles: effect.roles || {}, checked: effect.checked || 0, probes: effect.probes || 0, vars: effect.vars || {}, mismatches: effect.mismatches || [] } : null,
    page: pageAttributes(),
  };
  const key = JSON.stringify(status);
  if (key === lastStatus) return;
  lastStatus = key;
  currentStatus = { ...status, at: Date.now() };
  writeLocal({ status: currentStatus });
}

function rediscover() {
  try {
    const { rules, sawLegacy } = readRules();
    const found = discoverTokens(rules);
    const foundApp = discoverAppShell(rules, themeAttributes());
    // Nothing themeable has loaded yet while the document is still loading: that
    // proves nothing either way, so keep the current paint and decide later.
    if (!found && !foundApp && !sawLegacy && !rules.length && document.readyState !== "complete") return;
    // A cached map is only a candidate. Never keep styling a new site version
    // with yesterday's tokens when its current CSS no longer matches.
    tokens = found;
    app = foundApp;
    legacy = sawLegacy;
    ruleCount = rules.length;
    if (!settings) {
      // Extension storage has not answered yet. If this page's CSS already
      // rejects the map, drop the early paint now rather than after the read.
      if (!found && !foundApp && !sawLegacy) { paint(""); writePaintCache(""); }
      return;
    }
    render();
    if (!sameDiscovery(found, cachedTokens)) {
      cachedTokens = found;
      writeLocal({ tokens: found });
    }
    publishStatus();
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

/** A previously paused stylesheet gets another try (new route, tab shown again). */
function retryPaused() {
  if (!pausedCss) return;
  pausedCss = null;
  plan = { css: "", expect: {} };
  render();
}

/**
 * Signed-in ChatGPT rewrites its inline theme block (`<style data-codex-app-themes>`)
 * when the appearance preset or mode changes, without a load event; and it flips
 * `<html data-theme>` for light/dark. Watch both, cheaply.
 */
function watchThemeChanges() {
  if (typeof MutationObserver !== "function") return;
  const isStyleNode = (n) => n && (n.nodeName === "STYLE" || n.nodeName === "LINK");
  const headObserver = new MutationObserver((records) => {
    for (const r of records) {
      const target = r.target?.nodeType === 3 ? r.target.parentNode : r.target;
      if (target?.id === STYLE_ID) continue;
      if (isStyleNode(target) || [...(r.addedNodes || [])].some((n) => isStyleNode(n) && n.id !== STYLE_ID) || [...(r.removedNodes || [])].some((n) => isStyleNode(n) && n.id !== STYLE_ID)) {
        rediscoverBeforePaint();
        return;
      }
    }
  });
  let watchedHead = null;
  const attachHead = () => {
    if (!document.head || document.head === watchedHead) return;
    watchedHead = document.head;
    headObserver.observe(document.head, { childList: true, subtree: true, characterData: true });
  };
  attachHead();
  const root = document.documentElement;
  if (!root) return;
  new MutationObserver((records) => {
    if (records.some((r) => r.type === "childList")) attachHead();
    if (records.some((r) => r.type === "attributes")) {
      // Light/dark or preset switched: rediscover (presets scope their rules by
      // attribute) and look again at what the page shows.
      rediscoverBeforePaint();
      if (plan.css && !pausedCss) scheduleEffectCheck(true);
      publishStatus();
    }
  }).observe(root, { childList: true, attributes: true, attributeFilter: ["data-theme", "data-appearance-mode", "data-appearance-preset", "class"] });
}

async function start() {
  // Same build as the last validated paint: apply it before the first frame.
  // The CSS below re-validates it and removes it if this page disagrees.
  try {
    const early = readPaintCache();
    if (early) {
      paint(early);
      // When it landed, for checking it beat ChatGPT's first paint (diagnostics only).
      document.getElementById(STYLE_ID)?.setAttribute?.("data-early", String(Math.round(globalThis.performance?.now?.() ?? 0)));
    }
  } catch { /* never block the page */ }

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
  try { watchThemeChanges(); } catch { /* optional */ }

  const [{ settings: s }, cached] = await Promise.all([loadState(), readLocal(["tokens"])]);
  settings = s;
  cachedTokens = cached.tokens || null;
  // Reading extension storage is asynchronous, so styles may already be ready.
  rediscover();
  rediscoverBeforePaint();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => { rediscover(); rediscoverBeforePaint(); }, { once: true });
  window.addEventListener("load", () => { rediscover(); rediscoverBeforePaint(); setTimeout(render, 3000); }, { once: true });
  // SPA navigations can load route stylesheets and occasionally rebuild <head>.
  document.addEventListener("visibilitychange", () => { if (!document.hidden) { retryPaused(); rediscover(); rediscoverBeforePaint(); } });
  // A paused stylesheet may have had nothing to act on (a page without a composer);
  // try again after an in-app navigation.
  if (typeof setInterval === "function" && typeof location !== "undefined") {
    let href = location.href;
    setInterval(() => { if (location.href !== href) { href = location.href; retryPaused(); } }, 1500);
  }

  // The toolbar popup asks the active tab directly, so its warning describes the
  // ChatGPT tab it is attached to rather than whichever tab wrote storage last.
  ext.runtime?.onMessage?.addListener((msg, _sender, reply) => {
    if (msg?.type !== "chatgpt-accents:status") return;
    reply({ status: currentStatus });
  });

  ext.storage.onChanged.addListener((changes, area) => {
    const next = area === "local" ? changes.live?.newValue : area === "sync" ? changes.settings?.newValue : null;
    if (!next) return;
    // The popup writes the same settings to local (instantly) and sync (debounced);
    // whichever is newer wins, so a late sync echo never undoes a newer live edit.
    const incoming = normalizeSettings(next);
    if (newest(settings, incoming) !== incoming && incoming.updatedAt !== settings?.updatedAt) return;
    settings = incoming;
    render();
    publishStatus();
  });
}

start().catch((err) => console.debug("[ChatGPT Accents] failed to start:", err));
