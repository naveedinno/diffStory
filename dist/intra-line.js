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
    const block = diffBlockTokens([oldLine], [newLine]);
    const left = block?.left[0];
    const right = block?.right[0];
    return left !== undefined && right !== undefined ? { left, right } : null;
}
/** In a multi-line run, a line needs this share of common tokens to keep its marks. */
const BLOCK_LINE_THRESHOLD = 0.5;
/** Past this many LCS cells a block falls back to per-line pairing. */
const BLOCK_CELL_LIMIT = 250_000;
/**
 * Diff a run of removed lines against its run of added lines as one token
 * stream, ignoring whitespace and line breaks. A statement reflowed from four
 * lines into one then marks only the clause that actually changed, instead of
 * pairing its first line with the whole new statement and marking nothing.
 * Returns per-line HTML for each side, or null when the runs are too dissimilar.
 * In a multi-line run, a line that is mostly new gets undefined: marking every
 * token says nothing the row tint does not, so it falls back like a dissimilar pair.
 */
export function diffBlockTokens(oldLines, newLines) {
    const a = lineTokens(oldLines);
    const b = lineTokens(newLines);
    const ar = realIndexes(a);
    const br = realIndexes(b);
    const denom = Math.max(ar.length, br.length);
    if (denom === 0 || ar.length * br.length > BLOCK_CELL_LIMIT)
        return null;
    const aText = ar.map((k) => a[k].text);
    const bText = br.map((k) => b[k].text);
    const [aCommon, bCommon] = commonTokens(aText, bText);
    let common = 0;
    for (const c of aCommon)
        if (c)
            common++;
    // Too little in common → the code was rewritten, not edited.
    if (common / denom < SIMILARITY_THRESHOLD)
        return null;
    slideChanges(a, ar, aCommon);
    slideChanges(b, br, bCommon);
    const lineGuard = oldLines.length > 1 || newLines.length > 1;
    return {
        left: renderLines(a, ar, aCommon, oldLines.length, false, lineGuard),
        right: renderLines(b, br, bCommon, newLines.length, true, lineGuard),
    };
}
function lineTokens(lines) {
    return lines.flatMap((line, index) => tokenize(line).map((t) => ({ ...t, line: index })));
}
/** Positions of the tokens that carry meaning; whitespace never takes part in the diff. */
function realIndexes(tokens) {
    const out = [];
    tokens.forEach((t, k) => {
        if (!isWs(t.text))
            out.push(k);
    });
    return out;
}
/** LCS over token text: which tokens of each side lie on a common subsequence. */
function commonTokens(a, b) {
    const n = a.length;
    const m = b.length;
    // dp[i][j] = length of the longest common subsequence of a[i..] and b[j..].
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
            dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
    }
    const aCommon = new Array(n).fill(false);
    const bCommon = new Array(m).fill(false);
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
        if (a[i] === b[j]) {
            aCommon[i++] = true;
            bCommon[j++] = true;
        }
        else if (dp[i + 1][j] >= dp[i][j + 1]) {
            i++;
        }
        else {
            j++;
        }
    }
    return [aCommon, bCommon];
}
const OPERATOR_CHARS = new Set(['|', '&', '=', '<', '>', '!', '+', '-', '*', '/', '%', '^', ':', '?', '.']);
const OPENERS = new Set(['(', '[', '{', ',', ';', '?', ':', '|', '&']);
const CLOSERS = new Set([')', ']', '}', ',', ';', '?', ':', '|', '&']);
const JOINERS = new Set(['|', '&', ',']);
/**
 * Slide each changed run to the reading that names a whole expression.
 *
 * When text repeats, the LCS can place a deletion at several equally short
 * spots: removing one `x >= y ||` clause from `p || x >= y || x >= z` may mark
 * `y || x >=`, which straddles two comparisons. Sliding a run past a token
 * equal to its far end keeps every common token in order, so the alignment
 * stays valid; this picks the position whose ends sit on expression
 * boundaries (after `||`, `(`, `,` …; before `)`, `;` …) and never inside a
 * member access or a multi-character operator.
 */
