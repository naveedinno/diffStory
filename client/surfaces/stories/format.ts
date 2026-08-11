// Presentation helpers for review history, lifted out of the deleted
// `src/story-picker.ts`.
//
// `relativeTime` still takes `now` explicitly: the payload carries the SERVER
// clock at render time, and reaching for `Date.now()` here would make "just now"
// wrong on a machine whose clock has drifted. It is a byte-for-byte port of the
// vanilla `relTime()`, which is in turn identical to the repo picker's copy —
// see the note in the report about promoting one of them to `client/shared/`.

export function relativeTime(then: number, now: number): string {
  const sec = Math.max(0, Math.round((now - then) / 1000));
  if (sec < 60) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.round(hr / 24);
  return day === 1 ? "yesterday" : `${day} days ago`;
}

/**
 * `2, "open note"` → `"2 open notes"`.
 *
 * Deliberately the vanilla `plural(n, word)` and NOT the repo picker's
 * `plural(count, one, many)`: every word this surface pluralises is regular, and
 * the counted-noun form is what the state-machine strings are written against.
 */
export function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? "" : "s"}`;
}
