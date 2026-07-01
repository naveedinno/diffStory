// A self-contained, story-less diff viewer for the "Your change" screen.
//
// The review page (render.ts) renders the diff too, but it's wired to a story
// (steps, coverage, comments, voice). This is the plain version: parse a git
// diff and show each file's hunks — no agent, no story required — so a reviewer
// can read the change immediately and only generate a story if they want one.
//
// Styling is deliberately its own small system (the `dv-*` classes) that fits
// the change page's Apple-style tokens, rather than sharing the review's `ds-*`
// CSS — that keeps this isolated and means touching it can never regress the
// review. Syntax highlighting reuses highlight() (the same tk-* spans the
// review uses); the token colors are redeclared below so they render here too.
import { highlight } from './highlight.js';
import { intraLineMap, type IntraSides } from './intra-line.js';
import { isReviewNoise } from './noise.js';
import type { DiffFile, DiffHunk, DiffLine } from './types.js';
import type { SbsRow } from './view-model.js';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

const STATUS_LABEL: Record<DiffFile['status'], string> = {
  modified: 'Modified',
  added: 'New',
  deleted: 'Deleted',
  renamed: 'Renamed',
};

function counts(f: DiffFile): { add: number; del: number } {
  let add = 0;
  let del = 0;
  for (const h of f.hunks) {
    for (const l of h.lines) {
      if (l.type === 'add') add++;
      else if (l.type === 'del') del++;
    }
  }
  return { add, del };
}

/** One diff row (unified): line number gutter + sign + highlighted code. When
 *  `intra` is given (word-level diff HTML for this line), it's used instead of a
 *  plain highlight so only the changed tokens are marked. */
function rowHtml(type: DiffLine['type'], no: number | undefined, content: string, intra?: string): string {
  const sign = type === 'add' ? '+' : type === 'del' ? '−' : ' ';
  return (
    `<div class="dv-row dv-${type}">` +
    `<span class="dv-no">${no ?? ''}</span>` +
    `<span class="dv-sign">${sign}</span>` +
    `<span class="dv-code">${(intra ?? highlight(content)) || ' '}</span>` +
    `</div>`
  );
}

/** A unified row's precomputed intra-line side: del shows the old line (left),
 *  add shows the new line (right). Context rows have none. */
function pickSide<T>(map: Map<T, IntraSides>, row: T, type: DiffLine['type']): string | undefined {
  const sides = map.get(row);
  if (type === 'del') return sides?.left;
  if (type === 'add') return sides?.right;
  return undefined;
}

function hunkHeader(h: DiffHunk): string {
  const label = `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`;
  return `<div class="dv-hunkhead">${esc(label)}</div>`;
}

/** The default view: just the changed hunks, each with its @@ header. */
function hunksBody(f: DiffFile): string {
  if (!f.hunks.length) return `<div class="dv-note">No line changes (metadata only).</div>`;
  return f.hunks
    .map((h) => {
      const intra = intraLineMap(h.lines, (l) => l.type, (l) => l.content);
      return (
        hunkHeader(h) +
        h.lines.map((l) => rowHtml(l.type, l.newNo ?? l.oldNo, l.content, pickSide(intra, l, l.type))).join('')
      );
    })
    .join('');
}

/** The "Full file" view: every line, changed ones marked. Built from SbsRow[]
 *  (buildFullFileRows) so the server can stream it lazily without a story. */
export function renderDiffFullBody(rows: SbsRow[]): string {
  if (!rows.length) return `<div class="dv-note">Couldn't read the file from the working tree.</div>`;
  const intra = intraLineMap(rows, (r) => r.type, (r) => r.content);
  return rows
    .map((r) => rowHtml(r.type, r.type === 'del' ? r.oldNo : r.newNo, r.content, pickSide(intra, r, r.type)))
    .join('');
}

function pathHtml(path: string): string {
  const i = path.lastIndexOf('/');
  const dir = i < 0 ? '' : path.slice(0, i + 1);
  const base = i < 0 ? path : path.slice(i + 1);
  return `${dir ? `<span class="dir">${esc(dir)}</span>` : ''}<span class="base">${esc(base)}</span>`;
}

