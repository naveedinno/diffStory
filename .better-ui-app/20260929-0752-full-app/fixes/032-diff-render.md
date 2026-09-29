# 032: Enlarge moved-line jump targets
- Findings: A11Y-13
- Severity: LOW
- Wave: 2
- Owned files: src/diff-render.ts

## Problem
- A11Y-13: `.ds-moved-tag` buttons render at 10px type with no vertical padding (~15px tall, src/diff-render.ts:61; class styled in review.css:960-963 which plan 006 does not touch); consecutive moved lines stack closer than the 24px spacing circle. Line-number blame targets (~20px, :109) are accepted as-is per the report.

## Target
- Moved-tag buttons reach ~24px height via vertical padding. Implement in the owned file: add an inline `style="padding-top:4px;padding-bottom:4px"` on the button tag (or a `data-` hook + plan for CSS; inline style is acceptable here since review.css is owned by another chain). Do NOT change the font size, colors, or labels. Line-number targets untouched.

## Repo conventions
- 24px target floor (WCAG 2.5.8); keyboard paths and names already fine.

## Steps
1. Add vertical padding to the moved-tag button markup.

## Boundaries
- Edit only the owned files.
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run build`
- Look: moved-line chips are taller and easier to tap; rows do not overlap.
- Done when: build passes; measured chip height >= 22px (report the value).
