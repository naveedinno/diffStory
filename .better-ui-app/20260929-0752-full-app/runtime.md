# Runtime evidence (2026-09-29)
Driver: playwright-core 1.61.1 driving system Google Chrome (`/Applications/Google Chrome.app`). Reached at: http://localhost:7777 (local `node dist/app-server.js --port 7777 --no-open --dir .`, built from working tree at capture time).
Scratch scripts: `capture.mjs` (41 stills), `record.mjs` (1 recording), both in this run folder.

Data caveats for lens agents: picker recents and the folder modal browse the real user HOME (server ran with real HOME). Change/diff file lists show this run's own untracked files (`.better-ui-app/.gitignore`, `brief.md`, `capture.mjs`). Review renders the repo's own `.diffstory/story.json` ("Make the viewer stop fighting the scroll", 18 steps).

## Captures
| File | Screen | Viewport or device | Theme | State | Notes |
|---|---|---|---|---|---|
| screens/picker-desktop-dark.png | Repository picker (/repos) | 1440x900 | dark | populated, 6 recents | viewed: real content, correct screen |
| screens/picker-desktop-light.png | Repository picker | 1440x900 | light | populated | viewed |
| screens/picker-tablet-dark.png | Repository picker | 768x1024 | dark | populated | viewed; skill-banner + unavailable-workspace rows visible |
| screens/picker-tablet-light.png | Repository picker | 768x1024 | light | populated | viewed |
| screens/picker-mobile-dark.png | Repository picker | 375x812 | dark | populated | viewed; icon-only add button, truncated paths |
| screens/picker-mobile-light.png | Repository picker | 375x812 | light | populated | viewed |
| screens/stories-desktop-dark.png | Review history | 1440x900 | dark | 8 saved reviews | viewed |
| screens/stories-desktop-light.png | Review history | 1440x900 | light | 8 saved reviews | viewed |
| screens/stories-tablet-dark.png | Review history | 768x1024 | dark | populated | viewed |
| screens/stories-tablet-light.png | Review history | 768x1024 | light | populated | viewed |
| screens/stories-mobile-dark.png | Review history | 375x812 | dark | populated | viewed; breadcrumb truncated to initials |
| screens/stories-mobile-light.png | Review history | 375x812 | light | populated | viewed |
| screens/change-desktop-dark.png | Choose review scope | 1440x900 | dark | uncommitted, 3 files | viewed |
| screens/change-desktop-light.png | Choose review scope | 1440x900 | light | uncommitted, 3 files | viewed |
| screens/change-tablet-dark.png | Choose review scope | 768x1024 | dark | uncommitted | viewed; metrics ledger hidden below breakpoint |
| screens/change-tablet-light.png | Choose review scope | 768x1024 | light | uncommitted | viewed |
| screens/change-mobile-dark.png | Choose review scope | 375x812 | dark | uncommitted | viewed; icon-only segment tiles |
| screens/change-mobile-light.png | Choose review scope | 375x812 | light | uncommitted | viewed |
| screens/review-desktop-dark.png | Guided review overview | 1440x900 | dark | story intro | viewed |
| screens/review-desktop-light.png | Guided review overview | 1440x900 | light | story intro | viewed |
| screens/review-tablet-dark.png | Guided review overview | 768x1024 | dark | story intro | viewed; title truncated with ellipsis |
| screens/review-tablet-light.png | Guided review overview | 768x1024 | light | story intro | viewed |
| screens/review-mobile-dark.png | Guided review overview | 375x812 | dark | story intro | viewed; compact chrome |
| screens/review-mobile-light.png | Guided review overview | 375x812 | light | story intro | viewed |
| screens/diff-desktop-dark.png | Raw diff (All files) | 1440x900 | dark | 3 files, split mode | viewed; sidebar + split diff |
| screens/diff-desktop-light.png | Raw diff | 1440x900 | light | 3 files, split mode | viewed |
| screens/diff-tablet-dark.png | Raw diff | 768x1024 | dark | 3 files | viewed; file header wraps to two lines |
| screens/diff-tablet-light.png | Raw diff | 768x1024 | light | 3 files | viewed |
| screens/diff-mobile-dark.png | Raw diff | 375x812 | dark | 3 files | viewed; top-right control appears clipped at viewport edge |
| screens/diff-mobile-light.png | Raw diff | 375x812 | light | 3 files | viewed; same clipped edge control |
| screens/review-step-desktop-dark.png | Story step 1 (paired-code) | 1440x900 | dark | code scene + filmstrip | viewed; before/after split, 18-stop filmstrip |
| screens/review-step-desktop-light.png | Story step 1 (paired-code) | 1440x900 | light | code scene + filmstrip | viewed |
| screens/review-step-mobile-dark.png | Story step 1 (unified) | 375x812 | dark | code scene | viewed; long code lines clip horizontally (no wrap) |
| screens/picker-modal-desktop-dark.png | Folder browser modal | 1440x900 | dark | modal over dimmed picker | viewed; real HOME listing, "Not a git repo" footer |
| screens/review-desktop-dark-reduced.png | Review overview, reduced motion | 1440x900 | dark | story intro | viewed; byte-identical to non-reduced rest state |
| screens/change-desktop-dark-reduced.png | Scope, reduced motion | 1440x900 | dark | uncommitted | viewed; byte-identical to non-reduced rest state |
| screens/review-zoom200-dark.png | Review overview at ~200% zoom | 720x450 @2x | dark | story intro | viewed; layout holds, CTA below fold, no overlap |
| screens/review-320-dark.png | Review overview | 320x700 | dark | story intro | viewed; 0px horizontal overflow |
| screens/change-320-dark.png | Scope | 320x700 | dark | uncommitted | viewed; 0px horizontal overflow, truncated breadcrumb/paths |
| screens/review-focus-skiplink.png | Review overview, Tab 1 | 1440x900 | dark | skip link focused | viewed; skip link revealed with ring |
| screens/review-focus-midpass.png | Review overview, Tab 5 | 1440x900 | dark | theme toggle focused | viewed; blue ring on toggle |
| screens/review-step-transition.webm | Overview -> step 1 -> step 2 | 1440x900, 4s | dark | transition animation | verified via ffprobe + mid-transition crossfade frame extract |

