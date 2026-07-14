export interface ReviewScope {
  base?: string;
  head?: string;
  label: string;
}

export function scopeLabel(base: string, head?: string): string {
  return head ? `${shortRef(base)} → ${shortRef(head)}` : `${shortRef(base)} → working tree`;
}

export function isReviewScope(value: unknown): value is ReviewScope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const scope = value as Record<string, unknown>;
  return typeof scope.label === 'string'
    && (scope.base === undefined || typeof scope.base === 'string')
    && (scope.head === undefined || typeof scope.head === 'string');
}

function shortRef(ref: string): string {
  return /^[a-f0-9]{40}$/i.test(ref) ? ref.slice(0, 8) : ref;
}
