// The story-generation skill readiness banner.
//
// Three branches, in this order — the order matters, and the strings are the
// only guidance a user gets when generation is about to fail:
//
//   1. `legacyInstalled` — a retired `review-tour` copy is still on disk.
//      Named first because it is the migration case, and it stays visible even
//      when a current copy is also installed.
//   2. `current`         — everything matches; the banner disappears entirely.
//   3. otherwise         — installed-but-stale, or not found at all.
//
// The banner is fetched, not server-rendered: `GET /api/agents` runs on mount
// and its failure is swallowed on purpose. A picker that cannot reach its own
// skills endpoint should still let you open a repository.

import { useEffect, useState } from "react";
// Imported from `button/base` rather than the barrel: the barrel also pulls in
// StatefulButton and MagneticButton, which this surface never renders.
import { Button } from "../../vendor/beui/motion/button/base";
import { requestJson } from "../../shared/api";

/** The subset of `SkillStatus` (src/repo-setup.ts) this banner reads. */
export interface SkillState {
  installed?: boolean;
  current?: boolean;
  legacyInstalled?: boolean;
}

interface AgentsResponse {
  skills?: SkillState;
}

interface SkillUpdateResponse {
  skills?: SkillState;
}

const LEGACY_TEXT =
  "review-tour was renamed to diffstory-storyteller. Update skills to remove the retired copy and finish migration.";
const STALE_TEXT =
  "Story-generation skill is installed but does not match this app. Update it before generating so the agent sees the current story rules.";
const MISSING_TEXT =
  "Story-generation skill was not found in ~/.agents, ~/.claude, or ~/.codex. Install it before generating so the agent can create stories reliably.";
const UPDATING_TEXT = "Installing bundled diffStory skills locally…";
const FAILED_TEXT =
  "Could not update skills. Run scripts/install-skills.sh from this repo, or re-run the diffStory installer.";

function describe(skills: SkillState): string | null {
  if (skills.legacyInstalled) return LEGACY_TEXT;
  if (skills.current) return null;
  return skills.installed ? STALE_TEXT : MISSING_TEXT;
}

export function SkillBanner() {
  const [skills, setSkills] = useState<SkillState | null>(null);
  const [override, setOverride] = useState<{ text: string; label: string; busy: boolean } | null>(null);

  useEffect(() => {
    let live = true;
    requestJson<AgentsResponse>("/api/agents")
      .then((data) => {
        if (live && data?.skills) setSkills(data.skills);
      })
      // Deliberately silent: the picker's job is opening repositories.
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);

  const update = () => {
    setOverride({ text: UPDATING_TEXT, label: "Updating…", busy: true });
    requestJson<SkillUpdateResponse>("/api/skills/update", { method: "POST" })
      .then((data) => {
        if (!data?.skills) throw new Error("bad response");
        setSkills(data.skills);
        setOverride(null);
      })
      .catch(() => setOverride({ text: FAILED_TEXT, label: "Try again", busy: false }));
  };

  if (!skills && !override) return null;
  const settled = skills ? describe(skills) : null;
  if (!override && !settled) return null;

  const text = override?.text ?? settled ?? "";
  const label = override?.label ?? "Update skills";

  return (
    <p className="mt-3.5 flex items-center gap-2.5 border-t border-line-soft px-0.5 pt-2.5 text-[11.5px] leading-[1.45] text-text-2 contrast-more:border-text">
      {/* Polite + atomic: the text is replaced wholesale, so a partial read
          would be misleading. */}
      <span className="min-w-0 flex-1" role="status" aria-live="polite" aria-atomic="true">
        {text}
      </span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        pressScale={0.97}
        disabled={override?.busy ?? false}
        onClick={update}
        className="h-auto flex-none rounded-full bg-fill-1 px-[11px] py-1.5 text-[11.5px] font-semibold text-text-2 hover:bg-fill-2 hover:text-text disabled:opacity-55"
      >
        {label}
      </Button>
    </p>
  );
}
