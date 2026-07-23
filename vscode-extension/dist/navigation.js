"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseNavigationQuery = parseNavigationQuery;
const node_path_1 = require("node:path");
function parseNavigationQuery(query) {
    const params = new URLSearchParams(query);
    const path = params.get('path') ?? '';
    const line = Number(params.get('line'));
    const column = Number(params.get('column'));
    if (!path || path.length > 4096 || !(0, node_path_1.isAbsolute)(path) ||
        !Number.isInteger(line) || line < 1 || line > 10_000_000 ||
        !Number.isInteger(column) || column < 1 || column > 10_000_000) {
        return null;
    }
    return { path, line, column };
}
//# sourceMappingURL=navigation.js.map