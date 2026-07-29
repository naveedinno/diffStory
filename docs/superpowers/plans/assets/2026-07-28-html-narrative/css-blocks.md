# css-blocks

Five insertion points, zero new theme tokens. Block A goes into PAGE_CSS_CORE right after the existing `.ds-md` rules (src/page-assets.ts:482) and styles every tag the narrative sanitizer can emit: the table family, dl/dt/dd, hr, kbd, sup/sub, the `.ds-md-tablewrap` scroll container, and the five accent classes. Cells reset the inherited `overflow-wrap:anywhere` to `normal` (it feeds min-content width, which is what collapses columns to one character), and `.ds-md-tablewrap` owns `overflow-x:auto` so the concept column never scrolls sideways — the same "wide block owns its own overflow" shape as `.ds-concept-diagram-output`. Block B goes into SESSION_REDESIGN_CSS after `.ds-concept-body` (src/page-assets.ts:789) and steps the same elements up to the document's 15px/1.67 measure; it wins at equal specificity purely because SESSION_REDESIGN_CSS is concatenated after PAGE_CSS_CORE, which is the ordering the file already relies on. Blocks C/D/E append into the existing `@media (max-width:620px)`, `prefers-reduced-transparency`, and `prefers-contrast:more` rules. Colour comes entirely from tokens that already exist and are already tuned per theme — the accent hues borrow the syntax palette (`--tk-s`, `--tk-f`, `--tk-k`, `--tk-n`) plus the amber semantic pair, table rules and caption text use `--text-3` and `--muted`, which clear WCAG contrast in both themes by construction.


---

## Block A — `src/page-assets.ts`

**Placement:** insert after line 482 (immediately after `.ds-md .ds-md-code code{...}`, before `.ds-comment-menu{...}` on line 483)

```
/* ---- narrative markup (src/narrative.ts) ---- */
/* The sanitizer emits these tags directly, so each one needs a rule here: a bare
   UA <table> or <pre> ignores the concept column's width and blows it open
   sideways. Px values are hardcoded to sit with the .ds-md neighbours above —
   this block deliberately stays off the type-scale tokens. */
.ds-md .ds-md-tablewrap{margin:12px 0 0;overflow-x:auto;overscroll-behavior-x:contain}
.ds-md table{width:100%;margin:0;border-collapse:collapse;font-size:12.5px;line-height:1.5}
.ds-md caption{caption-side:top;padding:0 0 7px;color:var(--muted);font-size:11px;font-weight:600;letter-spacing:.02em;text-align:left}
/* .ds-md sets overflow-wrap:anywhere at the root and it inherits. Unlike
   break-word, anywhere feeds the min-content width, so an unreset cell shrinks
   to one character per line and every column collapses. */
.ds-md th,.ds-md td{padding:8px 12px;overflow-wrap:normal;word-break:normal;text-align:left;vertical-align:top}
.ds-md thead th{border-bottom:1px solid var(--text-3);color:var(--text);font-weight:700;white-space:nowrap}
.ds-md tbody{border-bottom:1px solid var(--text-3)}
.ds-md tbody th{color:var(--text);font-weight:600}
.ds-md tbody tr:nth-child(even){background:var(--fill-1)}
.ds-md dl{margin:10px 0 0}
.ds-md dt{margin-top:9px;color:var(--text);font-weight:700}
.ds-md dt:first-child{margin-top:0}
.ds-md dd{margin:3px 0 0 16px}
.ds-md hr{height:1px;margin:14px 0;border:0;background:var(--line)}
.ds-md kbd{display:inline-block;min-width:18px;padding:1px 5px;border:1px solid var(--line);border-bottom-width:2px;border-radius:5px;background:var(--fill-2);color:var(--text);font-family:var(--mono);font-size:.86em;line-height:1.45;text-align:center;white-space:nowrap}
/* line-height:0 plus a relative offset is the only pair that keeps sup/sub from
   stretching the line box — the concept document runs 1.67 leading and a
   footnote marker must not open a gap in the paragraph it annotates. */
.ds-md sup,.ds-md sub{position:relative;font-size:.72em;line-height:0;vertical-align:baseline}
.ds-md sup{top:-.46em}
.ds-md sub{bottom:-.24em}
/* <pre data-lang> is allowlisted, but only the markdown renderer adds
   .ds-md-code — a narrative <pre> arrives bare and needs its own box. */
.ds-md pre{margin:10px 0 0;padding:10px 12px;border:1px solid var(--line-soft);border-radius:8px;background:var(--gutter);overflow-x:auto;color:var(--text);font-family:var(--mono);font-size:11.5px;line-height:1.5;white-space:pre;overflow-wrap:normal}
/* .ds-md p{margin:0}, so a paragraph following a new block needs the same
   sibling gap the .ds-md-code+p pair already gets. */
.ds-md .ds-md-tablewrap+p,.ds-md dl+p,.ds-md hr+p,.ds-md pre+p{margin-top:10px}
/* The five narrative accents. Each class sets nothing but a hue; the shared
   rules pull the tint and the chip border off currentColor, so the set stays one
   declaration wide. Hues are the syntax palette, which theme.ts already tunes
   for contrast in both themes: bit=literal, slot=identifier, flag=keyword,
   num=numeral, warn=the amber semantic pair. */
.ds-md :is(.ds-bit,.ds-slot,.ds-flag,.ds-val,.ds-warn){background:color-mix(in srgb,currentColor 14%,transparent)}
.ds-md :is(.ds-bit,.ds-slot,.ds-flag,.ds-val){font-family:var(--mono);font-size:.94em;font-weight:600;font-variant-numeric:tabular-nums}
.ds-md span:is(.ds-bit,.ds-slot,.ds-flag,.ds-val,.ds-warn){padding:1px 5px;border-radius:5px}
.ds-md code:is(.ds-bit,.ds-slot,.ds-flag,.ds-val,.ds-warn){border-color:color-mix(in srgb,currentColor 34%,transparent)}
.ds-md :is(th,td).ds-val{text-align:right}
.ds-md .ds-bit{color:var(--tk-s)}
.ds-md .ds-slot{color:var(--tk-f)}
.ds-md .ds-flag{color:var(--tk-k)}
.ds-md .ds-val{color:var(--tk-n)}
.ds-md .ds-warn{color:var(--amber-text);font-weight:600}
```

