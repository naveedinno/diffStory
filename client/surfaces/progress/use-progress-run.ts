// The imperative handle the review page drives a run with.
//
// The panel is fed by the NDJSON response body of `POST /api/generate` or
// `POST /api/story/repair`, which is a push stream, not a render input. So the
// host does not "pass props that describe the run" — it calls `start()`, pipes
// events in with `handle()`, and renders `<ProgressPanel run={run} />`.
//
// Everything about *what those calls mean* lives in `state.ts`. This file is
// only the React seam: one `useState` for the state, one `useRef` so callbacks
// can read the latest state without being re-created on every event, and a
// stable identity so the host can put the run in a ref if it wants to.

import { useCallback, useMemo, useRef, useState } from "react";
import type { ProgressEvent, RunStatus } from "../../../src/progress";
import {
  applyEvent,
  blockRun,
  finishRun,
  initialProgressState,
  startRun,
  type ProgressError,
  type ProgressState,
} from "./state";

export interface ProgressRunOptions {
  /** Every event, before the panel sees it. The vanilla `opts.onEvent`. */
  onEvent?: (event: ProgressEvent) => void;
  /** The Stop button. Abort your `AbortController` here. */
  onStop?: () => void;
  /** The Close button. Defaults to closing the panel when not supplied. */
  onClose?: () => void;
  /** A run that ended, however it ended. */
  onDone?: (status: RunStatus, result: Record<string, unknown>) => void;
  /** A run that never started. */
  onBlocked?: (error: ProgressError) => void;
}

export interface ProgressRun {
  state: ProgressState;
  /** Open the panel and begin a run. Clears everything the last run left. */
  start: () => void;
  /** Fold one streamed event in. Safe to call with anything off the wire. */
  handle: (event: ProgressEvent) => void;
  /** End a run that did not end with a `run_done` event. */
  finish: (status: RunStatus, result?: Record<string, unknown>) => void;
  /** The run could not start. Shows "Cannot start" and the reason. */
  blocked: (error?: ProgressError) => void;
  /** Hide the panel and drop the run view. */
  close: () => void;
  /** The last error seen, for a host building a recovery affordance. */
  error: () => ProgressError | null;
  /** Wired to the Stop button. */
  requestStop: () => void;
  /** Wired to the Close button. Falls back to `close()`. */
  requestClose: () => void;
}

export function useProgressRun(options: ProgressRunOptions = {}): ProgressRun {
  const [state, setState] = useState<ProgressState>(initialProgressState);

  // Options are read at call time, so a host that rebuilds its closures every
  // render (which it will — `onDone` usually captures a payload) does not have
  // to memoize anything for the run's identity to stay stable.
  const opts = useRef(options);
  opts.current = options;

  const latest = useRef(state);
  latest.current = state;

  const commit = useCallback((next: ProgressState) => {
    latest.current = next;
    setState(next);
  }, []);

  const start = useCallback(() => {
    commit(startRun());
  }, [commit]);

  const finish = useCallback(
    (status: RunStatus, result: Record<string, unknown> = {}) => {
      commit(finishRun(latest.current, status, result));
      opts.current.onDone?.(status, result);
    },
    [commit],
  );

  const handle = useCallback(
    (event: ProgressEvent) => {
      if (!event || !event.type) return;
      opts.current.onEvent?.(event);
      if (event.type === "run_done") {
        finish(event.status, event.result || {});
        return;
      }
      commit(applyEvent(latest.current, event));
    },
    [commit, finish],
  );

  const blocked = useCallback(
    (error: ProgressError = {}) => {
      commit(blockRun(latest.current, error));
      opts.current.onBlocked?.(error);
    },
    [commit],
  );

  const close = useCallback(() => {
    commit({ ...latest.current, open: false });
  }, [commit]);

  const requestStop = useCallback(() => {
    opts.current.onStop?.();
  }, []);

  const requestClose = useCallback(() => {
    if (opts.current.onClose) opts.current.onClose();
    else close();
  }, [close]);

  const error = useCallback(() => latest.current.error, []);

  return useMemo(
    () => ({ state, start, handle, finish, blocked, close, error, requestStop, requestClose }),
    [state, start, handle, finish, blocked, close, error, requestStop, requestClose],
  );
}
