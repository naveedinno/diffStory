# Design Implementation Plan: Beat Navigator

## Summary

- **Scope:** Structural redesign of code-step beat navigation
- **Target:** `src/render.ts`, `src/page-assets.ts`, and render regressions
- **Winner:** Variant F — nested beat tree plus bottom review transport
- **Outcome:** The sidebar owns beat overview and selection, the dock owns active narration and transport, and the code remains the dominant canvas.

## Implementation

1. Render code-step beats as children of their step in the reading-order rail.
2. Refine the tree with a quiet connector, concise labels, selected/visited states, and a compact broad-step status.
3. Replace the large canvas beat list with one bottom transport containing position, active narration, read-aloud, and previous/next controls.
4. Reduce the review question to one calm inline prompt above the diff.
5. Move repair actions into a compact overflow menu and remove the large amber broad-step banner.
6. Keep Focus, Context, Full, pointer selection, arrow keys, read-aloud auto-advance, step changes, and All files behavior intact.
7. At compact widths or with the sidebar closed, keep the bottom transport fully usable.

## Accessibility and verification

- Tree and transport use native buttons with stable accessible names.
- Arrow-key navigation remains immediate and does not depend on sidebar visibility.
- Selected and visited states do not rely on color alone.
- Long beat labels truncate in the rail while the dock retains the complete narration.
- Verify desktop, resized rail, collapsed rail, and compact viewport states.
- Run focused render/interaction tests, the full suite, browser console checks, and visual review.
