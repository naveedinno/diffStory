# diffStory UI atlas

This folder is the app's local, reproducible visual reference. It is closer to a
living contact sheet than a set of hand-maintained mockups: every image is
captured from the real diffStory UI against a deterministic demo repository.

Open `index.html` directly in a browser to browse, filter, and inspect the atlas.
No server is required for the gallery.

## Refresh the atlas

```sh
npm run ui:atlas
```

The capture command:

1. builds diffStory;
2. creates a temporary Git repository from `examples/demo.mjs`;
3. starts the real local app with a deterministic fake Codex model catalog;
4. captures routes, overlays, collaboration states, themes, and responsive sizes;
5. rewrites `manifest.json` and `manifest.js` with the captured dimensions.

Google Chrome or Microsoft Edge must be installed. Set `DIFFSTORY_ATLAS_BROWSER`
to an alternative Chromium executable when needed. The command never calls a
real coding agent and never writes `.diffstory/` data to this repository.

## Coverage contract

Enforced by `test/ui-atlas.test.mjs`, not just by convention:

- **Pages** — repository picker, its folder-browser modal, review history,
  change scope, the anchored ref picker, and the raw diff. Each of these is
  captured at **all three viewports** (desktop 1440×960, tablet 920×820, mobile
  390×844), and the page surfaces are captured in **both themes**.
- **Empty states** — no repositories yet, no saved reviews, and a clean working
  tree. An atlas of only-populated screens hides half the design.
- **Review** — code steps, concept steps, unified and split all-files views, the
  review page, the queued-comment workspace, the inline composer, and a queued
  comment traced back to code.
- **Progress panel** — running, complete, stopped, failed, cannot-start, and the
  `stage` variant mounted inside the storyless intro; plus a mobile frame that
  exercises the panel's 520px head-grid breakpoint, and element-scale closeups.
- **Responsive** — the review workspace at tablet and phone widths.

Each shot records the `surface` it drives, which is what the capture script
switches on and what the coverage assertions count. Several states share one
surface across viewports and themes.

If a frame contains a diff-load error, the capture script records a `degraded`
note on that shot and prints it. A screenshot of an error page is worse than no
screenshot, because it reads as coverage — an unexpected one fails the run.

`manifest.json` is the machine-readable inventory. `manifest.js` contains the
same data so the gallery also works from a `file://` URL.

## `baseline-pre-react/`

A frozen copy of a complete capture, taken immediately before the React/beUI
rewrite began. Live atlas runs overwrite `screenshots/`; that directory does not
change. See its own README for the date and commit.
