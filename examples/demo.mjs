// Builds a throwaway git repo with a realistic multi-file change + a tour, then
// opens the Cairn review page on it. Run with: npm run demo
// Set CAIRN_DEMO_NO_SERVE=1 to build the repo without launching the server.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'dist', 'cli.js');
const DEMO = process.env.CAIRN_DEMO_DIR || join(tmpdir(), 'cairn-demo');

// ---------------------------------------------------------------------------
// File contents. Authored so line numbers match the tour ranges exactly.
// (No backticks or ${} inside — they'd clash with these template literals.)
// ---------------------------------------------------------------------------

const BASE_API = `import { placeOrder } from './orders.js';

// POST /orders — create an order for a customer.
export async function createOrder(req) {
  const { customerId, amount, items } = req.body;
  const order = await placeOrder(customerId, amount, items);
  return { status: 201, order };
}
`;

const NEW_API = `import { placeOrder } from './orders.js';
import { checkSpendingLimit } from './limits.js';

// POST /orders — create an order for a customer.
export async function createOrder(req) {
  const { customerId, amount, items } = req.body;

  // Reject the order if it would blow the customer's monthly cap.
  const limit = await checkSpendingLimit(customerId, amount);
  if (!limit.ok) {
    return { status: 402, error: 'over the limit, ' + limit.remaining + ' remaining' };
  }

  const order = await placeOrder(customerId, amount, items);
  return { status: 201, order };
}
`;

const BASE_ORDERS = `const orders = [];

export async function placeOrder(customerId, amount, items) {
  const order = { id: orders.length + 1, customerId, amount, items };
  orders.push(order);
  return order;
}
`;

const NEW_ORDERS = `const orders = []; // FIXME: persist these somewhere real

export async function placeOrder(customerId, amount, items) {
  const order = { id: orders.length + 1, customerId, amount, items };
  orders.push(order);
  recordSpend(customerId, amount); // track spend toward the monthly cap
  return order;
}

function recordSpend(customerId, amount) {
  // demo persistence — a real impl would update the customer's monthlySpend
  console.log('spend', customerId, '+=', amount);
}
`;

const DB = `// In-memory customer store (demo only).
const customers = {
  c1: { id: 'c1', name: 'Acme', monthlySpend: 850 },
};

export async function getCustomer(id) {
  return customers[id];
}
`;

const NEW_LIMITS = `import { getCustomer } from './db.js';

const MONTHLY_CAP = 1000;

// How much more this customer can spend this month.
export async function checkSpendingLimit(customerId, amount) {
  const customer = await getCustomer(customerId);
  const spent = customer.monthlySpend || 0;
  const remaining = MONTHLY_CAP - spent;
  return { ok: amount < remaining, remaining };
}
`;

const NEW_TEST = `import { checkSpendingLimit } from '../src/limits.js';

test('rejects an order over the monthly cap', async () => {
  const r = await checkSpendingLimit('c1', 500);
  // c1 has spent 850 of 1000, so only 150 remains — 500 must be rejected.
  expect(r.ok).toBe(false);
});
`;

