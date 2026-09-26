# Free concept pages — design

- **Date**: 2026-09-26
- **Status**: Approved design, awaiting spec review
- **Supersedes**: the "Let the agent emit arbitrary HTML/CSS/JS scenes — Reject"
  row in `plans/013-build-native-story-stage.md`, for concept steps only.

## Problem

Concept (mental-model) steps come out as mostly text. The schema caps them at
one block-tier HTML `body` of 60–220 words plus at most one Mermaid diagram, and
the checker limits how many there are and where they sit. The agent cannot show
an idea the way it would best be taught: interactively, animated, as a custom
visual.

## Goal

The storyteller agent is completely free inside a concept step: it authors any
HTML page — HTML, CSS, SVG, canvas, JavaScript, CDN libraries — and places as
many concept steps as the change needs, wherever it wants. Code steps are
unchanged.

The one invariant that stays: a story.json can come from any branch, so a
concept page must never reach the app, its API, the reviewer's comments, or the
local filesystem. The sandbox bounds blast radius, not creativity.

## Decisions

| Question | Decision |
| --- | --- |
| Runtime freedom | JavaScript on, network on (CDN scripts, styles, fonts, images, fetch). |
| What travels with the page | A plain-text `narration` for Aloud and screen readers. The page owns the stage. |
| Structural limits | All lifted: no count cap, adjacency, "not last", or required `preparesFor`. |
| Rendering | Dedicated page endpoint with its own permissive CSP, embedded in a `sandbox="allow-scripts"` iframe. |

Rejected rendering alternatives: loosening the whole app's CSP so an inline
`srcdoc` frame can reach CDNs (weakens every screen for one feature; `srcdoc`
inherits the parent CSP, so this is the only way it could work); a second local
server on another port (little extra isolation over an opaque-origin sandbox,
much more machinery).

## 1. Schema

- Story format **version 4**. Older installed diffStory builds reject v4 with a
  clear unsupported-version error. v1–v3 stories keep validating exactly as
  today.
- A v4 concept step takes one of two shapes:
  - **Page concept (new):** `id`, `order`, `title`, `kind: "concept"`,
    `page`, `narration`, optional `preparesFor`, optional `tags`.
    - `page`: a complete HTML document string. No element, attribute, size, or
      content rules.
    - `narration`: plain text (no markup). What Aloud speaks and screen readers
      announce for the step.
  - **Legacy concept:** `body` + optional `diagram`, as today. Still accepted in
    v4 so a repaired story can keep an old primer.
  - `page` and `body` are mutually exclusive; `narration` is required with
    `page` and not allowed with `body`.
- Removed for all v4 stories: the per-mode concept cap (1/2/3), the 60–220 word
  bounds, "concept steps cannot be adjacent", "concept step cannot be the last
  step", and the requirement that `preparesFor` exists and includes the next
  step.
- Kept, because they catch broken data rather than limit authoring: `page` and
  `narration` are non-empty strings; every `preparesFor` id, when given,
  references an existing code step; code-step flow references (`calls`,
  `returnsTo`, hotspots) still may not target concepts; concepts never claim
  diff coverage and still may not carry code fields (`file`, `range`, `beats`…).
- The legacy-shape rules (word bounds, one diagram) still apply to legacy
  concepts in v2/v3 stories. In v4 the word bounds are dropped for legacy
  concepts too.

## 2. Rendering and runtime

### Panel

`conceptStepPanel` in `src/render.ts` branches on the step shape. A page concept
renders:

- the existing slim heading — "Mental model" eyebrow and the title `h1`;
- a frame region filling the rest of the stage, holding
  `<iframe sandbox="allow-scripts" allow="fullscreen" title="…" src="…">`,
  a loading line shown until the iframe's `load` event, and a fullscreen button
  (same affordance as the Mermaid figure);
- the `[data-speech-concept]` node carrying `narration`.

Panels are already lazy (`/api/review/step-panel`), so the iframe exists only
once the reviewer walks onto the step; the metadata-first 300-step render is
unaffected. The React `SpeechCache` stub keeps reading `conceptSpeech`, which the
view model now derives from `narration` for page concepts.

### Page endpoint

`GET /api/review/concept-page?page=<lease>&index=<n>&theme=<light|dark>`

- Validates the review-page lease and step index exactly like `step-panel`;
  404s for a non-page step.
- Returns the step's `page` with the shim (below) injected as the first child of
  `<head>` (or prepended when the document has no `<head>`).
