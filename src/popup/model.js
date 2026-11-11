// Popup logic with no DOM in it, so it can be unit tested.
import { hexToOklch, normalizeHex } from "../lib/color.js";
import { rolesFor } from "../lib/theme.js";
import { normalizeSettings } from "../lib/settings.js";

/** What the Advanced palette shows before the user has picked anything (as in 1.x). */
export const DRAFT_DEFAULTS = Object.freeze({
  accent: "#66b5ff",
  bubbleBg: "#003f7a",
  bubbleText: "#f5faff",
  submitBg: "#0169cc",
  submitText: "#ffffff",
  link: null,
  surfaceKind: "default",
  surfaceColor: "#0f0f10",
});

/**
 * The Advanced editor's working copy of a look. Roles a look leaves to be derived
 * are filled in with what the engine derives, so the fields show what is on the page.
 */
export function draftFromSettings(settings, mode = "light") {
  if (!settings?.light) return { ...DRAFT_DEFAULTS };
  const r = settings.roles || {};
  const derived = rolesFor(mode, settings);
  const surface = settings.surface || { kind: "default" };
  return {
    accent: settings.light,
    bubbleBg: r.bubbleBg || derived.tint,
    bubbleText: r.bubbleText || derived.onTint,
    submitBg: r.submitBg || derived.submit,
    submitText: r.submitText || derived.onSubmit,
    link: r.link || null,
    surfaceKind: surface.kind,
    surfaceColor: surface.color || DRAFT_DEFAULTS.surfaceColor,
  };
}

/** Draft -> the look it describes (what settings and saved themes store). */
export function lookFromDraft(d) {
  return {
    light: normalizeHex(d.accent),
    dark: null,
    roles: {
      bubbleBg: normalizeHex(d.bubbleBg),
      bubbleText: normalizeHex(d.bubbleText),
      submitBg: normalizeHex(d.submitBg),
      submitText: normalizeHex(d.submitText),
      link: normalizeHex(d.link ?? ""),
    },
    surface: d.surfaceKind === "custom"
      ? { kind: "custom", color: normalizeHex(d.surfaceColor) }
      : { kind: d.surfaceKind, color: null },
  };
}

/** Settings used to render the live preview of a draft. */
export const previewSettings = (draft) => normalizeSettings({ enabled: true, ...lookFromDraft(draft) });

/** One sentence under the preview about what the chosen surface does in light and dark mode. */
export function surfaceNote(draft) {
  if (draft.surfaceKind === "dark") return "Deepens dark mode. Light mode keeps ChatGPT's own page.";
  if (draft.surfaceKind === "light") return "Brightens light mode. Dark mode keeps ChatGPT's own page.";
  if (draft.surfaceKind === "custom") {
    const L = hexToOklch(draft.surfaceColor)?.L ?? 0;
    return L < 0.5
      ? "Custom background: Dark. Reshapes dark mode, lightly tints light mode."
      : "Custom background: Light. Reshapes light mode, lightly tints dark mode.";
  }
  return "Using site default background";
}

/**
 * Where arrow keys move inside the two-column theme grid (a radio group).
 * Left/Right step by one and wrap, Up/Down step by a row and stop at the edge,
 * Home/End jump to the ends. Returns the new index, or null for other keys.
 */
export function nextGridIndex(key, index, count, columns = 2) {
  if (count <= 0) return null;
  switch (key) {
    case "ArrowRight": return (index + 1) % count;
    case "ArrowLeft": return (index - 1 + count) % count;
    case "ArrowDown": return index + columns < count ? index + columns : index;
    case "ArrowUp": return index - columns >= 0 ? index - columns : index;
    case "Home": return 0;
    case "End": return count - 1;
    default: return null;
  }
}

/** Same idea for the two tabs: arrows and Home/End, wrapping. */
export function nextTabIndex(key, index, count) {
  if (key === "ArrowRight") return (index + 1) % count;
  if (key === "ArrowLeft") return (index - 1 + count) % count;
  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  return null;
}