function slideChanges(tokens, real, common) {
    const s = real.map((k) => tokens[k].text);
    // glued[k]: real tokens k and k+1 touch in the source and are both operator characters (`>` `=`).
    const glued = real.map((k, i) => i + 1 < real.length && real[i + 1] === k + 1 && OPERATOR_CHARS.has(s[i]) && OPERATOR_CHARS.has(s[i + 1]));
    let p = 0;
    while (p < s.length) {
        if (common[p]) {
            p++;
            continue;
        }
        let q = p;
        while (q < s.length && !common[q])
            q++;
        // The run is s[p..q). Find how far it can slide either way.
        let lo = p;
        while (lo > 0 && common[lo - 1] && s[lo - 1] === s[lo - 1 + (q - p)])
            lo--;
        let hi = p;
        while (hi + (q - p) < s.length && common[hi + (q - p)] && s[hi] === s[hi + (q - p)])
            hi++;
        if (hi > lo) {
            const len = q - p;
            let best = p;
            let bestScore = runScore(s, glued, p, q);
            for (let start = lo; start <= hi; start++) {
                const score = runScore(s, glued, start, start + len);
                if (score > bestScore) {
                    best = start;
                    bestScore = score;
                }
            }
            for (let k = Math.min(lo, p); k < Math.max(hi + len, q); k++)
                common[k] = k < best || k >= best + len;
            q = best + len;
        }
        p = q;
    }
}
/** How cleanly the run s[p..q) reads as a whole expression; higher is better. */
function runScore(s, glued, p, q) {
    let score = 0;
    // A boundary inside `>=` or `||` cuts an operator in half.
    if (p > 0 && glued[p - 1])
        score -= 5;
    if (q < s.length && glued[q - 1])
        score -= 5;
    // A boundary beside a dot cuts a member access.
    if (s[p - 1] === '.' || s[p] === '.' || s[q - 1] === '.' || s[q] === '.')
        score -= 3;
    if (p === 0 || OPENERS.has(s[p - 1]) || s[p - 1] === 'return' || isAssignment(s, p - 1))
        score += 2;
    if (q === s.length || CLOSERS.has(s[q]))
        score += 2;
    // A clause carries its joiner with it: `x >= y ||` reads as one removed term.
    if (JOINERS.has(s[q - 1]))
        score += 1;
    if (JOINERS.has(s[p]))
        score += 0.5;
    return score;
}
/** True when s[k] is a plain `=`, not part of `>=`, `==`, `+=` or `=>`. */
function isAssignment(s, k) {
    return k >= 0 && s[k] === '=' && !OPERATOR_CHARS.has(s[k - 1] ?? '') && !OPERATOR_CHARS.has(s[k + 1] ?? '');
}
/** Per-line HTML with changed tokens marked. Whitespace between two changed
 *  tokens on the same line joins them, so a removed clause reads as one span
 *  rather than a row of separate chips; a lone space is never marked. */
function renderLines(tokens, real, common, lineCount, navigable, lineGuard) {
    const changed = new Array(tokens.length).fill(false);
    real.forEach((k, i) => {
        if (!common[i])
            changed[k] = true;
    });
    for (let i = 0; i + 1 < real.length; i++) {
        const from = real[i];
        const to = real[i + 1];
        if (!changed[from] || !changed[to] || tokens[from].line !== tokens[to].line)
            continue;
        for (let k = from + 1; k < to; k++)
            changed[k] = true;
    }
    const realCount = new Array(lineCount).fill(0);
    const commonCount = new Array(lineCount).fill(0);
    real.forEach((k, i) => {
        realCount[tokens[k].line]++;
        if (common[i])
            commonCount[tokens[k].line]++;
    });
    const lines = new Array(lineCount).fill('');
    let line = -1;
    let column = 1;
    tokens.forEach((t, k) => {
        if (t.line !== line) {
            line = t.line;
            column = 1;
        }
        lines[line] += renderToken(t, changed[k], navigable ? column : undefined);
        column += t.text.length;
    });
    return lines.map((html, line) => lineGuard && realCount[line] > 0 && commonCount[line] / realCount[line] < BLOCK_LINE_THRESHOLD ? undefined : html);
}
/**
 * Word-diff one run of removed lines against the added lines that follow it.
 * Equal-length runs pair line by line, like GitHub. Runs of different lengths,
 * or equal runs where some line was rewritten past recognition, are first
 * tried as one block, so a reflowed statement still marks its real change.
 * A side's entry is undefined where that line gets no intra-line marks.
 */
export function runSides(oldLines, newLines) {
    const left = new Array(oldLines.length).fill(undefined);
    const right = new Array(newLines.length).fill(undefined);
    if (!oldLines.length || !newLines.length)
        return { left, right };
    const count = Math.min(oldLines.length, newLines.length);
    const pairs = Array.from({ length: count }, (_, k) => diffLineTokens(oldLines[k], newLines[k]));
    if (oldLines.length !== newLines.length || pairs.some((pair) => !pair)) {
        const block = diffBlockTokens(oldLines, newLines);
        if (block)
            return block;
    }
    pairs.forEach((pair, k) => {
        if (!pair)
            return;
        left[k] = pair.left;
        right[k] = pair.right;
    });
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
 * Build a per-row map of intra-line HTML for an ordered row list: word-diff each
 * run of removed lines against the added lines after it (see runSides), and key
 * the result by row so a renderer can look up a row's precomputed side. Removed
 * rows get `left`, added rows get `right`. Unmarked rows are absent (caller falls back).
 */
export function intraLineMap(rows, getType, getContent) {
    const map = new Map();
    let i = 0;
    while (i < rows.length) {
        if (getType(rows[i]) !== 'del') {
            i++;
            continue;
        }
        const dels = [];
        const adds = [];
        while (i < rows.length && getType(rows[i]) === 'del')
            dels.push(rows[i++]);
        while (i < rows.length && getType(rows[i]) === 'add')
            adds.push(rows[i++]);
        const sides = runSides(dels.map(getContent), adds.map(getContent));
        sides.left.forEach((html, k) => {
            if (html !== undefined)
                map.set(dels[k], { left: html });
        });
        sides.right.forEach((html, k) => {
            if (html !== undefined)
                map.set(adds[k], { right: html });
        });
    }
    return map;
}
