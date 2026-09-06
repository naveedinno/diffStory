import { isDeepStrictEqual } from 'node:util';
import { commitEvolutionManifest, } from './git.js';
const CACHE_LIMIT = 128;
const verificationCache = new Map();
function resolveBoundary(value, manifest) {
    const matches = manifest.commits.filter((commit) => commit.sha.toLowerCase().startsWith(value.toLowerCase()));
    if (matches.length === 1)
        return { sha: matches[0].sha };
    if (matches.length === 0)
        return { error: `commit boundary "${value}" is outside the frozen first-parent history` };
    return { error: `commit boundary "${value}" is ambiguous in the frozen first-parent history` };
}
/** Expand unambiguous agent-authored prefixes and stamp server-owned endpoints. */
export function normalizeEvolutionObject(rawStory, manifest) {
    if (!manifest)
        return;
    const raw = rawStory.evolution;
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw))
        return;
    const evolution = raw;
    evolution.baseSha = manifest.baseSha;
    evolution.headSha = manifest.headSha;
    if (!Array.isArray(evolution.phases))
        return;
    for (const rawPhase of evolution.phases) {
        if (typeof rawPhase !== 'object' || rawPhase === null || Array.isArray(rawPhase))
            continue;
        const phase = rawPhase;
        for (const field of ['firstCommit', 'lastCommit']) {
            if (typeof phase[field] !== 'string' || phase[field].length >= 40)
                continue;
            const resolved = resolveBoundary(phase[field], manifest);
            if (resolved.sha)
                phase[field] = resolved.sha;
        }
    }
}
/** Verify authored phase boundaries against one immutable first-parent manifest. */
export function verifyEvolution(repo, tour, frozenManifest) {
    const errors = [];
    const warnings = [];
    const evolution = tour.evolution;
    if (!evolution) {
        if (frozenManifest?.eligible) {
            warnings.push('Eligible first-parent history has no evolution block.');
        }
        return { errors, warnings, displayable: false, commitCount: frozenManifest?.commits.length ?? 0, phaseCommitCounts: [] };
    }
    const manifest = frozenManifest ??
        commitEvolutionManifest(repo, evolution.baseSha, evolution.headSha);
    if (!manifest) {
        warnings.push('Commit evolution could not be re-verified because its stored endpoints are unavailable.');
        return { errors, warnings, displayable: false, commitCount: 0, phaseCommitCounts: [] };
    }
    if (manifest.baseSha !== evolution.baseSha ||
        manifest.headSha !== evolution.headSha) {
        errors.push('evolution endpoints do not match the frozen generation manifest');
    }
    if (!manifest.eligible) {
        warnings.push('Commit evolution is only shown for fixed ranges with 2 to 30 first-parent commits.');
    }
    const indexes = new Map(manifest.commits.map((commit, index) => [commit.sha, index]));
    let previousStart = -1;
    let previousEnd = -1;
    const phaseCommitCounts = [];
    evolution.phases.forEach((phase, phaseIndex) => {
        const first = resolveBoundary(phase.firstCommit, manifest);
        const last = resolveBoundary(phase.lastCommit, manifest);
        if (first.error)
            errors.push(`evolution.phases[${phaseIndex}].firstCommit ${first.error}`);
        if (last.error)
            errors.push(`evolution.phases[${phaseIndex}].lastCommit ${last.error}`);
        if (!first.sha || !last.sha) {
            phaseCommitCounts.push(0);
            return;
        }
        const start = indexes.get(first.sha);
        const end = indexes.get(last.sha);
        if (start === undefined || end === undefined) {
            phaseCommitCounts.push(0);
            return;
        }
        phaseCommitCounts.push(Math.max(0, end - start + 1));
        if (start > end) {
            errors.push(`evolution.phases[${phaseIndex}] runs backward through commit history`);
            return;
        }
        if (previousStart >= 0 && (start < previousStart || end < previousEnd)) {
            errors.push(`evolution.phases[${phaseIndex}] reverses the previous phase order`);
            return;
        }
        if (previousEnd >= 0 && start > previousEnd + 1) {
            warnings.push(`evolution phases leave a gap before phase ${phaseIndex + 1}`);
        }
        if (previousEnd >= 0 && start <= previousEnd) {
            warnings.push(`evolution phase ${phaseIndex + 1} overlaps the previous phase`);
        }
        previousStart = start;
        previousEnd = end;
    });
    if (evolution.phases.length && manifest.commits.length) {
        const first = resolveBoundary(evolution.phases[0].firstCommit, manifest).sha;
        const last = resolveBoundary(evolution.phases[evolution.phases.length - 1].lastCommit, manifest).sha;
        if (first !== manifest.commits[0].sha ||
            last !== manifest.commits[manifest.commits.length - 1].sha) {
            warnings.push('Evolution phases do not cover the complete first-parent history.');
        }
    }
    return {
        errors,
        warnings: [...new Set(warnings)],
        displayable: manifest.eligible && errors.length === 0 && warnings.length === 0,
        commitCount: manifest.commits.length,
        phaseCommitCounts,
    };
}
export function cachedEvolutionVerification(repo, storyIdentity, tour) {
    if (!tour.evolution)
        return { errors: [], warnings: [], displayable: false, commitCount: 0, phaseCommitCounts: [] };
    const key = `${repo}\0${storyIdentity}`;
    const cached = verificationCache.get(key);
    if (cached) {
        verificationCache.delete(key);
        verificationCache.set(key, cached);
        return cached;
    }
    const result = verifyEvolution(repo, tour);
    verificationCache.set(key, result);
    while (verificationCache.size > CACHE_LIMIT) {
        const oldest = verificationCache.keys().next().value;
        if (!oldest)
            break;
        verificationCache.delete(oldest);
    }
    return result;
}
export function evolutionPreservationErrors(tour, originalArc, originalEvolution) {
    const errors = [];
    if (originalArc === undefined) {
        if (tour.storyArc !== undefined)
            errors.push('targeted repair must not introduce storyArc');
    }
    else if (!isDeepStrictEqual(tour.storyArc, originalArc)) {
        errors.push('targeted repair must preserve storyArc exactly');
    }
    if (originalEvolution === undefined) {
        if (tour.evolution !== undefined)
            errors.push('targeted repair must not introduce evolution');
        return errors;
    }
    if (!tour.evolution) {
        errors.push('targeted repair must preserve evolution');
        return errors;
    }
    const protectedEvolution = (value) => ({
        baseSha: value.baseSha,
        headSha: value.headSha,
        phases: value.phases.map((phase) => ({
            title: phase.title,
            summary: phase.summary,
            firstCommit: phase.firstCommit,
            lastCommit: phase.lastCommit,
        })),
    });
    if (!isDeepStrictEqual(protectedEvolution(tour.evolution), protectedEvolution(originalEvolution))) {
        errors.push('targeted repair may change only evolution relatedSteps');
    }
    return errors;
}
export function clearEvolutionVerificationCache() {
    verificationCache.clear();
}
export function evolutionVerificationCacheSize() {
    return verificationCache.size;
}
