// "Remove <title> from this repo?" — the confirmation in front of a delete.
//
// The vanilla page used `window.confirm()` for this question and
// `window.alert()` for the failure. `surface-inventory.md` §2.7 flags that pair
// as an accessibility gap and names the only two honest replacements: keep the
// native dialogs, or build an accessible one. Deleting optimistically is NOT on
// that list, and a story file is not recoverable from this app.
//
// This is the second option, built on the shared modal choreography the folder
// browser already uses — the same rAF-then-class entrance, the same 210 ms exit
// hold, the same `inert` + `aria-hidden` background, the same focus trap and
// focus restore. Nothing new was invented for it.
//
// Two deliberate departures from the native dialogs, both improvements the
// native ones cannot offer:
//   - focus lands on Cancel, not on the destructive action;
//   - a failed delete reports inside the dialog and leaves it open, instead of
//     an `alert()` that dismisses the context along with itself.

import { useEffect, useRef } from "react";
import { Button } from "../../vendor/beui/motion/button/base";
import { cn } from "../../shared/cn";
import { useModalChoreography } from "../../shared/use-modal";

export interface RemoveStoryDialogProps {
  /** The story queued for removal, or null when nothing is queued. */
  target: { id: string; title: string } | null;
  /** Page content to inert while the dialog is up. */
  background: React.RefObject<HTMLElement | null>;
  busy: boolean;
  /** Set when the DELETE failed; the dialog stays open and shows it. */
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RemoveStoryDialog({
  target,
  background,
  busy,
  error,
  onConfirm,
  onCancel,
}: RemoveStoryDialogProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const modal = useModalChoreography({ dialog, background, onClose: onCancel });

  // Focus waits for `is-shown`, and this is not a nicety. Between the "opening"
  // phase and the rAF that adds the class, `.ds-scrim` is still
  // `visibility: hidden` — and `focus()` on a `visibility: hidden` element is a
  // silent no-op, so focusing from `onOpen` leaves focus on <body> and the
  // reviewer has to Tab their way into a destructive dialog. `modal.shown` is
  // true only in the commit that adds the class, and this passive effect runs
  // after that commit has hit the DOM.
  useEffect(() => {
    if (modal.shown) cancel.current?.focus();
  }, [modal.shown]);

  // The queued target is the single source of truth for "is this open"; the
  // choreography is driven from it rather than the other way round, so a
  // dismissal from anywhere (Escape, scrim, Cancel) takes the same path.
  const { open, close } = modal;
  useEffect(() => {
    if (target) open();
    else close();
  }, [target, open, close]);

  // Keep the last target on screen through the 210 ms exit, or the sheet
  // renders an empty question while it fades.
  const shown = useRef(target);
  if (target) shown.current = target;
  const story = target ?? shown.current;

  return (
    <div
      className={cn("ds-scrim", modal.shown && "is-shown")}
      hidden={!modal.mounted}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="remove-story-title"
        aria-describedby="remove-story-body"
        tabIndex={-1}
        className={cn(
          "ds-sheet w-[min(420px,100%)] rounded-[var(--radius-island)] border border-line-soft bg-surface-3 p-5",
          "shadow-signal outline-none contrast-more:border-text",
        )}
      >
        <h2
          id="remove-story-title"
          className="m-0 font-display text-lg leading-[1.15] font-semibold tracking-[-.012em]"
        >
          Remove this review?
        </h2>
        <p id="remove-story-body" className="mt-2 mb-0 text-[13.5px] leading-[1.45] text-text-2">
          Remove “{story?.title ?? ""}” from this repo? The story file is deleted; the code and any
          comments you left stay where they are.
        </p>

        {/* Assertive, because it answers an action the reviewer just took and
            the buttons below it have already come back to life. */}
        <p
          className={cn("mt-2.5 mb-0 text-[12.5px] leading-[1.45] text-del", !error && "hidden")}
          role="alert"
        >
          {error ?? ""}
        </p>

        <div className="mt-5 flex justify-end gap-2.5">
          <Button
            ref={cancel}
            type="button"
            pressScale={0.97}
            disabled={busy}
            onClick={onCancel}
            className="h-[var(--control-h)] rounded-full bg-fill-2 px-3.5 text-[12.5px] font-semibold text-text hover:bg-fill-3 disabled:opacity-55"
          >
            Cancel
          </Button>
          <Button
            type="button"
            pressScale={0.97}
            disabled={busy}
            onClick={onConfirm}
            className="h-[var(--control-h)] rounded-full bg-del-soft px-3.5 text-[12.5px] font-semibold text-del hover:bg-del hover:text-on-accent disabled:opacity-55"
          >
            {busy ? "Removing…" : "Remove story"}
          </Button>
        </div>
      </div>
    </div>
  );
}