function filePanel(f: DiffFile): string {
  const { add, del } = counts(f);
  const canFull = f.status !== 'deleted';
  const toggle = canFull
    ? `<div class="dv-toggle" role="group" aria-label="View mode">` +
      `<button type="button" class="is-active" data-mode="diff">Diff</button>` +
      `<button type="button" data-mode="full">Full file</button>` +
      `</div>`
    : '';
  return (
    `<section class="dv-file" data-file="${esc(f.newPath)}" data-loaded="0">` +
    `<div class="dv-fhead">` +
    `<span class="dv-fpath" title="${esc(f.newPath)}">${pathHtml(f.newPath)}</span>` +
    `<span class="dv-badge dv-badge-${f.status}">${STATUS_LABEL[f.status]}</span>` +
    `<span class="dv-fstat"><span class="add">+${add}</span><span class="del">−${del}</span></span>` +
    toggle +
    `</div>` +
    `<div class="dv-body" data-diff-body>${hunksBody(f)}</div>` +
    `<div class="dv-body" data-full-body hidden></div>` +
    `</section>`
  );
}

/** Render every changed file's diff. Generated/oversized files are listed but
 *  not rendered, so a regenerated 20k-line artifact can't balloon the page. */
export function renderDiffFiles(files: DiffFile[]): string {
  const textual = files.filter((f) => f.hunks.length);
  const normal = textual.filter((f) => !isReviewNoise(f.newPath, totalChange(f)));
  const noise = textual.filter((f) => isReviewNoise(f.newPath, totalChange(f)));

  if (!normal.length && !noise.length) {
    return `<div class="dv-empty">No textual changes to show for this scope.</div>`;
  }

  const panels = normal.map(filePanel).join('');
  const noiseHtml = noise.length
    ? `<details class="dv-noise"><summary>` +
      `<span class="dv-noise-chev" aria-hidden="true">›</span>` +
      `<span>${plural(noise.length, 'generated &amp; large file')} — diff hidden</span>` +
      `</summary><div class="dv-noise-list">` +
      noise.map((f) => `<div class="dv-noise-row">${pathHtml(f.newPath)}</div>`).join('') +
      `</div></details>`
    : '';

  return `<div class="dv-files">${panels}${noiseHtml}</div>`;
}

function totalChange(f: DiffFile): number {
  const { add, del } = counts(f);
  return add + del;
}

/** CSS for the diff viewer. Uses the change page's existing tokens (--elev,
 *  --hair, --add, …) plus its own tk-* token colors so highlight() renders. */
