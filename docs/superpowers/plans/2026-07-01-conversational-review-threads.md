# Conversational Review Threads Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn each diffStory review thread into a live multi-turn conversation — a persistent chat box lets the reviewer reply, each message re-invokes the agent with the full thread as context, and the agent's answer is appended as a new turn.

**Architecture:** A comment gains an ordered `turns[]` list; the conversation is `body` (the anchored first message) followed by `turns`. Legacy single-`reply` comments are normalized to one AI turn on load, so nothing breaks. A new `POST /api/comments/:id/message` endpoint appends a user turn and reopens the thread; the client then reuses the existing `/api/address` streaming loop. The agent appends an `ai` turn instead of overwriting a single reply.

**Tech Stack:** TypeScript compiled with `tsc` to `dist/`, Node's built-in test runner (`node --test`), a zero-dependency HTTP server, and a hand-rolled client script embedded as a string in `src/page-assets.ts`.

## Global Constraints

- **Tests import compiled output** from `../dist/*.js`, so every red/green step is `npm run build && node --test test/<file>.test.mjs`. There is no way to run a test against `src/` directly.
- **Commit `dist/` with `src/`** — github installs have no build step. Each task's commit stages the specific rebuilt `dist/*.js` files it changed. Never `git add -A`: the working tree contains unrelated in-progress work (intra-line diff feature) that must not be swept into these commits.
- **This feature builds on the current (uncommitted) working tree**, which already renders threads chat-style (right-aligned `You` bubbles via `align-self:flex-end`, left `◈` blocks via `ds-reply`). Do not reset or branch away from it.
- **UI follows the existing Apple-style system** — reuse existing CSS variables (`--panel3`, `--line-soft`, `--accent-blue`, `--text`, `--mono`) and existing bubble classes rather than inventing a second chat surface.
- **Decisions (locked in the spec):** auto-run the AI on every send; the AI is a full agent (may edit code + refresh the tour); the chat box is always shown, and every send flips status to `open` (a resolved thread reopens on a new message).

---

### Task 1: Data model + storage helpers

Add the `Turn` type, `turns` on `Comment`, legacy-`reply` normalization on load, and the `appendUserMessage` helper that appends a reviewer turn and reopens the thread.

**Files:**
- Modify: `src/types.ts` (add `Turn`, add `turns?` to `Comment`)
- Modify: `src/comments.ts` (add `normalizeComment`, normalize in `loadComments`, add `appendUserMessage`)
- Test: `test/comments.test.mjs`

**Interfaces:**
- Produces:
  - `interface Turn { role: 'user' | 'ai'; text: string; at: string }`
  - `Comment.turns?: Turn[]`
  - `normalizeComment(c: Comment): Comment` — exported; returns `c` with `turns` synthesized from a legacy `reply` when `turns` is absent/empty. Non-mutating.
  - `appendUserMessage(repo: string, id: string, text: string): Comment | null` — appends `{role:'user',text,at}` to `turns`, sets `status='open'`, saves, returns the updated comment (or `null` if id not found; throws on empty text).
- Consumes: existing `loadComments`, `saveComments` (private) in `src/comments.ts`.

- [ ] **Step 1: Add the `Turn` type and `turns` field**

In `src/types.ts`, immediately before `export interface Comment {`, add:

```ts
/** One message in a review-thread conversation: the reviewer (`user`) or the AI. */
export interface Turn {
  role: 'user' | 'ai';
  text: string;
  /** ISO timestamp; set by the server. */
  at: string;
}
```

Inside `interface Comment`, right after the `reply?: string;` line, add:

```ts
  /** Ordered follow-up conversation after `body`. Absent on legacy single-reply comments. */
  turns?: Turn[];
```

- [ ] **Step 2: Write the failing tests**

Append to `test/comments.test.mjs`. First extend the import line to include the new helper:

```js
import { addComment, appendUserMessage, loadComments } from '../dist/comments.js';
```

Then add:

