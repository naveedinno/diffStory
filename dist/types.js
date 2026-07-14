// Shared data shapes for diffStory.
//
// Two authored artifacts flow through the system:
//   - the *story* (story.json) — written by the AI, describes the reading order.
//   - the *comments* (comments.json) — written by the reviewer (via the server),
//     read back by the AI to close the loop.
// Everything else (diffs, snippets, coverage) is derived at render time.
export function isCodeStep(step) {
    return step.kind !== 'concept';
}
