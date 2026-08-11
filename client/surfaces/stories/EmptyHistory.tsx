// "No saved reviews".
//
// Deliberately small, dashed and left-aligned rather than a centred hero: the
// header above it already offers Start review, and this panel's job is to say
// where stories will appear, not to become the app's onboarding tutorial. Two
// `doesNotMatch` guards in the old test file existed to keep it that way.
//
// The mark is the Thread Path in its monochrome tone — `brandStoryMarkSvg()`
// was only ever `brandMarkSvg(..., 'mono')` at 30px.

import { BrandMark } from "../../shared/brand";

export function EmptyHistory() {
  return (
    // `empty` is the UI-atlas evidence selector for the empty capture
    // (scripts/capture-ui-atlas.mjs looks for `main .empty`).
    <div className="empty ds-reveal max-w-[460px] rounded-[var(--radius-island)] border border-dashed border-line bg-fill-1 p-6 text-left max-[560px]:max-w-none">
      <span className="mb-3.5 inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] border border-line bg-surface text-text-3">
        <BrandMark size={30} tone="mono" />
      </span>
      <h2 className="m-0 font-display text-[22px] font-bold tracking-[-.02em]">No saved reviews</h2>
      <p className="mt-2 mb-0 text-[14px] leading-[1.5] text-text-2">
        Start from the current diff. A guided story will appear here when you save one.
      </p>
    </div>
  );
}
