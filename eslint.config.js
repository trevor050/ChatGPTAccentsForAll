import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["dist/**", "node_modules/**", ".e2e-profile/**", ".probe/**", ".directions/**"] },
  js.configs.recommended,
  {
    files: ["src/**/*.js"],
    languageOptions: { globals: { ...globals.browser, chrome: "readonly", browser: "readonly" } },
  },
  {
    files: ["scripts/**/*.mjs", "test/**/*.js", "eslint.config.js"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    // Playwright scripts pass callbacks that run inside the browser page.
    files: ["scripts/**/*.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser, chrome: "readonly" } },
  },
  {
    rules: {
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      eqeqeq: ["error", "smart"],
    },
  },
];
