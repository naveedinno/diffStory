# Concept primers

Part of the diffstory-storyteller skill. Read when a code stop needs a mental model the reviewer does not have yet.

### 3.75. Test for concept gaps

Run the Concept-gap test before finalizing the path: before each code stop, can
the reviewer explain the terminology, roles, relationships, or state model the
next lines need? Add a concept primer only when the answer is no and one
visible code span cannot teach the model cleanly.

- Overview is the whole-change reading map: goal, designed flow, where the
  review goes. A primer is a just-in-time mental model for one specific code
  stop; it never repeats the Overview or summarizes the diff. A context step
  shows exact unchanged code when that code is the clearest contract.
- Place each primer immediately before the first code step that depends on it;
  `preparesFor` includes that step. Never place two concept primers next to each other. Never end the story with a concept primer.
- `body` is 60-180 words, with a hard maximum of 220 words, tags excluded. If the model does
  not earn 60 useful words, teach it in the code beat instead.
- Teach by worked example, then state the rule: walk one concrete instance from
  this diff before generalizing, and reuse that instance when the rule appears.

### 6.25. Write concept primers with the exact fileless shape

```jsonc
{
  "id": "concept-cap-model",
  "order": 2,
  "title": "How the cap travels",
  "kind": "concept",
  "body": "<60-180 word mental model>",
  "preparesFor": ["s2"],
  "diagram": { "type": "mermaid", "source": "flowchart LR\n  A --> B", "caption": "The request crosses the owner before the boundary check." },
  "tags": ["mental-model"]
}
```

`diagram` and `tags` are optional; everything else is required. A concept step
must not contain `file`, `range`, `ranges`, `viewport`, `highlights`, `beats`, `why`, `calls`, or `returnsTo`,
nor legacy `focus`. `preparesFor` points at later code-step ids and includes
the immediately following one. Concept primers never claim diff coverage.
