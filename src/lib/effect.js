// Effect check: did the page actually take the colours?
//
// Finding familiar variable names proves nothing (signed-in ChatGPT still ships the
// old shell's names in a stylesheet while drawing everything from new ones). So after
// painting, the content script finds elements that ChatGPT styles with a variable we
// override (from its own CSS rules: `.bg-user-message { background-color: var(--x) }`,
// following `--a: var(--b)` aliases) and compares their computed colour with the
// colour we asked for. This module is the pure part: which elements to look at and
// how to judge what they computed.

import { deltaE, parseColor } from "./color.js";

/** Colour properties whose computed value can be compared with a variable's colour. */
export const COLOR_PROPS = new Set([
  "background-color", "background", "color", "border-color", "border-top-color", "border-bottom-color",
  "border-left-color", "border-right-color", "outline-color", "fill", "stroke", "caret-color",
  "text-decoration-color", "accent-color",
]);

/** Roles whose failure means the theme visibly did not apply. */
export const CRITICAL_ROLES = ["bubble", "send"];

const VAR_REF = /^var\(\s*(--[\w-]+)\s*(?:,[\s\S]*)?\)$/;

/** `var(--x)` / `var(--x, fallback)` -> "--x"; anything else -> null. */
export function varRef(value) {
  const m = VAR_REF.exec(String(value).trim());
  return m ? m[1] : null;
}

// Pseudo-classes that still match a resting element; anything else (:hover,
// ::before, :focus-visible) describes a state we cannot observe.
const STATIC_PSEUDO = /:(?:root|is|where|not|host)\b/g;
export function probeable(selector) {
  return !selector.replace(STATIC_PSEUDO, "").includes(":");
}

/** Follow `--a: var(--b)` aliases until reaching a variable in `targets`. */
export function resolveAlias(name, aliases, targets, maxHops = 6) {
  let cur = name;
  for (let i = 0; i <= maxHops && cur; i++) {
    if (cur in targets) return cur;
    cur = aliases[cur];
  }
  return null;
}

/**
 * Which (selector, property) pairs to probe, per overridden variable.
 *   usages   [{ selector, prop, ref }]  colour declarations that are exactly var(ref)
 *   aliases  { "--a": "--b" }           custom properties declared as exactly var(--b)
 *   expect   { name: { role, light, dark } } from css.buildPlan
 * Returns [{ selector, prop, name, role }], at most `perRole` selectors per role.
 */
export function planProbes(usages, aliases, expect, { perRole = 12 } = {}) {
  const seen = new Set();
  const count = {};
  const out = [];
  for (const u of usages) {
    const name = resolveAlias(u.ref, aliases, expect);
    if (!name) continue;
    const role = expect[name].role;
    for (const selector of splitSelectors(u.selector)) {
      if (!probeable(selector)) continue;
      const key = selector + "|" + u.prop;
      if (seen.has(key)) continue;
      seen.add(key);
      if ((count[role] = (count[role] || 0) + 1) > perRole) continue;
      out.push({ selector, prop: u.prop, name, role });
    }
  }
  return out;
}

function splitSelectors(list) {
  const out = [];
  let depth = 0, cur = "";
  for (const ch of String(list)) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (ch === "," && depth === 0) { out.push(cur.trim()); cur = ""; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Same colour, give or take rounding (computed styles are 8-bit sRGB). */
export function sameColor(actual, wanted) {
  const a = parseColor(String(actual ?? "").trim()), b = parseColor(String(wanted ?? "").trim());
  if (!a || !b) return false;
  return Math.abs(a.a - b.a) < 0.03 && deltaE({ ...a, a: 1 }, { ...b, a: 1 }) < 0.01;
}

/**
 * Judge what the probed elements computed.
 *   samples [{ role, name, selector, prop, actual, base? }]: `actual` is the computed
 *           colour with our stylesheet, `base` the same element's colour with it
 *           switched off (when measured)
 *   expect  { name: { role, light, dark } }
 * A sample counts for its role when our stylesheet changed it, to the intended colour
 * or (through some other override) to anything else. It counts against when nothing
 * changed although we asked for a different colour. When our colour happens to be
 * ChatGPT's own (white text on a button), the sample proves nothing and is ignored.
 * Returns { state, roles, checked, mismatches }:
 *   state "empty"    nothing on the page shows an overridden variable (yet)
 *         "fail"     elements use them, but none took our colours: no visible effect
 *         "partial"  some roles took the colours, a critical one (bubble, send) did not
 *         "pass"     everything checked took our colours (or only minor roles missed)
 *   roles { role: "pass" | "fail" }
 */
export function judgeEffect(samples, expect) {
  const roles = {};
  const mismatches = [];
  let checked = 0;
  for (const s of samples) {
    const want = expect[s.name];
    if (!want) continue;
    const wanted = sameColor(s.actual, want.light) || sameColor(s.actual, want.dark);
    let ok;
    if (s.base === undefined) ok = wanted;
    else if (!sameColor(s.actual, s.base)) ok = true; // our stylesheet changed it
    else if (wanted) continue; // ours equals theirs: proves nothing either way
    else ok = false;
    checked++;
    if (ok) roles[s.role] = "pass";
    else {
      if (roles[s.role] !== "pass") roles[s.role] = "fail";
      if (mismatches.length < 6) mismatches.push({ role: s.role, name: s.name, selector: s.selector, prop: s.prop, actual: s.actual, light: want.light, dark: want.dark });
    }
  }
  const values = Object.values(roles);
  let state;
  if (!values.length) state = "empty";
  else if (!values.includes("pass")) state = "fail";
  else if (CRITICAL_ROLES.some((r) => roles[r] === "fail")) state = "partial";
  else state = "pass";
  return { state, roles, checked, mismatches: state === "pass" ? [] : mismatches.filter((m) => roles[m.role] === "fail") };
}
