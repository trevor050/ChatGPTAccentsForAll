// Live check of the Firefox build in stock Firefox via geckodriver (brew install geckodriver).
// Installs dist/firefox as a temporary add-on, sets a colour through the real popup page,
// and checks chatgpt.com picks it up and keeps it across a reload.
// Usage: npm run zip && node scripts/e2e-firefox.mjs [--shots dir]
import { Builder, By } from "selenium-webdriver";
import { Command } from "selenium-webdriver/lib/command.js";
import firefox from "selenium-webdriver/firefox.js";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const { version } = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const xpi = path.join(root, `dist/chatgpt-accents-firefox-${version}.zip`);
const shotsArg = process.argv.indexOf("--shots");
const shots = shotsArg > 0 ? path.resolve(process.argv[shotsArg + 1]) : null;
const ADDON_ID = "chatgpt-accents-for-all@trevor050.github.io";
// Let Selenium locate the installed Firefox on Windows/Linux. A macOS app
// bundle path is not a valid fallback on either of those platforms.
const binary = process.env.FIREFOX_BIN || (process.platform === "darwin" ? "/Applications/Firefox.app/Contents/MacOS/firefox" : null);

const options = new firefox.Options()
  .windowSize({ width: 1280, height: 860 });
if (binary) options.setBinary(binary);
// Reuse an explicitly selected test profile without copying or deleting it.
if (process.env.ACCENTS_TEST_PROFILE) {
  const profile = path.resolve(process.env.ACCENTS_TEST_PROFILE);
  fs.mkdirSync(profile, { recursive: true });
  options.addArguments("-profile", profile);
}
// geckodriver must be told to allow chrome-context scripts (used to open the popup page).
const service = new firefox.ServiceBuilder().addArguments("--allow-system-access");
const driver = await new Builder().forBrowser("firefox").setFirefoxOptions(options).setFirefoxService(service).build();
const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? "  " + detail : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  // This driver runs on this machine. Keep the original package as its backing
  // file: Selenium's Base64 path can leave Windows Firefox pointing at an
  // already-deleted addon-test-*.xpi, so none of the extension resources load.
  await driver.execute(new Command("install addon").setParameter("path", xpi).setParameter("temporary", true));
  await driver.setContext(firefox.Context.CHROME);
  const uuid = await driver.executeScript("return WebExtensionPolicy.getByID(arguments[0]).mozExtensionHostname;", ADDON_ID);
  await driver.setContext(firefox.Context.CONTENT);
  await driver.get("https://chatgpt.com/");
  await sleep(9000);
  const title = await driver.getTitle();
  check("chatgpt.com loaded", !/just a moment/i.test(title), title);
  const chatHandle = await driver.getWindowHandle();

  // WebDriver refuses to navigate to moz-extension:// URLs, so open the popup page
  // as a tab from Firefox's privileged (chrome) context.
  const before = new Set(await driver.getAllWindowHandles());
  await driver.setContext(firefox.Context.CHROME);
  await driver.executeScript(`gBrowser.selectedTab = gBrowser.addTab(arguments[0], { triggeringPrincipal: Services.scriptSecurityManager.getSystemPrincipal() });`, `moz-extension://${uuid}/popup.html`);
  await driver.setContext(firefox.Context.CONTENT);
  await sleep(1000);
  const popupTab = (await driver.getAllWindowHandles()).find((h) => !before.has(h));
  await driver.switchTo().window(popupTab);
  await driver.wait(() => driver.executeScript("return Boolean(document.title && document.body?.children.length);"), 10_000,
    "Firefox did not load the extension resource document; inspect the browser console and package path.");
  const status = await driver.executeAsyncScript("const done = arguments[0]; chrome.storage.local.get(['status', 'tokens'], done);");
  check("discovery found accent tokens", status.status?.accentTokens > 5, JSON.stringify(status.status));
  const t = status.tokens;
  const fillVar = Object.entries(t.accent).find(([, v]) => v.kind === "color" && v.light === t.referenceFill && v.dark === t.referenceFill)?.[0];

  // Advanced tab: type the send-button colour into its hex field (Firefox closes the popup for
  // the native picker, so the field is the control there), then Apply.
  await driver.findElement(By.id("seg-advanced")).click();
  await sleep(400);
  const hex = await driver.findElement(By.id("submitBgHex"));
  await hex.click();
  await driver.executeScript("arguments[0].select();", hex); // select all, then type over it
  await hex.sendKeys("#7c3aed");
  await driver.findElement(By.id("save")).click();
  await sleep(1200);
  if (shots) fs.writeFileSync(path.join(shots, "firefox-popup.png"), await driver.takeScreenshot(), "base64");
  const popupHandle = await driver.getWindowHandle();

  await driver.switchTo().window(chatHandle);
  const read = () => driver.executeScript(`return getComputedStyle(document.documentElement).getPropertyValue(${JSON.stringify(fillVar)}).trim();`);
  const isOurs = (v) => /^#7c3aed$|^light-dark\(#7c3aed,/i.test(v);
  check("popup Apply recolours the live page", isOurs(await read()), await read());
  await driver.navigate().refresh();
  await sleep(6000);
  check("colour persists across reload", isOurs(await read()), await read());
  if (shots) fs.writeFileSync(path.join(shots, "firefox-page.png"), await driver.takeScreenshot(), "base64");

  await driver.switchTo().window(popupHandle);
  const stored = await driver.executeAsyncScript("const done = arguments[0]; chrome.storage.sync.get(['settings'], done);");
  check("settings saved to storage.sync", stored.settings?.roles?.submitBg === "#7c3aed", JSON.stringify(stored.settings));
} finally {
  await driver.quit();
}
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
