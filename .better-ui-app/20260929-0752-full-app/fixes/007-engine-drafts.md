# 007: Preserve comment drafts across dismissal
- Findings: EXP-1
- Severity: HIGH
- Wave: 2 (first of the engine chain; runs alone on this file)
- Owned files: client/surfaces/review/engine/review-engine.js

## Problem
- EXP-1: `removeComposer(box,restoreFocus)` (:3195) removes the composer node unconditionally with no draft stash. Three paths drop typed text: close button `close.onclick=function(){removeComposer(box,true);}` (:3187), second composer `openComposer` starting with `removeComposer(null,false)` (:3197), Escape `removeComposer(inlineComposer,true)` (:3838). No `beforeunload` guard; localStorage keys hold no composer draft. The textarea is `.ds-composer-ta` with flavor radio state in `state.flavor` and anchor `{file,line,side,step}` in `buildComposer`.

## Target
- Before removal, `removeComposer` reads the current textarea; when non-empty (trimmed), it stashes `{anchor:{file,line,side,step}, flavor, text, selectedText}` in a module-level map keyed by `file:line:side:step` AND in localStorage (so reload restores), e.g. key `ds-composer-draft:<scope>:<anchor>`.
- `openComposer`/`buildComposer` restores a stashed draft for the same anchor (text into textarea, flavor into radio state); successful queue/copy clears the stash for that anchor.
- A `beforeunload` guard warns while a dirty (non-empty) composer is mounted, following the existing `pagehide` listener style for the live event source.
- Focus behavior unchanged (restoreFocus path intact); Escape still closes, but the text survives a reopen.

## Repo conventions
- Engine idiom is vanilla ES5-style functions with `var`, `el()`, `$()` helpers; match surrounding style.
- Storage keys are namespaced (`ds-review-ui:` pattern at :2040); follow it.

## Steps
1. Add draft stash/restore/clear helpers plus the module map.
2. Call stash at the top of `removeComposer` (read textarea before node removal).
3. Restore in `openComposer` after `buildComposer`; clear on successful queue/copy.
4. Add the `beforeunload` guard tied to dirty-composer presence.

## Boundaries
- Edit only the owned files.
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run build`
- Look: type a comment, press Escape, reopen on the same line (text back); reload mid-draft (browser warns; text back after reopen); queue clears the draft.
- Done when: build passes; all three dismissal paths preserve text; beforeunload warns only with a dirty composer.
