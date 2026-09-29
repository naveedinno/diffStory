# 003: Restore focus rings on selected review controls
- Findings: A11Y-1, A11Y-7, VIS-4
- Severity: HIGH
- Wave: 2 (first of the review.css chain; runs alone on this file)
- Owned files: client/surfaces/review/review.css

## Problem
- A11Y-1: the generic ring `button:focus-visible,a:focus-visible,summary:focus-visible{outline:none;box-shadow:var(--shadow-focus)}` (review.css:1289, specificity 0,1,1) loses to four resting rules that set their own shadow or none, none with its own `:focus-visible` rule:
  - `:root .ds-reviewchrome-utilities .ds-tab.is-active{background:var(--panel4);color:var(--text);box-shadow:0 1px 2px rgba(0,0,0,.25)}` (review.css:1378)
  - `.ds-fileitem.is-active{background:var(--fill-2);box-shadow:inset 0 0 0 1px var(--accent-line)}` (review.css:656)
  - `.ds-stepcard.is-intro{...box-shadow:none}` (review.css:273)
  - `.ds-composer-tab.is-active{border-color:var(--line-soft);background:var(--panel3);box-shadow:0 1px 3px rgba(0,0,0,.18);color:var(--text)}` (review.css:601)
  The layered global ring in styles.css loses to all unlayered rules. (Light-theme `.ds-tab` already has its own inset rule at :1092 and is exempt.)
- A11Y-7 (CSS half): `.ds-blame-pop:focus{outline:none}` (review.css:967) removes the outline while the resting `box-shadow:var(--shadow)` beats the layered global ring, so the focused popover shows no indicator. (Naming/aria-modal half is plan 009.)
- VIS-4: `.ds-concept-diagram-tools button:focus-visible{outline:2px solid var(--accent-blue);outline-offset:2px}` (review.css:1209) breaks the shared 3px accent-soft box-shadow idiom.

## Target
- Four new unlayered rules (place near :1289): `:root .ds-reviewchrome-utilities .ds-tab.is-active:focus-visible`, `.ds-fileitem.is-active:focus-visible`, `.ds-stepcard.is-intro:focus-visible`, `.ds-composer-tab.is-active:focus-visible`, each `{outline:none;box-shadow:var(--shadow-focus)}` except `.ds-fileitem.is-active:focus-visible`, which layers both shadows: `{outline:none;box-shadow:inset 0 0 0 1px var(--accent-line),var(--shadow-focus)}` so the selection inset survives under the ring.
- Blame popover: `.ds-blame-pop:focus{outline:none;box-shadow:var(--shadow-focus)}`.
- Diagram tools: `.ds-concept-diagram-tools button:focus-visible{outline:none;box-shadow:var(--shadow-focus)}`.
- No other rule in the file changes. No `outline` (except the forced-colors block owned by plan 001 in other files).

## Repo conventions
- Focus idiom is `outline:none;box-shadow:var(--shadow-focus)` with no outline (DESIGN_MEMORY.md). Exemplar: `.ds-dock .ds-readaloud-primary:focus-visible{outline:none;box-shadow:var(--shadow-focus)}` (review.css:1384).

## Steps
1. Insert the four `:focus-visible` rules after the generic rule at :1289, with the layered shadow on `.ds-fileitem.is-active:focus-visible`.
2. Extend `.ds-blame-pop:focus` with `box-shadow:var(--shadow-focus)`.
3. Replace the diagram-tools focus declaration with the shared ring.

## Boundaries
- Edit only the owned files.
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run build`
- Look: Tab onto the active Story tab, a selected file, the intro step card, and an active composer radio in dark theme; each shows the blue ring. Focus the blame popover; ring visible. COL recheck should confirm ring contrast on each fill.
- Done when: build passes; all six focus rules present and unlayered.