```js
test('loadComments migrates a legacy reply into one ai turn', () => {
  const repo = tmpRepo();
  try {
    const c = addComment(repo, { file: 'a.ts', line: 1, type: 'question', body: 'why?' });
    // Simulate an old comments.json written by a pre-turns agent: a bare reply.
    const raw = loadComments(repo);
    raw[0].reply = 'because X';
    delete raw[0].turns;
    writeFileSync(join(repo, '.diffstory', 'comments.json'), JSON.stringify(raw) + '\n');
    const [loaded] = loadComments(repo);
    assert.deepEqual(loaded.turns, [{ role: 'ai', text: 'because X', at: loaded.createdAt }]);
    assert.equal(loaded.id, c.id);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('appendUserMessage adds a user turn and reopens the thread', () => {
  const repo = tmpRepo();
  try {
    const c = addComment(repo, { file: 'a.ts', line: 1, type: 'question', body: 'first?' });
    // Mark it addressed with an ai turn, as if the agent already answered.
    const raw = loadComments(repo);
    raw[0].status = 'addressed';
    raw[0].turns = [{ role: 'ai', text: 'answer', at: '2026-01-01T00:00:00Z' }];
    writeFileSync(join(repo, '.diffstory', 'comments.json'), JSON.stringify(raw) + '\n');

    const updated = appendUserMessage(repo, c.id, '  follow-up question  ');
    assert.equal(updated.status, 'open');
    assert.equal(updated.turns.length, 2);
    assert.equal(updated.turns[1].role, 'user');
    assert.equal(updated.turns[1].text, 'follow-up question');
    assert.ok(updated.turns[1].at);
    assert.deepEqual(loadComments(repo)[0].turns, updated.turns);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test('appendUserMessage rejects empty text and unknown ids', () => {
  const repo = tmpRepo();
  try {
    const c = addComment(repo, { file: 'a.ts', line: 1, type: 'change', body: 'x' });
    assert.throws(() => appendUserMessage(repo, c.id, '   '), /text/);
    assert.equal(appendUserMessage(repo, 'nope', 'hi'), null);
  } finally { rmSync(repo, { recursive: true, force: true }); }
});
```

Add the needed imports at the top of the test file if missing: `writeFileSync` from `node:fs` and `join` from `node:path` are already imported for `tmpRepo`; add `writeFileSync` to the existing `node:fs` import (`mkdtempSync, rmSync, writeFileSync`).

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run build && node --test test/comments.test.mjs`
Expected: FAIL — `appendUserMessage is not a function` / migration assertion mismatch.

- [ ] **Step 4: Implement the storage changes**

In `src/comments.ts`:

Extend the type import:

```ts
import type { Comment, CommentSelection, CommentSide, CommentStatus, CommentType, Turn } from './types.js';
```

Add a roles constant next to the existing `TYPES`/`STATUSES`/`SIDES`:

```ts
const ROLES: Turn['role'][] = ['user', 'ai'];
```

Add the normalizer (place it above `loadComments`):

```ts
/**
 * Back-compat: a legacy single `reply` reads as one `ai` turn so every caller can
 * treat `body` + `turns` as the whole conversation. Non-mutating; leaves `reply` in place.
 */
export function normalizeComment(c: Comment): Comment {
  if (Array.isArray(c.turns) && c.turns.length) return c;
  if (typeof c.reply === 'string' && c.reply.trim()) {
    return { ...c, turns: [{ role: 'ai', text: c.reply, at: c.createdAt }] };
  }
  return c;
}
```

In `loadComments`, change the return to normalize:

```ts
    return Array.isArray(data) ? (data as Comment[]).map(normalizeComment) : [];
```

Add the append helper (place it near `setCommentStatus`):

```ts
/**
 * Reviewer follow-up: append a `user` turn to a comment's conversation and reopen the
 * thread so the agent re-engages. Returns the updated comment, or null if no comment has
 * that id. Throws on empty text.
 */
