# 011: Repair StoryView reading path, filmstrip, and labels
- Findings: A11Y-2, A11Y-5, A11Y-9, COPY-7, COPY-11, COPY-12
- Severity: HIGH
- Wave: 2 (runs after plan 010; owns StoryView.tsx plus the filmstrip key handler in the engine)
- Owned files: client/surfaces/review/StoryView.tsx, client/surfaces/review/engine/review-engine.js

## Problem
- A11Y-2: `ReadingPath` renders `<p className="ds-intro-reading" aria-label={...}>` (StoryView.tsx:116) with the visible path in `aria-hidden` spans; the label is ignored and the path hidden from assistive technology.
- A11Y-5: filmstrip nodes are plain `<button>`s in natural tab order (StoryView.tsx:655 Overview, :667 steps); the engine handles hover/scroll/tooltip only, with no arrow-key walk.
- A11Y-9 (StoryView half): `aria-label` on role-less `div.ds-intro-utility` (:232) and `div.ds-storyscope-actions` (:392). (Other halves are plans 012 and 015.)
- COPY-7 (StoryView half): drift drawer rows tagged `Story`/`Side` (StoryView.tsx:88 area). (State/ReviewApp halves are plans 013 and 024.)
- COPY-11: storyless escape always reads "Review excluded file" (:704) even for several files.
- COPY-12: CTA sub reads `{plural(filesChanged, "file")} selected` (:576), rendering "files selected, ..." until the engine rewrites it with the count.

## Target
- ReadingPath: drop `aria-label` from the `p`; keep visible spans aria-hidden; add `<span className="ds-sr-only">. Reading path: {spoken}</span>` (add a minimal `.ds-sr-only` rule ONLY if none exists anywhere in scope; check review.css/shared.css first and reuse).
- Filmstrip roving tabindex: Overview + step buttons get `tabIndex={isActive ? 0 : -1}`; engine gains an ArrowLeft/ArrowRight/Home/End walk beside the view-tab walk (same wrapping pattern as engine:3883), moving focus and activating via the existing `data-goto-step` path.
- Add `role="group"` to the two labeled divs (labels add context here).
- Drawer tags read "Story" / "Outside story".
- Escape reads "Review {n} excluded file(s)" pluralized on `payload.excludedFiles.length` (singular keeps "Review excluded file").
- Sub reads `{filesChanged} {plural(filesChanged, "file")} selected` server-side.

## Repo conventions
- Roving-tabindex exemplar: composer flavor radios (`tabIndex=v===state.flavor?0:-1`, engine:3188) and the view-tab arrow walk (engine:3883).
- Plural exemplar: surface `plural()` helpers.

## Steps
1. Rewrite ReadingPath with the sr-only spoken sentence.
2. Add roving tabindex attributes in StoryView and the engine key walk.
3. Add `role="group"` to the two divs.
4. Retag drawer rows; pluralize the escape; render the CTA count server-side.

## Boundaries
- Edit only the owned files. In review-engine.js touch ONLY the new filmstrip key-walk block.
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run build`, `npm run typecheck:client`
- Look: screen reader announces the full reading path; arrows walk the filmstrip with one Tab stop; drawer, escape, and CTA read correctly.
- Done when: build + typecheck pass; all six target states present.
