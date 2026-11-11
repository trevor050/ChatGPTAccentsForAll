import { describe, expect, it } from "vitest";
import { browserName, formatDiagnostics } from "../src/popup/diagnostics.js";

const status = {
  ok: false, reason: "no-effect", shell: "signed-in", legacy: true, appVars: 41, appRoles: { send: 1, bubble: 3 },
  accentTokens: 0, neutralTokens: 0, rules: 456, build: "54e1c8b554b8f3fe", at: 1000,
  overridden: ["--color-background-user-message", "--color-background-composer-primary", "--app-color-border"],
  effect: { state: "fail", roles: { send: "fail" }, checked: 2, probes: 9, vars: { "--color-background-composer-primary": "ours" },
    mismatches: [{ role: "send", name: "--color-background-composer-primary", selector: ".bg-composer-primary", prop: "background-color", actual: "rgb(96, 106, 204)", light: "#d97706", dark: "#d97706" }] },
  page: { "data-theme": "dark", "data-appearance-preset": "linear", "data-theme-user-id": "user-abc", "data-theme-account-id": "1234", chatgptThemeClass: false, colorScheme: "dark" },
};

describe("diagnostics", () => {
  const text = formatDiagnostics({ version: "2.0.0", ua: "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/142.0.0.0 Safari/537.36", settings: { enabled: true, theme: "yellow", surface: { kind: "default" } }, status, source: "active-tab", now: 5000 });
  it("reports what was found, overridden and whether it took effect", () => {
    expect(text).toMatch(/ChatGPT Accents 2\.0\.0 diagnostics/);
    expect(text).toMatch(/browser: Chromium-based 142/);
    expect(text).toMatch(/healthy: no \(no-effect\)/);
    expect(text).toMatch(/shell: signed-in \+ legacy names present/);
    expect(text).toMatch(/data-appearance-preset=linear/);
    expect(text).toMatch(/effect check: fail/);
    expect(text).toMatch(/miss send: \.bg-composer-primary background-color = rgb\(96, 106, 204\), wanted #d97706/);
  });
  it("never includes account or user identifiers, even if the status carried them", () => {
    expect(text).not.toMatch(/user-abc|1234|account|user-id/);
  });
  it("says which tab the status came from", () => {
    const stored = formatDiagnostics({ version: "2.0.0", status, source: "stored", now: 61000 });
    expect(stored).toMatch(/last ChatGPT tab, not this one \(60s ago\)/);
    expect(formatDiagnostics({ version: "2.0.0" })).toMatch(/none yet/);
  });
  it("omits values that do not look like style data", () => {
    const odd = formatDiagnostics({ version: "2.0.0", status: { ...status, shell: "name@example.com\nsecret" }, source: "active-tab" });
    expect(odd).toMatch(/shell: \[omitted\]/);
  });
  it("names browsers by family and major version only", () => {
    expect(browserName("Mozilla/5.0 Firefox/140.0")).toBe("Firefox 140");
    expect(browserName("")).toBe("unknown");
  });
});
