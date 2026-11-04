import React, { useMemo } from 'react';
import MathDocument from './MathDocument';
import { renderFormula } from './mathMarkdown';
import { mathCss } from './mathHtml';
export default function MathFormula({ latex, displayMode, color }: { latex: string; displayMode: boolean; color: string }) {
  const body = useMemo(() => '<span class="' + (displayMode ? 'math-display' : 'math-inline') + '">' + renderFormula(latex, displayMode) + '</span>', [latex, displayMode]);
  const css = useMemo(() => mathCss({ color }), [color]);
  return <MathDocument body={body} css={css} />;
}
