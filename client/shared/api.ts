// The one place a surface talks to `/api/*`.
//
// Every JSON endpoint in this app answers with `{ error: string }` and a 4xx/5xx
// status, and the vanilla pages all repeated the same three-step dance: fetch,
// tolerate a non-JSON body, then throw `d.error || <a page-specific fallback>`.
// That is what `requestJson` is.
//
// The part that is NOT boilerplate, and the reason this is shared rather than
// copy-pasted per surface:
//
//   HTTP 409 with `{ reloadRequired: true }` is not a retryable failure.
//
// It is `sendReviewPageConflict()` telling the page that its review-page lease
// is stale — the diff moved under it. The vanilla review page answers that with
// a **"Reload review"** button, never a "Retry" button, because retrying the
// same request against the same dead lease can only 409 again. A generic
// `useFetch` hook that folds every non-2xx into one "something went wrong,
// retry?" affordance is a real regression, flagged as such in the surface
// inventory. So the failure kind is part of the error object, and callers are
// expected to branch on it.
//
// The repo picker itself never hits a leased endpoint, so it will only ever see
// `network` and `http`. The contract lives here anyway so the four surfaces that
// do hit them inherit it instead of reinventing it.

export type ApiFailureKind =
  /** The request never completed: offline, server gone, connection reset. */
  | "network"
  /** The server answered with a 4xx/5xx and (usually) an `error` string. */
  | "http"
  /** 409 + `reloadRequired`: this page's lease is stale. Offer a reload, not a retry. */
  | "reload-required";

export class ApiError extends Error {
  readonly kind: ApiFailureKind;
  /** HTTP status, or 0 when the request never reached the server. */
  readonly status: number;
  /** The server's secondary explanation, when it sent one. */
  readonly detail?: string;

  constructor(kind: ApiFailureKind, status: number, message: string, detail?: string) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.detail = detail;
  }

  /** True only for a stale review-page lease. Show "Reload", not "Retry". */
  get reloadRequired(): boolean {
    return this.kind === "reload-required";
  }
}

export interface RequestOptions {
  method?: string;
  /** Serialized as JSON with the matching content-type. */
  body?: unknown;
  signal?: AbortSignal;
  /** Message to use when the server sent a status but no usable `error` string. */
  fallback?: string;
  /** Message to use when the request never reached the server. */
  networkFallback?: string;
}

interface ErrorBody {
  error?: unknown;
  detail?: unknown;
  reloadRequired?: unknown;
}

/**
 * Fetch a same-origin JSON endpoint, or throw an {@link ApiError}.
 *
 * A 204 (or any empty body) resolves to `undefined as T` — `DELETE /api/comments/<id>`
 * answers that way and callers should not have to special-case it.
 */
export async function requestJson<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, signal, fallback, networkFallback } = options;

  let response: Response;
  try {
    response = await fetch(path, {
      method,
      signal,
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    if ((cause as Error)?.name === "AbortError") throw cause;
    throw new ApiError("network", 0, networkFallback ?? "Could not reach the server.");
  }

  const text = await response.text().catch(() => "");
  let parsed: unknown = undefined;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = undefined;
    }
  }

  if (response.ok) return parsed as T;

  const shape = (parsed ?? {}) as ErrorBody;
  const message = typeof shape.error === "string" && shape.error ? shape.error : (fallback ?? "The request failed.");
  const detail = typeof shape.detail === "string" ? shape.detail : undefined;
  const stale = response.status === 409 && shape.reloadRequired === true;
  throw new ApiError(stale ? "reload-required" : "http", response.status, message, detail);
}

/** The user-facing message for any thrown value, including non-`ApiError`s. */
export function failureMessage(cause: unknown, fallback = "Something went wrong."): string {
  if (cause instanceof ApiError) return cause.message;
  if (cause instanceof Error && cause.message) return cause.message;
  return fallback;
}
