const fs = require('node:fs');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const assert = require('node:assert/strict');
const { renderMathMarkdown, renderFormula } = require('../src/components/chat/mathMarkdown.ts');
const { buildHtml, mathCss } = require('../src/components/chat/mathHtml.ts');
const formulas = [
  String.raw`Tm = \dfrac{f(b)-f(a)}{b-a}`,
  String.raw`\frac{\text{salário mensal}}{\text{horas semanais}}`,
  String.raw`\frac{1+\frac{x}{y}}{\sqrt[3]{x^2+1}}`,
  String.raw`\int_0^\infty e^{-x^2}\,dx=\frac{\sqrt\pi}{2}`,
  String.raw`\sum_{n=1}^{\infty}\frac1{n^2}=\frac{\pi^2}{6}`,
  String.raw`\lim_{x\to0}\frac{\sin x}{x}=1`,
  String.raw`\begin{pmatrix}a&b\\c&d\end{pmatrix}`,
  String.raw`f(x)=\begin{cases}x^2&x\ge0\\-x&x<0\end{cases}`,
  String.raw`\begin{aligned}a&=b+c\\d&=e-f\end{aligned}`,
  String.raw`\begin{align}a&=b+c\\d&=e-f\end{align}`,
  String.raw`\left\langle\vec u,\vec v\right\rangle=\sum_i u_i v_i`,
  String.raw`\mathbb{R}\subseteq\mathbb{C},\quad P(A\mid B)=\frac{P(A\cap B)}{P(B)}`,
  String.raw`\frac{\partial^2 f}{\partial x^2}+\nabla\cdot\mathbf{F}`,
  String.raw`\underbrace{1+\cdots+1}_{n}=n,\quad\binom{n}{k}=\frac{n!}{k!(n-k)!}`,
];
for (const latex of formulas) {
  for (const wrap of [x => '$$'+x+'$$', x => '\\['+x+'\\]']) {
    const html = renderMathMarkdown(wrap(latex));
    assert(html.includes('class="katex"'), latex);
    assert(!html.includes('math-fallback'), latex);
    assert(html.includes('<math'), 'Accessible MathML');
  }
}
for (const wrap of [x => '$'+x+'$', x => '\\('+x+'\\)']) {
  assert(renderMathMarkdown('Antes '+wrap(formulas[0])+' depois').includes('math-inline'));
}
for (const latex of formulas.slice(0,3)) assert(renderMathMarkdown(latex).includes('class="katex"'), 'Bare fractions');
for (const text of ['Preço $5 e $10.', 'Custa $5.99 ou $59.99.', String.raw`\$5`, '`'+formulas[0]+'`', '```latex\n'+formulas[0]+'\n```', '    '+formulas[0]]) {
  assert(!renderMathMarkdown(text).includes('class="katex"'), 'Preserve code/currency: '+text);
}
assert(renderMathMarkdown('1. Fórmula $x^2$ e texto\n2. Próxima').includes('<ol>'));
assert(renderMathMarkdown('$$\na^2+b^2=c^2\n\n$$').includes('class="katex"'));
assert(renderMathMarkdown(formulas[6]).includes('class="katex"'));
assert(renderMathMarkdown('$\\unknownCommand{x}$').includes('math-fallback'));
assert(!renderMathMarkdown('<img src=x onerror=alert(1)>').includes('<img'));
assert(!renderMathMarkdown('![x](https://example.com/x)').includes('<img'));
assert(!renderMathMarkdown('[x](javascript:alert(1))').includes('href="javascript:'));
assert(!renderFormula(String.raw`\href{javascript:alert(1)}{x}`, false).includes('href='));
assert(!renderFormula(String.raw`\htmlStyle{position:fixed}{x}`, false).includes('style="position:fixed'));
const html = buildHtml('</script><script>alert(1)</script>', true, '#222');
assert(!html.includes('</script><script>alert(1)'));
assert(!html.includes('cdn.jsdelivr'));
assert(!/<(?:script|link)[^>]+(?:src|href)=/.test(html));
assert(html.includes('data:font/woff2;base64,'));
assert(!mathCss({color:'red;}body{display:none'}).includes('body{display:none'));
console.log(`Passed: ${formulas.length} formula families, delimiters, bare/nested fractions, Markdown/code/currency isolation, safe fallback, injection protection and offline fonts.`);
