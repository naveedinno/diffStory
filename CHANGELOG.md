# Changelog

All notable changes to diffStory are tracked here.

## Unreleased

- Added live review synchronization: agent replies, review-state changes, story
  updates, and working-tree diff drift now reach an open review page over a
  server-sent event stream instead of requiring manual reloads. Reviews stay
  live across bfcache restores, tolerate a story rewrite mid-review, and never
  report a persisted comment change as failed.
- Added interleaved concept primers so generated stories can teach new terms and
  mental models before the code that uses them, with optional local Mermaid
  diagrams and no effect on diff coverage.
- Keep clone-and-run setup easy for new users.
- Keep optional integrations clearly separated from the core app.

## 0.1.0

- Added the local browser review app for git diffs.
- Added guided story review files under `.diffstory/story.json`.
- Added selected-text comments and agent handoff for Claude/Codex.
- Added optional local read-aloud support, including optional Kokoro AI voice
  setup.
- Added npm packaging metadata, bundled skills, brand assets, and public launch
  docs.
