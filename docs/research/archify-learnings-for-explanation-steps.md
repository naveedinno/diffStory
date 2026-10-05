# Archify: what its explanation/diagram approach teaches our storyteller skill

Researched 2026-10-05 against primary sources only: the `tt-a1i/archify` repo at `3c4e4a50` (cloned 2026-10-05; README, `archify/SKILL.md`, all seven files under `archify/references/`, `DESIGN.md`, `docs/authoring-cookbook.md`, `archify/recipes/scenarios.mjs`, the `web-app.architecture.json` example, `archify/delta/architecture-delta.mjs`, `archify/schemas/common.schema.json`, and the viewer design comments in `archify/assets/template.html`). Compared against this repo's `skills/diffstory-storyteller/SKILL.md` + `references/`, `docs/story-schema.md`, and `docs/research/explaining-changes.md`. Not verified: viewer runtime behavior beyond its in-code comments and contracts (no browser run was made); the 130K+ install badge and press claims in the README are vendor assertions, not findings.

---

## 1. What archify does and how its agent skill works

**Product.** Archify turns a plain-language description, a pasted Mermaid diagram, or a real repository into a standalone interactive HTML diagram: typed JSON IR in, one self-contained HTML file with inline SVG out. Five diagram types — `architecture`, `workflow`, `sequence`, `dataflow`, `lifecycle` — chosen from the reader's question (type router at `archify/SKILL.md:50-60`). Output defaults to static; motion is opt-in (`archify/SKILL.md:13`: "Static output is the default; enable motion only when requested"). The closest feature to our problem is **Architecture Delta**: two validated snapshots in, one HTML page with Before / Delta / After tabs, a change navigator, and a finite step-through Review (README:254).

**The skill's shape.** `archify/SKILL.md` (109 lines) is a thin fast path: pick a type, read one example plus the schemas, write the complete candidate JSON directly ("without planning coordinates in prose", `archify/SKILL.md:32`), then run one `finalize` command that chains validate → deliver → strict check → real-browser check and stops at the first failing gate. Seven `references/*.md` files load only on trigger ("Read branch references only when their stated trigger applies", `archify/SKILL.md:27`) — the same core-plus-references shape our D8 decision adopted. A `/tmp`-level detail worth noting: each new diagram request gets its own timestamped folder so earlier versions stay intact (`archify/SKILL.md:15`).

**The pipeline's philosophy is measurement over taste.** `finalize` returns stable rule codes with the exact subject, measured evidence, and only the supported repair controls (`delivery-contract.md:264`, README:302); the agent edits the connected neighborhood and reruns the whole command. Three properties matter for the comparison below:

1. **Bounded repair.** "If an issue survives two focused repairs, inspect measured geometry or the relevant contract; after one evidence-based retry, report the concrete gap" (`delivery-contract.md:9`). Escalated visual review allows at most `correction_rounds: 2` (`delivery-contract.md:558-560`).
2. **Claims never merge.** The handoff receipt reports `validation`, `browser_evidence`, `visual_review`, and `correction_rounds` as separate fields (`delivery-contract.md:565-578`), and "Passing one claim never implies the others" (`delivery-contract.md:346`). The agent must "Report artifact checks, browser evidence, captures, and actual perceptual review as distinct results" (`archify/SKILL.md:88`).
3. **Reader-driven, not author-narrated.** The viewer offers focus, upstream/downstream reach, route probing, a semantic lens, radar, finder, and deep links (`references/viewer-runtime.md:5-16`) — but no authored narration path, no beats, no landing, no read-aloud. The agent authors topology; the reader finds their own way through it. The single exception is the Delta page's finite Review playback (section 2.6), which steps through machine-derived changes, not authored prose.

**Corroborations with our existing research (no action, but confidence):** main-path-first placement with branches beside their owner (`authoring-defaults.md:15-23`, cf. our runtime-flow ordering); "Use one concise title and let the diagram carry the explanation" (`authoring-contract.md:131`, cf. our title rules); Mermaid accepted only as input topology and never rendered as output (`archify/SKILL.md:64-70`, cf. our v4 move from Mermaid `diagram` to HTML `page`); no quotas — "There is no node, edge, citation, view, card, or boundary count to hit" (`repository-authoring.md:62-63`, cf. our "no fixed stop count").

