# Selection Context Comments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace line-button comments with selected-text right-click comments.

**Architecture:** Keep existing comment transport and inline thread rendering, but change the authoring interaction from row buttons to a selection context menu. Persist selected text and range metadata while retaining `file` and `line` for compatibility and agent lookup.

**Tech Stack:** TypeScript, server-rendered HTML, inline browser JavaScript, Node test runner.

---

### Task 1: Pin The New Comment Contract

**Files:**
- Modify: `test/comments.test.mjs`
- Modify: `test/comments-render.test.mjs`
- Modify: `test/render-page.test.mjs`
- Modify: `test/agent.test.mjs`

- [ ] Add tests proving selected text persists, visible line-comment affordances are gone, commentable code exposes selection metadata, selected snippets render, and the address prompt tells agents to use selected snippets.
- [ ] Run `npm test` and confirm these tests fail before implementation.

### Task 2: Persist Selected Text Metadata

**Files:**
- Modify: `src/types.ts`
- Modify: `src/comments.ts`

- [ ] Extend `Comment` and `NewComment` with `selectedText` and `selection`.
- [ ] Sanitize selected text and range numbers in `addComment`.
- [ ] Keep old comments valid when the new fields are absent.

### Task 3: Render Selection-Only Anchors

**Files:**
- Modify: `src/render.ts`
- Modify: `src/page-assets.ts`

- [ ] Remove `ds-addcomment` buttons and line-comment copy.
- [ ] Mark only commentable current-side code spans with `data-comment-code`.
- [ ] Add selected-snippet display to server-rendered and client-built comment cards.
- [ ] Add the right-click menu and composer flow for valid text selections.
- [ ] Leave native browser context menus untouched when no valid review selection exists.

### Task 4: Update Agent Handoff And Docs

**Files:**
- Modify: `src/agent.ts`
- Modify: `skills/address-review/SKILL.md`
- Modify: `README.md`

- [ ] Change prompt wording from file-line comments to selected-snippet comments.
- [ ] Update README copy to describe selecting text and right-clicking.

### Task 5: Verify

**Files:**
- Generated: `dist/*`

- [ ] Run `npm test`.
- [ ] Run a focused source search for old line-comment UI copy and `ds-addcomment`.
- [ ] Check `git status --short` and make sure unrelated files are untouched.
