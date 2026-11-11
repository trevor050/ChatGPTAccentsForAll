// Builds dist/chrome and dist/firefox from src/. Usage: node scripts/build.mjs [--watch]
import { build, context } from "esbuild";
import fs from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const src = path.join(root, "src");
const dist = path.join(root, "dist");
const watch = process.argv.includes("--watch");

const targets = {
  chrome: (m) => ({ ...m, minimum_chrome_version: "123" }),
  firefox: (m) => ({
    ...m,
    browser_specific_settings: {
      gecko: {
        id: "chatgpt-accents-for-all@trevor050.github.io",
        strict_min_version: "140.0",
        data_collection_permissions: { required: ["none"] },
      },
      // data_collection_permissions arrived in Firefox for Android 142.
      gecko_android: { strict_min_version: "142.0" },
    },
  }),
};

const manifest = JSON.parse(await fs.readFile(path.join(src, "manifest.json"), "utf8"));
const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
if (manifest.version !== pkg.version) {
  throw new Error(`Version mismatch: src/manifest.json ${manifest.version} vs package.json ${pkg.version}`);
}

for (const [name, transform] of Object.entries(targets)) {
  const out = path.join(dist, name);
  await fs.rm(out, { recursive: true, force: true });
  await fs.mkdir(out, { recursive: true });
  await fs.writeFile(path.join(out, "manifest.json"), JSON.stringify(transform(manifest), null, 2) + "\n");
  await fs.cp(path.join(src, "icons"), path.join(out, "icons"), { recursive: true });
  for (const file of ["popup.html", "popup.css"]) await fs.cp(path.join(src, "popup", file), path.join(out, file));
  await fs.cp(path.join(src, "popup/fonts"), path.join(out, "fonts"), { recursive: true });

  const options = {
    entryPoints: { content: path.join(src, "content/index.js"), popup: path.join(src, "popup/popup.js") },
    outdir: out,
    bundle: true,
    format: "iife",
    target: ["chrome123", "firefox140"],
    legalComments: "none",
    logLevel: "warning",
  };
  if (watch) await (await context(options)).watch();
  else await build(options);
  console.log(`built dist/${name}`);
}
