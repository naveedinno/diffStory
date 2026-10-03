// Types for the skim-run grouping. `skim.js` is deliberately plain
// JavaScript so node tests import it directly — see its header.

import type { ReviewStepView } from "../../../src/payloads";

export interface SkimRunItem {
  step: ReviewStepView;
  index: number;
}

export type SkimRunGroup =
  | { kind: "step"; step: ReviewStepView; index: number }
  | { kind: "run"; steps: SkimRunItem[] };

export function groupSkimRuns(items: SkimRunItem[]): SkimRunGroup[];
