// Deterministic prose and structure lints for authored stories.
//
// These catch the recurring failures from the 2026-09 corpus audit
// (docs/research/story-corpus-audit-2026-09.md) that no validator checks.
// Every rule is cheap and explainable; anything needing judgment stays with
// the eval judge. "error" means the reviewer would see something broken;
// "warning" is craft advice the author fixes or can justify.
import { orderedSteps } from "./tour.js";
import { isCodeStep, } from "./types.js";
const SWEEP_TAGS = new Set(["skim", "sweep", "mechanical"]);
const PROSE_FILE = /\.(md|mdx|markdown|txt|rst|adoc)$/i;
const BARE_OPENER = /^(now(?! that)|here|this adds|it|then|also|next|and)\b/i;
const LINE_REF = /\blines?\s+\d+/gi;
const LOOK_AT_LINES = /\blook at lines?\s+\d+/i;
const OPERAND = String.raw `(?:<code[^>]*>[^<]{1,40}<\/code>|\d[\d_.,]*%?)`;
const PROSE_TRANSITION = new RegExp(String.raw `\bfrom\s+${OPERAND}\s+to\s+${OPERAND}`, "i");
const COUNTER_SUFFIX = /(?:\s+|\s*[·•:#(\-–—]\s*)(?:\d+\s*(?:\/|of)\s*\d+\)?|(?:part|decision|step|instance)\s+\d+|#?\d+\)?)\s*$/i;
const OFFSCREEN = /\b(claimed spans?|other spans?|second span|remaining spans|claimed ranges?)\b/i;
/** Visible text of a narrative field: tags dropped, common entities decoded. */
export function plainText(html) {
    return html
        .replace(/<[^>]+>/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/\s+/g, " ")
        .replace(/\s+([.,;:!?])/g, "$1")
        .trim();
}
function wordsOf(text) {
    return text.split(/\s+/).filter(Boolean);
}
/** Lowercased, digits folded, punctuation dropped: beats differing only in numbers are copies. */
function copyKey(html) {
    return plainText(html)
        .toLowerCase()
        .replace(/\d+/g, "#")
        .replace(/[^a-z#\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}
/** First three words with identifiers folded to "x", so "This is <code>a()</code>" and "This is <code>b()</code>" share a frame. */
function openerKey(html) {
    return copyKey(html.replace(/<code[^>]*>[\s\S]*?<\/code>/gi, " x "))
        .split(" ")
        .slice(0, 3)
        .join(" ");
}
function isSweep(step) {
    return (step.tags ?? []).some((tag) => SWEEP_TAGS.has(tag));
}
function stepList(ids) {
    return `steps[${ids.slice(0, 5).join(", ")}${ids.length > 5 ? ", …" : ""}]`;
}
/** Run every rule. The story must already pass validateTour. */
export function lintStory(tour, ctx = {}) {
    const findings = [];
    const add = (rule, severity, where, message, fix) => findings.push({ rule, severity, where, message, fix });
    const steps = orderedSteps(tour);
    const code = steps.filter(isCodeStep);
    const beats = code.flatMap((step) => (step.beats ?? []).map((beat, index) => ({ step, beat, index })));
    void ctx; // TEMP: used by Task 3 rules
    lintCopies(code, add);
    lintOpeners(beats, add);
    lintLandings(code, add);
    lintLinePointers(code, add);
    lintWhyCopiesBeats(code, add);
    lintBeatLength(beats, add);
    lintBeatPhrases(beats, add);
    lintNumberedSeries(steps, add);
    return findings;
}
function lintCopies(code, add) {
    const byKey = new Map();
    const note = (html, id) => {
        if (!html)
            return;
        const key = copyKey(html);
        if (wordsOf(key).length < 6)
            return;
        const ids = byKey.get(key) ?? new Set();
        ids.add(id);
        byKey.set(key, ids);
    };
    for (const step of code) {
        note(step.why, step.id);
        for (const beat of step.beats ?? [])
            note(beat.text, step.id);
    }
    for (const [key, ids] of byKey) {
        if (ids.size < 3)
            continue;
        add("copied-beat", "error", stepList([...ids]), `${ids.size} steps share the same narration: "${key.slice(0, 90)}${key.length > 90 ? "…" : ""}"`, "Each stop must say what its own lines prove. Merge repeated instances into one sweep step with top-level `ranges`, or rewrite each beat around its own decision.");
    }
}
function lintOpeners(beats, add) {
    if (beats.length < 12)
        return;
    const counts = new Map();
    for (const { beat } of beats) {
        const key = openerKey(beat.text);
        if (wordsOf(key).length < 3)
            continue;
        counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const limit = Math.max(5, Math.ceil(beats.length * 0.25));
    for (const [key, count] of counts) {
        if (count < limit)
            continue;
        add("formulaic-opener", "warning", "story", `${count} of ${beats.length} beats open with "${key} …"`, "Vary how beats begin: lead with what this spot is for, what just happened, or what would break, not the same frame every time.");
    }
}
function lintLandings(code, add) {
    for (const step of code) {
        if (isSweep(step) || PROSE_FILE.test(step.file))
            continue;
        const first = step.beats?.[0];
        if (!first)
            continue;
        const where = `steps[${step.id}].beats[0]`;
        if (!/<code[^>]*>[^<]+<\/code>/i.test(first.text)) {
            add("landing-missing-symbol", "warning", where, "The first beat names no symbol in <code>.", "Land the listener first: name the function, rule, or test on screen in <code>, who reaches it and when, then the change.");
        }
        const text = plainText(first.text);
        if (BARE_OPENER.test(text)) {
            add("landing-bare-opener", "warning", where, `The first beat opens with "${wordsOf(text).slice(0, 3).join(" ")} …".`, 'Open on where the listener is ("This is <code>placeOrder()</code>, what the POST handler calls first …"), not on "Now", "Here", or "It".');
        }
    }
}
function lintLinePointers(code, add) {
    for (const step of code) {
        let refs = 0;
        (step.beats ?? []).forEach((beat, index) => {
            const text = plainText(beat.text);
            if (LOOK_AT_LINES.test(text)) {
                add("line-pointer", "error", `steps[${step.id}].beats[${index}]`, 'The beat says "Look at lines …".', "Name the code instead (\"the <code>require</code> guarding the cap\"); the glow already points at the lines.");
            }
            refs += (text.match(LINE_REF) ?? []).length;
        });
        if (refs > 1) {
            add("line-pointer", "warning", `steps[${step.id}]`, `The step mentions line numbers ${refs} times.`, "Say a line number at most once per step, after the landing, and only when the glow alone is ambiguous.");
        }
    }
}
function lintWhyCopiesBeats(code, add) {
    for (const step of code) {
        const beats = step.beats ?? [];
        if (!beats.length)
            continue;
        const whyWords = wordsOf(copyKey(step.why)).filter((w) => w.length >= 3);
        if (whyWords.length < 12)
            continue;
        const beatWords = new Set(wordsOf(copyKey(beats.map((b) => b.text).join(" "))));
        const shared = whyWords.filter((w) => beatWords.has(w)).length;
        if (shared / whyWords.length >= 0.8) {
            add("why-copies-beats", "warning", `steps[${step.id}].why`, "`why` repeats the beats.", "Make `why` one sentence: the failure this stop rules out. The beats carry the walk-through.");
        }
    }
}
function lintBeatLength(beats, add) {
    let total = 0;
    for (const { step, beat, index } of beats) {
        const count = wordsOf(plainText(beat.text)).length;
        total += count;
        if (count > 45) {
            add("beat-too-long", "warning", `steps[${step.id}].beats[${index}]`, `The beat is ${count} words.`, "One idea per beat. Split it, or cut what the highlighted lines already show.");
        }
    }
    if (beats.length >= 6 && total / beats.length > 32) {
        add("beats-long-on-average", "warning", "story", `Beats average ${Math.round(total / beats.length)} words.`, "Aim for 12–30 spoken words per beat; the listener cannot glance back.");
    }
}
function lintBeatPhrases(beats, add) {
    for (const { step, beat, index } of beats) {
        const where = `steps[${step.id}].beats[${index}]`;
        if (PROSE_TRANSITION.test(beat.text)) {
            add("prose-value-transition", "warning", where, "The beat narrates a value change the diff already shows.", "Say what depended on the old value instead (\"nothing reads the old weight, so no consumer breaks\").");
        }
        if (OFFSCREEN.test(plainText(beat.text))) {
            add("offscreen-claim", "warning", where, "The beat talks about claimed spans the reviewer cannot see.", "Talk only about what is on screen. Other `ranges` entries are coverage claims, not narration.");
        }
    }
}
function lintNumberedSeries(steps, add) {
    const groups = new Map();
    for (const step of steps) {
        const title = step.title.trim();
        const base = title.replace(COUNTER_SUFFIX, "").trim().toLowerCase();
        if (!base || base === title.toLowerCase())
            continue;
        groups.set(base, [...(groups.get(base) ?? []), step.id]);
    }
    for (const [base, ids] of groups) {
        if (ids.length < 3)
            continue;
        add("numbered-series", "warning", stepList(ids), `${ids.length} steps are numbered copies of "${base}".`, "A repeated edit is one sweep step: narrate one instance and claim the rest with top-level `ranges`. A real sequence gets purpose titles, not counters.");
    }
}
