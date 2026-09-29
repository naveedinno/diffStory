# Brief: diffStory web app (2026-09-29)
Mode: full. Lenses: A11Y, LAY, TYP, COL, COPY, VIS, MOT, EXP (eight core; no VIZ, no charts found). Scope: whole app UI. Excluded: client/vendor/beui internals (third-party vendored library; its usage sites in surfaces/ ARE in scope), dist/ (generated), test/, docs/, eval/, macos/, zed-extension/.

## Platform
web: React 19 + React DOM via esbuild bundles, Tailwind v4. Roots: client/ (TSX/CSS source), src/ (node server + server-rendered markup for the review surface). No Android Compose (no gradle files; macos/ dir is a packaging script only).

## Stack
- Styling: Tailwind v4 (@import "tailwindcss" source(none), explicit @source), utility-first in all surfaces except review, which keeps a 1463-line hand stylesheet (client/surfaces/review/review.css) because its diff rows are server-rendered HTML. Cross-surface keyframes/scrim/backdrop in client/shared/shared.css (550 lines).
- Components: own surfaces + selected beUI motion primitives (Button, Input, Loader, Tooltip, AnimatedBadge, BouncyAccordion, TextShimmer, ActionSwapText, NumberTicker) imported from ../../vendor/beui.
- Icons: lucide-react (v1.30) plus inline stroke SVGs (Thread-Path brand mark); 1.5 stroke convention.
- Fonts: self-hosted woff2 under assets/fonts (IBM Plex Sans UI, IBM Plex Mono data/kickers, Space Grotesk numerals/display), served same-origin via /assets/fonts route; @font-face in canonical tokens. Never Google Fonts (font-src 'self' CSP).
- Motion: motion/react (motion v11) with useReducedMotion/AnimatePresence in change + progress + picker surfaces; shared.css keyframes gated on prefers-reduced-motion; beUI ease tokens.
- i18n and RTL: none. English-only, no locale catalogue, no dir handling (one RTL-adjacent mention in StoryView.tsx only).
- Theming: data-theme / data-theme-mode on <html> + html.style.colorScheme, ds-theme localStorage key, useTheme re-exported from vendor (client/shared/theme.ts). Two schemes: dark ink + light.

## Tokens
- Canonical: src/theme.ts sharedTokens() (the 3b block for both schemes + @font-face). Generated bridge client/generated/theme.css (do not edit; regen via node scripts/build-theme-css.mjs). Page-local names alias one-directional onto canonical tokens (never introduce var() cycles).
- Type tokens: --font-sans/--font-mono, --text-base, --leading-body, --tracking-kicker in generated theme.css + src/theme.ts.
- Spacing/radius: --radius-sm/--radius/--radius-lg (6/9/12px), --radius-island 16px, 12px gutters, 48px chrome rows, --ds-rail-width/--rail-width 316px rail, 1px --line/--line-soft hairlines.
- Motion tokens: beUI ease + shared.css timings; accent-soft focus ring via --shadow-focus / --accent-soft (3px box-shadow, no outline).
- Color: signal blue accent #3fb2ff (dark) / #0072d6 (light); semantic amber/green/red/blue for evidence+state only; --text-2 muted, --text-3 faint tier lifted for AA (see conventions).

## Conventions read
- DESIGN_MEMORY.md (Signal / Thread-Ledger direction 3b: islands, thread, filmstrip, Notes one-shot, brand tone, color/type/layout/a11y rules; canonical-tokens + self-hosted-fonts repo conventions) — read in full, it is the design source of truth.
- DESIGN_PLAN.md (noted, superseded by DESIGN_MEMORY.md 3b direction).
- CONTRIBUTING.md (noted).
- docs/ui-atlas/ (existing screenshot atlas + capture script scripts/capture-ui-atlas.mjs; may be stale, capture agent should re-capture).
- .claude-design/lab/diffstory-ds/ mockup is the imported source of truth for values/layouts (referenced by DESIGN_MEMORY.md; lens agents may consult for intent but judge the shipped code).
- None of: CLAUDE.md, AGENTS.md, CODING_STANDARDS.md, Storybook, ADRs found at root (there is .claude/ and skills/ dirs; interface ADRs none).

## Surfaces in scope
- / WorkspacePicker, entry client/entry/picker.tsx, surface client/surfaces/picker/ (Hero, FolderBrowser, PickerApp, RecentRepos, SkillBanner, format).
- /stories ReviewHistory, entry client/entry/stories.tsx, surface client/surfaces/stories/ (StoriesApp, StoryRow, RemoveStoryDialog, EmptyHistory, story-state, format).
- /change ChangeScope, entry client/entry/change.tsx, surface client/surfaces/change/ (ChangeApp, RefPicker, ScopeCard, FileSummary, refs, format).
- /review guided review + story view, entry client/entry/review.tsx, surface client/surfaces/review/ (ReviewApp, ReviewView, StoryView, Sidebar, engine/, review.css); markup partly server-rendered in src/ (render, page-assets, diff-assets) — in scope where it determines rendered UI.
- ProgressPanel embedded progress/loading UI, entry client/entry/progress.tsx (window.diffStoryProgress bridge), surface client/surfaces/progress/ (ProgressPanel, Milestones, PlanList, ActivityText, Elapsed, state, run-progress, use-progress-run).

## Shared primitives
- client/shared/nav.tsx (imported ~22x), client/shared/mount.tsx (~39x), client/shared/brand.tsx (~5x), client/shared/theme-menu.tsx (~4x), client/shared/editor-menu.tsx (~4x), client/shared/use-modal.ts, client/shared/api.ts, client/shared/payload.ts, client/shared/theme.ts, client/shared/cn.ts, client/shared/quiet.ts, client/shared/shared.css, client/styles.css, client/generated/theme.css (generated).

## Frequency map
constant: keyboard traversal of review steps/files (Tab + review shortcuts), typing in RefPicker/search inputs, scrolling diff content.
frequent: sidebar step/file selection, accordion expand/collapse (FileSummary), hover affordances, filmstrip prev/next, story row selection.
occasional: dialogs (RemoveStoryDialog), theme menu, editor menu, tooltips, FolderBrowser navigation, ProgressPanel narration during runs, error/empty/loading states.
rare: first-run picker empty state, EmptyHistory, SkillBanner, onboarding-adjacent hero content.

## Personality
Minimal, premium, calm, precise, developer-native instrument. No hype, no exclamation points, no emoji. Sentence case except uppercase mono kickers.

## Checks available
- Typecheck (client): npm run typecheck:client (tsc -p client/tsconfig.json).
- Build: npm run build (tsc + browser assets + client esbuild + skill checker); dist/ committed.
- Tests: node --test test/*.test.mjs (includes test/render-page.test.mjs contrast-AA checks, test/motion-regressions.test.mjs, test/client-js-xref.test.mjs).
- No eslint-plugin-jsx-a11y, no axe, no Android lint. Screenshot atlas: npm run ui:atlas (scripts/capture-ui-atlas.mjs, playwright-core in devDeps).

## Runtime
Renders via npm run build && node dist/app-server.js --port 7777 --no-open (DEFAULT_PORT 7777 in src/config.ts); routes / /stories /change /review (+ /repos legacy). Review/change routes need a git repo context (--dir <repo>). playwright-core is a devDependency; browsers may need install. docs/ui-atlas/screenshots may hold stale captures.

## Charts
None. No chart libraries in package.json or client imports; SVG use is icons/brand/thread marks; Milestones/NumberTicker/PlanList are progress narration, not charts/dashboards/sparklines/stat tiles. VIZ lens does not run.