export function diffViewStyles(): string {
  return `
:root{--tk-k:#9A2EBF;--tk-t:#0E7490;--tk-f:#2563EB;--tk-s:#297A3A;--tk-n:#B45309;--tk-c:#6B7785;
  --dv-add:rgba(52,199,89,.12);--dv-del:rgba(255,69,58,.11);--dv-addno:rgba(52,199,89,.22);--dv-delno:rgba(255,69,58,.2);
  --dv-addchg:rgba(52,199,89,.32);--dv-delchg:rgba(255,69,58,.3)}
@media (prefers-color-scheme:dark){:root{--tk-k:#C79BFF;--tk-t:#6FD2C2;--tk-f:#8FB4FF;--tk-s:#B7D59B;--tk-n:#E8A87C;--tk-c:#8A929E;
  --dv-add:rgba(48,209,88,.16);--dv-del:rgba(255,105,97,.15);--dv-addno:rgba(48,209,88,.28);--dv-delno:rgba(255,105,97,.26);
  --dv-addchg:rgba(48,209,88,.42);--dv-delchg:rgba(255,105,97,.4)}}
.dv-files{display:flex;flex-direction:column;gap:14px}
.dv-file{background:var(--elev);border:.5px solid var(--hair);border-radius:14px;overflow:hidden;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.dv-fhead{display:flex;align-items:center;gap:10px;padding:9px 14px;border-bottom:.5px solid var(--sep);background:var(--subbg);font-size:13px}
.dv-fpath{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:"SF Mono",ui-monospace,Menlo,monospace;font-size:12.5px;direction:rtl;text-align:left}
.dv-fpath .dir{color:var(--l3)}.dv-fpath .base{color:var(--label);font-weight:600}
.dv-badge{flex:none;font-size:10.5px;font-weight:700;letter-spacing:.02em;text-transform:uppercase;padding:2px 7px;border-radius:6px;background:var(--fill);color:var(--l2)}
.dv-badge-added{color:var(--add);background:color-mix(in srgb,var(--addbar) 16%,transparent)}
.dv-badge-deleted{color:var(--del);background:color-mix(in srgb,var(--delbar) 16%,transparent)}
.dv-fstat{flex:none;font-family:"SF Mono",ui-monospace,Menlo,monospace;font-size:12px;display:inline-flex;gap:8px}
.dv-toggle{flex:none;display:inline-flex;border:.5px solid var(--hair);border-radius:8px;overflow:hidden}
.dv-toggle button{font:inherit;font-size:11.5px;font-weight:600;padding:4px 11px;background:var(--elev);color:var(--l2);border:none;cursor:pointer;line-height:1.6}
.dv-toggle button+button{border-left:.5px solid var(--hair)}
.dv-toggle button:hover{background:var(--fill);color:var(--label)}
.dv-toggle button.is-active{background:var(--blue);color:#fff}
.dv-body{overflow:auto;max-height:min(60vh,640px);font-family:"SF Mono",ui-monospace,Menlo,monospace;font-size:12.5px;line-height:1.55}
.dv-body[hidden]{display:none}
.dv-hunkhead{padding:3px 14px;background:var(--fill);color:var(--l3);font-size:11.5px;border-top:.5px solid var(--sep);border-bottom:.5px solid var(--sep)}
.dv-file .dv-body>.dv-hunkhead:first-child{border-top:none}
.dv-row{display:grid;grid-template-columns:52px 18px 1fr;align-items:baseline;min-width:max-content;padding-right:14px}
.dv-no{text-align:right;padding-right:11px;color:var(--l3);user-select:none;font-variant-numeric:tabular-nums}
.dv-sign{text-align:center;user-select:none;color:var(--l3)}
.dv-code{white-space:pre;padding-left:8px;color:var(--label)}
.dv-add{background:var(--dv-add)}.dv-add .dv-no{background:var(--dv-addno)}.dv-add .dv-sign{color:var(--add);font-weight:700}
.dv-del{background:var(--dv-del)}.dv-del .dv-no{background:var(--dv-delno)}.dv-del .dv-sign{color:var(--del);font-weight:700}
.dv-code .tk-k{color:var(--tk-k)}.dv-code .tk-t{color:var(--tk-t)}.dv-code .tk-f{color:var(--tk-f)}
.dv-code .tk-s{color:var(--tk-s)}.dv-code .tk-n{color:var(--tk-n)}.dv-code .tk-c{color:var(--tk-c);font-style:italic}
.dv-add .dv-code .changed{background:var(--dv-addchg);border-radius:3px;box-shadow:0 0 0 1px var(--dv-addchg)}
.dv-del .dv-code .changed{background:var(--dv-delchg);border-radius:3px;box-shadow:0 0 0 1px var(--dv-delchg)}
.dv-note,.dv-empty{padding:18px 16px;color:var(--l2);font-size:13px}
.dv-empty{text-align:center;background:var(--elev);border:.5px solid var(--hair);border-radius:14px}
.dv-noise{background:var(--elev);border:.5px solid var(--hair);border-radius:14px;overflow:hidden}
.dv-noise>summary{display:flex;align-items:center;gap:9px;padding:11px 15px;font-size:12.5px;color:var(--l2);cursor:pointer;list-style:none;user-select:none}
.dv-noise>summary::-webkit-details-marker{display:none}
.dv-noise>summary:hover{background:var(--fill)}
.dv-noise-chev{display:inline-flex;transition:transform .15s ease;color:var(--l3);font-size:15px;line-height:1}
.dv-noise[open] .dv-noise-chev{transform:rotate(90deg)}
.dv-noise-list{border-top:.5px solid var(--sep)}
.dv-noise-row{padding:8px 15px;border-bottom:.5px solid var(--sep);font-family:"SF Mono",ui-monospace,Menlo,monospace;font-size:12px}
.dv-noise-row:last-child{border-bottom:none}
`;
}

/** Client script: the per-file Diff / Full-file toggle (lazy-loads full file). */
export function diffViewScript(): string {
  return `(function(){
  document.addEventListener('click',function(e){
    var btn=e.target.closest('.dv-toggle button');if(!btn)return;
    var panel=btn.closest('.dv-file');if(!panel)return;
    var mode=btn.getAttribute('data-mode');
    [].slice.call(panel.querySelectorAll('.dv-toggle button')).forEach(function(b){b.classList.toggle('is-active',b===btn);});
    var diffBody=panel.querySelector('[data-diff-body]'),fullBody=panel.querySelector('[data-full-body]');
    if(!diffBody||!fullBody)return;
    if(mode==='full'){
      if(panel.getAttribute('data-loaded')!=='1'){
        fullBody.innerHTML='<div class="dv-note">Loading full file…</div>';
        fetch('/api/diff/fullfile?file='+encodeURIComponent(panel.getAttribute('data-file')||''))
          .then(function(r){return r.text();})
          .then(function(html){fullBody.innerHTML=html;panel.setAttribute('data-loaded','1');})
          .catch(function(){fullBody.innerHTML='<div class="dv-note">Could not load the full file.</div>';});
      }
      diffBody.hidden=true;fullBody.hidden=false;
    }else{
      diffBody.hidden=false;fullBody.hidden=true;
    }
  });
})();`;
}
