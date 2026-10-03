import { lintStory } from './story-lint.js';
import { orderedSteps, validateGeneratedTour } from './tour.js';
import { isCodeStep } from './types.js';
const CONTRACT_STEP = /^steps\[(\d+)\]/;
const LINT_STEP = /^steps\[([^\].,]+)/;
export function storyHealth(tour, readLines) {
    const steps = orderedSteps(tour);
    const panelById = new Map(steps.map((step, index) => [step.id, index + 1]));
    const fileById = new Map(steps.filter(isCodeStep).map((step) => [step.id, step.file]));
    const findings = [];
    for (const message of validateGeneratedTour(tour)) {
        const match = CONTRACT_STEP.exec(message);
        const stepId = match ? steps[Number(match[1])]?.id : undefined;
        findings.push({
            kind: 'contract',
            severity: 'error',
            where: match ? match[0] : 'story',
            message,
            ...(stepId ? { stepId } : {}),
            ...(stepId && panelById.get(stepId) ? { panelIndex: panelById.get(stepId) } : {}),
            ...(stepId && fileById.get(stepId) ? { file: fileById.get(stepId) } : {}),
        });
    }
    for (const lint of lintStory(tour, readLines ? { readLines } : undefined)) {
        const stepId = LINT_STEP.exec(lint.where)?.[1];
        const resolved = stepId && panelById.has(stepId) ? stepId : undefined;
        findings.push({
            kind: 'lint',
            severity: lint.severity,
            where: lint.where,
            message: lint.message,
            rule: lint.rule,
            ...(lint.fix ? { fix: lint.fix } : {}),
            ...(resolved ? { stepId: resolved } : {}),
            ...(resolved && panelById.get(resolved) ? { panelIndex: panelById.get(resolved) } : {}),
            ...(resolved && fileById.get(resolved) ? { file: fileById.get(resolved) } : {}),
        });
    }
    findings.sort((a, b) => (a.severity === 'error' ? 0 : 1) - (b.severity === 'error' ? 0 : 1) ||
        (a.panelIndex ?? 0) - (b.panelIndex ?? 0) ||
        a.where.localeCompare(b.where));
    return {
        findings,
        errors: findings.filter((f) => f.severity === 'error').length,
        warnings: findings.filter((f) => f.severity === 'warning').length,
    };
}
