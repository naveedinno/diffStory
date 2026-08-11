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

import { ArrowRight } from "lucide-react";
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
            {file.added ? <span className="text-add">+{file.added}</span> : null}
            {file.removed ? <span className="ml-1.5 text-del">−{file.removed}</span> : null}
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
        <p className="m-0 mb-3 font-mono text-[11px] text-add">✓ working tree clean</p>
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
          <span className="text-add">+{total.added}</span>
          <span className="text-del">−{total.removed}</span>
        </span>
        <ButtonLink
          href={diffHref}
          aria-label={`Start review of ${reviewCount}`}
          pressScale={0.97}
          whileHover={undefined}
          className={cn(
            "ml-auto h-[var(--control-h)] gap-[7px] rounded-full bg-accent px-[15px] text-[12.5px] font-semibold text-on-accent hover:bg-accent-hi",
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
          <details className="group border-t border-line-soft">
            <summary className="flex cursor-pointer list-none items-center justify-between bg-fill-1 px-[15px] py-[11px] text-xs font-semibold text-text-2 [&::-webkit-details-marker]:hidden focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_var(--accent-soft)]">
              <span>Generated output</span>
              <span>
                {generated.length} {plural(generated.length, "file", "files")}{" "}
                <i className="ml-1.5 inline-block text-text-3 not-italic group-open:rotate-180">⌄</i>
              </span>
            </summary>
            <div>
              {generated.map((file) => (
                <FileRow key={file.path} file={file} inset />
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </div>
  );
}
