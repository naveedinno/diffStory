// Language-agnostic "where am I" label for a diff hunk: scan upward from the
// hunk's first line for the nearest non-blank line with strictly lower
// indentation that opens a scope, skipping closers and comments. Working from
// indentation alone means Solidity, TS, Python, and friends all resolve without
// per-language grammars; callers fall back to git's own funcname (DiffHunk.context)
// when this returns undefined.
const SKIP_RE = /^\s*(\}|\)|\]|else\b|\/\/|\/\*|\*|#|<!--|['"`])/;
const MAX_LABEL = 90;
function indentWidth(line) {
    let w = 0;
    for (const ch of line) {
        if (ch === ' ')
            w += 1;
        else if (ch === '\t')
            w += 4;
        else
            break;
    }
    return w;
}
export function enclosingScopeLabel(lines, startLine) {
    const startIdx = Math.min(Math.max(startLine, 1), lines.length) - 1;
    // Indent of the first non-blank line at or after the hunk start.
    let base;
    for (let i = startIdx; i < lines.length; i++) {
        if (lines[i].trim()) {
            base = indentWidth(lines[i]);
            break;
        }
    }
    if (base === undefined || base === 0)
        return undefined;
    for (let i = startIdx - 1; i >= 0; i--) {
        const line = lines[i];
        if (!line.trim() || SKIP_RE.test(line))
            continue;
        if (indentWidth(line) < base) {
            const label = line.trim().replace(/\s*\{\s*$/, '');
            if (!label)
                continue;
            return label.length > MAX_LABEL ? label.slice(0, MAX_LABEL - 1) + '…' : label;
        }
    }
    return undefined;
}