---

## Block B — `src/page-assets.ts`

**Placement:** insert after line 789 (immediately after the `.ds-concept-body{...}` line, before `.ds-concept-diagram` on line 790)

```
/* The concept document runs 15px/1.67, so the narrative blocks step up with it.
   These sit in SESSION_REDESIGN_CSS, which is concatenated after PAGE_CSS_CORE —
   that source order is the only reason they beat .ds-md at equal specificity.
   The wrap still owns overflow-x, so a wide table scrolls inside the measure and
   .ds-concept-scroll keeps its vertical-only axis. */
.ds-concept-body .ds-md-tablewrap{margin:18px 0 20px}.ds-concept-body table{font-size:13.5px;line-height:1.55}.ds-concept-body caption{padding-bottom:9px;color:var(--muted);font-size:11.5px}.ds-concept-body th,.ds-concept-body td{padding:9px 14px}.ds-concept-body dl{margin:14px 0 18px}.ds-concept-body dt{margin-top:13px}.ds-concept-body dd{margin:4px 0 0 18px}.ds-concept-body hr{margin:24px 0;background:var(--line-soft)}.ds-concept-body kbd{font-size:.8em}.ds-concept-body pre{margin:16px 0;padding:13px 15px;border-radius:9px;background:var(--panel3);font-size:12px}
```

---

## Block C — `src/page-assets.ts`

**Placement:** append inside the `@media (max-width:620px){...}` rule on line 840, immediately before its closing `}` (i.e. directly after `.ds-filmthread-allfiles{height:44px;padding:0 9px}`)

```
.ds-concept-body .ds-md-tablewrap{margin:14px 0 16px}.ds-concept-body table{font-size:12.5px}.ds-concept-body th,.ds-concept-body td{padding:7px 10px}.ds-concept-body dd{margin-left:13px}.ds-concept-body pre{margin:13px 0;padding:11px 12px;font-size:11.5px}.ds-md kbd{padding:1px 4px}
```

---

## Block D — `src/page-assets.ts`

**Placement:** append inside the `@media (prefers-reduced-transparency:reduce){...}` rule on line 847, immediately before its closing `}`

```
.ds-md :is(.ds-bit,.ds-slot,.ds-flag,.ds-val,.ds-warn){background:color-mix(in srgb,currentColor 14%,var(--panel3))}.ds-md tbody tr:nth-child(even){background:var(--panel3)}
```

---

## Block E — `src/page-assets.ts`

**Placement:** append inside the `@media (prefers-contrast:more){...}` rule on line 848, immediately before its closing `}`

```
.ds-md caption{color:var(--text)}.ds-md thead th,.ds-md tbody{border-color:var(--text)}.ds-md tbody tr:nth-child(even){background:transparent}.ds-md tbody tr+tr{border-top:1px solid var(--line)}.ds-md hr{background:var(--text-3)}.ds-md kbd{border-color:var(--text-3)}.ds-md .ds-warn{color:var(--text);background:var(--amber-soft);box-shadow:inset 0 0 0 1px var(--amber)}
```

---

## Notes

