// Pure helpers for reporting Mermaid parse failures inside concept steps.
//
// The engine imports these; node tests import them too. They never touch the
// DOM: the engine builds the error box from their answers with textContent,
// so neither the parser's message nor the author's source can become markup.
var LINE_REF = /\bline (\d+)\b/i;

/**
 * The one-line message to show: the parser's first non-empty line, capped so
 * a pathological error cannot flood the step. Never empty.
 */
export function diagramErrorSummary(error) {
  var message = '';
  if (typeof error === 'string') message = error;
  else if (error && typeof error.message === 'string') message = error.message;
  var first = '';
  var lines = message.split('\n');
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line) {
      first = line;
      break;
    }
  }
  if (!first) first = 'The diagram source could not be parsed.';
  if (first.length > 280) first = first.slice(0, 277) + '…';
  return first;
}

/**
 * The offending source line, when the parser names one that exists.
 * Returns `{ line, text }` (1-based) or null.
 */
export function diagramErrorLine(message, source) {
  var match = LINE_REF.exec(String(message || ''));
  if (!match) return null;
  var line = parseInt(match[1], 10);
  if (!Number.isFinite(line) || line < 1) return null;
  var lines = String(source || '').split('\n');
  if (line > lines.length) return null;
  return { line: line, text: lines[line - 1] };
}
