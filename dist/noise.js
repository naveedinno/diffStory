// One definition for files excluded from the bounded default review: generated
// paths and diffs too large to render safely. Exclusion is a presentation and
// performance decision, not a claim that these files never matter. Callers can
// use the metadata API below to keep every exclusion visible to the reviewer.
//
// Pure (path + line-count only) so the low-level git layer can import it with
// no risk of a cycle.
/** A single-file diff at or above this size is omitted from the bounded default view. */
export const REVIEW_NOISE_MAX_LINES = 1500;
/** Paths recognized as generated, vendored, or machine-produced artifacts. */
export function isGeneratedPath(path) {
    const p = path.toLowerCase();
    return (/(^|\/)(dist|build|out|node_modules|vendor|\.next|coverage|__generated__)\//.test(p) ||
        /(^|\/)(package-lock\.json|yarn\.lock|pnpm-lock\.yaml|composer\.lock|cargo\.lock|go\.sum)$/.test(p) ||
        /\.(min\.js|min\.css|map|lock)$/.test(p) ||
        /(^|\/)abis?\//.test(p) ||
        /\.abi\.json$/.test(p));
}
/** Explain why a file is omitted from the bounded diff, or null when it stays. */
export function reviewExclusionMetadata(path, addedLines, removedLines) {
    const changedLines = addedLines == null || removedLines == null ? null : addedLines + removedLines;
    const reason = isGeneratedPath(path)
        ? 'generated-path'
        : changedLines == null
            ? 'binary'
            : changedLines === 0
                ? 'metadata-only'
                : changedLines >= REVIEW_NOISE_MAX_LINES
                    ? 'large-diff'
                    : null;
    if (!reason)
        return null;
    return { path, reason, addedLines, removedLines, changedLines };
}
/** Compatibility boolean for the bounded-diff filter. Prefer reviewExclusionMetadata(). */
export function isReviewNoise(path, changedLines) {
    return reviewExclusionMetadata(path, changedLines, 0) !== null;
}
