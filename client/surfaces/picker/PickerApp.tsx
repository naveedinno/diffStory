// The repository picker — diffStory's front door.
//
// Rendered for `GET /repos`, and for `/`, `/change`, `/review` and `/stories`
// when no repository is open. Everything it shows on first paint comes from the
// `PickerPayload` embedded by the shell; the only thing fetched on mount is the
// skills banner.
//
// Navigation is a real URL assignment, never a client-side route. There is no
// `history.pushState` anywhere in this codebase and this surface does not
// introduce one: opening a repository is `location.href = <server-chosen route>`,
// which is what makes Back and Forward behave.
//
// Feedback is a screen-reader-only `role="status"` paragraph, matching the
// vanilla picker. Sighted users get no visible confirmation for "Opening…" or
// "Removed from recent repositories" — that is the current behaviour, and
// changing it here would quietly change one third of the app's three unrelated
// notification mechanisms.

import { useRef, useState } from "react";
import { Plus } from "lucide-react";
import type { PickerPayload, RecentRow } from "../../../src/payloads";
import { Button } from "../../vendor/beui/motion/button/base";
import { failureMessage, requestJson } from "../../shared/api";
import { cn } from "../../shared/cn";
import { FolderBrowser, type FolderBrowserHandle } from "./FolderBrowser";
import { Hero } from "./Hero";
import { RecentRepos } from "./RecentRepos";
import { SkillBanner } from "./SkillBanner";
import { fallbackRepoRoute } from "./format";

interface OpenResponse {
  route?: string;
}

type Status = { text: string; tone: "neutral" | "error" } | null;

export function PickerApp({ payload }: { payload: PickerPayload }) {
  const [recents, setRecents] = useState<RecentRow[]>(payload.recents);
  const [status, setStatus] = useState<Status>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const main = useRef<HTMLElement>(null);
  const browser = useRef<FolderBrowserHandle>(null);

  const openRepo = (path: string) => {
    if (!path) return;
    setStatus({ text: "Opening…", tone: "neutral" });
    requestJson<OpenResponse>("/api/repo/open", {
      method: "POST",
      body: { path },
      // Two distinct messages, as before: the server refused, versus we never
      // reached it at all.
      fallback: "Could not open that path.",
      networkFallback: "Could not reach the server.",
    })
      .then((data) => {
        // The server picks the route (review history, or straight back into a
        // restored story). The fallback only fires if it declined to.
        window.location.href = data?.route || fallbackRepoRoute(path);
      })
      .catch((cause: unknown) => {
        setStatus({ text: failureMessage(cause, "Could not open that path."), tone: "error" });
      });
  };

  const removeRepo = (path: string) => {
    setRemoving(path);
    requestJson("/api/repos/recent", {
      method: "DELETE",
      body: { path },
      fallback: "Could not remove repository.",
    })
      .then(() => {
        // Dropping the row from state is what re-numbers the list, recounts the
        // unavailable group, collapses it when it empties, and swaps in the
        // empty state — all of which `syncRecentUi()` did by hand.
        setRecents((rows) => rows.filter((row) => row.path !== path));
        setRemoving(null);
        setStatus({ text: "Removed from recent repositories.", tone: "neutral" });
      })
      .catch((cause: unknown) => {
        setRemoving(null);
        setStatus({ text: failureMessage(cause, "Could not remove repository."), tone: "error" });
      });
  };

  return (
    <>
      <main
        ref={main}
        className="mx-auto flex min-h-screen w-[min(820px,100%)] flex-col px-6 pt-9 pb-7 max-[760px]:px-4 max-[760px]:py-6"
      >
        <Hero />

        <section className="ds-reveal ds-reveal-2 mb-14 min-w-0 max-[760px]:mb-10">
          <div className="mt-0.5 mb-3.5 flex items-end justify-between gap-[18px] max-[480px]:items-center">
            <h2 className="m-0 font-display text-2xl leading-[1.1] font-bold tracking-[-.02em] max-[480px]:text-[21px]">
              Repositories
            </h2>
            {/* Icon-only below 760px; the accessible name has to survive that. */}
            <Button
              type="button"
              // The UI atlas clicks this by id to capture the modal frames.
              id="quickAddBtn"
              aria-label="Add repository"
              title="Add repository"
              pressScale={0.97}
              onClick={(event) => browser.current?.open(event.currentTarget as HTMLElement)}
              className="h-[var(--control-h)] gap-[7px] rounded-full bg-accent px-3.5 text-[12.5px] font-semibold text-on-accent hover:bg-accent-hi max-[760px]:w-[var(--control-h)] max-[760px]:px-0"
            >
              <Plus className="h-[15px] w-[15px]" strokeWidth={2} />
              <span className="max-[760px]:hidden">Add repository</span>
            </Button>
          </div>

          <RecentRepos
            recents={recents}
            home={payload.home}
            now={payload.now}
            removing={removing}
            onOpen={openRepo}
            onRemove={removeRepo}
          />

          <SkillBanner />

          <p className={cn("ds-sr-only", status?.tone === "error" && "text-del")} role="status">
            {status?.text ?? ""}
          </p>
        </section>
      </main>

      <FolderBrowser ref={browser} background={main} onOpenRepo={openRepo} />
    </>
  );
}