---

## 2. Techniques worth borrowing

Each item names the archify directive verbatim where it counts, cites the source, and says what it maps to in our skill.

### 2.1 Labels are semantic data; deleting one is never a spacing repair

> "Relationship labels are semantic data. If the gap is too small, move the label, adjust the route or spacing, then shorten the wording while preserving meaning. … Deleting it is not a spacing repair." (`authoring-contract.md:212-217`)

The repair order is explicit and ranked: move → reroute/respace → shorten → (omit only wording both endpoints already fully imply and only when it carries no protocol, action, direction, or boundary meaning, `authoring-contract.md:214-216`; same rule at `authoring-defaults.md:11`).

*Maps to:* our beat prose contract (SKILL.md §8). We state the budget (12–30 words, over 45 is two beats) but no ranked repair order, and nothing that says which clause survives shortening. The borrowable directive: when a beat is too long, split the beat, then split the step, then shorten — never drop the landing clause or the consequence clause to fit.

### 2.2 Prose must not assert what no topology shows

> "Cards answer additional reader questions; they do not replace required topology." … "a card alone cannot qualify an otherwise unconditional arrow." (`authoring-defaults.md:9`)

Cards are archify's second-class explanation surface (fixed shape: `dot`, `title`, `items[]` — `schemas/common.schema.json:164-179`; example at `examples/web-app.architecture.json:36-40`). The contract is one-directional: supporting prose may elaborate, never substitute.

*Maps to:* our coverage rule (concept/context steps never claim coverage) and, more sharply, to beats: "say they are existing context" is not enough — a beat must never narrate a claim its highlights do not show. The second sentence is the quotable form: narration that qualifies code no highlight points at is a card qualifying an unconditional arrow.

### 2.3 Vocabulary discipline for inferred consequences

> "Call it authored reachability — not impact, blast radius, breakage, or runtime causality." (`viewer-runtime.md:31`)

Repeated in DESIGN.md: reachability receipts say "nodes, links, and maximum hops; it never says blast radius or breakage" (`DESIGN.md:218`), and the Delta footer stamps every page "Authored IR only · no risk or mergeability inference" (`delta/architecture-delta.mjs:795`). README:254: the delta Review "infers no impact, risk, or merge safety."

*Maps to:* our truth audit and hotspot rules. We ban invented claims but never name the specific forbidden vocabulary. The borrowable directive: beats and `why` fields name only what the lit lines show; impact/risk/performance language requires a measurement recorded in `verification`, else it is a hotspot-style doubt, not a claim.

### 2.4 Name uncertainty in place, in a fixed form

> "Write unresolved questions beside the claim they affect: for example, '`writeFile` is called here; durability is unknown.' Resolve a question by reading the next relevant source range or preserve it as an explicit unknown. Never turn a label, package description, or config value into an unobserved service or behavior." (`repository-authoring.md:55-59`)

*Maps to:* our hotspots (capped at 3, code-step-anchored) and `verification` not-run entries. Archify's form is finer-grained — an inline `<observed fact>; <what remains unknown>` marking at the exact claim — where ours forces a binary choice between asserting and staying silent inside beats. The borrowable directive is the sentence shape itself.

### 2.5 Detail follows reader intent; it never moves the camera

Reading Depth is "a viewer-only level-of-detail layer. MAP preserves the authored structure and primary labels, READ restores relationship labels and node context, and FULL restores tags and fine annotations. Semantic intent can reveal the relevant detail without moving any geometry." (`assets/template.html:4100-4103`; contract at `viewer-runtime.md:8`).

*Maps to:* our `weight: skim` / must-read-only walkthrough. The borrowable principle is the last clause: expanding or collapsing detail must never change the viewport. Our checker already requires `highlights` inside `viewport`; the skill could state the invariant in archify's direction — camera moves are authorial and deliberate; detail-state changes are not camera moves.

### 2.6 The Delta Review playback: one current item at full prominence

