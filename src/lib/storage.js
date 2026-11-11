// Thin promise wrapper over extension storage, shared by the content script and popup.
//
// Keys
//   sync.settings  v2 settings (source of truth, follows the browser profile)
//   sync.saved     saved favourites
//   local.live     copy of settings written on every popup change, so open
//                  ChatGPT tabs repaint instantly without hitting sync quotas
//   local.tokens   last token discovery; validated against current CSS before applying
//   local.status   what the last ChatGPT tab found, shown in the popup if broken
import { migrate, normalizeSettings } from "./settings.js";

// `chrome.*` with callbacks works in Chromium and Firefox alike (Firefox aliases it).
export const ext = globalThis.chrome ?? globalThis.browser;

const get = (area, keys) => new Promise((resolve) => ext.storage[area].get(keys, (v) => resolve(v || {})));
const set = (area, items) => new Promise((resolve) => ext.storage[area].set(items, () => resolve()));
const remove = (area, keys) => new Promise((resolve) => ext.storage[area].remove(keys, () => resolve()));

/** Newest of two settings objects (by updatedAt). */
export const newest = (a, b) => ((b?.updatedAt ?? 0) > (a?.updatedAt ?? 0) ? b : a);

/** Read settings + saved list, migrating v1 data on the way. */
export async function loadState() {
  const [sync, local] = await Promise.all([
    get("sync", ["settings", "saved", "themeVars", "savedThemes"]),
    get("local", ["live"]),
  ]);
  const m = migrate(sync);
  if (m.migrated) await set("sync", { settings: m.settings, saved: m.saved });
  if (m.removeKeys.length) await remove("sync", m.removeKeys);
  const live = local.live ? normalizeSettings(local.live) : null;
  return { settings: newest(m.settings, live), saved: m.saved };
}

export const writeLive = (settings) => set("local", { live: settings });
export const writeSettings = (settings) => set("sync", { settings });
export const writeSaved = (saved) => set("sync", { saved });
export const readLocal = (keys) => get("local", keys);
export const writeLocal = (items) => set("local", items);