## Observations
- Keyboard order and reachability: 9-stop cycle on review overview, then wraps: Skip to content -> Close story -> Story tab -> source-editor toggle -> theme toggle -> Start the walkthrough -> Review notes (summary) -> All files -> Play narration -> body -> wrap. Nothing unreachable on this screen; filmstrip steps and diff controls live past Start and were not tabbed through.
- Focus visibility: visible blue box-shadow ring at 8 of 9 stops (see focus screenshots). Exception: the active Story tab at stop 3 reports only its resting shadow with no distinct focus ring — A11Y lens should judge.
- 320px and 200% zoom: 0px horizontal overflow measured on review and change at 320px; truncation via ellipsis, no clipping of controls except diff-mobile top-right edge control (visible in diff-mobile stills, present at 375px too). ~200% zoom holds layout with no overlap; primary CTA scrolls below fold.
- Reduced motion (emulated `prefers-reduced-motion: reduce`): rest renders byte-identical to normal. Animated transitions under reduce were not dynamically exercised — what still moves is Not verified.
- Console errors and layout shift: zero console errors and zero pageerrors across all 41 page loads. CLS not instrumented — layout shift Not verified.
- Motion: 4s recording of overview -> step 1 -> step 2 shows a crossfade between steps (verified in extracted frame). Timing not judged slowed-down beyond this real-time capture.

## Not captured
- ProgressPanel run states (running/complete/stopped/failed/blocked/stage variant) — needs synthetic progress-event driving; existing `scripts/capture-ui-atlas.mjs` covers these but was not re-run (may be stale).
- Comment composer, comment queue, copy-all, comment anchors — need text selection + queue interaction; atlas script covers.
- All-files split divider drag, editor menu open, theme menu open, RefPicker open, RemoveStoryDialog, narration-active state — interaction states beyond the cheap set.
- Concept-diagram / concept-document / code-focus story steps — only overview + step 1 captured.
- Empty states (no recents, no saved reviews, clean tree) and error/loading states — no cheap route with this live repo; atlas fixture covers some.
- Reduced-motion transition behavior, slowed-down timing judgement, CLS measurement — not instrumented in this pass.
- Stale `docs/ui-atlas/screenshots/` were not reused (not confirmed against current build).

## Settings restored
not applicable (no device or OS settings changed; dev server stopped after capture).
