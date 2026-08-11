// Silence a vendored component's baked-in live region.
//
// Twenty of the 113 vendored beUI components ship their own `aria-live`,
// `role="status"`, `role="log"` or `role="alert"` — see the table in
// `client/vendor/beui/README.md`. That is reasonable for a chat UI and wrong
// here: a live region on a diff viewport announces the entire body on every
// lazy load, context expansion and split<->unified toggle, and `todo-list`
// re-reads a whole plan on every update.
//
// The rule this file exists to enforce is "wrap, never edit the vendored
// source". Editing `client/vendor/beui/**` would work until the next re-vendor
// silently undid it, and `test/vendor-beui.test.mjs` would not catch that
// because it asserts the vendored files still DO carry their markers.
//
// Most of those components hardcode the attribute in their own JSX, so there is
// no prop to pass. Hence a DOM pass: React writes the attribute during commit,
// and this strips it in the layout effect immediately after, before paint and
// before any assistive technology reads the tree. It deliberately runs on every
// render with no dependency array — a re-render re-applies the component's own
// JSX, so a one-shot effect would silence it once and let it come back.

import { useLayoutEffect, type RefObject } from "react";

/** Everything that makes a node speak on change. */
const LIVE_SELECTOR = '[aria-live], [role="status"], [role="log"], [role="alert"]';

export interface QuietOptions {
  /**
   * Descendants matching this selector keep their live region. Use it when the
   * surface wants exactly one announcer of its own inside a wrapped component,
   * rather than none.
   */
  keep?: string;
}

/**
 * Strip live-region semantics from everything inside `ref`.
 *
 * `aria-live` is set to `off` rather than removed: an explicit `off` also
 * neutralises an implicit live region inherited from a `role`, and it survives
 * being read back in a test as a positive assertion rather than an absence.
 * The `role` is removed only when it is purely announcement-carrying — a
 * `role="alert"` node has no other semantics worth keeping, whereas we never
 * touch roles like `menuitem` that mean something structural.
 */
export function useQuietSubtree(ref: RefObject<HTMLElement | null>, options: QuietOptions = {}): void {
  const { keep } = options;
  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const kept = keep ? new Set(root.querySelectorAll(keep)) : null;
    const nodes: Element[] = [];
    if (root.matches(LIVE_SELECTOR)) nodes.push(root);
    nodes.push(...root.querySelectorAll(LIVE_SELECTOR));
    for (const node of nodes) {
      if (kept?.has(node)) continue;
      node.setAttribute("aria-live", "off");
      const role = node.getAttribute("role");
      if (role === "status" || role === "log" || role === "alert") node.removeAttribute("role");
      // aria-atomic/aria-relevant only mean anything on a live region; leaving
      // them behind is harmless but misleading to anyone reading the DOM.
      node.removeAttribute("aria-atomic");
      node.removeAttribute("aria-relevant");
    }
  });
}