const TOUR = `{
  "version": 1,
  "title": "Add per-customer monthly spending limit",
  "summary": "Start at the API entry point, follow the new limit check across files, then see where the spend gets recorded. The jumps mirror the call flow — read top to bottom.",
  "steps": [
    { "id": "s1", "order": 1, "title": "Entry point: createOrder() now checks the limit", "file": "src/api.ts", "range": [1, 16], "kind": "changed", "why": "Start here — the POST /orders handler. The new block on lines 8-12 rejects the order before placing it. Verify the check runs BEFORE placeOrder, not after.", "calls": ["s2"], "tags": ["entrypoint"] },
    { "id": "s2", "order": 2, "title": "The check it calls: checkSpendingLimit() (new file)", "file": "src/limits.ts", "range": [1, 11], "kind": "new-file", "why": "createOrder delegates here. It reads the customer's spend and compares against the cap. Look hard at line 10 — the boundary condition is the risky bit.", "calls": ["s3"], "returnsTo": "s1", "tags": ["core"] },
    { "id": "s3", "order": 3, "title": "What it reads: getCustomer() (unchanged)", "file": "src/db.ts", "range": [6, 8], "kind": "context", "why": "Not changed — shown only so the limit check makes sense. monthlySpend is the field the cap compares against; in the demo, c1 has spent 850 of 1000.", "returnsTo": "s2", "tags": ["context"] },
    { "id": "s4", "order": 4, "title": "Back in the order path: recording the spend", "file": "src/orders.ts", "range": [3, 13], "kind": "changed", "why": "Once the limit passes, placeOrder records the spend via the new recordSpend() helper so the next request sees the updated total.", "returnsTo": "s1", "tags": ["core"] },
    { "id": "s5", "order": 5, "title": "Test: an over-cap order is rejected", "file": "test/limits.test.ts", "range": [1, 7], "kind": "new-file", "why": "Covers the rejection path. Notice it does NOT test the exact-boundary case (amount equal to remaining) — see the comment on limits.ts:10.", "tags": ["test"] }
  ]
}
`;

const COMMENTS = `[
  { "id": "c_demo1", "step": "s2", "file": "src/limits.ts", "line": 10, "type": "change", "body": "Boundary bug? 'amount < remaining' rejects a spend that exactly equals the remaining budget. Should this be '<=' ?", "status": "open", "createdAt": "2026-06-14T12:00:00.000Z" },
  { "id": "c_demo2", "step": "s1", "file": "src/api.ts", "line": 11, "type": "question", "body": "Is 402 the right status for over-limit, or should this be 403/429? What does the rest of the API use?", "status": "open", "createdAt": "2026-06-14T12:01:00.000Z" }
]
`;

// ---------------------------------------------------------------------------

function git(args) {
  execFileSync('git', args, { cwd: DEMO, stdio: ['ignore', 'pipe', 'pipe'] });
}
function write(rel, content) {
  const p = join(DEMO, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content);
}

// reset + base commit (on main)
rmSync(DEMO, { recursive: true, force: true });
mkdirSync(DEMO, { recursive: true });
git(['init', '-q', '-b', 'main']);
git(['config', 'user.email', 'demo@cairn']);
git(['config', 'user.name', 'cairn demo']);
write('src/api.ts', BASE_API);
write('src/orders.ts', BASE_ORDERS);
write('src/db.ts', DB);
git(['add', '-A']);
git(['commit', '-qm', 'base: orders service']);

// the change (on a feature branch)
git(['checkout', '-q', '-b', 'feat/spending-limit']);
write('src/api.ts', NEW_API);
write('src/orders.ts', NEW_ORDERS);
write('src/limits.ts', NEW_LIMITS);
write('test/limits.test.ts', NEW_TEST);
git(['add', '-A']);
git(['commit', '-qm', 'feat: per-customer monthly spending limit']);

// the tour + a couple of pre-seeded comments
write('.cairn/review-tour.json', TOUR);
write('.cairn/comments.json', COMMENTS);

console.log('\nDemo repo built at: ' + DEMO);
console.log('— cairn check —');
try {
  execFileSync('node', [CLI, 'check', '--dir', DEMO], { stdio: 'inherit' });
} catch {
  /* `check` exits 1 when something is uncovered — that's the point of this demo */
}

if (process.env.CAIRN_DEMO_NO_SERVE) {
  console.log('\n(skipping serve; CAIRN_DEMO_NO_SERVE set)');
  process.exit(0);
}

console.log('\nOpening the review page — Ctrl-C to stop.\n');
try {
  execFileSync('node', [CLI, 'serve', '--dir', DEMO], { stdio: 'inherit' });
} catch {
  /* Ctrl-C */
}
