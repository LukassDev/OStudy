import React, { useMemo } from 'react';
import MathDocument from './MathDocument';
import { renderMathMarkdown } from './mathMarkdown';
import { mathCss, MathAppearance } from './mathHtml';

export default function MathRichText({ content, color, formulaColor, boldColor, fontSize, lineHeight }: MathAppearance & { content: string }) {
  const body = useMemo(() => renderMathMarkdown(content), [content]);
  const css = useMemo(() => mathCss({ color, formulaColor, boldColor, fontSize, lineHeight }), [color, formulaColor, boldColor, fontSize, lineHeight]);
  return <MathDocument body={body} css={css} />;
}
