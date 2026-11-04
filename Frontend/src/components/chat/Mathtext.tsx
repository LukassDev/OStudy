import React from 'react';
import { View, StyleSheet, TextStyle, Platform } from 'react-native';
import Markdown from 'react-native-markdown-display';

interface MathTextProps {
  content: string;
  isUser: boolean;
  textStyle: TextStyle | TextStyle[];
  boldColor: string;
  formulaColor: string;
}

// Plain messages keep the lightweight native Markdown renderer.
function MathText({ content, isUser, textStyle, boldColor, formulaColor }: MathTextProps) {
  if (!content) return null;

  const flatTextStyle = StyleSheet.flatten(textStyle) as TextStyle;
  const baseColor = flatTextStyle.color as string;
  const baseFontSize = (flatTextStyle.fontSize as number) || 15.5;
  const isWeb = Platform.OS === 'web';
  const webLineHeight = Math.max(flatTextStyle.lineHeight || 0, baseFontSize * 1.7);
  // Quando o corpo da mensagem usa Inter, as ênfases e títulos internos usam
  // Inter bold para manter o conteúdo coeso e "editorial". Para corpos DM
  // Sans mantém-se o DM Sans bold (identidade dos elementos de UI).
  const isInterBody = (flatTextStyle.fontFamily || '').startsWith('Inter');
  const boldFont = isInterBody ? 'Inter_700Bold' : 'DMSans_700Bold';

  if (/\$|\\(?:[a-zA-Z]+|[([])/.test(content)) {
    const MathRichText = require('./MathRichText').default;
    return <MathRichText content={content} color={baseColor} formulaColor={formulaColor}
      boldColor={boldColor} fontSize={baseFontSize} lineHeight={webLineHeight} />;
  }

  const markdownStyles = {
    body: { color: baseColor, fontSize: baseFontSize, fontFamily: flatTextStyle.fontFamily as string, lineHeight: webLineHeight },
    paragraph: { marginTop: 0, marginBottom: isWeb ? 16 : 12 },
    heading1: { color: baseColor, fontSize: baseFontSize + 6, fontFamily: boldFont, marginTop: 4, marginBottom: 6 },
    heading2: { color: baseColor, fontSize: baseFontSize + 4, fontFamily: boldFont, marginTop: 4, marginBottom: 6 },
    heading3: { color: baseColor, fontSize: baseFontSize + 2, fontFamily: boldFont, marginTop: 4, marginBottom: 4 },
    strong: { fontFamily: boldFont, fontWeight: 'bold' as const, color: boldColor },
    em: { fontStyle: 'italic' as const, color: baseColor },
    bullet_list: { marginBottom: isWeb ? 16 : 12 },
    ordered_list: { marginBottom: isWeb ? 16 : 12 },
    list_item: { marginBottom: isWeb ? 8 : 6, flexDirection: 'row' as const },
    code_inline: {
      backgroundColor: isUser ? 'rgba(255,255,255,0.2)' : 'rgba(127,127,127,0.15)',
      color: baseColor,
      paddingHorizontal: 4,
      borderRadius: 4,
      fontFamily: 'monospace',
      borderWidth: 0, padding: 0, paddingVertical: 0, fontSize: baseFontSize - 2, lineHeight: webLineHeight,
    },
    code_block: {
      backgroundColor: isUser ? 'rgba(255,255,255,0.15)' : 'rgba(127,127,127,0.12)',
      color: baseColor,
      padding: 10,
      borderRadius: 8,
      fontFamily: 'monospace',
      fontSize: baseFontSize - 1,
      borderWidth: 0, lineHeight: 24, marginVertical: 12,
    },
    fence: {
      backgroundColor: isUser ? 'rgba(255,255,255,0.15)' : 'rgba(127,127,127,0.12)',
      color: baseColor,
      padding: 10,
      borderRadius: 8,
      fontFamily: 'monospace',
      fontSize: baseFontSize - 1,
      borderWidth: 0, lineHeight: 24, marginVertical: 12,
    },
    blockquote: {
      backgroundColor: isUser ? 'rgba(255,255,255,0.12)' : 'rgba(127,127,127,0.1)',
      borderLeftWidth: 3,
      borderLeftColor: baseColor,
      paddingHorizontal: 10,
      paddingVertical: 4,
      marginVertical: 4,
    },
    link: { color: baseColor, textDecorationLine: 'underline' as const },
    hr: { backgroundColor: isUser ? 'rgba(255,255,255,0.3)' : 'rgba(127,127,127,0.3)', height: 1, marginVertical: 8 },
    table: { borderWidth: 1, borderColor: isUser ? 'rgba(255,255,255,0.3)' : 'rgba(127,127,127,0.3)', marginVertical: 4 },
    th: { padding: 6, fontFamily: boldFont, color: baseColor },
    td: { padding: 6, color: baseColor },
  };

  return (
    <View style={styles.container}>
      <Markdown style={markdownStyles as any}>{content}</Markdown>
    </View>
  );
}

export default React.memo(MathText, (previous, next) => {
  const previousStyle = StyleSheet.flatten(previous.textStyle) as TextStyle;
  const nextStyle = StyleSheet.flatten(next.textStyle) as TextStyle;
  return previous.content === next.content
    && previous.isUser === next.isUser
    && previous.boldColor === next.boldColor
    && previous.formulaColor === next.formulaColor
    && previousStyle.color === nextStyle.color
    && previousStyle.fontFamily === nextStyle.fontFamily
    && previousStyle.fontSize === nextStyle.fontSize
    && previousStyle.lineHeight === nextStyle.lineHeight;
});

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
});
