# 010: Correct engine strings
- Findings: COPY-4, COPY-5, COPY-14, COPY-17
- Severity: LOW
- Wave: 2 (engine chain, runs after plan 009)
- Owned files: client/surfaces/review/engine/review-engine.js

## Problem
- COPY-4: `setLineWrap` flips the accessible name: `button.setAttribute('aria-label',on?'Disable line wrapping':'Wrap long lines')` (:218) while the visible label stays "Wrap".
- COPY-5 (JS half): generator labels read `Generate compact story` (:3316) beside `Generate guided review` (:3317) and `Generate deep review` (:3318). (Dialog/row halves are plans 023 and 024.)
- COPY-14: diagram help reads "...or use the keyboard arrow, plus, minus, and zero keys." (:428).
- COPY-17: bulk toast reads `toast('Every visible file is marked reviewed')` (:3115).

## Target
- Wrap toggle keeps `aria-label` stable at "Wrap long lines" in both states (pressed carried by `aria-pressed`); the `title` flip at :217 may stay as-is (hover hint) or match; keep the title flip to minimize churn.
- Labels read "Generate compact story", "Generate guided story", "Generate deep story".
- Diagram help reads "...or use the arrow, plus, minus, and zero keys."
- Toast reads "All visible files marked reviewed".

## Repo conventions
- Sentence case everywhere except uppercase mono kickers; no exclamation points (DESIGN_MEMORY.md).

## Steps
1. Make the wrap `aria-label` unconditional ("Wrap long lines").
2. Rename the two generator labels to "story".
3. Fix the diagram-help grammar.
4. Fix the bulk-reviewed toast.

## Boundaries
- Edit only the owned files.
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run build`
- Look: pressed Wrap announces "Wrap long lines, pressed"; all three generator depths say story; diagram help and bulk toast read correctly.
- Done when: build passes; all four strings exact.
