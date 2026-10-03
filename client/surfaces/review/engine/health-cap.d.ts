// Types for health-row capping. `health-cap.js` is deliberately plain
// JavaScript so node tests import it directly — see its header.

import type { StoryHealthFinding } from "../../../../src/payloads";

export const MAX_HEALTH_ROWS: number;

export interface CappedHealthRows {
  shown: StoryHealthFinding[];
  rest: number;
}

export function capHealthRows(
  rows: readonly StoryHealthFinding[],
  max?: number,
): CappedHealthRows;
