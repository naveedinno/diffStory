// Shared Signal motion curves for the React client.
//
// Each export mirrors a `--motion-*` token in `sharedTokens()`
// (`src/theme.ts`), the canonical source of truth. Prefer these over
// hand-typed beziers so the client and the server-rendered surfaces stay in
// sync; if a token value changes, update both places.

/** Signal entrance/exit curve; mirrors `--motion-ease-out`. */
export const EASE_SIGNAL_OUT = [0.23, 1, 0.32, 1] as const;

/** Signal drawer curve; mirrors `--motion-ease-drawer`. */
export const EASE_SIGNAL_DRAWER = [0.32, 0.72, 0, 1] as const;

/** CSS form of `EASE_SIGNAL_OUT`; mirrors `--motion-ease-out`. */
export const EASE_SIGNAL_OUT_CSS = "cubic-bezier(.23,1,.32,1)";