- Response headers, set instead of `setLocalResponseHeaders`:
  - `Content-Security-Policy: default-src * data: blob: 'unsafe-inline' 'unsafe-eval'; frame-ancestors 'self'`
  - no `X-Frame-Options: DENY`;
  - `Referrer-Policy: no-referrer`, `X-Content-Type-Options: nosniff`;
  - `Cache-Control: no-store`.
- The app's CSP gains `frame-src 'self'` so it may embed the endpoint. Nothing
  else in the app CSP changes.

### Isolation

`sandbox="allow-scripts"` without `allow-same-origin` gives the page an opaque
origin. It therefore cannot read the app's storage or cookies, cannot navigate
the top window, cannot open popups, and cannot submit forms. Its requests to the
local server arrive with `Origin: null`: mutations are already rejected by the
server's origin check, and GET responses are unreadable because the server sends
no CORS headers. A test pins this for `fs-browse` and the review API.

Known trade-off, documented in `docs/story-schema.md`: because CDN access is
allowed, opening a story can make the browser contact URLs its author chose —
revealing the reviewer's IP and that the story was opened.

### Keyboard

Focus inside the iframe starves the app's `document` keydown handler. The shim
listens for `keydown` in the page and forwards story navigation keys to
`parent` via `postMessage({ type: "diffstory:key", key, … })` unless the event
target is an input, textarea, select, or contenteditable, or the page already
called `preventDefault()`. The review engine accepts the message only when
`event.source` is the active concept iframe's `contentWindow`, then replays it
through the existing key handler.

### Theme

The iframe URL carries the current theme. The shim sets `data-ds-theme` on the
page's `<html>`, and injects a `<style>` of optional Signal color tokens as CSS
custom properties (`--ds-ink`, `--ds-signal`, …) ahead of the author's styles so
the author always wins. On theme change the app posts
`{ type: "diffstory:theme", theme }` and the shim updates the attribute. Fonts
are not provided (the app's assets are same-origin only); pages use CDN or
system fonts.

### Failure

If the network is down, the page renders whatever it can; narration still
works. The app does not inspect or judge the page.

## 3. Skill, checker, lint, eval

### Skill (`skills/diffstory-storyteller`)

- `references/primers.md` is rewritten as concept pages:
  - **When:** whenever a mental model lands better shown than told; the agent
    decides count and placement.
  - **What:** a gallery of starting ideas, not a menu — an interactive state
    machine to step through, an animated money or data flow, a before/after
    toggle, a worked numeric example with sliders (a position's margin as price
    moves), a lifecycle timeline. Any CDN library that fits.
  - **Craft advice (not a check):** teach with a concrete instance from this
    diff, not a generic textbook picture.
  - **`narration`:** what you would say while pointing at the page.
  - **Theming:** `--ds-*` tokens and `data-ds-theme`, optional.
- `SKILL.md`, `references/schema.md`, and `references/examples.md` updated; the
  skill emits version 4 stories.

### Checker (`src/tour.ts`, bundled `scripts/check-story.mjs`)

Implements Section 1. The checker never parses or evaluates the page HTML.

### Lint (`src/story-lint.ts`)

- `chapter-seam` reads the opener from `narration` for page concepts.
- New `narration-markup` error when `narration` contains HTML tags.
- `narrativeFields` includes `narration`, excludes `page`.
- `detailed-without-primer` stays a warning.
- `mermaid-label` applies to legacy diagrams only.

### Eval (`eval/`)

Rubric lines that score primer word counts or the concept cap are updated so
evals do not penalize page concepts.

### Housekeeping

`docs/story-schema.md` (v4, page concepts, CDN privacy note), `CHANGELOG.md`,
rebuilt `dist/` and `check-story.mjs` in the same commit as the `src/` change.

## Testing

- Validator: v4 page concept accepted; legacy shape still accepted in v2–v4;
  `page`+`body` rejected; `narration` without `page` rejected; removed rules no
  longer fire in v4 (cap, adjacency, last, missing `preparesFor`); a v3 story
  with `page` rejected.
- Lint: `narration-markup`, `chapter-seam` on narration.
- Server: concept-page endpoint headers (CSP, no XFO, `frame-ancestors 'self'`),
  lease/index validation, shim injection with and without `<head>`; app CSP has
  `frame-src 'self'`; an `Origin: null` request cannot mutate and receives no
  CORS headers from the review API and `fs-browse`.
- Render: page concept panel emits `sandbox="allow-scripts"` exactly (no
  `allow-same-origin`), narration in the speech node, no page HTML in the
  panel itself.
- `node --check` on the emitted PAGE_JS after adding the message listener.
- Browser pass: a sample story with a d3-from-CDN interactive page — renders,
  arrow keys navigate from inside the frame, theme switch reaches the page,
  fullscreen works, narration plays.
