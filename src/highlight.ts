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

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Highlight one line of code → HTML-escaped string with token spans. */
export function highlight(code: string): string {
  if (!code) return '';
  let out = '';
  RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = RE.exec(code)) !== null) {
    const [tok, comment, str, num, word, ws] = m;
    if (comment !== undefined) out += `<span class="tk-c">${esc(tok)}</span>`;
    else if (str !== undefined) out += `<span class="tk-s">${esc(tok)}</span>`;
    else if (num !== undefined) out += `<span class="tk-n">${esc(tok)}</span>`;
    else if (word !== undefined) {
      // identifiers can't contain HTML-special chars, so no escaping needed
      if (KEYWORDS.has(tok)) out += `<span class="tk-k">${tok}</span>`;
      else if (/^[A-Z]/.test(tok)) out += `<span class="tk-t">${tok}</span>`;
      else if (/^\s*\(/.test(code.slice(RE.lastIndex))) out += `<span class="tk-f">${tok}</span>`;
      else out += tok;
    } else if (ws !== undefined) out += tok;
    else out += esc(tok);
    if (m.index === RE.lastIndex) RE.lastIndex++; // guard against any zero-width match
  }
  return out;
}
