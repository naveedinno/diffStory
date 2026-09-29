# 024: Align story removal dialog and drift state
- Findings: COPY-5, COPY-7
- Severity: LOW
- Wave: 2
- Owned files: client/surfaces/stories/RemoveStoryDialog.tsx, client/surfaces/stories/story-state.ts

## Problem
- COPY-5 (dialog half): dialog asks "Remove this review?" (:117) but its button says "Remove story" (:157). (Row/generator halves are plans 010 and 023.)
- COPY-7 (state half): details read `· ${plural(story.outsideStoryDrift, "side file")} also changed` (:57) and `Story current · ${plural(...)} changed` (:73). (ReviewApp/StoryView halves are plans 011 and 013.)

## Target
- Dialog title reads "Remove this story?" matching its button and body.
- Details read "N file(s) outside the story also changed" and "Story current · N file(s) outside the story changed" (keep the `plural()` helper with the new noun phrase; check the helper's signature for multi-word nouns and adapt, e.g. plural(n, "file outside the story", "files outside the story") or equivalent).

## Repo conventions
- One noun per object; plain reviewer vocabulary; sentence case.

## Steps
1. Retitle the dialog to "Remove this story?".
2. Rewrite both drift detail strings with the plural helper.

## Boundaries
- Edit only the owned files.
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run typecheck:client`
- Look: dialog title matches its button; drift lines name files outside the story with correct singular/plural.
- Done when: typecheck passes; both strings exact.
