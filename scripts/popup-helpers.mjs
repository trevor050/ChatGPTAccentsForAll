// Helpers for driving the popup from Playwright scripts.

/** Click a theme in the popup, switching to its group tab first (only one group is shown at a time). */
export async function pickTheme(popup, id) {
  await popup.evaluate((themeId) => {
    const item = document.querySelector(`.theme[data-id="${themeId}"]`);
    const tab = item && document.getElementById(item.closest("[role=tabpanel]").getAttribute("aria-labelledby"));
    tab?.click();
  }, id);
  await popup.locator(`.theme[data-id="${id}"]`).click();
}
