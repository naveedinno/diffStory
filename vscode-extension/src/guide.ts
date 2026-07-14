import { createHash } from 'node:crypto';
import type { Tour } from './model';

export type GuideState = 'current' | 'scope-mismatch' | 'stale' | 'unverified';

export interface GuideStatus {
  state: GuideState;
  activeScopeLabel: string;
  storyScopeLabel?: string;
  canSwitchScope: boolean;
}

export interface GuideStatusInput {
  story: Pick<Tour, 'diffFingerprint'>;
  activeDiff: string;
  activeScopeLabel: string;
  storyDiff?: string;
  storyScopeLabel?: string;
  canSwitchScope?: boolean;
}

/** Stable identity shared with the web app for the exact rendered Git diff. */
export function diffFingerprint(diff: string): string {
  return createHash('sha256').update(diff).digest('hex');
}

/**
 * Classify whether guide line targets belong to the diff currently open in VS Code.
 * A stored fingerprint is authoritative. For legacy stories, a declared comparison
 * can still tell us that the active scope is wrong, but not that old line targets
 * remain fresh.
 */
export function classifyGuide(input: GuideStatusInput): GuideStatus {
  const expected = input.story.diffFingerprint?.toLowerCase();
  const activeFingerprint = diffFingerprint(input.activeDiff);
  const storyFingerprint = input.storyDiff === undefined ? undefined : diffFingerprint(input.storyDiff);
  const base = {
    activeScopeLabel: input.activeScopeLabel,
    ...(input.storyScopeLabel ? { storyScopeLabel: input.storyScopeLabel } : {}),
    canSwitchScope: Boolean(input.canSwitchScope && input.storyDiff !== undefined),
  };

  if (expected === activeFingerprint) return { state: 'current', ...base };
  if (expected && storyFingerprint === expected) return { state: 'scope-mismatch', ...base };
  if (!expected && storyFingerprint !== undefined && storyFingerprint !== activeFingerprint) {
    return { state: 'scope-mismatch', ...base };
  }
  return { state: expected ? 'stale' : 'unverified', ...base };
}
