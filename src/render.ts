// Turn a validated tour + the parsed diff into a single self-contained HTML page.
// All code content is escaped here, server-side; the client JS only ever uses
// textContent, so there is no HTML-injection sink.
import { join } from 'node:path';
import { readFileRange } from './git.js';
import { rangesOverlap } from './diff.js';
import { orderedSteps } from './tour.js';
import { computeCoverage, stalePointers } from './coverage.js';
import { PAGE_CSS, PAGE_JS } from './page-assets.js';
import { APP_NAME } from './config.js';
import type { DiffFile, DiffLine, Tour, TourStep } from './types.js';

const UNCOVERED_STEP_ID = '__uncovered__';

export interface RenderInput {
  repo: string;
  tour: Tour;
  files: DiffFile[];
  baseLabel: string;
}

export function renderPage(input: RenderInput): string {
  const { repo, tour, files, baseLabel } = input;
  const steps = orderedSteps(tour);
  const byId = new Map(steps.map((s) => [s.id, s]));
  const coverage = computeCoverage(tour, files);
  const stale = stalePointers(tour, files);

  const coveragePill =
    coverage.uncovered.length > 0
      ? `<span class="pill warn">⚠ ${coverage.uncovered.length} change${coverage.uncovered.length === 1 ? '' : 's'} not in tour</span>`
      : `<span class="pill ok">✓ all changes covered</span>`;

  const head = `
  <header class="top">
    <h1><span class="brand">${APP_NAME}</span> ${esc(tour.title)}</h1>
    ${tour.summary ? `<p class="summary">${nl(esc(tour.summary))}</p>` : ''}
    <div class="meta">
      <span class="pill">vs ${esc(baseLabel)}</span>
      <span class="pill">${coverage.coveredChangedFiles}/${coverage.totalChangedFiles} changed files</span>
      ${coveragePill}
      <span class="pill" id="comment-count">0 comments</span>
    </div>
    ${staleBanner(stale)}
  </header>`;

  const body =
    steps.map((s) => renderStep(repo, s, files, byId)).join('\n') +
    renderUncovered(coverage, files);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${APP_NAME} — ${esc(tour.title)}</title>
<style>${PAGE_CSS}</style>
</head>
<body>
${head}
<div class="layout">
${renderRail(steps)}
<main>
${body || '<div class="empty">This tour has no steps.</div>'}
</main>
</div>
<script>${PAGE_JS}</script>
</body>
</html>`;
}

function renderRail(steps: TourStep[]): string {
  const items = steps
    .map(
      (s) =>
        `<li><a href="#step-${esc(s.id)}"><span class="num">${s.order}</span>${esc(
          s.title,
        )}<span class="ktag">${s.kind}</span></a></li>`,
    )
    .join('');
  return `<nav class="rail"><ol>${items}</ol></nav>`;
}

function renderStep(
  repo: string,
  step: TourStep,
  files: DiffFile[],
  byId: Map<string, TourStep>,
): string {
  const view = buildStepView(repo, step, files);
  const loc = `${esc(step.file)}:${step.range[0]}–${step.range[1]}`;
  const editor = vscodeLink(repo, step.file, step.range[0]);
  const tags = (step.tags ?? []).map((t) => `<span class="pill">${esc(t)}</span>`).join(' ');

  const code = view.blocks.length
    ? `<div class="code">${view.blocks
        .map(
          (block, i) =>
            (i > 0 ? `<div class="gap"><span>⋯</span></div>` : '') +
            block.map((dl) => renderLine(dl, step)).join(''),
        )
        .join('')}</div>`
    : `<div class="empty">${esc(view.note ?? 'Nothing to show.')}</div>`;

  return `<section class="step" id="step-${esc(step.id)}">
  <div class="step-head"><span class="order">#${step.order}</span><h2>${esc(
    step.title,
  )}</h2><span class="kind">${step.kind}</span></div>
  <div class="loc"><span>${loc}</span><a href="${editor}">open in editor →</a>${
    tags ? `<span>${tags}</span>` : ''
  }</div>
  <div class="why">${nl(esc(step.why))}</div>
  ${renderJumps(step, byId)}
  ${view.note && view.blocks.length ? `<div class="loc">note: ${esc(view.note)}</div>` : ''}
  ${code}
