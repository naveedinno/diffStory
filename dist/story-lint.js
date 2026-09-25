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
    void beats;
    void ctx;
    void openerKey;
    void isSweep; // TEMP: used by Task 2/3 rules
    lintCopies(code, add);
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
