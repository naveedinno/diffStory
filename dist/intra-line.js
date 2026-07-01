// Word-level (intra-line) diff highlighting, shared by both diff viewers.
//
// The row-level viewers tint a removed line fully red and its replacement fully
// green, which hides a change that only touches the middle of the line. Here we
// pair a removed line with its added counterpart, diff them at the token level
// (the same tokens highlight.ts colors), and mark just the changed tokens so the
// renderer can give them a stronger tint.
//
// Pure data → HTML string, server-side, no deps — same trust model as the rest
// of the page.
import { tokenize, renderToken } from './highlight.js';
/** How much two paired lines must overlap before we word-diff them. Below this
 *  the line is effectively rewritten, so we skip intra-line marks (which would
 *  be confetti) and let the caller fall back to whole-line highlighting. */
const SIMILARITY_THRESHOLD = 0.3;
const isWs = (s) => /^\s*$/.test(s);
/**
 * Diff two lines at the token level. Returns highlighted HTML for each side with
 * changed tokens carrying the `changed` class — or null when the lines are too
 * dissimilar to be worth an intra-line diff (caller should highlight normally).
 */
export function diffLineTokens(oldLine, newLine) {
    const a = tokenize(oldLine);
    const b = tokenize(newLine);
    const n = a.length;
    const m = b.length;
    // LCS over token text. dp[i][j] = length of the longest common token
    // subsequence of a[i..] and b[j..].
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            dp[i][j] = a[i].text === b[j].text ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }
    // Walk the table forward, marking tokens that lie on a common subsequence.
    const aCommon = new Array(n).fill(false);
    const bCommon = new Array(m).fill(false);
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (a[i].text === b[j].text) {
            aCommon[i] = true;
            bCommon[j] = true;
            i++;
            j++;
        }
        else if (dp[i + 1][j] >= dp[i][j + 1]) {
            i++;
        }
        else {
            j++;
        }
    }
    // Similarity guard: share of the larger line's real (non-whitespace) tokens
    // that are common. Too low → the line was rewritten, not edited.
    const aReal = a.filter((t) => !isWs(t.text)).length;
    const bReal = b.filter((t) => !isWs(t.text)).length;
    const denom = Math.max(aReal, bReal);
    if (denom === 0)
        return null;
    let commonReal = 0;
    for (let k = 0; k < n; k++)
        if (aCommon[k] && !isWs(a[k].text))
            commonReal++;
    if (commonReal / denom < SIMILARITY_THRESHOLD)
        return null;
    // A whitespace-only token is never marked changed on its own — highlighting a
    // lone space reads as noise. Real tokens off the common subsequence are marked.
    const left = a.map((t, k) => renderToken(t, !aCommon[k] && !isWs(t.text))).join('');
    const right = b.map((t, k) => renderToken(t, !bCommon[k] && !isWs(t.text))).join('');
    return { left, right };
}
/**
 * Find removed/added line pairs in an ordered row list. Within each run of
 * consecutive removed lines immediately followed by added lines, the k-th removed
 * line pairs with the k-th added line (position-based, like GitHub). Unequal
 * counts pair the minimum; unpaired lines get no intra-line treatment.
 */
export function pairChanges(rows, getType) {
    const pairs = [];
    let i = 0;
    while (i < rows.length) {
        if (getType(rows[i]) !== 'del') {
            i++;
            continue;
        }
        const delStart = i;
        while (i < rows.length && getType(rows[i]) === 'del')
            i++;
        const addStart = i;
        while (i < rows.length && getType(rows[i]) === 'add')
            i++;
        const count = Math.min(addStart - delStart, i - addStart);
        for (let k = 0; k < count; k++)
            pairs.push([delStart + k, addStart + k]);
    }
    return pairs;
}
/**
 * Build a per-row map of intra-line HTML for an ordered row list: pair the
 * changes, word-diff each pair, and key the result by row so a renderer can look
 * up a row's precomputed side. Removed rows get `left`, added rows get `right`.
 * Rows whose pair was too dissimilar are absent (caller falls back).
 */
export function intraLineMap(rows, getType, getContent) {
    const map = new Map();
    for (const [di, ai] of pairChanges(rows, getType)) {
        const diff = diffLineTokens(getContent(rows[di]), getContent(rows[ai]));
        if (!diff)
            continue;
        map.set(rows[di], { left: diff.left });
        map.set(rows[ai], { right: diff.right });
    }
    return map;
}
