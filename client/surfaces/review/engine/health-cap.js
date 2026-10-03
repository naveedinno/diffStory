// Health-row capping. A large story can carry hundreds of lint findings, and
// the health `<details>` opens expanded — rendering every row stalls the
// first paint. Each section shows the first MAX_HEALTH_ROWS (findings arrive
// errors-first from the server) and names the remainder. Plain JavaScript so
// node tests import it directly — see `diagram-errors.js`.

export const MAX_HEALTH_ROWS = 10;

/**
 * Split a section's findings into the rows to render plus the overflow count.
 * Pure: the input array is never mutated.
 */
export function capHealthRows(rows, max = MAX_HEALTH_ROWS) {
  const list = Array.isArray(rows) ? rows : [];
  const limit = Number.isInteger(max) && max >= 0 ? max : MAX_HEALTH_ROWS;
  return { shown: list.slice(0, limit), rest: Math.max(0, list.length - limit) };
}
