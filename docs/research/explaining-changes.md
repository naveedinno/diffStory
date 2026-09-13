# Explaining a code change, project, or spec to another engineer — what the primary sources prescribe

Researched 2026-09-13 against primary sources only (the guideline, template, paper, or standard itself). Scope: written explanation (CL/commit/patch descriptions, RFC/PEP/design-doc/ADR structures, technical-writing guidance, cognitive-science results) and spoken explanation (audio-description standards, lecture signposting, voice/TTS style guides). Everything quoted below was read from the source named, with these exceptions: Ausubel (1960) — the APA publisher page is script-gated, so the abstract wording was confirmed only through index mirrors (Semantic Scholar, Lehigh thesis quoting it); Pinker's "The Source of Bad Writing" was read from the Center for Plain Language's licensed reprint of the WSJ essay, not WSJ itself; Sweller 1998 (Educational Psychology Review) was behind a Springer login, so cognitive-load claims rest on the 1988 Cognitive Science paper; Google's Assistant conversation-design "Write dialogs" page and Amazon's Alexa design guide have been taken down — only the surviving Google "Style guide" sub-page is cited; the BBC audio-description guide was not located at a stable URL and is omitted. Barbara Minto's site gives only a summary of the Pyramid Principle; the full SCQ introduction method is in her textbook, not quoted here.

---

## Part 1 — Code-change descriptions and review order

### Google Engineering Practices: "Writing good CL descriptions"
URL: https://google.github.io/eng-practices/review/developer/cl-descriptions.html

Purpose stated up front — a CL description must communicate two things:

> 1. **What** change is being made? This should summarize the major changes such that readers have a sense of what is being changed without needing to read the entire CL.
> 2. **Why** are these changes being made? What contexts did you have as an author when making this change? Were there decisions you made that aren't reflected in the source code? etc.

Why it matters (the stated reason): "Reading source code may reveal what the software is doing but it may not reveal why it exists, which can make it harder for future developers to know whether they can move Chesterton's fence."

**First line**:
> - Short summary of what is being done.
> - Complete sentence, written as though it was an order.
> - Follow by empty line.

> "the first line should stand alone, allowing readers to skim through code history much faster." ... "say '**Delete** the FizzBuzz RPC and **replace** it with the new system.' instead of '**Deleting** the FizzBuzz RPC and **replacing** it with the new system.'"

**Body**:
> "the rest of the description should fill in the details and include any supplemental information a reader needs to understand the changelist holistically. It might include a brief description of the problem that's being solved, and why this is the best approach. If there are any shortcomings to the approach, they should be mentioned. If relevant, include background information such as bug numbers, benchmark results, and links to design documents."

> "Where possible include enough context for reviewers and future readers to understand the CL. ... Even small CLs deserve a little attention to detail. Put the CL in context."

The good-example commentary spells out the order: "The first few words describe what the CL actually does. The rest of the description talks about the problem being solved, why this is a good solution, and a bit more information about the specific implementation." For the refactoring example: "The first line describes what the CL does and how this is a change from the past. The rest of the description talks about the specific implementation, the context of the CL, that the solution isn't ideal, and possible future direction."

Bad descriptions listed: "Fix bug", "Fix build.", "Add patch.", "Moving code from A to B.", "Phase 1." — "they do not provide enough useful information."

### Google Engineering Practices: "Small CLs"
URL: https://google.github.io/eng-practices/review/developer/small-cls.html

> "the right size for a CL is **one self-contained change**." ... "The CL makes a minimal change that addresses **just one thing**. This is usually just one part of a feature, rather than a whole feature at once."

Stated reasons: reviewed faster and more thoroughly, fewer bugs ("Making fewer changes simultaneously makes reasoning about impact ... simpler"), less wasted effort, easier rollback. "100 lines is usually a reasonable size for a CL, and 1000 lines is usually too large."

### Google Engineering Practices: "Navigating a CL in review" (reviewer reading order)
URL: https://google.github.io/eng-practices/review/reviewer/navigate.html

The prescribed order:
> 1. Does the change make sense? Does it have a good description?
> 2. Look at the most important part of the change first. Is it well-designed overall?
> 3. Look at the rest of the CL in an appropriate sequence.

