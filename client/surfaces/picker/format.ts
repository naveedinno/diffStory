// Presentation helpers lifted out of the deleted `src/picker.ts`.
//
// The shell contract says the payload carries raw `path` and `lastOpened`, and
// that `prettyPath()` / `relativeTime()` move into the component — so these are
// ports, not rewrites. `relativeTime` still takes `now` explicitly: the payload
// carries the SERVER clock at render time, and using `Date.now()` here would
// make "just now" wrong on a machine whose clock has drifted.

/** Home-relative, middle-truncated path. The full path stays in the `title`. */
export function prettyPath(path: string, home: string): string {
  let text = home && path.startsWith(home) ? "~" + path.slice(home.length) : path;
  if (text.length > 46) text = text.slice(0, 16) + "…" + text.slice(-27);
  return text;
}

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

/** The client-side fallback route when `POST /api/repo/open` omits one. */
export function fallbackRepoRoute(path: string): string {
  const name = path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || "repo";
  return "/repo/" + encodeURIComponent(name) + "/stories";
}

export function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}