The Delta page's review strip — Overview / ← / Review (play) / → plus an `aria-live` status line (`delta/architecture-delta.mjs:792`) — steps through authored changes with a 1400 ms dwell (`REVIEW_DWELL_MS`, `delta/architecture-delta.mjs:798`). During review, unchanged content drops to 0.14 opacity, non-current changes to 0.28, and exactly one change (`data-delta-review-current`) renders at full opacity (`delta/architecture-delta.mjs:783`). A clickable "Exact authored changes" disclosure lists every change and stays auto-open when there are ≤ 10 (`delta/architecture-delta.mjs:793`). Before / Delta / After are tabs over the same canvas, not three pages.

*Maps to:* our Aloud beat playback and old-side deletion display. The borrowable patterns: (a) during narration, dim non-current beats' highlights so one beat owns the glow; (b) pair any auto-play with a one-line status announcement per stop; (c) Before/After as a tab switch over one view, which is the shape our `oldHighlights` presentation wants.

### 2.7 Still frame carries full meaning; motion is finite and reader-controlled

> "Motion has one bounded owner, finishes, and never carries meaning that disappears in a still frame." (`DESIGN.md:90`)

Enforced end to end: `meta.animation` is `"trace"` or `"none"` (`common.schema.json:21-23`); "Still, reduced motion, page hiding, print, and canonical export preserve complete static meaning" (`viewer-runtime.md:19`); state transitions are 140–200 ms (`DESIGN.md:98`); motion never enters canonical exports (`viewer-runtime.md:23`).

*Maps to:* our concept pages (interactive by design: drag, step, toggle — `primers.md:18-22`) and our `why`-as-fallback rule. We require narration text to make sense standalone, but we never state the visual half: a concept page screenshotted mid-interaction, or viewed with reduced motion, must still teach the model. The borrowable directive is the DESIGN.md sentence plus a reduced-motion equivalence expectation for pages.

### 2.8 Recipe shape: question, use-when, avoid-when

Every scenario recipe carries `question`, `summary`, `useWhen`, `avoidWhen`, `include`, and a ready prompt (`recipes/scenarios.mjs:11-15`) — e.g. system-overview's question "What exists, who owns it, and how is it connected?" with `avoidWhen: 'The audience needs exact call order, state transitions, or row-level data lineage.'`

*Maps to:* our `change-types.md` playbooks, which say how to open, order, and evidence each type but never say when *not* to use them. The borrowable change is structural, not textual: add a one-line `question` and `avoidWhen` to each change-type and surface entry.

### 2.9 Evidence attached per claim, verified against committed bytes

Repository-backed diagrams pin a credential-free origin URL plus a full 40-character revision in `meta.repository`, attach `path`/`line`/`end_line` sources to each node, and verify "blobs at that commit, independently of working-tree edits" (`authoring-contract.md:341-352`). The authoring rule: "Do not present uncommitted bytes as evidence for `HEAD`" (`repository-authoring.md:19-23`), and "Each reference proves only the fact visible at that location" (`authoring-defaults.md:29`).

*Maps to:* our `intent.sources`, `base`/`head`, and landing verification. The borrowable bits: (a) the "committed bytes, not worktree" rule stated as a rule rather than left implicit in our base/head handling; (b) the per-claim scope sentence, which is a tighter formulation of our "every claim maps to lit lines" audit.

---

## 3. What NOT to borrow, and why

### 3.1 Reader-driven exploration as the explanation model

Archify's core bet is that the reader finds their own path (focus, routes, lens, radar, finder, deep links). That is the right bet for a system map — and the wrong one for a diff review. Our evidence base says the listener needs the goal and the worked path handed to them (Sweller 1988 on means-ends load; Ausubel organizers; Google's reviewer-order prescription — all in `explaining-changes.md`). Importing "let the reviewer explore" as a substitute for beats, landing, or reading path would reintroduce exactly the failure our corpus audit measured (F2–F5). Exploration widgets are an app-roadmap question, never a skill change.

### 3.2 Geometry-heavy authoring contracts

