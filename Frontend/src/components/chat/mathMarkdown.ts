import MarkdownIt from 'markdown-it';
import katex from 'katex';

export const hasMath = (text: string) => /\$|\\(?:[a-zA-Z]+|[([])/.test(text);
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function renderFormula(latex: string, displayMode: boolean): string {
  try {
    // Each equation gets its own macro scope; tutor content cannot create links/HTML.
    return katex.renderToString(latex, {
      displayMode, throwOnError: true, trust: false, strict: 'ignore',
      maxExpand: 200, maxSize: 20, output: 'htmlAndMathml', macros: {},
    });
  } catch {
    // Preserve unsupported/incomplete expressions, including during streaming.
    return `<code class="math-fallback">${escapeHtml(latex)}</code>`;
  }
}

type Formula = { end: number; latex: string; display: boolean };
function closing(source: string, delimiter: string, from: number) {
  for (let at = source.indexOf(delimiter, from); at >= 0; at = source.indexOf(delimiter, at + delimiter.length)) {
    let slashes = 0;
    for (let i = at - 1; i >= 0 && source[i] === '\\'; i--) slashes++;
    if (slashes % 2 === 0) return at;
  }
  return -1;
}

// Recover unambiguous bare commands without consuming the surrounding prose.
function bareEnd(source: string, at: number): number {
  const command = /^\\(?:dfrac|tfrac|frac|sqrt|binom|vec|hat|bar|overline|underline|text|mathrm|mathbf|mathbb|mathcal|operatorname)\b/.exec(source.slice(at));
  if (!command) return at;
  let end = at + command[0].length;
  let groups = 0;
  while (end < source.length) {
    const next = /^\s*(\{|\[)/.exec(source.slice(end));
    if (!next) break;
    const opener = next[1], closer = opener === '{' ? '}' : ']';
    let depth = 1, i = end + next[0].length;
    for (; i < source.length && depth; i++) {
      if (source[i] === '\\') { i++; continue; }
      if (source[i] === opener) depth++;
      if (source[i] === closer) depth--;
    }
    if (depth) return at;
    end = i; groups++;
  }
  return groups ? end : at;
}

function formulaAt(source: string, at: number): Formula | null {
  const tail = source.slice(at);
  for (const [open, close, display] of [['$$', '$$', true], ['\\[', '\\]', true], ['\\(', '\\)', false], ['$', '$', false]] as const) {
    if (!tail.startsWith(open)) continue;
    const start = at + open.length;
    if (open === '$' && (/\s/.test(source[start] || '') || source[start] === '$')) return null;
    const end = closing(source, close, start);
    if (end < 0 || end === start) return null;
    const latex = source.slice(start, end);
    // Dollar amounts in prose are not equations. Explicit $5$ still is.
    if (open === '$' && (/\s$/.test(latex) || /^\d/.test(source[end + 1] || '') || latex.includes('\n'))) return null;
    return { end: end + close.length, latex, display };
  }
  const env = /^\\begin\{(equation\*?|align\*?|aligned|gather\*?|gathered|cases|[pbBvV]?matrix|smallmatrix|array|split)\}/.exec(tail);
  if (env) {
    const endTag = `\\end{${env[1]}}`;
    const end = source.indexOf(endTag, at + env[0].length);
    if (end >= 0) return { end: end + endTag.length, latex: source.slice(at, end + endTag.length), display: true };
  }
  const end = bareEnd(source, at);
  return end > at ? { end, latex: source.slice(at, end), display: false } : null;
}

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });
// Code spans/fences retain literal LaTeX. Run before escape handling for \(...\).
md.inline.ruler.before('escape', 'oren_math', (state, silent) => {
  const match = formulaAt(state.src, state.pos);
  if (!match) return false;
  if (!silent) {
    const token = state.push('oren_math', '', 0);
    token.content = match.latex;
    token.meta = { display: match.display };
  }
  state.pos = match.end;
  return true;
});
md.block.ruler.before('fence', 'oren_math_block', (state, startLine, endLine, silent) => {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  if (state.sCount[startLine] - state.blkIndent >= 4) return false;
  const match = formulaAt(state.src, start);
  if (!match?.display) return false;
  let last = startLine;
  while (last < endLine && state.eMarks[last] < match.end) last++;
  if (last >= endLine || state.src.slice(match.end, state.eMarks[last]).trim()) return false;
  if (silent) return true;
  const token = state.push('oren_math', '', 0);
  token.content = match.latex; token.meta = { display: true }; token.block = true;
  token.map = [startLine, last + 1]; state.line = last + 1;
  return true;
}, { alt: ['paragraph', 'reference', 'blockquote', 'list'] });
md.renderer.rules.oren_math = (tokens, index) => {
  const token = tokens[index];
  return `<span class="${token.meta.display ? 'math-display' : 'math-inline'}">${renderFormula(token.content, token.meta.display)}</span>`;
};
// Images from tutor text must not initiate remote requests in the renderer.
md.renderer.rules.image = (tokens, index) => escapeHtml(tokens[index].content);
const originalLink = md.renderer.rules.link_open;
md.renderer.rules.link_open = (tokens, index, options, env, self) => {
  tokens[index].attrSet('target', '_blank'); tokens[index].attrSet('rel', 'noopener noreferrer');
  return originalLink ? originalLink(tokens, index, options, env, self) : self.renderToken(tokens, index, options);
};
export const renderMathMarkdown = (content: string) => md.render(content);