- Zero new tokens — theme.ts:129-196 is untouched. Reused: --text-3 (table rules), --muted/--text-2 (caption), --line + --line-soft (hr, kbd, pre border), --fill-1 (zebra), --fill-2 (kbd ground), --gutter (pre ground), --panel3 (opaque fallbacks), --mono, --text, and the syntax palette --tk-s/--tk-f/--tk-k/--tk-n plus --amber/--amber-text/--amber-soft for the five accent classes. The --tk-* set is the right borrow because theme.ts already gives it a separate light-theme ramp tuned for small text (theme.ts:162 vs :193), so the accents inherit that tuning instead of needing their own pair.

- Contrast, measured against the concept document ground (--panel2 = #181b20 dark / #eef1f5 light): --text-3 table rules land 4.95:1 dark (worst case, over --surface-3) and 4.92:1 light — well past the 3:1 non-text floor, and past 4.5:1 too. Caption at --muted is 6.70:1 dark / 5.04:1 light. --text-3 is used as-is, never mixed toward transparent: an alpha mix behaves asymmetrically across the two themes (38% of --text is 3.2:1 on dark but only 2.4:1 on light), which is exactly why a single mixed value can't serve both and why the raw token is the correct choice.

- Table structure is deliberately sparse — a header rule, a closing rule under tbody, and a zebra fill — rather than a full grid. Every rule that IS drawn clears contrast; the row separation that would have needed weak hairlines is carried by the --fill-1 stripe, which is decorative and exempt. Under prefers-contrast:more the stripe is dropped and real `tr+tr` rules take over, using the --line that block already redefines to 42% of --text.

- The cell reset is `overflow-wrap:normal`, not `break-word`. `anywhere` (inherited from .ds-md at line 471) is the one value that participates in min-content width calculation, which is precisely what collapses a column to one character per line; `break-word` would not undo that. Long unbroken tokens now overflow instead of wrapping, which is fine because .ds-md-tablewrap scrolls them.

- Overflow chain verified against the stated column: .ds-concept-step{overflow:hidden} > .ds-concept-scroll{overflow-y:auto} > .ds-concept-document{width:min(100%,860px);padding:34px 42px 38px}. Only .ds-md-tablewrap and .ds-md pre carry overflow-x:auto, mirroring .ds-concept-diagram-output at line 791. Note that .ds-concept-body{max-width:72ch} means tables are laid out against roughly 648px of measure, not the document's 776px inner width — narrower than it needs to be, but it scrolls cleanly and I did not reach for negative margins to escape the measure. Flagging it in case you want tables to break out later.

- The `<pre>` rule is an addition beyond your listed elements. It is here because `pre` with `data-lang` is on the allowlist but only renderMarkdown emits the .ds-md-code class (render.ts:2111, page-assets.ts:1068) — a narrative-authored `<pre>` arrives bare, and a bare UA `<pre>` has `white-space:pre` with no overflow container, so it would push the concept column sideways and violate the no-horizontal-scroll requirement. Drop it only if narrative.ts is also going to stamp .ds-md-code onto pre.

- Specificity is intentional and checked: `:is()` takes the specificity of its most specific argument, so `.ds-md :is(.ds-bit,…)` is (0,2,0) and beats `.ds-md code` (0,1,1) for background; `.ds-md code:is(.ds-bit,…)` is (0,2,1) and beats `.ds-md code` for border-color; `.ds-md :is(th,td).ds-val` is (0,2,1) and beats `.ds-md th,.ds-md td` for text-align. `:is()` is already in use in this file (line 770), so it is not new syntax here.

- `background:color-mix(in srgb,currentColor 14%,transparent)` resolves currentColor against the element's own computed `color`, which the per-class rules set further down the block. Cascade order between the two is irrelevant — `color` is resolved before `background` consumes currentColor — but keep the shared rule ahead of the hue rules anyway so the block reads top-down.

- One honest gap: `.ds-warn` uses --amber-text on an --amber-soft-weight tint, which in the light theme lands near 3.9:1 rather than 4.5:1. That is the existing house treatment (.ds-severity-concern at line 813, .ds-exclusion-ack small at line 815 do exactly this), and I matched it rather than making one class an outlier — the prefers-contrast:more entry lifts it to --text on an amber ring. If you would rather it clear AA unconditionally, swap the base rule to `color:var(--text);background:var(--amber-soft);box-shadow:inset 0 0 0 1px var(--amber)` and delete the prefers-contrast override for it.

- dl/dt/dd use plain block flow, not grid. A grid layout reads better for one-dd-per-dt but breaks the moment an author writes two `<dd>` under one `<dt>` — which the sanitizer permits — so flow layout is the safe shape.

- No rules for h2/h3/h4 in .ds-md itself; .ds-concept-body already styles them at line 789 and that is the only block-tier surface. If a second block-tier consumer appears, headings will fall through to UA sizes.