export function appendUserMessage(repo: string, id: string, text: string): Comment | null {
  const body = typeof text === 'string' ? text.trim() : '';
  if (!body) throw new Error('message text is required');
  const comments = loadComments(repo);
  const target = comments.find((c) => c.id === id);
  if (!target) return null;
  if (!Array.isArray(target.turns)) target.turns = [];
  target.turns.push({ role: 'user', text: body, at: new Date().toISOString() });
  target.status = 'open';
  saveComments(repo, comments);
  return target;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run build && node --test test/comments.test.mjs`
Expected: PASS (all comment-store tests, old and new).

- [ ] **Step 6: Commit**

```bash
git add src/types.ts src/comments.ts dist/comments.js test/comments.test.mjs
git commit -m "feat: comment turns model + appendUserMessage (migrate legacy reply)"
```

(Note: `dist/types.js` has no runtime output for an added interface, so it will not change; if `git status` shows it changed, add it too.)

---

### Task 2: Server endpoint to post a message

Add `POST /api/comments/:id/message` — appends a reviewer turn and reopens the thread, returning the updated comment.

**Files:**
- Modify: `src/server.ts` (import `appendUserMessage`; add the route before the existing `PATCH /api/comments/` handler)
- Test: `test/app-server.test.mjs`

**Interfaces:**
- Consumes: `appendUserMessage` from Task 1; existing `readBody`, `sendJson`, `noRepo`, `loadComments`.
- Produces: `POST /api/comments/<id>/message` with JSON body `{ text: string }` → `200` + updated `Comment`; `400` on empty text; `404` on unknown id; `409` when no repo is open.

- [ ] **Step 1: Write the failing test**

Append to `test/app-server.test.mjs`. This test boots the server, opens a repo, creates a comment via HTTP, then posts a message to it.

```js
test('POST /api/comments/:id/message appends a user turn and reopens the thread', async () => {
  const realHome = process.env.HOME;
  const tmpHome = mkdtempSync(join(tmpdir(), 'ds-home-'));
  process.env.HOME = tmpHome;
  const repo = gitRepo();
  addCommits(repo, 1);
  const { server, base } = await boot();
  try {
    await fetch(`${base}/api/repo/open`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: repo }),
    });
    const created = await (await fetch(`${base}/api/comments`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: 'README.md', line: 1, type: 'question', body: 'why?' }),
    })).json();

    const res = await fetch(`${base}/api/comments/${created.id}/message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'a follow-up' }),
    });
    assert.equal(res.status, 200);
    const updated = await res.json();
    assert.equal(updated.status, 'open');
    assert.equal(updated.turns.at(-1).role, 'user');
    assert.equal(updated.turns.at(-1).text, 'a follow-up');

    const empty = await fetch(`${base}/api/comments/${created.id}/message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: '  ' }),
    });
    assert.equal(empty.status, 400);

    const missing = await fetch(`${base}/api/comments/nope/message`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'x' }),
    });
    assert.equal(missing.status, 404);
  } finally {
    server.close();
    rmSync(repo, { recursive: true, force: true });
    rmSync(tmpHome, { recursive: true, force: true });
    process.env.HOME = realHome;
  }
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run build && node --test test/app-server.test.mjs`
Expected: FAIL — the `/message` POST returns `404 Not found` (route absent), so `res.status` is `404` not `200`.

- [ ] **Step 3: Implement the route**

In `src/server.ts`, add `appendUserMessage` to the import from `./comments.js` (alongside `addComment`, `deleteComment`, `setCommentStatus`, `loadComments`).

Add this handler **immediately before** the `if (method === 'PATCH' && url.pathname.startsWith('/api/comments/'))` block (so the more specific POST route is matched first):

```ts
    if (method === 'POST' && url.pathname.startsWith('/api/comments/') && url.pathname.endsWith('/message')) {
      if (!session.repo) return noRepo(res);
      const repo = session.repo;
      const id = decodeURIComponent(url.pathname.slice('/api/comments/'.length, -'/message'.length));
      return readBody(req, (body) => {
        try {
          const { text } = JSON.parse(body || '{}') as { text?: string };
          const updated = appendUserMessage(repo, id, text ?? '');
          if (updated) sendJson(res, 200, updated);
          else sendJson(res, 404, { error: 'no such comment' });
        } catch (e) {
          sendJson(res, 400, { error: (e as Error).message });
        }
      });
    }
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run build && node --test test/app-server.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/server.ts dist/server.js test/app-server.test.mjs
git commit -m "feat: POST /api/comments/:id/message appends a reviewer turn and reopens"
```

---

### Task 3: Agent prompt + address-review skill

Teach the agent that a comment is a conversation (`body` + `turns`) and that it must **append** an `ai` turn instead of overwriting a single `reply`.

**Files:**
- Modify: `src/agent.ts` (the write-back paragraph in `addressPrompt`)
- Modify: `skills/address-review/SKILL.md` (step 1 field list, step 4 write-back, the example)
- Test: `test/agent.test.mjs`

**Interfaces:**
- Consumes: existing `addressPrompt(target, base?, head?, opts?)` signature — unchanged.
- Produces: prompt text containing the conversation/append contract (asserted by tests).

- [ ] **Step 1: Inspect current prompt assertions**

Run: `rg -n "addressPrompt|reply|turns|append" test/agent.test.mjs`
Read any assertions that reference the old `"reply"` wording so Step 5 can update them rather than leave them stale.

- [ ] **Step 2: Write/adjust the failing test**

In `test/agent.test.mjs`, add (and update any existing assertion that requires the literal old reply-only wording):

```js
test('addressPrompt tells the agent to append an ai turn, not overwrite a reply', () => {
  const p = addressPrompt(['c_1'], 'main');
  assert.match(p, /"turns"/);
  assert.match(p, /append a new turn/i);
  assert.match(p, /"role":"ai"/);
  assert.match(p, /latest "user" message/i);
});
```

Ensure `addressPrompt` is imported at the top of `test/agent.test.mjs` (it is used by existing tests; if not, add it to the import from `../dist/agent.js`).

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm run build && node --test test/agent.test.mjs`
Expected: FAIL — the prompt does not yet mention `turns` / appending an ai turn.

- [ ] **Step 4: Update the prompt**

In `src/agent.ts`, inside `addressPrompt`, replace the single write-back paragraph:

