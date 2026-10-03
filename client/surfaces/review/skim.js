// Pure grouping for the rail's skim runs.
//
// Consecutive `skim` steps of length 2+ collapse into one disclosure; lone
// skim steps and every `must` step render as their own card. The engine
// imports nothing from here — it reads `data-step-weight` off the panels —
// but node tests import this directly, which is why it lives outside the
// TSX rail.

/**
 * @param items `[{ step, index }]` in rail order; `step.weight` is the
 *   server-resolved `'must' | 'skim'`.
 * @returns items in order, where each entry is `{ kind: 'step', step, index }`
 *   or `{ kind: 'run', steps: [{ step, index }] }` for a collapsed skim run.
 */
export function groupSkimRuns(items) {
  var groups = [];
  var run = [];
  function flush() {
    if (!run.length) return;
    if (run.length === 1) groups.push({ kind: 'step', step: run[0].step, index: run[0].index });
    else groups.push({ kind: 'run', steps: run });
    run = [];
  }
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    if (item.step && item.step.weight === 'skim') run.push(item);
    else {
      flush();
      groups.push({ kind: 'step', step: item.step, index: item.index });
    }
  }
  flush();
  return groups;
}
