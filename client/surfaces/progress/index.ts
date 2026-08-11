// The progress surface's public contract.
//
// The review page imports from here and from nowhere deeper. Everything a host
// needs to run, render and recover from an agent run is on this barrel:
//
//   const run = useProgressRun({ onStop, onClose, onDone, onBlocked });
//   run.start();
//   await runProgress(run, "/api/generate", payload, controller.signal);
//   <ProgressPanel run={run} variant="stage" foot={recoveryButtons} />

export { ProgressPanel, progressPrimaryActionClass, progressSecondaryActionClass } from "./ProgressPanel";
export type { ProgressPanelProps } from "./ProgressPanel";
export { useProgressRun } from "./use-progress-run";
export type { ProgressRun, ProgressRunOptions } from "./use-progress-run";
export { runProgress } from "./run-progress";
export type { ProgressSink } from "./run-progress";
export {
  applyEvent,
  blockRun,
  finishRun,
  initialProgressState,
  startRun,
  elapsedLabel,
} from "./state";
export type {
  ProgressError,
  ProgressPhase,
  ProgressState,
  ProgressVariant,
} from "./state";
