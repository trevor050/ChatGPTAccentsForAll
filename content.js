// List of CSS variable keys we control
const THEME_KEYS = [
  "--text-accent",
  "--icon-accent",
  "--link",
  "--link-hover",
  "--selection",
  "--interactive-bg-accent-default",
  "--interactive-bg-accent-hover",
  "--interactive-bg-accent-press",
  "--interactive-bg-accent-inactive",
  "--interactive-bg-accent-selected",
  "--interactive-bg-accent-muted-hover",
  "--interactive-bg-accent-muted-press",
  "--composer-blue-bg",
  "--composer-blue-hover",
  "--composer-blue-text",
  "--theme-user-msg-bg",
  "--theme-user-msg-text",
  "--theme-submit-btn-bg",
  "--theme-submit-btn-text",
  "--theme-secondary-btn-bg",
  "--theme-secondary-btn-text"
];

function clearThemeVars() {
  const root = document.documentElement;
  for (const key of THEME_KEYS) {
    root.style.removeProperty(key);
  }
}

function applyTheme(vars) {
  const root = document.documentElement;
  clearThemeVars();
  if (!vars) return;
  for (const [k, v] of Object.entries(vars)) {
    if (v) root.style.setProperty(k, v);
  }
}

// Initial load on page start
chrome.storage.sync.get(["themeVars"], ({ themeVars }) => applyTheme(themeVars));

// Live update on changes from popup
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync" || !("themeVars" in changes)) return;
  applyTheme(changes.themeVars.newValue);
});

// Re-apply on SPA navigations or tab focus
const reapply = () => {
  chrome.storage.sync.get(["themeVars"], ({ themeVars }) => applyTheme(themeVars));
};
window.addEventListener("visibilitychange", reapply);
window.addEventListener("focus", reapply);
window.addEventListener("pageshow", reapply); 