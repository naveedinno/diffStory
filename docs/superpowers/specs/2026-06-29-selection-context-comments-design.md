# Selection Context Comments Design

## Goal

Replace line-button comments with selection-only review comments. A reviewer selects text in the review code, right-clicks the selection, chooses a review action, writes the note, and diffStory sends that selected-text comment to the agent.

## Interaction

- Remove all visible `+` line-comment buttons and line-comment instructions.
- Preserve the normal browser context menu unless the reviewer has an active text selection inside commentable review code.
- When a valid selection exists, right-click opens a compact diffStory menu with `Ask`, `Ask for change`, and `Nit`.
- Choosing a menu item opens the existing composer below the nearest selected row, pre-set to the matching comment type.
- The composer and comment card describe the selected snippet, not a line.

## Data

Comments remain backward-compatible with existing `.diffstory/comments.json`.

- Keep `file`, `line`, and optional `step` for agent lookup and old comments.
- Add `selectedText` for the reviewer-selected snippet.
- Add optional `selection` with `startLine`, `endLine`, and best-effort column offsets.
- Old comments without `selectedText` still render at their saved line.

## Agent Handoff

The agent prompt and copied comments should tell the agent the comment is anchored to selected text in a file/range. The line metadata is still available, but the instruction should point the agent at the selected snippet first.

## Testing

- Render tests should prove the `+` affordance and line placeholder are gone.
- Render tests should prove commentable code spans expose selection metadata and selected snippets render in comment cards.
- Comment-store tests should prove selected text and range metadata persist.
- Agent prompt tests should prove the address prompt talks about selected snippets, not line comments.
