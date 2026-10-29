const LATEX_SUPERSCRIPT: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶',
  '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻', 'n': 'ⁿ', 'x': 'ˣ',
};
const LATEX_SUBSCRIPT: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆',
  '7': '₇', '8': '₈', '9': '₉', 'n': 'ₙ', 'x': 'ₓ', '+': '₊', '-': '₋',
};
const LATEX_FRACTIONS: Record<string, string> = {
  '1/2': '½', '1/3': '⅓', '2/3': '⅔', '1/4': '¼', '3/4': '¾',
  '1/5': '⅕', '1/6': '⅙', '1/8': '⅛',
};

function toScriptChars(text: string, map: Record<string, string>): string {
  return text.split('').map((c) => map[c] || c).join('');
}

function latexInlineToUnicode(input: string): string {
  let text = input;

  text = convertFractions(text);

  text = text.replace(/\^\{([^{}]+)\}/g, (_m, exp) => toScriptChars(exp, LATEX_SUPERSCRIPT));
  text = text.replace(/\^([a-zA-Z0-9+-])/g, (_m, exp) => toScriptChars(exp, LATEX_SUPERSCRIPT));
  text = text.replace(/_\{([^{}]+)\}/g, (_m, sub) => toScriptChars(sub, LATEX_SUBSCRIPT));
  text = text.replace(/_([a-zA-Z0-9])/g, (_m, sub) => toScriptChars(sub, LATEX_SUBSCRIPT));

  text = text.replace(/\\sqrt\{([^{}]+)\}/g, (_m, a) => `√(${a})`);
  text = text.replace(/\\times/g, '×');
  text = text.replace(/\\div/g, '÷');
  text = text.replace(/\\pm/g, '±');
  text = text.replace(/\\cdot/g, '·');
  text = text.replace(/\\le/g, '≤');
  text = text.replace(/\\ge/g, '≥');
  text = text.replace(/\\ne/g, '≠');
  text = text.replace(/\\infty/g, '∞');
  text = text.replace(/\\pi/g, 'π');
  text = text.replace(/\\alpha/g, 'α');
  text = text.replace(/\\beta/g, 'β');
  text = text.replace(/\\theta/g, 'θ');

  return text.trim();
}

// Preserve grouping: (a+b)/(c-d), never the ambiguous a+b/c-d.
export function convertFractions(input: string): string {
  let text = input;
  for (let depth = 0; depth < 16; depth++) {
    const unwrapped = text.replace(/\\(?:text|mathrm|mathbf)\s*\{([^{}]*)\}/g, '$1');
    const next = unwrapped.replace(/\\(?:dfrac|tfrac|frac)\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g, (_m, a, b) => {
      const key = a.trim() + '/' + b.trim();
      return LATEX_FRACTIONS[key] || '(' + a + ')/(' + b + ')';
    });
    if (next === text) break;
    text = next;
  }
  return text;
}
export type Segment = { type: 'markdown' | 'math'; value: string };
export function parseBlocks(content: string): Segment[] {
  const segments: Segment[] = [];
  let markdown = '';
  // Protect code before considering math delimiters.
  const tokens = /(```[\s\S]*?(?:```|$)|`[^`\n]*`|\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\]|\\\([^\n]*?\\\)|(?<!\\)\$[^$\n]+?\$)/g;
  let end = 0;
  let match: RegExpExecArray | null;
  while ((match = tokens.exec(content))) {
    markdown += convertFractions(content.slice(end, match.index));
    const token = match[0];
    if (token.startsWith('`')) markdown += token;
    else if (token.startsWith('$$') || token.startsWith('\\[')) {
      if (markdown) segments.push({ type: 'markdown', value: markdown });
      markdown = '';
      segments.push({ type: 'math', value: token.slice(2, -2).trim() });
    } else {
      const expr = token.startsWith('\\(') ? token.slice(2, -2) : token.slice(1, -1);
      markdown += latexInlineToUnicode(expr);
    }
    end = tokens.lastIndex;
  }
  markdown += convertFractions(content.slice(end));
  if (markdown) segments.push({ type: 'markdown', value: markdown });
  return segments;
}
