"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.diffFingerprint = diffFingerprint;
exports.classifyGuide = classifyGuide;
const node_crypto_1 = require("node:crypto");
/** Stable identity shared with the web app for the exact rendered Git diff. */
function diffFingerprint(diff) {
    return (0, node_crypto_1.createHash)('sha256').update(diff).digest('hex');
}
/**
 * Classify whether guide line targets belong to the diff currently open in VS Code.
 * A stored fingerprint is authoritative. For legacy stories, a declared comparison
 * can still tell us that the active scope is wrong, but not that old line targets
 * remain fresh.
 */
function classifyGuide(input) {
    const expected = input.story.diffFingerprint?.toLowerCase();
    const activeFingerprint = diffFingerprint(input.activeDiff);
    const storyFingerprint = input.storyDiff === undefined ? undefined : diffFingerprint(input.storyDiff);
    const base = {
        activeScopeLabel: input.activeScopeLabel,
        ...(input.storyScopeLabel ? { storyScopeLabel: input.storyScopeLabel } : {}),
        canSwitchScope: Boolean(input.canSwitchScope && input.storyDiff !== undefined),
    };
    if (expected === activeFingerprint)
        return { state: 'current', ...base };
    if (expected && storyFingerprint === expected)
        return { state: 'scope-mismatch', ...base };
    if (!expected && storyFingerprint !== undefined && storyFingerprint !== activeFingerprint) {
        return { state: 'scope-mismatch', ...base };
    }
    return { state: expected ? 'stale' : 'unverified', ...base };
}
//# sourceMappingURL=guide.js.map