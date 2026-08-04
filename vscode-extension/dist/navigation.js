"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseNavigationQuery = parseNavigationQuery;
exports.prepareNavigation = prepareNavigation;
exports.clampNavigationPoint = clampNavigationPoint;
const node_path_1 = require("node:path");
function parseNavigationQuery(query) {
    const params = new URLSearchParams(query);
    const repo = params.get('repo') ?? '';
    const path = params.get('path') ?? '';
    const line = Number(params.get('line'));
    const column = Number(params.get('column'));
    if (!repo || repo.length > 4096 || !(0, node_path_1.isAbsolute)(repo) ||
        !path || path.length > 4096 || !(0, node_path_1.isAbsolute)(path) ||
        !Number.isInteger(line) || line < 1 || line > 10_000_000 ||
        !Number.isInteger(column) || column < 1 || column > 10_000_000) {
        return null;
    }
    const root = (0, node_path_1.resolve)(repo);
    const target = (0, node_path_1.resolve)(path);
    const fromRoot = (0, node_path_1.relative)(root, target);
    if (!fromRoot || fromRoot === '..' || fromRoot.startsWith(`..${node_path_1.sep}`) || (0, node_path_1.isAbsolute)(fromRoot)) {
        return null;
    }
    return { repo: root, path: target, line, column };
}
/** Persist before opening the repository because VS Code may restart this
 * extension host as soon as the workspace changes. Activation resumes the
 * pending request in the reviewed workspace. */
async function prepareNavigation(request, host) {
    if (host.containsSource(request.path))
        return 'ready';
    await host.persistPending(request);
    await host.openRepository(request.repo);
    return 'opening-repository';
}
/** Convert DiffStory's 1-based source location to VS Code's 0-based caret,
 * clamping stale locations to the nearest position the opened file can show. */
function clampNavigationPoint(request, lineCount, lineLengthAt) {
    const line = Math.min(request.line - 1, Math.max(0, lineCount - 1));
    const character = Math.min(request.column - 1, Math.max(0, lineLengthAt(line)));
    return { line, character };
}
//# sourceMappingURL=navigation.js.map