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

The atlas deliberately covers four kinds of UI evidence:

- **Pages** — repository picker, review history, change scope, raw diff, and the
  guided review entry point.
- **Review** — code steps, concept steps, unified and split all-files views,
  review status, the queued-comment workspace, its Copy all handoff, and a
  queued comment traced back to code.
- **Progress** — running, complete, stopped, and failed story-generation states.
- **Responsive and theme** — mobile/tablet review surfaces and the two explicit
  color themes.

`manifest.json` is the machine-readable inventory. `manifest.js` contains the
same data so the gallery also works from a `file://` URL.