Port-spread gutters, route-rhythm minima (8px/16px segments), detour ratios (2.5× + 200px + 96px excursion), via-coordinate alignment tables (`authoring-contract.md:137-228`). Our camera is line ranges over code the renderer owns; asking the storyteller to do pixel math does not transfer. Only the meta-principle transfers — repair from measured evidence, never by guessing coordinates — and our checker already embodies it.

### 3.3 Provenance and delivery machinery

Directory locks, recovery journals, no-clobber publishers, SHA-256 handoff receipts (`delivery-contract.md:38-197`). This is deployment infrastructure for untrusted filesystems. Our integrity story is git plus the bundled checker; none of this improves an explanation step.

### 3.4 Motion, presets, brand marks, i18n catalogs

Trace animation, four visual presets, digest-pinned brand badges, per-locale UI catalogs. Product surface, not explanation craft. Note archify itself treats motion as decorative journey replay over already-authored topology — our concept pages use interactivity to *teach* (sliders, state machines), which is the stronger use and should not be diluted into ambient animation.

### 3.5 The "go directly to the candidate" fast-path stance

Archify forbids "preliminary help, doctor, starter validation, temporary diagrams" (`archify/SKILL.md:30`) to save turns. Our loop deliberately front-loads reconstruction (ledger, app path, reviewer map) because ungrounded narration is our measured failure mode (corpus audit F2/F4/F5). Do not shorten our steps 2–4 to match their step count.

### 3.6 Machine-derived change lists as narrative

The Delta change rows are generated by diffing two IR snapshots — kind, id, classifications, changed fields (`delta/architecture-delta.mjs:763`). They carry no why, no consequence, no branch-not-taken. They are a coverage surface, like our ledger, and must never be mistaken for beats. If we ever auto-generate story scaffolding, this is the ceiling for what the machine may claim: inventory, not story.

---

## 4. Proposed small changes to the storyteller skill

Five concrete edits, each one paragraph or a few lines, ordered by value. File paths are in this repo.

**P1 — Ranked beat-repair order (SKILL.md §8, "Beat prose").** Add after rule 2 ("One beat, one decision"): *"Repair order for an over-long beat: split the beat; then split the step; then shorten the wording. Never drop the landing clause or the consequence clause to fit — deleting meaning is not a shortening repair."* (From 2.1; kills the observed failure where long sessions compress beats into captions.)

**P2 — Banned-inference vocabulary + unknown-marking form (SKILL.md §8 or Truth audit).** Add: *"Name only what the lit lines show. Impact, risk, performance, and security language requires a measurement in `verification`; without one, mark it inline as unknown — `<observed fact>; <what remains unknown>` — or as a hotspot, never as a claim."* (From 2.3 + 2.4; gives beats the sentence shape archify uses for `writeFile`-style half-knowledge.)

**P3 — Bounded checker loop ("Check, then hand back").** Replace open-ended "re-run until READY" with: *"If a failure survives two focused repairs, re-read the violated contract section before the third attempt; after one evidence-based retry past that, report the concrete gap instead of iterating."* Keep "report the blocker instead of pretending it is ready." (From section 1, property 1; matches archify's `delivery-contract.md:9`.)

**P4 — `question` + `avoidWhen` per playbook (references/change-types.md).** Add one line each to every change-type and surface entry, e.g. security: *question: "What could an attacker reach, and what stops them now?" / avoidWhen: "The diff only refactors security-adjacent code without changing a trust boundary — use refactor."* (From 2.8; prevents playbook misapplication, the same job archify's recipes do.)

**P5 — Still-frame rule for concept pages (references/primers.md + Page test in audits.md).** Add: *"A concept page must teach its model in a still frame: no fact may live only in motion, hover, or a transient state, and the page must read equivalently with reduced motion."* (From 2.7; closes the gap between our narration-fallback rule and the visual half we never state.)

Deliberately not proposed: dimming non-current highlights during Aloud (2.6a — app behavior, belongs in an app plan, not the skill); per-beat dwell times (our beats are speech-paced, archify's 1400 ms dwell is for silent stepping); `meta.output`-style path pinning (our `.diffstory/` location contract already covers it).