```ts
    `For every comment you handle: set "status" to "addressed" and write a specific "reply" — name the ` +
    `function or file you changed, or give your answer. Preserve every other field and never delete a comment.\n\n` +
```

with the conversation/append contract:

```ts
    `Conversation contract:\n` +
    `- Each comment is a conversation. Its "body" is the reviewer's first message, followed by "turns" — an ordered list of {"role":"user"|"ai","text","at"} messages (a legacy comment may instead have a single "reply" string; treat it as the first ai turn).\n` +
    `- Read the whole thread and answer the latest "user" message in that context.\n\n` +
    `For every comment you handle: append a new turn {"role":"ai","text":"<your specific answer — name the function or file you changed, or give your answer>","at":"<ISO 8601 timestamp>"} to its "turns" array (create the array if it is absent). Never overwrite "body" or an existing turn. Then set "status" to "addressed". Preserve every other field and never delete a comment.\n\n` +
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run build && node --test test/agent.test.mjs`
Expected: PASS (new test + all existing `agent.test.mjs` tests).

- [ ] **Step 6: Update the address-review skill doc**

In `skills/address-review/SKILL.md`:

In **step 1**, update the field list to mention the conversation. Change the trailing `` `body`, and `status`. `` clause to:

```
`body`, `status`, and an optional `turns` array — an ordered `{role:"user"|"ai",text,at}`
conversation that follows `body` (older comments may instead carry a single `reply` string).
```

Replace **step 4** ("Write back") with:

```markdown
4. **Write back** to each comment you handled:
   - **Append** a new turn to its `turns` array: `{"role":"ai","text":"<what you changed
     (name the function/file) or your answer>","at":"<ISO timestamp>"}`. Create the array
     if it is absent. This is the conversation the reviewer sees and can reply to.
   - Never overwrite `body`, and never rewrite an existing turn — the thread is a running
     conversation, so answer the **latest `user` message** in the context of the whole thread.
   - Set `status` to `"addressed"`.
   Preserve every other field. **Never delete a comment** — resolving is the reviewer's call.
   Write the full array back to `.diffstory/comments.json` (valid JSON).
```

Replace the **Example** "After" block with a turns-based version:

```json
{ "id": "c_abc", "step": "s2", "file": "contracts/lib/RateMath.sol", "line": 44,
  "selectedText": "require(cap <= MAX_CAP, \"cap\");",
  "selection": { "startLine": 44, "endLine": 44, "startColumn": 3, "endColumn": 34 },
  "type": "change", "body": "This require should be <= not < — the boundary is valid.",
  "status": "addressed", "createdAt": "2026-06-14T13:10:57.533Z",
  "turns": [
    { "role": "ai",
      "text": "Fixed — changed `cap < MAX` to `cap <= MAX` in _capRate(). Added a boundary test in RateMath.t.sol.",
      "at": "2026-06-14T13:22:04.001Z" }
  ] }
```

In the **Don't** list, replace the "Don't delete or rewrite the reviewer's `body`" bullet with:

```
- Don't overwrite `body` or an existing turn — append your answer as a new `ai` turn.
```

- [ ] **Step 7: Commit**

```bash
git add src/agent.ts dist/agent.js skills/address-review/SKILL.md test/agent.test.mjs
git commit -m "feat: agent appends ai turns to review-thread conversations"
```

---

### Task 4: Server-side render of the conversation

Make `commentHtml` render `body` + every turn (user bubble / `◈` AI block), normalizing a legacy `reply`. Remove the now-superseded "Send again" button.

**Files:**
- Modify: `src/render.ts` (`commentHtml`; import `normalizeComment` + `Turn`; add a `turnHtml` helper)
- Test: `test/comments-render.test.mjs`

**Interfaces:**
- Consumes: `normalizeComment` and the `Turn` type from Task 1; existing `renderMarkdown`, `esc`, `APP_BRAND`, `FLAVOR_ICON`, `FLAVOR_LABEL`, `STATUS_LABEL`, `commentSide`, `authorOf`.
- Produces: `commentHtml(c)` markup where the first user message is `<div class="ds-comment-body ds-md">`, follow-up user turns are `<div class="ds-comment-body ds-turn ds-turn-user ds-md">`, and ai turns are `<div class="ds-reply ds-turn">…</div>`. `data-hasreply="1"` when any ai turn exists. No `data-send` / "Send again" button.

- [ ] **Step 1: Write the failing tests**

In `test/comments-render.test.mjs`, add:

```js
test('a multi-turn comment renders body then turns in order', () => {
  const html = commentHtml({
    id: 'c3', file: 'a.ts', line: 1, type: 'question',
    body: 'why this branch?', status: 'addressed', createdAt: '2026-01-01T00:00:00Z',
    turns: [
      { role: 'ai', text: 'It guards the retry path.', at: '2026-01-01T00:01:00Z' },
      { role: 'user', text: 'what about the first attempt?', at: '2026-01-01T00:02:00Z' },
      { role: 'ai', text: 'First attempt skips it.', at: '2026-01-01T00:03:00Z' },
    ],
  });
  const iBody = html.indexOf('why this branch?');
  const iAi1 = html.indexOf('It guards the retry path.');
  const iUser = html.indexOf('what about the first attempt?');
  const iAi2 = html.indexOf('First attempt skips it.');
  assert.ok(iBody >= 0 && iAi1 > iBody && iUser > iAi1 && iAi2 > iUser, 'turns render in order after body');
  assert.match(html, /ds-turn-user/);
  assert.match(html, /data-hasreply="1"/);
  assert.doesNotMatch(html, /data-send/);
});
```

The existing test `'agent replies render Markdown as safe chat content'` (which passes a legacy `reply` and no `turns`) must keep passing via normalization — do not change it.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run build && node --test test/comments-render.test.mjs`
Expected: FAIL — `ds-turn-user` absent; `data-send` still present.

