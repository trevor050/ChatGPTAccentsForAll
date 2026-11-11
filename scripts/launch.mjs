// Shared Chromium launcher for the browser scripts.
//
// Default: Playwright's bundled Chromium, a fresh profile in the repo, and the
// extension loaded with --load-extension.
//
// ACCENTS_BROWSER=<path to chrome.exe / msedge.exe / any Chromium executable>
//   Runs an installed browser instead. Branded Google Chrome ignores
//   --load-extension since Chrome 137, so the extension is loaded over the
//   DevTools pipe with Extensions.loadUnpacked (needs
//   --enable-unsafe-extension-debugging) and uninstalled again on close.
// ACCENTS_TEST_PROFILE=<dir>
//   Reuses that profile directory for every run instead of creating and deleting
//   one per script. Useful on Windows machines driven remotely, where starting
//   Chromium on a brand-new profile without the user's credentials (for example
//   over SSH) can be logged as a failed sign-in for the account.
import { chromium } from "playwright";
import { unpackedExtensionId } from "./extension-id.mjs";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

// fresh: false keeps an extension already installed at extDir (and its storage), for upgrades.
export async function launchWithExtension(extDir, { profileName, headless = false, viewport, deviceScaleFactor, fresh = true } = {}) {
  extDir = fs.realpathSync(extDir);
  const browserPath = process.env.ACCENTS_BROWSER || null;
  const keepProfile = Boolean(process.env.ACCENTS_TEST_PROFILE);
  const profile = keepProfile ? path.resolve(process.env.ACCENTS_TEST_PROFILE) : path.join(root, profileName);
  if (!keepProfile && fresh) fs.rmSync(profile, { recursive: true, force: true });
  fs.mkdirSync(profile, { recursive: true });

  const ignoreDefaultArgs = ["--enable-automation"];
  const args = ["--disable-blink-features=AutomationControlled"];
  if (browserPath) {
    ignoreDefaultArgs.push("--disable-extensions", "--disable-component-extensions-with-background-pages");
    args.push("--enable-unsafe-extension-debugging");
  } else {
    args.push(`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`);
  }
  const ctx = await chromium.launchPersistentContext(profile, {
    ...(browserPath ? { executablePath: browserPath } : { channel: "chromium" }),
    headless, viewport, deviceScaleFactor, ignoreDefaultArgs, args,
  });

  let extId = unpackedExtensionId(extDir);
  let cdp = null;
  if (browserPath) {
    cdp = await ctx.browser().newBrowserCDPSession();
    // A run that crashed can leave the extension (and its storage) in a reused profile.
    if (fresh) await cdp.send("Extensions.uninstall", { id: extId }).catch(() => {});
    extId = (await cdp.send("Extensions.loadUnpacked", { path: extDir })).id;
  }
  // keep: true leaves the extension and profile in place for a later launch.
  const close = async ({ keep = false } = {}) => {
    // Leave a reused profile as we found it: no extension, no extension storage.
    if (cdp && !keep) await cdp.send("Extensions.uninstall", { id: extId }).catch((e) => console.warn("uninstall:", e.message));
    await ctx.close();
    if (!keepProfile && !keep) fs.rmSync(profile, { recursive: true, force: true });
  };
  return { ctx, extId, close };
}
