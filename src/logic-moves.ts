// Verifies authored logic-move claims (moved/extracted/inlined) against the
// exact old/new blobs a story names. Standalone so the bundled story checker
// can run it without the HTTP server.
import { readFileRange, readWholeFile } from "./git.js";
import { orderedSteps } from "./tour.js";
import { isCodeStep, type Tour } from "./types.js";

function moveTokens(text: string): string[] {
  return (
    text
      .toLowerCase()
      .match(/[a-z_$][a-z0-9_$]*|\d+|===|!==|==|!=|<=|>=|&&|\|\||[-+*/%<>]/g) ??
    []
  );
}

function tokenOverlap(
  left: string[],
  right: string[],
  denominator: "max" | "left" = "max",
): number {
  if (!left.length || !right.length) return 0;
  const counts = new Map<string, number>();
  for (const token of right) counts.set(token, (counts.get(token) ?? 0) + 1);
  let shared = 0;
  for (const token of left) {
    const count = counts.get(token) ?? 0;
    if (count > 0) {
      shared += 1;
      counts.set(token, count - 1);
    }
  }
  return (
    shared /
    (denominator === "left" ? left.length : Math.max(left.length, right.length))
  );
}

function functionShaped(text: string): boolean {
  return /\b(?:function|def|fn)\s+[A-Za-z_$][\w$]*\s*\(|\b[A-Za-z_$][\w$]*\s*\([^)]*\)\s*(?:\{|=>)/.test(
    text,
  );
}

/** Verify move claims against the exact old/new blobs used by the story. */
export function verifyLogicMoves(
  repo: string,
  tour: Tour,
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!repo)
    return {
      errors: [
        "logic moves could not be verified because the repository path is unavailable",
      ],
      warnings,
    };
  const steps = orderedSteps(tour);
  const beforeRef = tour.evolution?.baseSha ?? tour.base ?? "HEAD";
  const afterRef = tour.evolution?.headSha ?? tour.head;
  steps.forEach((step, stepIndex) => {
    if (!isCodeStep(step) || !("moves" in step)) return;
    (step.moves ?? []).forEach((move, moveIndex) => {
      const where = `steps[${stepIndex}].moves[${moveIndex}]`;
      if (move.hidden?.as === "destination") {
        const endpointName = move.after.file === step.file ? "before" : "after";
        const endpoint = move[endpointName];
        const ref = endpointName === "before" ? beforeRef : afterRef;
        if (readWholeFile(repo, endpoint.file, ref) === null) {
          errors.push(
            `${where}.hidden destination file "${endpoint.file}" could not be resolved in the repository`,
          );
        }
      }
      const readAnchor = (endpoint: "before" | "after"): string | null => {
        const anchor = move[endpoint];
        const ref = endpoint === "before" ? beforeRef : afterRef;
        const slice = readFileRange(
          repo,
          anchor.file,
          anchor.range[0],
          anchor.range[1],
          ref,
        );
        const expected = anchor.range[1] - anchor.range[0] + 1;
        if (
          !slice ||
          slice.startLine !== anchor.range[0] ||
          slice.lines.length !== expected
        ) {
          errors.push(
            `${where}.${endpoint}.range is outside the ${endpoint === "before" ? "old" : "new"} version of "${anchor.file}"`,
          );
          return null;
        }
        return slice.lines.join("\n");
      };
      const before = readAnchor("before");
      const after = readAnchor("after");
      if (before == null || after == null) return;
      const beforeTokens = moveTokens(before);
      const afterTokens = moveTokens(after);
      if (
        move.kind === "moved" &&
        tokenOverlap(beforeTokens, afterTokens) < 0.7
      ) {
        errors.push(
          `${where} kind "moved" requires at least 70% token overlap between its anchors`,
        );
      }
      if (move.kind === "extracted") {
        if (
          !functionShaped(after) ||
          tokenOverlap(beforeTokens, afterTokens, "left") < 0.5
        ) {
          warnings.push(
            `${where} says "extracted", but its after range does not clearly contain a function-shaped majority of the old logic.`,
          );
        }
      }
      if (move.kind === "inlined") {
        if (
          !functionShaped(before) ||
          tokenOverlap(afterTokens, beforeTokens, "left") < 0.5
        ) {
          warnings.push(
            `${where} says "inlined", but its before range does not clearly contain a function-shaped majority of the new logic.`,
          );
        }
      }
    });
  });
  return { errors, warnings };
}