- [ ] **Step 3: Implement the render changes**

In `src/render.ts`:

Add `normalizeComment` to the import from `./comments.js`, and `Turn` to the type import from `./types.js`.

Add a turn helper above `commentHtml`:

```ts
function turnHtml(t: Turn): string {
  if (t.role === 'user') {
    return `<div class="ds-comment-body ds-turn ds-turn-user ds-md">${renderMarkdown(t.text)}</div>`;
  }
  return `<div class="ds-reply ds-turn">
        <span class="ds-reply-av">◈</span>
        <div class="ds-reply-main">
          <div class="ds-reply-who"><span class="ds-reply-name">${esc(APP_BRAND)}</span><span class="ds-ai-badge">AI</span></div>
          <div class="ds-reply-body ds-md">${renderMarkdown(t.text)}</div>
        </div>
      </div>`;
}
```

Rewrite `commentHtml` to normalize, render turns, drop "Send again". Replace the function body so it reads:

```ts
export function commentHtml(c0: Comment): string {
  const c = normalizeComment(c0);
  const type = (['change', 'question', 'nit'] as CommentType[]).includes(c.type as CommentType)
    ? (c.type as CommentType)
    : 'change';
  const turns = c.turns ?? [];
  const turnsHtml = turns.map(turnHtml).join('');
  const hasReply = turns.some((t) => t.role === 'ai');
  const resolved = c.status === 'resolved';
  const selectionLabel = commentSide(c) === 'left' ? 'Selected old side' : 'Selected new side';
  const selection = c.selectedText
    ? `<div class="ds-comment-selection"><span>${selectionLabel}</span><code>${esc(c.selectedText)}</code></div>`
    : '';
  return `<div class="ds-comment status-${c.status}" data-comment-id="${esc(c.id)}" data-status="${
    c.status
  }"${hasReply ? ' data-hasreply="1"' : ''}>
    <div class="ds-comment-card flavor-${type}">
      <div class="ds-comment-head">
        <span class="ds-flavor-ico">${FLAVOR_ICON[type]}</span>
        <span class="ds-flavor-label">${FLAVOR_LABEL[type]}</span>
        <span class="ds-dot"></span>
        <span class="ds-comment-author">${esc(authorOf(c))}</span>
        <span class="ds-flex"></span>
        <span class="ds-statusbadge"><span class="ds-dot"></span>${STATUS_LABEL[c.status]}</span>
      </div>
      ${selection}
      <div class="ds-comment-body ds-md">${renderMarkdown(c.body)}</div>
      ${turnsHtml}
      <div class="ds-comment-actions">
        <button class="ds-ghost" data-resolve>${resolved ? 'Reopen' : 'Resolve'}</button>
        <button class="ds-ghost ds-del" data-delete>Delete</button>
      </div>
    </div>
  </div>`;
}
```

