import React, { useId } from 'react';
import katexStyles from './katexStyles.generated';

// Browser DOM, never react-native-webview. HTML is produced by MarkdownIt
// (raw HTML disabled) and KaTeX (trust:false); user text is never injected raw.
export default function MathDocument({ body, css }: { body: string; css: string }) {
  const id = 'math-' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return <div id={id} style={{ width: '100%', minWidth: 0 }}>
    <style href="ostudy-katex" precedence="default">{katexStyles}</style>
    <style>{css.replace(/\.ostudy-math-message/g, `#${id} .ostudy-math-message`)}</style>
    <div className="ostudy-math-message" dangerouslySetInnerHTML={{ __html: body }} />
  </div>;
}
