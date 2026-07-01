// Minimal, zero-dependency syntax highlighting for the diff viewer. It's a
// per-line, regex-based tokenizer for C-like languages (TypeScript / JavaScript /
// Solidity) — not a full parser, but enough to make code readable. Output is
// HTML-escaped with <span class="tk-*"> wrappers, so it drops straight into the
// server-rendered diff (same trust model as the rest of the page).

const KEYWORDS = new Set([
  // JS / TS
  'abstract', 'any', 'as', 'async', 'await', 'boolean', 'break', 'case', 'catch', 'class',
  'const', 'continue', 'debugger', 'declare', 'default', 'delete', 'do', 'else', 'enum',
  'export', 'extends', 'false', 'finally', 'for', 'from', 'function', 'get', 'if', 'implements',
  'import', 'in', 'instanceof', 'interface', 'is', 'keyof', 'let', 'namespace', 'new', 'null',
  'of', 'private', 'protected', 'public', 'readonly', 'return', 'satisfies', 'set', 'static',
  'super', 'switch', 'this', 'throw', 'true', 'try', 'type', 'typeof', 'undefined', 'var',
  'void', 'while', 'yield',
  // Solidity
  'address', 'assembly', 'bool', 'bytes', 'calldata', 'constructor', 'contract', 'emit', 'event',
  'external', 'immutable', 'indexed', 'internal', 'library', 'mapping', 'memory', 'modifier',
  'override', 'payable', 'pragma', 'pure', 'require', 'returns', 'revert', 'storage', 'struct',
  'uint', 'uint256', 'int', 'int256', 'unchecked', 'using', 'view', 'virtual',
]);

// comment | string | number | identifier | whitespace | any-single-char
const RE =
  /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"?|'(?:[^'\\]|\\.)*'?|`(?:[^`\\]|\\.)*`?)|(0[xX][0-9a-fA-F_]+|\d[\d_]*(?:\.\d+)?(?:[eE][+-]?\d+)?)|([A-Za-z_$][\w$]*)|(\s+)|([\s\S])/g;

export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** One lexed piece of a line: its raw text and syntax class (null = plain). */
export interface Token {
  text: string;
  /** `tk-*` class, or null for identifiers/whitespace/operators with no color. */
  cls: string | null;
}

/**
 * Lex one line into tokens. This is the single source of truth for how a line is
 * broken up; highlight() renders these, and intra-line.ts diffs them so word-level
 * change marks land on the same boundaries as the syntax colors.
 */
export function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  if (!code) return tokens;
  RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(code)) !== null) {
    const [tok, comment, str, num, word] = m;
    let cls: string | null = null;
    if (comment !== undefined) cls = 'tk-c';
    else if (str !== undefined) cls = 'tk-s';
    else if (num !== undefined) cls = 'tk-n';
    else if (word !== undefined) {
      if (KEYWORDS.has(tok)) cls = 'tk-k';
      else if (/^[A-Z]/.test(tok)) cls = 'tk-t';
      else if (/^\s*\(/.test(code.slice(RE.lastIndex))) cls = 'tk-f';
      // else: plain identifier — cls stays null
    }
    // whitespace and lone operator chars also stay null
    tokens.push({ text: tok, cls });
    if (m.index === RE.lastIndex) RE.lastIndex++; // guard against any zero-width match
  }
  return tokens;
}

/**
 * Render one token to HTML. esc() is a no-op on the previously-unescaped cases
 * (identifiers, keywords, whitespace), so escaping uniformly here reproduces the
 * old highlight() output byte-for-byte while staying safe for comments/strings.
 */
export function renderToken(t: Token, changed = false): string {
  const cls = changed ? (t.cls ? `${t.cls} changed` : 'changed') : t.cls;
  return cls ? `<span class="${cls}">${esc(t.text)}</span>` : esc(t.text);
}

/** Highlight one line of code → HTML-escaped string with token spans. */
export function highlight(code: string): string {
  if (!code) return '';
  let out = '';
  for (const t of tokenize(code)) out += renderToken(t);
  return out;
}
