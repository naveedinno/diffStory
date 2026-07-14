# DiffStory for VS Code

DiffStory gives a code change a clear review loop inside VS Code:

1. **Review** changed files in the native diff editor.
2. **Comment** on the exact selected code.
3. **Verify** the agent's fixes before resolving anything.

The sidebar is one review session with three tabs:

- **Changes** shows the whole file queue and what you have already opened.
- **Guide** optionally asks Codex or Claude to explain the change in a useful order.
- **Feedback** sends comments to an agent and keeps every fix waiting for your approval.

## Your first review

1. Open a Git project and run **DiffStory: Open review**.
2. In **Changes**, choose **Review these changes** or open any file in the queue.
3. Select code in the diff, right-click, and choose **DiffStory: Add comment to selected code**.
4. Open **Feedback** and send your comments to Codex or Claude.
5. Open each returned fix. Choose **Mark resolved** only after you verify it.

No guide is required. The normal workflow works directly from changed files.

## Choose what to compare

Click the comparison label in the sidebar header or run **DiffStory: Change review comparison**. You can review:

- the working tree against `HEAD`;
- the working tree against a branch or commit;
- one Git ref against another; or
- the repository's automatically resolved default comparison.

The optional guide never silently changes this comparison.

## Guided reviews

Open **Guide** when a change needs explanation. A guide opens the same native VS Code diffs, but in an agent-written reading order. Guide options let you choose the agent, depth, file coverage, or a saved guide without crowding the main file review.

## Feedback lifecycle

Comments are saved in `.diffstory/comments.json` and mirrored as native VS Code comment threads.

- **Needs agent**: open reviewer feedback.
- **Ready to verify**: the agent responded; inspect the change.
- **Resolved**: the reviewer accepted the result.

DiffStory never resolves an agent response automatically.

File-open progress, snapshots, and history live in `.diffstory/review-state.json`. Guides use `.diffstory/story.json` and `.diffstory/stories/*.json`, so the VS Code extension remains compatible with the DiffStory web app.

## Agent setup

Reviewing changed files works without an agent. Guide generation and feedback addressing need either the `codex` or `claude` CLI on your `PATH`.

Verify setup in VS Code's terminal:

```sh
codex --version
# or
claude --version
```

If neither command works, install [Codex CLI](https://developers.openai.com/codex/cli) or [Claude Code](https://code.claude.com/docs/en/getting-started), then reload VS Code.

## Development

```sh
npm install
npm run check
```

Open `vscode-extension` in VS Code and launch the extension host, or package it with `npm run package`.
