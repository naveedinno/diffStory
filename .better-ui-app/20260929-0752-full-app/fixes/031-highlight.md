# 031: Name the user's editor in symbol titles
- Findings: COPY-2
- Severity: MEDIUM
- Wave: 2
- Owned files: src/highlight.ts

## Problem
- COPY-2: every navigable identifier carries `title="Open implementation in VS Code (Command/Ctrl-click)"` (:82) regardless of the stored editor preference; nothing rewrites it. The menu offers Zed and VS Code (editor-menu.tsx:14).

## Target
- Render `title="Open implementation in your editor (Command/Ctrl-click)"` (static; no engine rewrite needed). Keep `data-vscode-symbol` attributes and behavior unchanged (attribute names are internal, not user-facing).

## Repo conventions
- One voice; never name the wrong application.

## Steps
1. Replace the VS Code title string with the "your editor" string.

## Boundaries
- Edit only the owned files.
- Add no dependencies.
- If the current code differs from Problem, stop and report instead of improvising.

## Verification
- Commands: `npm run build`
- Look: hovering a symbol offers "your editor".
- Done when: build passes; no "VS Code" remains in user-facing strings in this file.
