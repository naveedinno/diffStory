// Builds a throwaway git repo with a realistic multi-file change + a tour, then
// opens the diffStory review page on it. Run with: npm run demo
// Set DIFFSTORY_DEMO_NO_SERVE=1 to build the repo without launching the server.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'dist', 'cli.js');
const DEMO = process.env.DIFFSTORY_DEMO_DIR || join(tmpdir(), 'diffstory-demo');

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
  "version": 2,
  "mode": "guided",
  "title": "Add per-customer monthly spending limit",
  "summary": "Start at the existing POST /orders boundary, follow the new decision into customer state, then return to the placement path and its proof. Slow down on the exact-cap boundary.",
  "intent": {
    "goal": "Stop an order from taking a customer past the monthly spending cap.",
    "design": "The existing POST /orders path still owns placement; this change inserts a limit decision before placeOrder(), reads monthlySpend through the existing customer store, and records accepted spend in the placement path.",
    "sources": ["commit feat: per-customer monthly spending limit"]
  },
  "base": "main",
  "steps": [
    {
      "id": "s1", "order": 1, "title": "POST /orders keeps ownership and gains one pre-placement decision",
      "file": "src/api.ts", "range": [1, 16], "viewport": [1, 16],
      "highlights": [[4, 6], [8, 12], [14, 15]], "kind": "changed",
      "why": "I keep the existing order boundary and stop over-cap requests before placeOrder() can mutate anything.",
      "beats": [
        { "text": "Start here: this existing handler is where a customer order enters the app.", "highlights": [[4, 6]] },
        { "text": "The new decision reads the limit and returns before placement when the request would cross it.", "highlights": [[8, 12]] },
        { "text": "The accepted path still reaches the same placeOrder() call and 201 response.", "highlights": [[14, 15]] }
      ],
      "calls": ["s2"], "tags": ["entrypoint"]
    },
    {
      "id": "c1", "order": 2, "title": "The limit is a decision over derived budget, not a stored flag",
      "kind": "concept",
      "body": "## Three values form the policy\\n\\nThe store owns **spent so far**. Configuration supplies the **monthly cap**. The helper derives **remaining budget**, then compares the incoming order amount with that result.\\n\\nThat separation matters in the next steps: \`monthlySpend\` is state, \`MONTHLY_CAP\` is policy, and \`remaining\` is temporary decision data. No file stores whether a customer is currently over the limit.\\n\\n> Review the comparison as a business boundary: an amount equal to the remaining budget should either be deliberately accepted or deliberately rejected.",
      "preparesFor": ["s2", "s3", "s4"],
      "diagram": {
        "type": "mermaid",
        "source": "flowchart LR\\n  Stored[Spent so far] --> Remaining[Remaining budget]\\n  Cap[Monthly cap] --> Remaining\\n  Remaining --> Gate{Order fits?}\\n  Amount[Order amount] --> Gate",
        "caption": "Stored spend and the cap produce a remaining budget; the incoming amount is compared with that derived value."
      },
      "tags": ["mental-model", "policy"]
    },
    {
      "id": "s2", "order": 3, "title": "checkSpendingLimit() turns stored spend into the gate result",
      "file": "src/limits.ts", "range": [1, 11], "viewport": [1, 11],
      "highlights": [[1, 5], [7, 10]], "kind": "new-file",
      "why": "I isolate the cap math here, with the exact-equality comparison as the review hinge.",
      "beats": [
        { "text": "The API hands customerId and amount here, and this helper owns the fixed monthly cap.", "highlights": [[1, 5]] },
        { "text": "It derives remaining budget from stored spend; pause on amount < remaining because equal-to-remaining is the boundary risk.", "highlights": [[7, 10]] }
      ],
      "calls": ["s3"], "returnsTo": "s1", "tags": ["core"]
    },
    {
      "id": "s3", "order": 4, "title": "Existing customer storage supplies monthlySpend",
      "file": "src/db.ts", "range": [1, 8], "viewport": [1, 8],
      "highlights": [[2, 4], [6, 8]], "kind": "context",
      "why": "Unchanged context: this store is the state contract the new helper relies on.",
      "beats": [
        { "text": "Unchanged, but essential: customer state already owns monthlySpend.", "highlights": [[2, 4]] },
        { "text": "checkSpendingLimit() reaches it through this existing getter rather than a new data path.", "highlights": [[6, 8]] }
      ],
      "returnsTo": "s2", "tags": ["context"]
    },
    {
      "id": "s4", "order": 5, "title": "Accepted orders feed spend back into the placement path",
      "file": "src/orders.ts", "range": [1, 13], "viewport": [1, 13],
      "highlights": [[3, 6], [10, 13]], "kind": "changed",
      "why": "Back on the accepted path, I record the spend after storing the order so the next limit check can see it.",
      "beats": [
        { "text": "Now that the gate passed, the existing placeOrder() path still creates and stores the order.", "highlights": [[3, 5]] },
        { "text": "The new handoff records that accepted amount before the function returns.", "highlights": [[6, 6]] },
        { "text": "This demo helper is the downstream effect; its persistence limitation is deliberately visible here.", "highlights": [[10, 13]] }
      ],
      "returnsTo": "s1", "tags": ["core"]
    },
    {
      "id": "s5", "order": 6, "title": "Rejection proof leaves the exact boundary exposed",
      "file": "test/limits.test.ts", "range": [1, 7], "viewport": [1, 7],
      "highlights": [[1, 7]], "kind": "new-file",
      "why": "The test proves an over-cap request fails, while leaving equal-to-remaining as the missing case to review.",
      "beats": [
        { "text": "Final proof: the test drives the same helper with a customer who only has 150 left.", "highlights": [[1, 3]] },
        { "text": "It pins the over-cap rejection but does not settle the exact-equality behavior flagged above.", "highlights": [[4, 7]] }
      ],
      "tags": ["test"]
    }
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
git(['config', 'user.email', 'demo@diffstory']);
git(['config', 'user.name', 'diffStory demo']);
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
write('.diffstory/story.json', TOUR);
write('.diffstory/comments.json', COMMENTS);

console.log('\nDemo repo built at: ' + DEMO);

if (process.env.DIFFSTORY_DEMO_NO_SERVE) {
  console.log('\n(skipping serve; DIFFSTORY_DEMO_NO_SERVE set)');
  process.exit(0);
}

console.log('\nOpening the app — pick the saved story or view the diff. Ctrl-C to stop.\n');
try {
  execFileSync('node', [CLI, '--dir', DEMO], { stdio: 'inherit' });
} catch {
  /* Ctrl-C */
}
