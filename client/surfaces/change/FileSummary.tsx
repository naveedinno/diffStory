// The changed-file inventory, and the honest empty state that replaces it.
//
// Three details that carry meaning:
//
//   - Generated output (dist/, build/, lockfiles, *.generated.*) is partitioned
//     into a collapsed disclosure. It still counts toward the +/− ledger and
//     toward "Review N files", because it IS part of the diff — it just must not
//     pad the list a human is about to read.
//   - "Nothing to review" is a state, not an error. A clean working tree is a
//     normal thing to arrive at, so it gets a ✓, an explanation of where changes
//     will appear, and two ways onward — never an error tone.
//   - `.file-card`, `.frow` and `.empty-title` are the UI atlas's evidence
//     selectors for this surface (`scripts/capture-ui-atlas.mjs`). A capture
//     only counts as coverage if it can find a real row, so those three class
//     names are part of the contract even though the styling is utilities.
//
// ── beUI adoption notes ──────────────────────────────────────────────────────
//
//   - `BouncyAccordion` replaces the `<details>` around generated output, for
//     the same reason it replaced one in the repo picker: `<details>` cannot
//     animate its own height, so the list used to appear instantly under a
//     header that had just rotated a chevron smoothly. It renders closed with
//     `initial={false}`, so nothing about it animates on arrival — which is the
//     rule this whole surface is built around. Its content wrapper hardcodes
//     `px-5 pb-5`; the rows have to sit flush against the panel edge like the
//     primary ones, and because the measured element is the padded one, the
//     negative margins are also what keep the animated height honest.
//   - `AnimatedBadge` carries "working tree clean". That line is a status and
//     was drawn as one with a `✓` text glyph, which renders at a different
//     weight in every font on the fallback chain; the badge draws a real Check.
//     `AnimatePresence initial={false}` inside it means it does not roll in on
//     load, which on a surface where every change is a navigation matters more
//     than the roll would have been worth.
//   - Nothing here uses `motion/table/`. See the note on `Inventory`.
//   - No `useQuietSubtree`: neither of these two carries a live region, and the
//     one component on this surface that does is quieted where it is imported.

import { ArrowRight, Check } from "lucide-react";
import { AnimatedBadge } from "../../vendor/beui/motion/animated-badge";
import { BouncyAccordion } from "../../vendor/beui/motion/bouncy-accordion";
import { Button, ButtonLink } from "../../vendor/beui/motion/button/base";
import { cn } from "../../shared/cn";
import type { ChangeFileView } from "../../../src/payloads";
import { addShare, generatedOutput, plural, splitPath, totals } from "./format";

function FileRow({ file, inset }: { file: ChangeFileView; inset?: boolean }) {
  const [dir, name] = splitPath(file.path);
  const binary = file.added === null || file.removed === null;
  const share = addShare(file);

  return (
    <div
      className={cn(
        "frow flex items-center gap-3 border-b border-line-soft px-[15px] py-[9px] text-[13px] last:border-b-0",
        "max-[600px]:gap-[9px] max-[600px]:px-[13px]",
        inset && "bg-[color-mix(in_srgb,var(--fill-1)_50%,transparent)] pl-[25px]",
      )}
    >
      <span className="flex min-w-0 flex-1 items-baseline overflow-hidden font-mono" title={file.path}>
        {dir ? (
          <span className="min-w-0 flex-[0_1_auto] truncate text-right text-text-3 max-[600px]:max-w-[48%]">{dir}</span>
        ) : null}
        <span className="flex-none font-medium text-text">{name}</span>
      </span>
      {binary ? (
        <span
          aria-hidden="true"
          className="inline-flex h-[7px] w-[42px] flex-none rounded-[3px] bg-[repeating-linear-gradient(45deg,var(--fill-1),var(--fill-1)_3px,transparent_3px,transparent_6px)] max-[600px]:w-[34px]"
        />
      ) : (
        <span
          aria-hidden="true"
          className="inline-flex h-[7px] w-[42px] flex-none overflow-hidden rounded-[3px] bg-fill-1 max-[600px]:w-[34px]"
        >
          <span className="h-full bg-add" style={{ width: `${share}%` }} />
          <span className="h-full bg-del" style={{ width: `${100 - share}%` }} />
        </span>
      )}
      <span className="min-w-[78px] flex-none text-right font-mono text-xs max-[600px]:min-w-[70px]">
        {binary ? (
          <span className="text-text-3">binary / metadata</span>
        ) : file.added || file.removed ? (
          <>
            {/* Ink variants, not the rail hues — these are 10 px numerals on a
                light card, which is exactly the case `--diff-add-text` and
                `--diff-del-text` exist for. Identical to `--add`/`--del` in dark. */}
            {file.added ? <span className="text-diff-add-text">+{file.added}</span> : null}
            {file.removed ? <span className="ml-1.5 text-diff-del-text">−{file.removed}</span> : null}
          </>
        ) : (
          <span className="text-text-3">metadata</span>
        )}
      </span>
    </div>
  );
}

