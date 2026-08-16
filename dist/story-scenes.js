/**
 * Choose the most specific scene that can present the existing evidence.
 * Paired code wins over the more general logic-move treatment because the
 * cross-file relationship already determines the widest layout.
 */
export function projectStoryStepScene(facts) {
    if (facts.kind === 'concept')
        return facts.hasDiagram ? 'concept-diagram' : 'concept-document';
    if (facts.paired)
        return 'paired-code';
    if (facts.hasMoves)
        return 'logic-move';
    return 'code-focus';
}
