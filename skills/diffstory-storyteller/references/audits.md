# Self-review audits

Part of the diffstory-storyteller skill. Run every audit before handing a story back.

### Truth audit

- Every claim in `title`, `summary`, and `why` is supported by the diff or by
  source lines you read.
- Do not infer intent from branch names, filenames, or vibes.
- Do not invent runtime behavior, product semantics, test results, or safety claims.
- Do not claim tests pass unless you ran them.
- Do not claim a test covers behavior unless the assertion is visible in the
  viewport or in code you read.
- Uncertain: narrow the claim to what the code shows. `intent` claims only a
  why its `sources` support.

### Narrative audit

Falsifiable checks — run each, do not skim:

- Order test: reorder your steps by filename in your head. If the story reads
  the same, it is not a story yet.
- Why test: strike any code beat that only restates what the code does, and any
  primer that repeats the Overview.
- Failure test: for every substantive code step, name the specific bug its
  evidence rules out, in one concrete sentence. If you cannot, the stop is
  restating the diff.
- Beat prose test: strike any beat that opens with a line number, any beat
  joining separate line numbers with a semicolon or "and also" (split it), and
  any beat that stops at what the code is without what it guarantees.
- Landing test: read ONLY the first beat of every code step, aloud, with no
  code. After each you must be able to say which function or rule you are in,
  who reaches it and when, and only then what changed. A first beat starting on
  the change, or with a bare "Now", "Here", "This adds", or "It", fails.
- Hotspot test: each reason names something you specifically did not verify,
  not generic complexity. Each non-goal has intent evidence behind it.
- Thread test: read concept bodies and code beats in order with no code. They
  must form one continuous story with no unexplained term or jump; every switch
  between independent concerns is announced — an unannounced jump fails this test
  even when both halves are good.
- Concept-gap test: before each code stop, the reviewer already has the
  terminology, roles, relationships, and state model needed to read it.
- Primer placement test: every primer sits immediately before its first
  dependent step, `preparesFor` includes it, no two primers are adjacent, none
  is final, the mode budget holds.

### Context and camera audit

- Memory test: read only `intent`, `summary`, concept bodies, titles, and beats.
  A reviewer who remembers the request but not the app must be able to say
  where the behavior enters, who owns it, what changed, where the result goes,
  and what proves or threatens it.
- Camera test: follow only the files, viewports, and highlight groups. Every
  glow must visibly prove its beat without scrolling or guessing.
- First-stop test: the first code stop is the behavioral entry point, never
  incidental imports, icons, styling, generated output, or tests. A primer may
  open the story only to prepare that entry step.
- Title test: every code-step title names behavior, risk, contract, or
  invariant, never a file operation; every primer title names its model.