function EmptyState({ routeBase }: { routeBase: string }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-island)] border border-transparent bg-surface-2 contrast-more:border-text">
      <div className="px-4 pt-[34px] pb-[38px] text-center text-sm text-text-2">
        <p className="m-0 mb-3">
          <AnimatedBadge
            status="success"
            size="sm"
            icon={<Check strokeWidth={2.4} aria-hidden="true" />}
            className="h-auto gap-1 rounded-[var(--radius-sm)] border-0 bg-add-soft px-2 py-0.5 font-mono text-[11px] font-medium text-diff-add-text"
          >
            working tree clean
          </AnimatedBadge>
        </p>
        <h2 className="empty-title m-0 mb-2 font-display text-[19px] font-bold tracking-[var(--tracking-tight)] text-text">
          Nothing to review
        </h2>
        <p className="mx-auto mb-5 max-w-[46ch] text-[12.5px] leading-[1.6] text-text-2">
          Pick another scope above, or make a change. When your agent writes code, the changes appear here.
        </p>
        <div className="flex items-center justify-center gap-2">
          <Button
            type="button"
            pressScale={0.97}
            whileHover={undefined}
            onClick={() => window.location.reload()}
            className="h-[var(--control-h)] rounded-full bg-fill-2 px-3.5 text-[12.5px] font-semibold text-text hover:bg-fill-2"
          >
            Re-check
          </Button>
          <ButtonLink
            href={`${routeBase}/stories`}
            pressScale={0.97}
            whileHover={undefined}
            className="h-[var(--control-h)] rounded-full bg-fill-2 px-3.5 text-[12.5px] font-semibold text-text hover:bg-fill-2"
          >
            Review history →
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

export interface FileSummaryProps {
  files: ChangeFileView[];
  routeBase: string;
  diffHref: string;
}

export function FileSummary({ files, routeBase, diffHref }: FileSummaryProps) {
  return (
    <section className="file-card min-w-0" aria-label="Changed files">
      {files.length === 0 ? <EmptyState routeBase={routeBase} /> : <Inventory files={files} diffHref={diffHref} />}
    </section>
  );
}

/**
 * Why this is not beUI's `motion/table/`.
 *
 * That component is a data grid: it wants a column model and brings sorting,
 * resizing, drag-reorder, row selection and a per-column menu, none of which
 * this list has any use for — a changed-file inventory has one meaningful
 * order, the one git reported, and nothing to select. It also renders a single
 * virtualised body, and this list is deliberately two bodies: the files a human
 * will read, then a disclosure holding the generated output that must still
 * count toward the ledger and the CTA. The virtualiser is the one thing worth
 * envying on a diff with hundreds of files, and it is available separately
 * (`@tanstack/react-virtual` is already a dependency) if that ever bites.
 */
function Inventory({ files, diffHref }: { files: ChangeFileView[]; diffHref: string }) {
  const total = totals(files);
  const primary = files.filter((file) => !generatedOutput(file.path));
  const generated = files.filter((file) => generatedOutput(file.path));
  const reviewCount = `${files.length} ${plural(files.length, "file", "files")}`;

  return (
    <div className="overflow-hidden rounded-[var(--radius-island)] border border-transparent bg-surface-2 contrast-more:border-text">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft bg-fill-1 px-[15px] py-[11px] text-[13px] text-text-2">
        <span>
          <b className="font-display font-bold text-text tabular-nums">{primary.length}</b> review{" "}
          {plural(primary.length, "file", "files")}
          {generated.length ? <span className="text-text-3"> · {generated.length} generated</span> : null}
        </span>
        <span className="inline-flex gap-[9px] font-mono text-[12.5px]">
          <span className="text-diff-add-text">+{total.added}</span>
          <span className="text-diff-del-text">−{total.removed}</span>
        </span>
        <ButtonLink
          href={diffHref}
          aria-label={`Start review of ${reviewCount}`}
          pressScale={0.97}
          whileHover={undefined}
          className={cn(
            "ml-auto h-[var(--control-h)] gap-[7px] rounded-full bg-accent px-[15px] text-[12.5px] font-semibold text-on-accent hover:bg-accent-solid-hover",
            "max-[600px]:ml-0 max-[600px]:w-full",
          )}
        >
          Review {reviewCount}
          <ArrowRight className="h-[15px] w-[15px]" strokeWidth={2} aria-hidden="true" />
        </ButtonLink>
      </div>

      <div className="max-h-[min(58vh,620px)] overflow-auto max-[600px]:max-h-[58vh]">
        {primary.map((file) => (
          <FileRow key={file.path} file={file} />
        ))}
        {generated.length ? (
          <BouncyAccordion
            className="border-t border-line-soft"
            items={[
              {
                id: "generated",
                title: (
                  <span className="flex items-center justify-between gap-3">
                    <span>Generated output</span>
                    <span className="font-normal text-text-3">
                      {generated.length} {plural(generated.length, "file", "files")}
                    </span>
                  </span>
                ),
                description: (
                  <div>
                    {generated.map((file) => (
                      <FileRow key={file.path} file={file} inset />
                    ))}
                  </div>
                ),
              },
            ]}
            classNames={{
              // The vendored row ANIMATES a 28px corner radius onto itself as an
              // inline style, which a plain utility cannot outrank — and a
              // rounded block floating inside a flush file list is not what this
              // is. `!` is what beats an inline style that carries no `!` of its
              // own. Measured in Chrome: 28px before, 0px after.
              item: "rounded-none! bg-fill-1",
              // `outline-none` is baked into the vendored trigger, so the focus
              // ring has to come back from here or the control has none at all.
              trigger: cn(
                "min-h-0 gap-3 px-[15px] py-[11px] hover:bg-fill-2",
                "focus-visible:bg-fill-2 focus-visible:shadow-[var(--shadow-focus)]",
              ),
              title: "overflow-visible text-xs font-semibold text-ellipsis text-text-2",
              chevron: "h-4 w-4 text-text-3",
              content: "bg-surface-2",
              // The vendored content wrapper hardcodes `px-5 pb-5`; these rows
              // have to sit flush like the primary ones above. The measured
              // element is the padded one, so `-mb-5` is also what keeps the
              // animated height honest.
              description: "-mx-5 -mb-5 text-[unset] leading-[unset] text-text",
            }}
          />
        ) : null}
      </div>
    </div>
  );
}
