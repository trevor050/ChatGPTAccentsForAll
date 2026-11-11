// README screenshots of the popup itself, from the built extension, offline and headless.
// Usage: npm run build && node scripts/popup-shots.mjs [outDir]
import { launchWithExtension } from "./launch.mjs";
import { pickTheme } from "./popup-helpers.mjs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = path.resolve(process.argv[2] || path.join(root, "readme-imgs"));
const { ctx, extId, close } = await launchWithExtension(path.join(root, "dist/chrome"), {
  profileName: ".e2e-profile-shots", headless: true, viewport: { width: 360, height: 600 }, deviceScaleFactor: 2,
});
try {
  const popup = ctx.pages()[0];
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  await popup.locator("body[data-ready]").waitFor({ state: "attached" });
  await pickTheme(popup, "purple_plus");
  for (const scheme of ["light", "dark"]) {
    await popup.emulateMedia({ colorScheme: scheme });
    await popup.reload();
    await popup.locator("body[data-ready]").waitFor({ state: "attached" });
    await popup.evaluate(() => document.fonts.ready);
    const fit = async () => popup.setViewportSize({ width: 360, height: Math.min(600, Math.ceil(await popup.evaluate(() => document.body.getBoundingClientRect().height))) });
    await fit();
    await popup.screenshot({ path: path.join(out, `popup-themes-${scheme}.png`) });
    await popup.setViewportSize({ width: 360, height: 600 });
    await popup.click("#openCustomize");
    await fit();
    await popup.screenshot({ path: path.join(out, `popup-customize-${scheme}.png`) });
    console.log(`wrote popup-themes-${scheme}.png, popup-customize-${scheme}.png`);
  }
} finally {
  await close();
}