Step two, verbatim: "Find the file or files that are the 'main' part of this CL. Often, there is one file that has the largest number of logical changes, and it's the major piece of the CL. Look at these major parts first. This helps give context to all of the smaller parts of the CL, and generally accelerates doing the code review. If the CL is too large for you to figure out which parts are the major parts, ask the developer what you should look at first".

Step three: "Sometimes it's also helpful to read the tests first before you read the main code, because then you have an idea of what the change is supposed to be doing."

Why design first: "if the design problems are significant enough, a lot of the other code under review is going to disappear and not matter anyway."

Companion page "What to look for" (https://google.github.io/eng-practices/review/reviewer/looking-for.html): "The most important thing to cover in a review is the overall design of the CL." Complexity is defined as "can't be understood quickly by code readers."

### Linux kernel: Documentation/process/submitting-patches — "Describe your changes" / "Separate your changes"
URL: https://www.kernel.org/doc/html/latest/process/submitting-patches.html

Order prescribed: problem → impact → (numbers and trade-offs) → what you did.

> "Describe your problem. Whether your patch is a one-line bug fix or 5000 lines of a new feature, there must be an underlying problem that motivated you to do this work. Convince the reviewer that there is a problem worth fixing and that it makes sense for them to read past the first paragraph."

> "Describe user-visible impact. Straight up crashes and lockups are pretty convincing, but not all bugs are that blatant. Even if the problem was spotted during code review, describe the impact you think it can have on users."

> "Quantify optimizations and trade-offs. If you claim improvements ... include numbers that back them up. But also describe non-obvious costs."

> "Once the problem is established, describe what you are actually doing about it in technical detail. It's important to describe the change in plain English for the reviewer to verify that the code is behaving as you intend it to."

> "Solve only one problem per patch. If your description starts to get long, that's a sign that you probably need to split up your patch."

> "the patch (series) and its description should be self-contained." ... "try to make your explanation understandable without external resources. In addition to giving a URL ... summarize the relevant points of the discussion that led to the patch as submitted."

> "Describe your changes in imperative mood, e.g. 'make xyzzy do frotz' instead of '[This patch] makes xyzzy do frotz' or '[I] changed xyzzy to do frotz', as if you are giving orders to the codebase to change its behaviour."

On referencing commits: "don't just refer to the SHA-1 ID of the commit. Please also include the oneline summary of the commit, to make it easier for reviewers to know what it is about."

Separate your changes: "Separate each **logical change** into a separate patch." ... "each patch should make an easily understood change that can be verified by reviewers. Each patch should be justifiable on its own merits." ... "ensure that the kernel builds and runs properly after each patch in the series."

### Tim Pope, "A Note About Git Commit Messages" (2008)
URL: https://tbaggery.com/2008/04/19/a-note-about-git-commit-messages.html

Template: "Capitalized, short (50 chars or less) summary" / blank line / "More detailed explanatory text, if necessary. Wrap it to about 72 characters or so." Imperative: "Fix bug" not "Fixed bug" / "Fixes bug". Reason given: the summary line is what `git log --oneline`, `git shortlog`, `git rebase -i`, merge messages and GitHub display; the blank line is needed because tools such as rebase "can get confused if you run the two together."

### Chris Beams, "How to Write a Git Commit Message" (cites Pope, kernel, git project)
URL: https://cbea.ms/git-commit/

Rule 7 and its reason, verbatim:
> "Use the body to explain what and why vs. how" ... "In most cases, you can leave out details about how a change has been made. Code is generally self-explanatory in this regard (and if the code is so complex that it needs to be explained in prose, that's what source comments are for). Just focus on making clear the reasons why you made the change in the first place—the way things worked before the change (and what was wrong with that), the way they work now, and why you decided to solve it the way you did."

That last sentence is the most compact before/after formula in any of the sources: *before → what was wrong → after → why this way*.

---

## Part 2 — Spec, RFC, design-doc and decision-record structures

### Rust RFC template (0000-template.md)
URL: https://github.com/rust-lang/rfcs/blob/master/0000-template.md

Order: Summary → Motivation → Guide-level explanation → Reference-level explanation → Drawbacks → Rationale and alternatives → Prior art → Unresolved questions → Future possibilities.

> Summary: "One paragraph explanation of the feature."

> Motivation: "Any changes to Rust should focus on solving a problem that users of Rust are having. This section should explain this problem in detail, including necessary background. It should also contain several specific use cases where this feature can help a user, and explain how it helps. ... This section is one of the most important sections of any RFC, and can be lengthy."

> Guide-level explanation: "Explain the proposal as if it was already included in the language and you were teaching it to another Rust programmer. That generally means: Introducing new named concepts. Explaining the feature largely in terms of examples. Explaining how Rust programmers should *think* about the feature ... It should explain the impact as concretely as possible."

> Reference-level explanation: "This is the technical portion of the RFC. Explain the design in sufficient detail that: Its interaction with other features is clear. It is reasonably clear how the feature would be implemented. Corner cases are dissected by example. The section should return to the examples given in the previous section, and explain more fully how the detailed proposal makes those examples work."

> Drawbacks: "Why should we *not* do this?"

> Rationale and alternatives: "Why is this design the best in the space of possible designs? What other designs have been considered and what is the rationale for not choosing them? What is the impact of not doing this?"

Why this order (stated inside the template): motivation "can then be used to guide the design"; the guide-level pass teaches by example before the reference pass "return[s] to the examples" — i.e., intuition first, precision second, reusing the same examples.

### Python PEP 1 — "What belongs in a successful PEP"
URL: https://peps.python.org/pep-0001/#what-belongs-in-a-successful-pep

Order: Preamble → Abstract → Motivation → Rationale → Specification → Backwards Compatibility → Security Implications → How to Teach This → Reference Implementation → Rejected Ideas → Open Issues → Footnotes → Copyright.

> Abstract: "a short (~200 word) description of the technical issue being addressed."

> Motivation: "The motivation is critical for PEPs that want to change the Python language, library, or ecosystem. It should clearly explain why the existing language specification is inadequate to address the problem that the PEP solves."

> Rationale: "The rationale fleshes out the specification by describing why particular design decisions were made. It should describe alternate designs that were considered and related work, e.g. how the feature is supported in other languages."

> How to Teach This: "For a PEP that adds new functionality or changes language behavior, it is helpful to include a section on how to teach users, new and experienced, how to apply the PEP to their work."

> Rejected Ideas: "Throughout the discussion of a PEP, various ideas will be proposed which are not accepted. Those rejected ideas should be recorded along with the reasoning as to why they were rejected."

### IETF RFC 7322, "RFC Style Guide"
URL: https://www.rfc-editor.org/rfc/rfc7322.html

Structure (Section 4): title → Abstract → Status/Copyright → TOC → Introduction → body → Security Considerations → IANA Considerations → References → Appendices → Acknowledgements → Authors' Addresses.

> Abstract: "The Abstract must not contain citations" and should be complete in itself.
> Introduction: "Each RFC must include an Introduction section that explains the motivation for the RFC and describes the applicability of the document."
> Abbreviations (Section 3.6): "Abbreviations should be expanded in document titles and upon first use in the document."
> Terminology: "Capitalization must be consistent within the document and ideally should be consistent with related RFCs."

### Google design docs — Malte Ubl, "Design Docs at Google"
URL: https://www.industrialempathy.com/posts/design-docs-at-google/

Order: Context and scope → Goals and non-goals → The actual design (overview, then details) → Alternatives considered → Cross-cutting concerns.

> "The design doc documents the high level implementation strategy and key design decisions with emphasis on the trade-offs that were considered during those decisions."

> Context and scope: "This section gives the reader a very rough overview of the landscape in which the new system is being built and what is actually being built. This isn't a requirements doc. Keep it succinct! The goal is that readers are brought up to speed but some previous knowledge can be assumed and detailed info can be linked to. This section should be entirely focused on objective background facts."

> Goals and non-goals: "A short list of bullet points of what the goals of the system are, and, sometimes more importantly, what non-goals are. Note, that non-goals aren't negated goals like 'The system shouldn't crash', but rather things that could reasonably be goals, but are explicitly chosen not to be goals."

> The actual design: "This section should start with an overview and then go into details." ... "given the context (facts), goals and non-goals (requirements), the design doc is the place to suggest solutions and show why a particular solution best satisfies those goals."

> Alternatives considered: "The focus should be on the trade-offs that each respective design makes and how those trade-offs led to the decision to select the design that is the primary topic of the document."

Length: "The sweet spot for a larger project seems to be around 10-20ish pages"; 1–3 page mini design docs for incremental work.

### Architecture Decision Records — Michael Nygard, "Documenting Architecture Decisions" (2011)
URL: https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions

Order: Title → Context → Decision → Status → Consequences.

> Title: "These documents have names that are short noun phrases."
> Context: "This section describes the forces at play, including technological, political, social, and project local. ... The language in this section is value-neutral. It is simply describing facts."
> Decision: "This section describes our response to these forces. It is stated in full sentences, with active voice. 'We will …'"
> Consequences: "This section describes the resulting context, after applying the decision. All consequences should be listed here, not just the 'positive' ones."

Granularity and reason: one ADR per "architecturally significant" decision; "Large documents are never kept up to date. Small, modular documents have at least a chance at being updated."

---

## Part 3 — Technical-writing and cognitive-science sources

### Google Technical Writing One
URLs: https://developers.google.com/tech-writing/one/audience · /one/documents · /one/words · /one/paragraphs · /one/short-sentences

Audience: "good documentation = knowledge and skills your audience needs to do a task − your audience's current knowledge and skills." The course names the curse of knowledge directly: "As experts, it is easy to forget that novices don't know what you already know."

Documents (state scope, audience, assumptions up front): "A good document begins by defining its scope. For example: This document describes the design of Project Frambus." ... "A good document explicitly specifies its audience." ... declare prerequisites, e.g. "This document assumes that you understand matrix multiplication and the fundamentals of backpropagation." ... "Professional writers focus considerable energy on page one to increase the odds of readers making it to page two."

Words: "If the term already exists, link to a good existing explanation. If your document is introducing the term, define the term." ... "Apply the same unambiguous word or term consistently throughout your document. Once you've named a component thingy, don't rename it thingamabob." ... "On the initial use of an unfamiliar acronym within a document or a section, spell out the full term, and then put the acronym in parentheses." Pronouns: "Only use a pronoun after you've introduced the noun; never use the pronoun before you've introduced the noun." ... "if more than five words separate your noun from your pronoun, consider repeating the noun instead." ... "If you introduce a second noun between your noun and your pronoun, reuse your noun instead of using a pronoun."

Paragraphs: "The opening sentence is the most important sentence of any paragraph. Busy readers focus on opening sentences and sometimes skip over subsequent sentences." ... "A paragraph should represent an independent unit of logic. Restrict each paragraph to the current topic." ... paragraphs should answer "**What** are you trying to tell your reader? **Why** is it important for the reader to know this? **How** should the reader use this knowledge?"

Sentences: "Focus each sentence on a single idea, thought, or concept. Just as statements in a program execute a single task, sentences should execute a single idea." ... "Short sentences communicate more powerfully than long sentences, and short sentences are usually easier to understand than long sentences." ... "Inside many long technical sentences is a list yearning to break free."

### Diátaxis — "Explanation"
URL: https://diataxis.fr/explanation/

> "Explanation is a discursive treatment of a subject, that permits *reflection*. Explanation is **understanding-oriented**."

Bears on change explanation because a rationale is explanation, not how-to: "Make connections" to other ideas; "Provide background and context in your explanation" — design decisions, historical reasons, technical constraints; "Talk *about* the subject" — the bigger picture, choices, alternatives, reasons; "Admit opinion and perspective". Diátaxis separates this from how-to guides (the "user's eye-level view" of a task) and reference ("a close-up view of the machinery").

### Barbara Minto — The Pyramid Principle
URL: https://www.barbaraminto.com/

> "Your thinking will be easy for a reader to grasp if you present the ideas organized as a pyramid under a single point."

Structure: the answer/main point first; supporting ideas grouped beneath; each level summarises the level below; the introduction follows Situation → Complication → Question → Answer so the reader knows what question the document answers before it answers it. (Full method is in *The Minto Pyramid Principle*, 1996 ed.; not quoted here.)

### Bottom Line Up Front — US Army AR 25-50, *Preparing and Managing Correspondence*
URL: https://armypubs.army.mil/epubs/DR_pubs/DR_a/ARN42124-AR_25-50-007-WEB-13.pdf (para 1-38, 1-39)

> 1-38 a. "Effective Army writing is understood by the reader in a single rapid reading and is clear, concise, and well-organized".
> 1-38 b. "Two essential requirements include putting the main point at the beginning of the correspondence (bottom line up front) and using the active voice".
> 1-39 b. "(1) Use short words. (2) Keep sentences short. The average length of a sentence should be about 15 words. (3) Write paragraphs that, with few exceptions, are no more than 10 lines. (4) Avoid jargon. ... (8) Avoid sentences that begin with 'It is,' 'There is,' or 'There are.'"

### Ausubel (1960), "The use of advance organizers in the learning and retention of meaningful verbal material", *J. Educational Psychology* 51(5), 267–272
DOI: https://doi.org/10.1037/h0046669 (publisher page script-gated; abstract wording confirmed via index mirrors)

Abstract hypothesis: "the learning and retention of unfamiliar but meaningful verbal material can be facilitated by the advance introduction of relevant subsuming concepts (organizers). This hypothesis is based on the assumption that cognitive structure is hierarchically organized in terms of highly inclusive concepts under which are subsumed less inclusive subconcepts and informational data." Organizers are introductory material presented *before* the new material and written "on a higher level of abstraction, inclusiveness, and generality than the new material" (as quoted in Groller 1989, Lehigh thesis, https://preserve.lehigh.edu/system/files/derivatives/coverpage/425362.pdf). The 1960 experiment found better retention for the organizer group.

### Sweller (1988), "Cognitive load during problem solving: Effects on learning", *Cognitive Science* 12, 257–285
URL: https://onlinelibrary.wiley.com/doi/10.1207/s15516709cog1202_4 (read from the open PDF)

Abstract, verbatim: "Considerable evidence indicates that domain specific knowledge in the form of schemas is the primary factor distinguishing experts from novices in problem-solving skill. Evidence that conventional problem-solving activity is not effective in schema acquisition is also accumulating. It is suggested that a major reason for the ineffectiveness of problem solving as a learning device, is that the cognitive processes required by the two activities overlap insufficiently, and that conventional problem solving in the form of means-ends analysis requires a relatively large amount of cognitive processing capacity which is consequently unavailable for schema acquisition."

Relevance: a listener forced to *infer* the purpose of a diff hunk is doing means-ends search; telling them the goal and showing the worked path frees capacity for understanding. The paper cites Sweller & Cooper (1985) for the worked-example result in algebra.

### Camerer, Loewenstein & Weber (1989), "The Curse of Knowledge in Economic Settings", *J. Political Economy* 97(5), 1232–1254
URL: https://www.journals.uchicago.edu/doi/10.1086/261651 (read from https://www.cmu.edu/dietrich/sds/docs/loewenstein/CurseknowledgeEconSet.pdf)

> "In economic analyses of asymmetric information, better-informed agents are assumed capable of reproducing the judgments of less-informed agents. We discuss a systematic violation of this assumption that we call the 'curse of knowledge.' Better-informed agents are unable to ignore private information even when it is in their interest to do so; more information is not always better."

> "In predicting the judgments of others, agents are unable to ignore the additional information they possess."

### Steven Pinker, "The Source of Bad Writing" (WSJ, 2014; reprinted) / *The Sense of Style* (2014)
URL: https://centerforplainlanguage.org/the-source-of-bad-writing/

> "Call it the Curse of Knowledge: a difficulty in imagining what it is like for someone else not to know something that you know."
> "The curse of knowledge is the single best explanation of why good people write bad prose."
> Remedy: "close the loop, as the engineers say, and get a feedback signal from the world of readers—that is, show a draft to some people who are similar to your intended audience and find out whether they can follow it."

---

## Part 4 — Spoken explanation over a visual

### American Council of the Blind, Audio Description Project — *Audio Description Standards* (2009)
URL: https://adp.acb.org/docs/ADP_Standards.pdf

> "The oft-referenced 'first rule of description' is to 'Describe what you see' or W.Y.S.I.W.Y.S. – 'WHAT YOU SEE IS WHAT YOU SAY'"
> "Describe what is most essential for the viewer to know in order to understand and appreciate the image being described."
> "directional 'pointers' can help AD users organize the information they hear, i.e., going from top to bottom, right to left, clockwise, etc."
> "Deliver description in present tense, in active voice (e.g., 'Ted breaks the window,' is preferable to, 'The window was broken by Ted.') Use third-person narrative style to show neutrality and noninterference."
> "Be clear, concise, conversational: Use 'everyday' terms. Describe a technical term, then name it, e.g., 'she bends at the knees, a plié'".
> "Pronouns — Use pronouns only when it is clear to whom or what the pronoun refers."
> "Definite/Indefinite Articles — Use 'a' instead of 'the' ... If the sword has already been introduced, it becomes 'the' sword."
> "Identification — ... Consistently identify people/characters by name. Use a character's name only when sighted audience members know the name. ... tie the name to the physical description at the first opportunity ('John, the redheaded man') and afterwards use only the character's name."
> "Consistency — Utilizing the same character names and/or vocabulary throughout a production ... is essential."
> "Objectivity — The best audio describers objectively recount the visual aspects of an image. Subjective or qualitative judgments or comment get in the way". "So we do not say 'He is furious' ... Rather, 'He's clenching his fist'".
> "Less Is More. Description cannot and need not convey every visual image on display. Quality audio description is not a running commentary." (quoting the ITC: "The describer must learn to weed out what is not essential.")
> "Stepping On Lines — Descriptions are usually delivered during pauses ... it is appropriate to let pauses or quiet moments pass without a description."
> "'We See' — Avoid telling your guests that 'we see' or notice or view—it's a given."
> "Example: Mention who answers the phone—not that the phone is ringing. It's not necessary to describe obvious sound cues."

### DCMP Description Key (Described and Captioned Media Program)
URLs: https://dcmp.org/learn/618-description-key---what-to-describe · https://dcmp.org/learn/617-description-key---how-to-describe

What to describe: "Describe what is most essential for the viewer to know in order to follow, understand, and appreciate the intended learning outcomes" ... "what is the most significant and least obvious from the dialogue." ... "Start generally, creating a context, then move to details to enhance understanding and appreciation."

How to describe: present tense, active voice; third-person "neutrality and noninterference"; "Give descriptions in complete sentences if possible"; "Use pronouns only when it is clear to whom or what the pronoun refers"; "Describe objectively without personal interpretation, censorship, or comment"; "Conform the rate of the description to the pace" of the program; "Let pauses or quiet moments pass without a description when appropriate"; voice descriptions "as close to the action as possible".

### Netflix Audio Description Style Guide v2.5
URL: https://partnerhelp.netflixstudios.com/hc/en-us/articles/215510667-Audio-Description-Style-Guide-v2-5

> "Description should be informative and conversational, in present tense and third-person omniscient."
> "Avoid over-describing — do not include visual images that are not vital to the understanding or enjoyment of the scene."
> "Description should be as specific as possible and avoid general terms".
> "Ideally, characters should remain unnamed until introduced through dialogue or plot-point."
> "Description over dialogue should be utilized only as a last resort".

### WCAG 2.2 — Understanding SC 1.2.5 Audio Description (Prerecorded); SC 3.1.4 / Technique G97
URLs: https://www.w3.org/WAI/WCAG22/Understanding/audio-description-prerecorded.html · https://www.w3.org/WAI/WCAG22/Techniques/general/G97

1.2.5: audio description "provides information about actions, characters, scene changes, on-screen text, and other visual content"; "In standard audio description, narration is added during existing pauses in dialogue."

G97: "it is advisable to provide the full form before providing the abbreviated form" — "make the expanded form of an abbreviation available by associating the expanded form with its abbreviation the first time it occurs".

### W3C Pronunciation User Scenarios (APA WG)
URL: https://www.w3.org/TR/pronunciation-user-scenarios/

Documents failure modes of text-to-speech: abbreviations read as words ("YOW" / "Ottawa, CA" mispronounced), formulas such as `a3-b3=(a-b)(a2+ab+b2)` rendered wrongly without markup, homographs ("lead", "wind"), Greek letters indistinct. The practical consequence for narration: do not rely on the engine to read symbols, identifiers or abbreviations correctly — say them in words.

### Lecture signposting — Utrecht University, Educational Development & Training
URL: https://www.uu.nl/en/education/educational-development-training/knowledge-dossiers/knowledge-dossier-teaching-in-higher-education/teach-in-english-tips-on-using-signposts-and-stimulating-interaction-in-class

> "Signposts are words (*first, finally*), phrases (*in contrast to this, in a similar way*) or whole sentences (*let me summarise the main points, let me rephrase that*) that speakers use to make the structure of what they are saying explicit."
> "Listeners understand a presentation better if signposts are used, even if they do not consciously notice them."
Examples: "I will now move on to X. There are three parts to X, (i), (ii) and (iii)." / "I think that covers everything regarding…" / "Let me summarise the main points".

### Google Assistant conversation design — Style guide ("Language")
URL: https://developers.google.com/assistant/conversation-design/language

Surviving spoken-prompt rules: "Use short, simple words"; "Use contractions"; "Avoid jargon and legalese"; "Don't launch into monologues"; "Lead with benefits" (i.e., the payoff before the request). The companion "Write dialogs" page, which carried "write for the ear", is no longer online.

---

## Convergences — principles that recur across sources

1. **Problem and why before what and how.** Kernel ("Describe your problem ... Once the problem is established, describe what you are actually doing"); Google CL ("What ... Why"); Rust (Motivation precedes both explanations); PEP (Motivation → Rationale → Specification); Ubl (Context → Goals → Design); Nygard (Context → Decision); Beams ("what and why vs. how").
2. **Main point first, standing alone.** Google first line "should stand alone"; AR 25-50 "bottom line up front"; Minto "a pyramid under a single point"; RFC 7322 abstract "complete in itself"; Google Tech Writing "opening sentence is the most important"; Pope's 50-char summary.
3. **State context, scope, audience and assumed knowledge up front.** Google Tech Writing ("This document assumes that you understand…"); Ubl ("readers are brought up to speed but some previous knowledge can be assumed"); Ausubel (organizer "at a higher level of abstraction" before the material); DCMP ("Start generally, creating a context, then move to details"); kernel ("self-contained", "understandable without external resources").
4. **Before → what was wrong → after → why this way.** Beams' formula; Google's refactoring example ("what the CL does and how this is a change from the past"); Nygard's Consequences ("the resulting context, after applying the decision"); kernel ("describe user-visible impact").
5. **One unit = one idea/decision/change.** Google Small CLs ("just one thing"); kernel ("one problem per patch"); Nygard (one decision per ADR); Google Tech Writing (one topic per paragraph, one idea per sentence); AR 25-50 (short sentences, ~15 words).
6. **Teach by example before specifying precisely; reuse the same examples.** Rust (Guide-level then Reference-level, which "should return to the examples given in the previous section"); PEP "How to Teach This"; Sweller (worked examples cut means-ends load).
7. **Define a term on first use; then use it consistently.** RFC 7322 ("expanded ... upon first use"); Google Tech Writing ("don't rename it thingamabob"); WCAG G97; ADP ("Describe a technical term, then name it", "Consistency ... is essential"); Nygard ("short noun phrases").
8. **Name the referent; no pronoun without an introduced noun nearby.** Google Tech Writing (five-word rule, intervening-noun rule); ADP/DCMP ("Use pronouns only when it is clear to whom or what the pronoun refers"; "a" on first mention, "the" afterwards; name tied to description at first opportunity).
9. **Record alternatives and drawbacks, not just the winner.** Rust (Drawbacks; Rationale and alternatives); PEP (Rejected Ideas); Ubl (Alternatives considered, "focus ... on the trade-offs"); Nygard ("All consequences ... not just the 'positive' ones"); Google CL ("If there are any shortcomings ... they should be mentioned"); kernel ("describe non-obvious costs").
10. **Assume the reader lacks your context (curse of knowledge) and close the loop.** Camerer et al.; Pinker; Google Tech Writing ("easy to forget that novices don't know"); Pinker's remedy of testing on a real reader.
11. **Describe what is there, objectively and in present tense; interpret sparingly.** ADP (WYSIWYS, "clenching his fist" not "furious"); DCMP; Netflix; Nygard's Context "value-neutral ... simply describing facts"; Ubl's Context "entirely focused on objective background facts".
12. **Prioritise the essential; leave silence rather than narrate everything.** ADP ("Less Is More", "weed out what is not essential"); Netflix ("Avoid over-describing"); Google reviewer order (main part first, tests first to learn intent); Google Small CLs.
13. **Make the structure audible: signpost, sequence, summarise.** Utrecht ("make the structure ... explicit"; listeners benefit "even if they do not consciously notice"); ADP directional pointers ("top to bottom, right to left"); Google reviewer steps 1-2-3.

---

## Implications for a spoken, step-by-step code-change walkthrough

Each bullet is something a skill author can apply directly; the tag names the source that licenses it.

1. **Open with an advance organizer, not a file.** Before the first hunk, say in one or two sentences what problem existed, what the change does about it, and how many stops the tour has. [Ausubel 1960; AR 25-50 BLUF; Minto; Google CL "first line should stand alone"]
2. **State the listener's assumed knowledge and the scope explicitly.** "This assumes you know how the review engine renders a split diff; it does not cover the agent changes." [Google Tech Writing "State your audience"/"scope"; Ubl "Context and scope"; Ubl "non-goals"]
3. **Lead each step with why, then what, then where.** Problem → change → location on screen. Never open a step with "on line 42". [Kernel "Describe your problem ... Once the problem is established"; Google CL What/Why; Beams rule 7]
4. **Use the before/wrong/after/why-this-way formula for every behavioural change.** "Before, X happened; that was wrong because Y; now Z; we did it this way rather than W because…" [Beams; Google refactoring example; Nygard Consequences]
5. **One step, one idea.** If a step needs "and also", split it. Keep spoken sentences near 15 words and paragraphs (beats) to a handful of sentences. [Google Small CLs; kernel "one problem per patch"; Google Tech Writing one idea per sentence/paragraph; AR 25-50 1-39]
6. **Order steps the way a reviewer reads: the main file first, then dependents; consider the test first when it states intent.** [Google "Navigating a CL" steps 2–3]
7. **Name the referent every time; no naked "it/this/that" across a beat boundary.** Say the function, file or concept name; re-say the noun if more than about five words or another noun intervened. Use "a new helper" on first mention, "the helper" after. [Google Tech Writing pronouns; ADP/DCMP pronouns and articles]
8. **Define a term the first time it is spoken, then never rename it.** "the gap expander — the pill that reveals hidden lines — …" then always "the gap expander". [RFC 7322 3.6; Google Tech Writing "Define new terms"/"Use terms consistently"; ADP "Describe a technical term, then name it"; WCAG G97]
9. **Describe what is on screen in present tense, objectively, before interpreting.** "The diff removes the `position: sticky` rule" precedes "which is what stopped the header clipping." Avoid "we see"/"notice". [ADP WYSIWYS, present tense, objectivity, "We See"; DCMP; Netflix]
10. **Give directional pointers that match the viewport.** "Top of the file", "the second hunk, right-hand column", "scrolling down to the export". Listeners organise what they hear spatially. [ADP "directional pointers"; WCAG 1.2.5 "on-screen text"]
11. **Spell out symbols, identifiers and abbreviations in words; do not trust TTS.** "the `reviewEngine` object, camel-case" / "the arrow function" / "P R, pull request". Avoid parentheticals and nested clauses that only work visually. [W3C Pronunciation User Scenarios; RFC 7322 abbreviation rule; Google Tech Writing "Convert long sentences to lists"]
12. **Signpost transitions and count remaining stops.** "That was the second of four changes. Next, the test." "To summarise so far…" Listeners follow structure better even when they don't notice the signposts. [Utrecht signposting; Google Tech Writing opening sentences]
13. **Teach by worked example, then state the rule.** For a non-obvious pattern, walk one concrete instance through before generalising ("every column now owns its own scroll container"). Reuse the same example when you later state the general rule. [Rust guide-level → reference-level "return to the examples"; Sweller 1988; PEP "How to Teach This"]
14. **Name what was considered and rejected, and the known shortcomings, at the step where they bite.** "An alternative was a single shared scroller; rejected because…" "This still clips at widths under 600px." [Rust Drawbacks/Rationale; PEP Rejected Ideas; Ubl Alternatives; Nygard Consequences; Google CL "shortcomings"; kernel "non-obvious costs"]
15. **Leave silence rather than narrate trivia; say only what the listener cannot infer from what is visible or already said.** Skip renames, reformatting and import shuffles unless they carry meaning. [ADP "Less Is More"; Netflix "Avoid over-describing"; DCMP "least obvious"; ADP "Mention who answers the phone—not that the phone is ringing"]
16. **Keep the description self-contained; do not point off-screen for essentials.** Summarise the relevant bug report or design decision inside the narration instead of "see the ticket". [Kernel "self-contained"/"understandable without external resources"; Google CL on links that "may not be visible to future readers"]
17. **Close the loop with a real listener.** Play the narration to someone with the intended reviewer's knowledge and fix the spots where they lose the thread; the author cannot detect their own curse of knowledge. [Pinker; Camerer/Loewenstein/Weber; Google Tech Writing audience formula]
