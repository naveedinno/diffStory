# Code comprehension, change ordering, and the narrated diff walkthrough

Research note, 2026-09-13. Question: what does empirical work say about (a) how developers comprehend unfamiliar code and code changes, and (b) how the order, grouping and presentation of a change's parts affect review effectiveness, and what does that imply for an automatically generated, narrated, step-by-step walkthrough of a diff (diffStory)?

## Scope and source quality

Seventeen sources were checked. Fourteen were read from primary full text (author copies or publisher PDFs converted locally): Pennington 1987, von Mayrhauser & Vans 1995, Bacchelli & Bird 2013, Baum/Schneider/Bacchelli ICSME 2017, MacLeod et al. 2018, Sadowski et al. 2018, Rigby & Bird 2013, Uwano et al. 2006, Busjahn et al. 2015, Herzig & Zeller 2013, Barnett et al. 2015, Tao & Kim 2015, Mayer & Fiorella 2014, and (abstract page only, publisher) Mayer & Pilegard 2014. Three were **abstract- or secondary-only**: Baum/Schneider/Bacchelli EMSE 2019 (Springer and ACM are bot-walled; the ZORA open-access copy has been deleted; no arXiv version exists, so findings below come from the published abstract), Brooks 1983 and Letovsky 1986 (no open copy; described here through von Mayrhauser & Vans's 1995 survey, which is itself a primary source for the comparison). Soloway & Ehrlich 1984 is cited from its verbatim abstract (OpenAlex) plus von Mayrhauser & Vans. Baum, Leßmann & Schneider, "The Choice of Code Review Process" (PROFES 2017, LNCS 10611) could not be retrieved in any form and is listed only for completeness. Effect sizes and percentages below are copied from the papers; where I paraphrase, I say so.

---

## 1. Comprehension theory

### Brooks 1983 — "Towards a theory of the comprehension of computer programs"
*Int. J. Man-Machine Studies* 18(6):543–554. DOI 10.1016/S0020-7373(83)80031-5. **Secondary-only** (via von Mayrhauser & Vans 1995, below).

- Comprehension is top-down and hypothesis-driven: "Brooks sees program comprehension as the reconstruction of the domain knowledge used by the initial developer," and "hypotheses are the only drivers of cognition. Understanding is complete when the mental model contains a complete hierarchy of hypotheses. At the top is the primary hypothesis: a high-level description" (von Mayrhauser & Vans, p. 47).
- Verification is through **beacons**: "Beacons are the main vehicle for this verification, which is also hypothesis driven." A swap inside a loop is a beacon for "sort".
- Limits: a theory paper, not an experiment; assumes the reader already has domain knowledge to form the primary hypothesis.

### Soloway & Ehrlich 1984 — "Empirical Studies of Programming Knowledge"
*IEEE TSE* SE-10(5):595–609. DOI 10.1109/TSE.1984.5010283. Abstract verbatim; body via von Mayrhauser & Vans.

- Abstract: "expert programmers have and use two types of programming knowledge: 1) programming plans, which are generic program fragments that represent stereotypic action sequences in programming, and 2) rules of programming discourse, which capture the conventions in programming and govern the composition of the plans into programs. [...] Results from these studies do in fact support our claim."
- Von Mayrhauser & Vans summarise the experimental result: experts perform significantly better on programs that match expert programming plans; programs that violate discourse rules are hard "even for experts".
- Limits: short Pascal fragments, fill-in-the-blank tasks; 1980s procedural code.

### Letovsky 1986 — "Cognitive processes in program comprehension"
*Empirical Studies of Programmers* (Ablex), pp. 58–79; journal version *J. Systems & Software* 7(4), 1987. DOI 10.1016/0164-1212(87)90032-X. **Secondary-only.**

- Think-aloud protocols of professionals. Model: a knowledge base, a mental model with three layers (specification, implementation, annotation linking them), and an assimilation process that "occurs either top-down or bottom-up. It is opportunistic" (von Mayrhauser & Vans).
- Readers constantly ask questions and form conjectures of three kinds: "why conjectures hypothesize the purpose of a function; how conjectures hypothesize the method for accomplishing a program goal; and what conjectures hypothesize classification—for example, a variable or function."
- Limits: small sample, qualitative; but it is the origin of the "why / how / what" question taxonomy that later work keeps rediscovering.

### Pennington 1987 — "Stimulus Structures and Mental Representations in Expert Comprehension of Computer Programs"
*Cognitive Psychology* 19:295–341. Full text: https://www.cs.kent.edu/~jmaletic/cs69995-PC/papers/pennington87.pdf

- Two studies, 80 and 40 professional programmers. Abstract: "The results suggest that procedural rather than functional units form the basis of expert programmers' mental representations [...] programs are first understood in terms of their procedural episodes. However, results also suggest that a programmer's task goals may influence the relations that dominate mental representations later in comprehension."
- Two cross-referenced representations: the **program model** (textbase: control flow, operations) and the **situation model** (what the program is about in real-world terms). "procedural representations precede functional representations." Building the situation model took "both time and incentive."
- Design implication stated by Pennington herself: "documentation concerning the real world domain and the relation of program procedures to the domain might promote a simultaneous construction of both kinds of understanding."
- Limits: COBOL/FORTRAN, 200-line programs, lab tasks; comprehension of whole programs, not changes.

### von Mayrhauser & Vans 1995 — "Program Comprehension During Software Maintenance and Evolution"
*IEEE Computer* 28(8):44–55. Full text: https://www.cs.kent.edu/~jmaletic/cs69995-PC/papers/von_mayrhauser-1995.pdf

- Compares six models and presents the **integrated metamodel**: program model (bottom-up, Pennington), situation model, top-down/domain model (Soloway), and a shared knowledge base. Key empirical claim: "experiments show that programmers switch between all three comprehension models" and "Any of the three submodels may become active at any time during the comprehension process. For example, during program model construction, a programmer might recognize a beacon indicating a common task such as sorting. This leads to the hypothesis that the code sorts something, causing a jump to the top-down model."
- Experts "approach problem comprehension with flexibility. They discard questionable hypotheses and refine their hypotheses." "Beacons are useful for gaining a high-level understanding."
- Caveat the authors raise: "Most models assume that the objective is to understand all of the code rather than a particular purpose, such as debugging" — partial, goal-directed understanding (which is what review is) was under-studied.
- Limits: a survey; its own experimental support comes from small think-aloud studies on large industrial code.

---

## 2. Code review research

### Bacchelli & Bird 2013 — "Expectations, Outcomes, and Challenges of Modern Code Review"
ICSE 2013. Author copy: https://sback.it/publications/icse2013.pdf

- Method: 17 developers observed and interviewed at Microsoft, 570 review comments card-sorted, surveys (~880 programmer responses).
- "From interviews, no other code review challenge emerged as clearly as understanding the submitted change." Quotes: "the most difficult thing when doing a code review is understanding the reason of the change"; "the biggest information need in code review: what instigated the change"; "understanding the code takes most of the reviewing time."
- Familiarity dominates: 91% (798) said unfamiliar files take longer because "big-picture impact analysis requires contextual understanding. When reviewing a small, unfamiliar change, it is often necessary to read through much more code than that being reviewed." 82% said owners' comments are different: "substantially deeper, more detailed and insightful."
- Starting behaviour: some reviewers begin with the textual description, others "went directly to a specific changed file." Owners skip the description and "go directly to the files they own"; non-owners "need more information and try to get it from the description, which is deemed good when it states 'what was changed and why.'"
- Defect finding is the outcome that needs the most understanding (Fig. 5), and in practice review comments are dominated by code improvements, not defects.
- Limits: one company, one tool (CodeFlow), 2012.

### Baum, Schneider & Bacchelli 2017 — "On the Optimal Order of Reading Source Code Changes for Review"
ICSME 2017. Author copy: https://sback.it/publications/icsme2017.pdf

- Method: 292 logged industrial review sessions, 12 task-guided interviews, 201 survey respondents, related-work triangulation; output is a middle-range theory.
- Headline: "Our results indicate that an optimal order is mainly an optimal grouping of the change parts by relatedness."
- Tool order matters in practice: "In 156 of 292 studied review sessions (53%), the user started with the file presented first by the review tool," and 37% of between-file navigations followed tool order, yet reviewers "regard this order as sub-optimal." "For small changes, the presentation order may have a negligible effect [...] The problem is more pronounced for less knowledgeable reviewers."
- The six principles (verbatim):
  1. "Group related change parts as closely as possible."
  2. "Provide information before it is needed."
  3. "In case of conflicts between Principles 1 and 2, prefer Principle 1 (grouping)."
  4. "Closely related change parts form chunks treated as elementary for further grouping and ordering."
  5. "The closest distance between two change parts is 'visible on the screen at the same time.'"
  6. "To satisfy the other principles, use rules that the reviewer can understand. Support this by making the grouping explicit to the reviewer."
- Macro structure: "At the very beginning of the review, the reviewer should learn about the requirements that led to the change. Many also wanted to get some kind of overview at the start ('First introduction to understand the context, then the crucial part'). An example of usage, e.g., a test case, can help to achieve this." Then start with one of: (T1) something easy, (T2) a natural entry point (GUI/servlet/CLI), (T3) the most important parts, (T4) new things, (T5) parts that "don't fit in". End with "a wrap-up/overview (e.g. a test case or some other example of usage putting it all together)" or "put the unimportant rest at the end."
- Relatedness types named by participants: data flow, call flow, class hierarchy, declare-and-use, file order, similarity, logical dependencies, development flow. Direction: declaration before use; for call flow the survey favoured **bottom-up (callee before caller)**: 111 of 130 rated it best, while "no sensible rule" was rated worst by 112 of 130 (and "not at all useful" by experienced reviewers).
- Why explicit grouping matters: an unexplained order can "break his line of thought" and cause disorientation; "If the parts had been grouped, the groups made visible and ideally given sensible names, I would have been [...]".
- Limits: theory-generating, not theory-testing; preferences and log traces, not measured defect detection; single company for logs.

### Baum, Schneider & Bacchelli 2019 — "Associating working memory capacity and code change ordering with code review performance"
*Empirical Software Engineering* 24(4):1762–1798. DOI 10.1007/s10664-018-9676-8. **Abstract-only** (see scope note). Replication package: https://figshare.com/articles/dataset/5808609

- Confirmatory experiment, 50 participants, "mostly professional software developers," reviewing one small and two larger changes with seeded defects, presented in theory-optimal vs. worst order.
- Results (abstract): "a moderate association between working memory capacity and the effectiveness of finding delocalized defects [...] whereas the association with other defect types is almost non-existing"; "The effectiveness of reviews is significantly larger for small code changes"; and the authors "could not conclude reliably whether the order of presenting the code change parts influences the efficiency of code review."
- Reading: this is the honest null on ordering. The 2017 theory predicted an efficiency gain from good order; the controlled test did not confirm it at this sample size. Change **size** and **delocalisation** of the defect were the effects that did show. Limits: I could not inspect effect sizes or the order manipulation details.

### Baum, Leßmann & Schneider 2017 — "The Choice of Code Review Process: A Survey on the State of the Practice"
PROFES 2017, LNCS 10611. DOI 10.1007/978-3-319-69926-4_9. **Not retrieved** (no open copy or abstract found); listed for completeness only. Not used in the synthesis.

### MacLeod, Greiler, Storey, Bird & Czerwonka 2018 — "Code Reviewing in the Trenches: Challenges and Best Practices"
*IEEE Software* 35(4):34–42. Author copy: https://www.michaelagreiler.com/wp-content/uploads/2019/03/Code-Reviewing-in-the-Trenches-Understanding-Challenges-Best-Practices-and-Tool-Needs.pdf

- 18 interviews, 911 survey responses, four weeks of team observation at Microsoft.
- "Our code reviewers said they struggle with large reviews" and with "understanding the code's purpose, the motivations for the change, and how the change was implemented." A developer on a large change: "It's just this big incomprehensible mess... then you can't add any value because they are just going to explain it to you and you're going to parrot back what they say."
- What a good change description contains: "a good description of what the problem was, what the solution is, and if it's a big change, it has [documentation explaining] what it's doing and how it's integrated with everything else." Yet "less than one third of respondents reported writing descriptions of the change."
- Best practices (their bold items): "small, incremental changes"; "clustering related changes, documenting the motivation for a change, and describing the change and how to approach the review will help reviewers."
- Limits: one company; self-report; practitioner-oriented synthesis.

### Sadowski, Söderberg, Church, Sipko & Bacchelli 2018 — "Modern Code Review: A Case Study at Google"
ICSE-SEIP 2018. Author copy: https://sback.it/publications/icse2018seip.pdf

- 12 interviews, 44 survey responses, logs of 9 million reviewed changes.
- Size: "over 35% of the changes under consideration modify only a single file and about 90% modify fewer than 10 files. Over 10% of changes modify only a single line of code, and the median number of lines modified is 24." Median reviewers: 1. Initial feedback "a median time of under an hour for small changes and about 5 hours for very large changes."
- Finding 4: "Code review at Google has converged to a process with markedly quicker reviews and smaller changes, compared to the other projects previously investigated."
- Context as a breakdown: "misunderstandings can arise based on not knowing what gave rise to the change; for example, if the rationale for a change was an urgent fix to a production problem or a 'nice to have' improvement."
- Limits: one company with unusually strong small-change culture; small interview/survey n.

### Rigby & Bird 2013 — "Convergent Contemporary Software Peer Review Practices"
ESEC/FSE 2013. Author copy: https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/rigby2013convergent.pdf

- Across AMD, Microsoft (Bing, Office, SQL), Google (Chrome, Android), Lucent, Apache, Linux, KDE: "Convergent Practice 3: Change sizes are small." Medians: Apache 25 lines, Linux 32, Android and AMD 44, Chrome 78 lines in 5 files; Lucent inspections 263 lines. Median review completion 14.7–20.8 hours. "Convergent Practice 4: Two reviewers find an optimal number of defects."
- Rationale: reviews "are expensive because they require reviewers to read, understand" the change; small changes enable "frequent review of small independent changes."
- Limits: correlational repository mining; "small" is descriptive of practice, not causally tied to defect yield in this paper.

---

## 3. Eye tracking

### Uwano, Nakamura, Monden & Matsumoto 2006 — "Analyzing Individual Performance of Source Code Review Using Reviewers' Eye Movement"
ETRA 2006, pp. 133–140. Copy: https://www.cs.kent.edu/~jmaletic/cs69995-PC/papers/Uwano06.pdf

- 5 graduate students, 6 C programs of 12–23 lines, one seeded logic defect each; 30 sessions.
- The **scan** pattern: "the subjects were likely to first read the whole lines of the code from the top to the bottom briefly, and then to concentrate some particular portions. The statistics show that 72.8 percent of the code lines were watched in the first 30 percent of the review time."
- Result: "the defect detection time increased up to 2.5 times of average detection time when the first scan time is less than 0.8 [of average]"; "reviewers taking sufficient time for scanning the code tend to detect defects efficiently." A second "retrace reference" pattern (jumping back to where a variable was last set) was observed but "did not show any significant correlation with the performance."
- Limits: tiny programs, five students, one defect each. Evidence that an overview pass precedes and pays off in focused inspection; nothing about multi-file changes.

### Busjahn, Bednarik, Begel, Crosby, Paterson, Schulte, Sharif & Tamm 2015 — "Eye Movements in Code Reading: Relaxing the Linear Order"
ICPC 2015, pp. 255–265. DOI 10.1109/ICPC.2015.36. Author copy: https://researchonline.gcu.ac.uk/ws/files/24953094/ICPC2015_authors_version.pdf

- 14 novices (longitudinal) and 6 experts reading short Java programs and English text.
- "80% of the novices' eye movements were linear when reading natural language text and 70% when reading source code. For experts on the other hand, we found only 60% linear eye movements on source code. The experts' reading patterns can be characterized by a greater number of eye gaze movements that skip intermediate words and lines." Experts follow **execution order** more than **story (top-to-bottom) order**; "non-linear reading skills increase with expertise."
- Practitioner implication they draw: tools "informing that the initial Scan of the program was not sufficient or that someone solving a bug finding task is concentrating on a code entirely unrelated to the bug" could promote expert-like behaviour.
- Limits: 6 experts; comprehension of whole small programs, not diff review.

---

## 4. Tangled and composite changes

### Herzig & Zeller 2013 — "The Impact of Tangled Code Changes"
MSR 2013, pp. 121–130. Author copy: https://www.st.cs.uni-saarland.de/publications/files/herzig-msr-2013.pdf

- Abstract: "developers often commit unrelated or loosely related code changes in a single transaction [...] In an investigation of five open-source JAVA projects, we found up to 15% of all bug fixes to consist of multiple tangled changes. Using a multi-predictor approach to untangle changes, we show that on average at least 16.6% of all source files are incorrectly associated with bug reports. We recommend better change organization to limit the impact of tangled changes." Over 7,000 change sets manually classified.
- Limits: about data quality for mining, not reviewer cognition; establishes prevalence only.

### Barnett, Bird, Brunet & Lahiri 2015 — "Helping Developers Help Themselves: Automatic Decomposition of Code Review Changesets"
ICSE 2015. Author copy: https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/barnett2015hdh.pdf

- Premise: "Understanding a code review is more difficult when the changeset consists of multiple, independent, code differences." Prior evidence cited: "the easier it is for a reviewer to understand a change, the more likely they are to provide feedback that improves quality."
- CLUSTERCHANGES partitions a changeset using **def-use relationships** across diff regions into non-trivial partitions and "trivial" in-method partitions. On 1,000 Microsoft changesets: "over 40% of changes submitted for review at Microsoft can be potentially decomposed into multiple partitions"; 66% of changed methods land in non-trivial partitions on average.
- Authors annotating their own review to guide readers happens "less than 5% of the time in practice."
- User study with 20 developers: "most developers agree with our automatic partitioning and believe the decomposition is useful for reviewers to understand their changes better"; 18 of 20 were positive about using it, some "even before" sending for review.
- Limits: agreement study, not defect-detection measurement; C# only; def-use misses semantic relatedness (they name clone detection as a gap).

### Tao & Kim 2015 — "Partitioning Composite Code Changes to Facilitate Code Review"
MSR 2015. Author copy: https://yidatao.github.io/paper/tao_msr2015.pdf

- Manual inspection of 453 OSS changes: "up to 29% and on average 17% are composite." Partitioning by program slicing (dependency) plus pattern similarity, with formatting-only changes isolated into their own slice; 69% of 78 composite changes partitioned the same way humans did.
- Controlled user study (within-subject, partitioned vs. by-file): "In a similar amount of time, participants answered code review questions significantly better when the [changes were partitioned]"; correctness p = 0.01, time p = 0.81.
- Limits: "preliminary user study," students/small n, review questions rather than seeded defects.

---

## 5. Multimedia learning (Mayer)

### Mayer & Fiorella 2014 — "Principles for Reducing Extraneous Processing in Multimedia Learning: Coherence, Signaling, Redundancy, Spatial Contiguity, and Temporal Contiguity Principles"
In *The Cambridge Handbook of Multimedia Learning*, 2nd ed., ch. 12, pp. 279–315. Copy: https://edtechuvic.ca/wp-content/uploads/sites/11/2022/09/principles-for-reducing-extraneous-processing-in-multimedia-learning-coherence-signaling-redundancy-spatial-contiguity-and-temporal-contiguity-principles.pdf

- Coherence: "people learn more deeply from a multimedia message when extraneous material is excluded rather than included" — 23/23 tests, median d = 0.86.
- Signaling: "when cues are added that highlight the organization of the essential material" — 24/28 tests, median d = 0.41 (verbal signals d = 0.50; visual cueing d = 0.36, "stronger effects for certain forms of cueing such as spreading color and weaker effects for other forms such as arrows"). Boundary conditions: "applies more strongly to low-knowledge learners than high-knowledge learners [...] when it is used sparingly rather than excessively." Visual cues "are most effective when they guide attention both spatially and temporally."
- Redundancy: "people learn more deeply from graphics and narration than from graphics, narration, and on-screen text" — 16/16 tests, median d = 0.86. Applies when on-screen text duplicates the narration verbatim.
- Spatial contiguity: words near the corresponding picture — 22/22, d = 1.10.
- Temporal contiguity: "when corresponding animation and narration are presented simultaneously rather than successively" — 9/9, median d = 1.22; e.g. "when the narrator said, 'The inlet valve opens,' the animation showed the inlet valve opening."

### Mayer & Pilegard 2014 — "Principles for Managing Essential Processing in Multimedia Learning: Segmenting, Pre-training, and Modality Principles"
Same handbook, ch. 13. Publisher abstract: https://www.cambridge.org/core/books/abs/cambridge-handbook-of-multimedia-learning/principles-for-managing-essential-processing-in-multimedia-learning-segmenting-pretraining-and-modality-principles/DD24C2F48B9B1277CE59F78276110258 (abstract page read; chapter body paywalled).

- Segmenting: "People learn more deeply when a multimedia message is presented in learner-paced segments rather than as a continuous unit" — 10/10, median d = 0.79.
- Pre-training: "when they know the names and characteristics of the main concepts" — 13/16, d = 0.75.
- Modality: "when the words are spoken rather than printed" — 53/61, d = 0.76.
- Limits for all Mayer principles: lab studies, mostly novice university students, short science lessons (pumps, brakes, lightning), transfer tests. Code reviewers are high-knowledge readers of text, so expect smaller signaling effects and a possible expertise reversal; the modality principle assumes the visual channel is saturated by graphics, which is only partly true of code on screen.

---

## What a reader needs first (ranked synthesis)

1. **The reason for the change, before any code.** The single clearest empirical finding in review research: "the most difficult thing [...] is understanding the reason of the change" (Bacchelli & Bird); reviewers should "learn about the requirements that led to the change" first (Baum 2017); misunderstanding "what gave rise to the change" is a named breakdown at Google (Sadowski). This feeds Brooks's primary hypothesis and Letovsky's "why" conjectures.
2. **A macro-structure overview (what is touched, how it hangs together) before detail.** Uwano's scan-then-focus pattern predicts faster defect detection; Baum's interviewees wanted "first introduction to understand the context, then the crucial part"; Mayer's pre-training principle (d = 0.75) and signaling principle ("highlight the organization of the essential material").
3. **Names for the concepts and groups they are about to see.** Pre-training (Mayer & Pilegard); Baum's Principle 6 ("make the grouping explicit [...] given sensible names"); Pennington's situation-model vocabulary. A reader who knows the nouns builds the domain model in parallel with the program model.
4. **Control flow / procedural episodes before functional or data-flow abstraction.** Pennington: "programs are first understood in terms of their procedural episodes"; the program model precedes the situation model. For a change, this means "what runs, in what order" before "what it means for the feature."
5. **Information before it is needed, in dependency direction.** Baum Principle 2; declarations before uses; survey preference for callee-before-caller (111/130). Delocalized information is where working memory becomes the bottleneck (Baum 2019).
6. **Beacons and an example of use early.** Recognising a familiar pattern triggers the jump to top-down understanding (Brooks; von Mayrhauser & Vans); "an example of usage, e.g., a test case, can help" at the start (Baum 2017).
7. **The smallest coherent unit.** Effectiveness is "significantly larger for small code changes" (Baum 2019); industry converges on medians of 24–78 lines (Sadowski; Rigby & Bird). If the change is large, the reader first needs it cut into cohesive, self-contained parts (Barnett; Tao & Kim).
8. **Freedom to deviate.** Experts read non-linearly and switch models opportunistically (Busjahn; von Mayrhauser & Vans; Letovsky). An order is a default, not a cage.

## How to order and segment a change for review (ranked synthesis)

1. **Group by relatedness first; order within and between groups second.** "An optimal order is mainly an optimal grouping of the change parts by relatedness" and, on conflict, "prefer Principle 1 (grouping)" (Baum 2017). Relatedness signals, in roughly the order the literature can compute them: def-use/data flow (Barnett; Tao & Kim), call flow, class hierarchy, declare-and-use, similarity/clones, and the developer's own "development flow."
2. **Decompose composite changes into cohesive, self-contained slices, and isolate noise.** 17–29% of OSS changes and >40% of Microsoft review changesets are decomposable (Tao & Kim; Barnett); partitioning improved review correctness at equal time (p = 0.01, Tao & Kim); formatting-only and rename-only changes should be their own slice or dropped to the end (Tao & Kim; Baum's "put the unimportant rest at the end"; Mayer's coherence principle, d = 0.86).
3. **Open with context and an overview, close with a wrap-up.** Requirements/motivation, then overview or usage example; end with "a test case or some other example of usage putting it all together" (Baum 2017). Both bookends are the places where the situation model (Pennington) is built.
4. **Inside a group, follow dependency direction and provide information before it is needed.** Declaration before use; the survey favoured bottom-up call order (callee first), interviewees were split, so treat direction as a tunable default and keep it *consistent* (Baum Principles 2 and 6).
5. **Treat tightly coupled parts as one chunk and show them together.** "The closest distance between two change parts is 'visible on the screen at the same time'" (Principle 5). Side-by-side beats sequential for the pairs that must be compared (interface and implementation, test and code under test, caller and callee when the contract changed).
6. **Make the grouping and the rule behind it visible and nameable.** Unexplained order "break[s] his line of thought" (Principle 6); Mayer's signaling effect comes from cues that reveal organisation, not decoration.
7. **Segment into learner-paced steps with a deliberate entry point.** Segmenting d = 0.79 (Mayer & Pilegard); entry tactics: something easy, a natural entry point, the most important part, or the new thing (Baum T1–T4). Pick one and say which.
8. **Expect small effects from order on small changes, larger on big or unfamiliar ones.** "For small changes, the presentation order may have a negligible effect [...] more pronounced for less knowledgeable reviewers" (Baum 2017); the controlled test of order was inconclusive (Baum 2019). Size and delocalisation are the effects that replicated.

## Implications for a narrated, step-by-step diff walkthrough

Tags name the supporting papers; **strong** = direct empirical result in the review or comprehension setting (or a large, replicated multimedia effect); **weak** = inferred from theory, small-n studies, or transfer from other domains.

1. **Step 0 is the recovered intent, spoken before any code is shown.** State what instigated the change, what problem it solves, and what "done" looks like. [Bacchelli & Bird 2013; Baum 2017 macro-structure; Sadowski 2018; MacLeod 2018] — **strong**.
2. **Step 1 is a whole-change overview pass: every touched file/region, named groups, and one sentence on how they relate.** Simulates the scan that predicts faster defect detection and satisfies pre-training and signaling. [Uwano 2006; Baum 2017 P6; Mayer & Pilegard 2014 pre-training; Mayer & Fiorella 2014 signaling] — **strong** for "overview first", **weak** on how long the overview should be.
3. **Group hunks by relatedness and walk group by group; never walk in alphabetical file order.** Use def-use, call flow, declare-and-use, similarity; label each group with a concept name the narration reuses. [Baum 2017 P1/P3/P4/P6; Barnett 2015; Tao & Kim 2015] — **strong** on grouping, **weak** on any specific inter-group order (Baum 2019 null).
4. **Split composite diffs into separate stories (or clearly separate acts), and quarantine mechanical churn.** Formatting, renames, generated code, lockfiles go into a final "housekeeping" step or are collapsed, not narrated line by line. [Tao & Kim 2015; Barnett 2015; Herzig & Zeller 2013; Mayer coherence] — **strong**.
5. **Within a group, present information before it is needed: the declaration/type/helper before its use, the callee before the caller when the contract changed; keep the direction consistent across the story and say what the rule is.** [Baum 2017 P2/P6; Pennington 1987 program-model-first] — **strong** on "before it is needed", **weak** on top-down vs bottom-up (participants split).
6. **Narrate "what runs and in what order" before "what it means", then explicitly cross-reference the two.** Procedural episodes first, then the functional/domain reading ("this is the retry path; in product terms, it's what stops duplicate charges"). Pennington says explicit domain-to-procedure mapping can let both models build at once. [Pennington 1987; von Mayrhauser & Vans 1995] — **strong** on sequence, **weak** on the benefit of explicit cross-referencing (Pennington's own speculation).
7. **Each beat highlights exactly the lines the narration is talking about, at the moment it says them.** Temporal contiguity (d = 1.22) and spatial contiguity (d = 1.10) are the largest effects in the whole review; visual cues work best when they "guide attention both spatially and temporally." Viewport scroll plus highlight must be synchronised to the sentence, not the step. [Mayer & Fiorella 2014] — **strong** (in multimedia learning), transfer to expert code readers **moderate**.
8. **Speak the explanation; do not also print it verbatim as a caption over the code.** Modality (d = 0.76) favours spoken words alongside the visual; redundancy (d = 0.86) penalises identical on-screen text. Short labels, group names and step titles are fine (signaling), a full transcript overlay is not. Offer the transcript as an opt-in pane, not a default. [Mayer & Pilegard 2014; Mayer & Fiorella 2014] — **strong** effect sizes, **weak** transfer: reviewers are high-knowledge readers and the screen is already text, so expect the modality gain to shrink.
9. **Keep beats small and learner-paced; let the reviewer advance, pause, and jump between groups.** Segmenting (d = 0.79) requires learner control; experts read non-linearly and switch models opportunistically, so the story must tolerate leaving the path and coming back. [Mayer & Pilegard 2014; Busjahn 2015; von Mayrhauser & Vans 1995; Letovsky 1986] — **strong** on pacing control, **strong** on non-linear navigation being normal for experts.
10. **When two parts must be compared, show them side by side in one beat instead of two sequential beats.** Interface vs implementation, old vs new contract, test vs code under test. [Baum 2017 P5] — **strong** (clear participant preference), unmeasured for defects.
11. **Put a beacon or usage example early and a wrap-up example (the test) at the end.** A test or call site at the start seeds the top-down hypothesis; the same test at the end closes the loop. [Brooks 1983 via vM&V; Baum 2017 macro-structure] — **weak** (theory plus interview preference).
12. **Scale the walkthrough's depth with size and reviewer familiarity, and be honest about the limits of ordering.** For a 24-line single-file change, the overview and the intent are most of the value; for large, multi-file or unfamiliar changes, grouping and delocalised-information handling dominate. Effectiveness reliably drops with size, and the one controlled test of order was inconclusive, so the product claim should be "context, grouping and synchronisation", not "the optimal order". [Baum 2019; Baum 2017; Sadowski 2018; Rigby & Bird 2013; Bacchelli & Bird 2013 on familiarity] — **strong** on size, **strong** on the null for order.

## Gaps worth knowing

- No study measures a *narrated* code walkthrough against a static diff; the multimedia effects are borrowed from science-lesson experiments with novices.
- The only controlled test of change-part ordering (Baum 2019) could not confirm an efficiency effect; the grouping theory rests on preferences, logs, and one partitioning experiment (Tao & Kim).
- Eye-tracking evidence is on 12–200-line single programs, not multi-file diffs.
- Nothing here addresses LLM-generated explanations specifically; the closest is Barnett's observation that authors annotate their changes for reviewers less than 5% of the time, which is the gap an automatic walkthrough fills.
