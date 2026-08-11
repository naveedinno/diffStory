// The seam between the review engine and the React progress surface.
//
// `src/progress-ui.ts` used to define two browser globals — `ProgressPanel` and
// `runProgress` — from an inline script, and the review page's engine called
// `new ProgressPanel(root, opts)` twice: once for a story repair and once for a
// storyless generation. That module is gone; the panel is
// `client/surfaces/progress`, driven through the imperative bridge in
// `client/entry/progress.tsx`.
//
// This adapter exists so the engine keeps its two call sites and its two
// behaviours intact rather than being restructured around React state:
//
//   * `showFoot(node)` still takes a real DOM node. The engine builds recovery
//     buttons with live `onclick` closures over `startRun` / `restoreForm` /
//     `loadCodexStoryModels`; re-expressing those as props would have meant
//     lifting the whole generator state machine into React. `AdoptNode` renders
//     an empty div and appends the node the engine built, so the closures — and
//     the delegated `[data-reload-diff]` handler on the "Reload story" button —
//     keep working untouched.
//   * `els.close` is still reachable. The generator hides the panel's Close
//     button while a recovery footer is up, because closing mid-recovery would
//     strand the reviewer with no story and no explanation.
//
//     That one is implemented as a class on OUR host element rather than by
//     setting `hidden` on the panel's own button: the recovery path hides Close
//     and *then* installs the footer, and the footer's `setFoot` re-renders the
//     panel — a direct DOM poke would be wiped on the very next commit. A rule
//     in `review.css` keyed on `.ds-pp-noclose` survives every re-render, and
//     needs nothing from the progress surface.
//
// The one real difference: a run mounts a FRESH React root each time, into a
// fresh child of the host container. `createRoot()` refuses to run twice on one
// container, and the vanilla code constructed a new panel per run.

import { useEffect, useRef } from "react";
import { mountProgressPanel, type ProgressHostHandle } from "../../../entry/progress";
import { runProgress as runProgressStream } from "../../progress";
import type { ProgressError, ProgressVariant } from "../../progress";
import type { RunStatus } from "../../../../src/progress";

/** Renders a DOM node the caller already built, and hands it back on unmount. */
function AdoptNode({ node }: { node: Node }) {
  const slot = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const host = slot.current;
    if (!host) return;
    host.appendChild(node);
    return () => {
      if (node.parentNode === host) host.removeChild(node);
    };
  }, [node]);
  return <div ref={slot} className="contents" />;
}

export interface EnginePanelOptions {
  onStop?: () => void;
  onClose?: () => void;
  onDone?: (status: RunStatus, result: Record<string, unknown>) => void;
  onBlocked?: (error: ProgressError) => void;
}

/** The subset of the vanilla `ProgressPanel` instance the engine actually used. */
export interface EnginePanel {
  start(): void;
  handle(event: unknown): void;
  finish(status: RunStatus, result?: Record<string, unknown>): void;
  blocked(error?: ProgressError): void;
  close(): void;
  error(): ProgressError | null;
  showFoot(node: Node | null): void;
  /** `els.close` exposes only `hidden`, which is all the engine ever set. */
  readonly els: { readonly close: { hidden: boolean } };
}

let live: { handle: ProgressHostHandle; mount: HTMLElement } | null = null;

/**
 * Mount a progress panel into the engine's host container.
 *
 * `root` is `#ds-agentpanel`. Its `data-variant` attribute is read once, so
 * `mountPanelInStage()` — which stamps `stage` before constructing the panel —
 * still decides the placement.
 */
export function mountEnginePanel(root: HTMLElement, options: EnginePanelOptions = {}): EnginePanel {
  if (live) {
    live.handle.unmount();
    live.mount.remove();
    live = null;
  }
  const mount = document.createElement("div");
  root.appendChild(mount);
  const variant = (root.getAttribute("data-variant") as ProgressVariant | null) ?? "floating";
  const handle = mountProgressPanel(mount, { ...options, variant });
  live = { handle, mount };

  return {
    start: handle.start,
    handle: handle.handle as EnginePanel["handle"],
    finish: handle.finish,
    blocked: handle.blocked,
    close: handle.close,
    error: handle.error,
    showFoot(node: Node | null) {
      handle.setFoot(node ? <AdoptNode node={node} /> : null);
    },
    els: {
      // A stand-in for the vanilla `els.close` DOM node that exposes only the
      // one property the engine set on it. See the note at the top of the file.
      get close() {
        return {
          get hidden() {
            return mount.classList.contains("ds-pp-noclose");
          },
          set hidden(on: boolean) {
            mount.classList.toggle("ds-pp-noclose", !!on);
          },
        };
      },
    },
  };
}

/**
 * The vanilla `runProgress(panel, url, payload, controller)`.
 *
 * The React pump takes an `AbortSignal`; the engine holds an `AbortController`
 * so its Stop button can abort. Unwrapping it here keeps both call sites as
 * they were written.
 */
export function runProgress(
  panel: EnginePanel,
  url: string,
  payload: unknown,
  controller?: AbortController | null,
): Promise<void> {
  return runProgressStream(panel, url, payload, controller?.signal);
}

export { progressPrimaryActionClass, progressSecondaryActionClass } from "../../progress";
