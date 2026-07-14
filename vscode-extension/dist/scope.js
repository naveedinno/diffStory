"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.scopeLabel = scopeLabel;
exports.isReviewScope = isReviewScope;
function scopeLabel(base, head) {
    return head ? `${shortRef(base)} → ${shortRef(head)}` : `${shortRef(base)} → working tree`;
}
function isReviewScope(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
    const scope = value;
    return typeof scope.label === 'string'
        && (scope.base === undefined || typeof scope.base === 'string')
        && (scope.head === undefined || typeof scope.head === 'string');
}
function shortRef(ref) {
    return /^[a-f0-9]{40}$/i.test(ref) ? ref.slice(0, 8) : ref;
}
//# sourceMappingURL=scope.js.map