</section>`;
}

function renderJumps(step: TourStep, byId: Map<string, TourStep>): string {
  const parts: string[] = [];
  for (const id of step.calls ?? []) {
    const t = byId.get(id);
    if (t) parts.push(`<a href="#step-${esc(id)}">→ flows into: ${esc(t.title)}</a>`);
  }
  if (step.returnsTo) {
    const t = byId.get(step.returnsTo);
    if (t) parts.push(`<a href="#step-${esc(step.returnsTo)}">↩ back to: ${esc(t.title)}</a>`);
  }
  return parts.length ? `<div class="jumps">${parts.join('')}</div>` : '';
}

function renderLine(dl: DiffLine, step: TourStep): string {
  const no = dl.newNo ?? dl.oldNo ?? '';
  const canComment = dl.newNo !== undefined;
  const data = canComment
    ? ` data-file="${esc(step.file)}" data-line="${dl.newNo}" data-step="${esc(step.id)}"`
    : '';
  const gutter = canComment ? '<span class="gut gutter">+</span>' : '<span class="gut"></span>';
  return `<div class="ln ${dl.type}"${data}>${gutter}<span class="no">${no}</span><span class="code-content">${
    esc(dl.content) || ' '
  }</span></div>`;
}

interface StepView {
  blocks: DiffLine[][];
  note?: string;
}

function buildStepView(repo: string, step: TourStep, files: DiffFile[]): StepView {
  const [start, end] = step.range;
  const file = files.find((f) => f.newPath === step.file);

  if (step.kind === 'changed') {
    if (file && file.hunks.length) {
      const blocks = file.hunks
        .filter((h) => rangesOverlap([h.newStart, h.newStart + Math.max(h.newLines, 1) - 1], [start, end]))
        .map((h) => h.lines);
      if (blocks.length) return { blocks };
      return {
        blocks: file.hunks.map((h) => h.lines),
        note: 'tour range did not match a hunk — showing all changes in this file',
      };
    }
    const r = readFileRange(repo, step.file, start, end);
    if (!r) return { blocks: [], note: `file not found: ${step.file}` };
    return {
      blocks: [r.lines.map((c, i) => ctx(c, r.startLine + i))],
      note: 'no diff for this range — showing the current file',
    };
  }

  // context or new-file: read straight from the working tree
  const r = readFileRange(repo, step.file, start, end);
  if (!r) return { blocks: [], note: `file not found: ${step.file}` };
  const kind: DiffLine['type'] = step.kind === 'new-file' ? 'add' : 'ctx';
  return { blocks: [r.lines.map((c, i) => ({ type: kind, content: c, newNo: r.startLine + i }))] };
}

function renderUncovered(coverage: ReturnType<typeof computeCoverage>, files: DiffFile[]): string {
  if (!coverage.uncovered.length) return '';
  const blocks = coverage.uncovered
    .map((u) => {
      const file = files.find((f) => f.newPath === u.file);
      const lines = file
        ? file.hunks
            .filter((h) => rangesOverlap([h.newStart, h.newStart + Math.max(h.newLines, 1) - 1], u.range))
            .flatMap((h) => h.lines)
        : [];
      const head = `<div class="loc"><span>${esc(u.file)}:${u.range[0]}–${u.range[1]}</span><span class="pill">${u.status}</span></div>`;
      const code = lines.length
        ? `<div class="code">${lines
            .map((dl) => renderLine(dl, { id: UNCOVERED_STEP_ID, file: u.file } as TourStep))
            .join('')}</div>`
        : '';
      return head + code;
    })
    .join('<div class="gap"><span>⋯</span></div>');

  return `<section class="step uncovered" id="step-${UNCOVERED_STEP_ID}">
  <div class="step-head"><span class="order">⚠</span><h2>Not in the tour</h2><span class="kind">${coverage.uncovered.length} hunk(s)</span></div>
  <div class="why">These changes are in the diff but no tour step points at them. The agent may have left them out — review them directly, or send a comment asking why.</div>
  ${blocks}
</section>`;
}

function staleBanner(stale: TourStep[]): string {
  if (!stale.length) return '';
  const names = stale.map((s) => esc(s.title)).join(', ');
  return `<div class="meta"><span class="pill warn">⚠ ${stale.length} step(s) point at unchanged code: ${names}</span></div>`;
}

function ctx(content: string, newNo: number): DiffLine {
  return { type: 'ctx', content, newNo };
}

function vscodeLink(repo: string, file: string, line: number): string {
  return `vscode://file${encodeURI(join(repo, file))}:${line}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nl(s: string): string {
  return s.replace(/\n/g, '<br>');
}
