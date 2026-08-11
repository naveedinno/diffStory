// Types for the ported engine. `review-engine.js` is deliberately plain
// JavaScript — see its header — so this declares the one door into it.

import type { Comment } from "../../../../src/payloads";

export interface ReviewEngineOptions {
  /** The queued comments, exactly as the payload carries them. */
  comments: Comment[];
  /**
   * Comment id → server-computed anchor state. Cannot be derived in the
   * browser; the engine seeds its first card render from this and preserves
   * each value across later rebuilds.
   */
  commentAnchors: Record<string, string>;
}

/** Start the engine against the DOM React has committed. Call once. */
export function startReviewEngine(options?: ReviewEngineOptions): void;