> Verify against the current file while editing: keep whatever `data-delete` / closing markup the existing `commentHtml` used after the `data-resolve` button; the block above shows the intended end state (Resolve + Delete, no Send again). Preserve the exact closing tags the function already had.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run build && node --test test/comments-render.test.mjs`
Expected: PASS (new multi-turn test + existing legacy-reply test).

- [ ] **Step 5: Commit**

```bash
git add src/render.ts dist/render.js test/comments-render.test.mjs
git commit -m "feat: server-render review-thread conversations, drop Send again"
```

---

### Task 5: Client render of the conversation

Render `body` + turns in the browser client, replacing the single-reply path. Introduce `turnNode` and `renderConversation`, wire them into `buildComment` and `patchComment`, and drop the "Send again" button.

**Files:**
- Modify: `src/page-assets.ts` (`PAGE_JS`: `buildComment`, `patchComment`, add `turnNode` + `renderConversation`; `PAGE_CSS`: `.ds-turn-user`)
- Test: `test/comments-client.test.mjs`

**Interfaces:**
- Consumes: existing `el`, `markdownBlock`, `$`, `$all`, `BRAND`, `clearAgentDrafts`.
- Produces:
  - `turnNode(t)` → DOM node for one turn (`ds-comment-body ds-turn ds-turn-user ds-md` for `user`, `ds-reply ds-turn` for `ai`).
  - `renderConversation(wrap, c)` → removes existing `.ds-turn` nodes, then inserts a node per `c.turns` entry before the live-draft-or-actions anchor.

- [ ] **Step 1: Update the failing client tests**

In `test/comments-client.test.mjs`, update the test `'client renders comment replies through the same Markdown path'`. Replace its body with:

```js
test('client renders comment replies through the same Markdown path', () => {
  assert.match(PAGE_JS, /function renderMarkdown\(/);
  assert.match(PAGE_JS, /function renderInlineMarkdown\(/);
  assert.match(PAGE_JS, /markdownBlock\('ds-comment-body ds-md',c\.body\)/);
  assert.match(PAGE_JS, /function turnNode\(/);
  assert.match(PAGE_JS, /function renderConversation\(/);
  assert.match(PAGE_JS, /renderConversation\(wrap,c\)/);
});

test('client no longer renders a Send again button', () => {
  assert.doesNotMatch(PAGE_JS, /Send again/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run build && node --test test/comments-client.test.mjs`
Expected: FAIL — `turnNode` / `renderConversation` absent; "Send again" still present.

- [ ] **Step 3: Add `turnNode` and `renderConversation`**

In `src/page-assets.ts` (`PAGE_JS`), add these functions near `ensureReply`:

```js
  function turnNode(t){
    if(t.role==='user')return markdownBlock('ds-comment-body ds-turn ds-turn-user ds-md',t.text);
    var r=el('div','ds-reply ds-turn');
    r.appendChild(el('span','ds-reply-av','◈'));
    var main=el('div','ds-reply-main');
    var who=el('div','ds-reply-who');who.appendChild(el('span','ds-reply-name',BRAND));who.appendChild(el('span','ds-ai-badge','AI'));
    main.appendChild(who);
    main.appendChild(markdownBlock('ds-reply-body ds-md',t.text));
    r.appendChild(main);
    return r;
  }
  function renderConversation(wrap,c){
    var card=$('.ds-comment-card',wrap);if(!card)return;
    $all('.ds-turn',card).forEach(function(n){if(n.parentNode)n.parentNode.removeChild(n);});
    var anchor=$('.ds-reply-live',card)||$('.ds-comment-actions',card);
    var turns=(c&&c.turns)||[];
    for(var i=0;i<turns.length;i++)card.insertBefore(turnNode(turns[i]),anchor||null);
  }
```

- [ ] **Step 4: Wire into `buildComment`**

In `buildComment`, make three changes:

1. Change the `data-hasreply` line from `if(c.reply)...` to base it on ai turns:

```js
    wrap.setAttribute('data-comment-id',c.id);wrap.setAttribute('data-status',c.status);
    if((c.turns||[]).some(function(t){return t.role==='ai';}))wrap.setAttribute('data-hasreply','1');
```

2. Remove the "Send again" button line entirely:

```js
    if(c.status!=='resolved'){var snd=el('button','ds-ghost ds-send','Send again');snd.setAttribute('data-send','');actions.appendChild(snd);}
```

3. Change the final line from `if(c.reply)ensureReply(wrap,c.reply);return wrap;` to:

```js
    card.appendChild(actions);wrap.appendChild(card);renderConversation(wrap,c);return wrap;
```

- [ ] **Step 5: Wire into `patchComment`**

In `patchComment`, replace the reply branch:

```js
      if(c.reply){wrap.setAttribute('data-hasreply','1');ensureReply(wrap,c.reply);clearAgentDrafts([c.id]);}
```

with a turns-based render (leave draft-clearing to the address finish flow):

```js
      if((c.turns||[]).some(function(t){return t.role==='ai';}))wrap.setAttribute('data-hasreply','1');
      renderConversation(wrap,c);
```

Also remove the now-dead `[data-send]` toggle line in `patchComment` (`var snd=$('[data-send]',wrap);if(snd)snd.style.display=...`), since the button no longer exists.

- [ ] **Step 6: Add `.ds-turn-user` CSS**

In `PAGE_CSS`, next to the `.ds-comment-body` rule, add a small top-margin so stacked follow-up user bubbles breathe (visual style is inherited from `.ds-comment-body`):

```css
.ds-turn-user{margin-top:2px}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npm run build && node --test test/comments-client.test.mjs`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/page-assets.ts dist/page-assets.js test/comments-client.test.mjs
git commit -m "feat: client renders review-thread conversations from turns"
```

---

### Task 6: Persistent chat composer

Add an always-present chat input at the bottom of every thread. Submitting posts a message, re-renders authoritatively, and re-runs the agent. Disable it while an agent run is in progress.

**Files:**
- Modify: `src/page-assets.ts` (`PAGE_JS`: `buildThreadComposer`, `sendThreadMessage`, extend `setBusy`, click + keydown wiring, append composer in `buildComment`; `PAGE_CSS`: composer styles)
- Test: `test/comments-client.test.mjs`

**Interfaces:**
- Consumes: existing `allComments`, `API`, `agentBusy`, `setBusy`, `sendToAgent`, `patchComment`, `refreshCount`, `toast`, `closest`, event-delegation click handler.
- Produces:
  - `buildThreadComposer(c)` → `.ds-thread-composer` node (textarea `[data-thread-ta]` + Send button `[data-thread-send]`).
  - `sendThreadMessage(wrap)` → POSTs `/api/comments/:id/message`, updates `allComments`, `patchComment`, then `sendToAgent([id])`.

- [ ] **Step 1: Write the failing tests**

In `test/comments-client.test.mjs`, add:

```js
test('client mounts a persistent chat composer that posts and re-runs the agent', () => {
  assert.match(PAGE_JS, /function buildThreadComposer\(/);
  assert.match(PAGE_JS, /function sendThreadMessage\(/);
  assert.match(PAGE_JS, /data-thread-send/);
  assert.match(PAGE_JS, /data-thread-ta/);
  assert.match(PAGE_JS, /\/message/);
  assert.match(PAGE_JS, /sendToAgent\(\[id\]\)/);
  assert.match(PAGE_CSS, /\.ds-thread-composer/);
  assert.match(PAGE_CSS, /\.ds-thread-ta/);
});

test('the composer send is disabled while the agent is busy', () => {
  assert.match(PAGE_JS, /\[data-thread-send\]'\)\.forEach/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run build && node --test test/comments-client.test.mjs`
Expected: FAIL — composer functions/markers absent.

- [ ] **Step 3: Implement composer build + send**

In `src/page-assets.ts` (`PAGE_JS`), add:

```js
  function buildThreadComposer(c){
    var box=el('div','ds-thread-composer');
    var ta=el('textarea','ds-thread-ta');ta.placeholder='Reply to '+BRAND+'…';ta.rows=1;
    ta.setAttribute('data-thread-ta','');
    var send=el('button','ds-btn ds-btn-solid ds-thread-send','Send');
    send.setAttribute('data-thread-send','');
    if(agentBusy){ta.disabled=true;send.disabled=true;}
    box.appendChild(ta);box.appendChild(send);
    return box;
  }
  function sendThreadMessage(wrap){
    if(!wrap)return;
    var id=wrap.getAttribute('data-comment-id');
    var ta=$('[data-thread-ta]',wrap);if(!ta)return;
    var text=ta.value.trim();if(!text)return;
    if(agentBusy){toast('The agent is already working; wait for it to finish.');return;}
    ta.value='';
    fetch(API+'/'+encodeURIComponent(id)+'/message',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:text})})
      .then(function(r){if(!r.ok)throw 0;return r.json();})
      .then(function(updated){
        var found=false;
        for(var i=0;i<allComments.length;i++){if(allComments[i].id===id){allComments[i]=updated;found=true;break;}}
        if(!found)allComments.push(updated);
        patchComment(updated);refreshCount();
        sendToAgent([id]);
      }).catch(function(){toast('Could not send your message.');});
  }
```

- [ ] **Step 4: Mount the composer in `buildComment`**

In `buildComment`, after `card.appendChild(actions);` and before `wrap.appendChild(card);`, append the composer (it is always shown, per the decision):

```js
    card.appendChild(actions);card.appendChild(buildThreadComposer(c));wrap.appendChild(card);renderConversation(wrap,c);return wrap;
```

(Replace the line added in Task 5 Step 4.3 with this one.)

- [ ] **Step 5: Extend `setBusy`**

In `setBusy`, after the existing `$all('[data-send]')...` line (or replacing it, since `data-send` no longer exists), disable composer controls:

```js
    $all('[data-thread-send]').forEach(function(s){s.disabled=b;});
    $all('[data-thread-ta]').forEach(function(s){s.disabled=b;});
```

(Remove the stale `$all('[data-send]').forEach(...)` line — that button is gone.)

- [ ] **Step 6: Wire click + Enter-to-send**

In the document click delegation (near `b=closest(t,'[data-resolve]')...`), add:

```js
    b=closest(t,'[data-thread-send]');if(b){sendThreadMessage(closest(b,'.ds-comment'));return;}
```

Add an Enter-to-send keydown listener (place it beside the other top-level `document.addEventListener` calls, e.g. next to the contextmenu/mousedown listeners):

```js
  document.addEventListener('keydown',function(e){
    if(e.key!=='Enter'||e.shiftKey)return;
    var ta=closest(e.target,'[data-thread-ta]');if(!ta)return;
    e.preventDefault();sendThreadMessage(closest(ta,'.ds-comment'));
  });
```

- [ ] **Step 7: Add composer CSS**

In `PAGE_CSS`, add near the `.ds-comment-actions` rule:

```css
.ds-thread-composer{align-self:stretch;display:flex;gap:8px;align-items:flex-end;margin-top:8px}
.ds-thread-ta{flex:1;min-width:0;resize:none;font:inherit;font-size:13px;line-height:1.5;color:var(--text);background:var(--panel3);border:1px solid var(--line-soft);border-radius:10px;padding:9px 12px;max-height:160px}
.ds-thread-ta:focus{outline:none;border-color:var(--accent-blue)}
.ds-thread-ta:disabled{opacity:0.5}
.ds-thread-send{flex:none;align-self:flex-end}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npm run build && node --test test/comments-client.test.mjs`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/page-assets.ts dist/page-assets.js test/comments-client.test.mjs
git commit -m "feat: persistent in-thread chat composer that re-runs the agent"
```

---

### Task 7: Full suite, manual smoke, final commit

Verify the whole feature end-to-end, confirm no other test regressed, and make sure `dist/` is fully rebuilt and committed.

**Files:** none new — verification + any stray `dist/` artifacts.

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: PASS for every `test/*.test.mjs`. If a previously-passing test broke (e.g. a `render-page.test.mjs` snapshot that included "Send again"), fix it: update the expectation to match the new markup (Resolve/Delete only, plus the composer). Re-run until green.

- [ ] **Step 2: Manual smoke test (optional but recommended)**

Start the app against this repo, open a change, leave a `question` comment, wait for the AI turn, then use the chat box to send a follow-up and confirm a new AI turn appears in order and the thread reopens if it was resolved. Use the project's run path:

Run: `npm run build && node dist/cli.js` (then open the printed URL).
Confirm: the chat box shows on every thread; Enter sends; Shift+Enter makes a newline; the box is disabled while the agent is working.

- [ ] **Step 3: Confirm dist is consistent and nothing unrelated was staged**

Run: `git status` and `git diff --stat HEAD~6..HEAD`
Confirm: only `src/`, `dist/`, `test/`, `skills/`, and `docs/` files from this feature are committed; the unrelated intra-line working-tree changes remain unstaged.

- [ ] **Step 4: Final commit (only if Step 1 required fixes or dist drift remains)**

```bash
git add <the specific fixed files and their dist/*.js>
git commit -m "test: keep suite green for conversational review threads"
```

---

## Self-Review

**Spec coverage:**
- Turn model + migration → Task 1. ✅
- `POST /api/comments/:id/message` appends user turn + reopens → Task 2. ✅
- Agent appends ai turn / reads full thread; skill + prompt updated → Task 3. ✅
- Server render of `body` + turns; "Send again" retired → Task 4. ✅
- Client render of turns → Task 5. ✅
- Persistent chat composer, auto-run each turn, disabled while busy, always shown → Task 6. ✅
- Full agent (can edit code): unchanged `/api/address` reuse means change-intent follow-ups still edit + surface "Reload diff" — covered by reusing `sendToAgent`/`addressProgressPanel` (Task 6), no new work needed. ✅
- Resolved threads always show the input; a new message reopens → composer is unconditional in Task 6 Step 4, and `appendUserMessage` sets `status='open'` in Task 1. ✅
- dist committed with src → every task commit + Task 7. ✅

**Placeholder scan:** No TBD/TODO; every code step shows the actual code and every verify step shows the command + expected result.

**Type consistency:** `Turn`/`turns` shape (`{role,text,at}`) is identical across `types.ts`, `comments.ts`, `render.ts`, and the client. `normalizeComment` is defined in Task 1 and consumed by name in Task 4. `appendUserMessage` is defined in Task 1 and consumed in Task 2. Client `turnNode`/`renderConversation` are defined in Task 5 and consumed in Tasks 5–6. `data-thread-send`/`data-thread-ta` markers match between build (Task 6 Step 3), `setBusy` (Step 5), and wiring (Step 6).
