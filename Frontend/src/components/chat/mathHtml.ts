import katexStyles from './katexStyles.generated';
import { renderFormula } from './mathMarkdown';

export interface MathAppearance { color: string; formulaColor?: string; boldColor?: string; fontSize?: number; lineHeight?: number; }
const safeColor = (value?: string) => value && /^(#[0-9a-f]{3,8}|rgba?\([\d.,%\s]+\)|[a-z]+)$/i.test(value) ? value : 'inherit';
export function mathCss(appearance: MathAppearance): string {
  const size = Math.max(10, Math.min(48, appearance.fontSize || 16));
  const line = Math.max(size * 1.5, Math.min(96, appearance.lineHeight || size * 1.7));
  return `
.ostudy-math-message{color:${safeColor(appearance.color)};font: ${size}px/${line}px Arial,sans-serif;overflow-wrap:anywhere;min-width:0;width:100%;}
.ostudy-math-message p{margin:0 0 12px}.ostudy-math-message>:last-child{margin-bottom:0}
.ostudy-math-message strong{color:${safeColor(appearance.boldColor)};font-weight:700}
.ostudy-math-message .math-inline,.ostudy-math-message .math-display{color:${safeColor(appearance.formulaColor || appearance.color)}}
.ostudy-math-message .math-display{display:block;overflow-x:auto;max-width:100%;padding:4px 0;margin:8px 0}
.ostudy-math-message .katex-display{margin:0;text-align:left}
.ostudy-math-message .katex-display>.katex{text-align:left}
.ostudy-math-message .math-inline{display:inline-block;max-width:100%;overflow-x:auto;vertical-align:middle;padding:3px 0}
.ostudy-math-message .math-fallback{white-space:pre-wrap;overflow-wrap:anywhere}
.ostudy-math-message pre{overflow-x:auto;background:#8882;padding:10px;border-radius:8px}
.ostudy-math-message pre code{white-space:pre}.ostudy-math-message code{font-size:.9em}
.ostudy-math-message blockquote{border-left:3px solid #8886;margin:8px 0;padding:4px 12px;background:#8881}
.ostudy-math-message ul,.ostudy-math-message ol{padding-left:26px;margin:8px 0 12px}
.ostudy-math-message li{margin-bottom:6px}.ostudy-math-message li p{margin-bottom:4px}
.ostudy-math-message table{display:block;overflow-x:auto;border-collapse:collapse;max-width:100%}
.ostudy-math-message td,.ostudy-math-message th{padding:6px;border:1px solid #8886}
.ostudy-math-message a{color:inherit;text-decoration:underline}
.ostudy-math-message h1,.ostudy-math-message h2,.ostudy-math-message h3{line-height:1.4;margin:8px 0}
`;
}
export function documentHtml(body: string, css: string): string {
  return `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src data:; script-src 'unsafe-inline';"><style>html,body{margin:0;padding:0;background:transparent;} ${katexStyles} ${css}</style></head>
<body><div id="message" class="ostudy-math-message">${body}</div><script>
(function(){var node=document.getElementById('message');var last=0;
function report(){var height=Math.ceil(node.getBoundingClientRect().height)+4;if(height===last)return;last=height;
if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage(JSON.stringify({type:'ostudy-math-height',height:height}));}
if(typeof ResizeObserver!=='undefined')new ResizeObserver(report).observe(node);
window.addEventListener('resize',report);if(document.fonts)document.fonts.ready.then(report);report();
})();</script></body></html>`;
}
export function buildHtml(latex: string, displayMode: boolean, color: string): string {
  return documentHtml(renderFormula(latex, displayMode), mathCss({ color }));
}
