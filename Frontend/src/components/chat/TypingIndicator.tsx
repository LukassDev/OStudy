import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Animated } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useThemeColors, radius } from '../../constants/theme';
import { OrenAvatar } from '../common/OrenAvatar';

export const TypingIndicator: React.FC = () => {
  // StyleSheet.create() não funciona com cores dinâmicas (hook) porque é
  // executado a nível de módulo — convertido para inline styles dentro da
  // função, onde o hook já pode ser chamado.
  const colors = useThemeColors();
  const { t } = useTranslation();
  const pulseAnim = useRef(new Animated.Value(0.3)).current;
  const [phaseIndex, setPhaseIndex] = useState(0);

  // As fases já não vivem hardcoded em português no componente — vêm de
  // chat.typingPhases em locales/*.json (mesmo padrão de getGreeting() em
  // utils/greetings.ts), para seguirem o idioma ativo da UI em vez de
  // aparecerem sempre em pt-PT independentemente da língua do utilizador.
  const phases = (t('chat.typingPhases', { returnObjects: true }) as unknown as string[]) || [];
  const safePhases = Array.isArray(phases) && phases.length > 0 ? phases : [t('common.loading')];

  useEffect(() => {
    // Cada resposta começa num ponto diferente da lista. A partir daí o
    // índice avança circularmente, para o indicador nunca ficar congelado
    // na última frase durante respostas demoradas.
    setPhaseIndex(Math.floor(Math.random() * safePhases.length));
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ])
    );
    animation.start();
    const interval = setInterval(() => {
      setPhaseIndex((prev) => (prev + 1) % safePhases.length);
    }, 1400);
    return () => { animation.stop(); clearInterval(interval); };
    // safePhases.length é estável entre renders (mesmo idioma durante a vida
    // do indicador), por isso não entra nas deps para não reiniciar o timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseAnim]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8, marginHorizontal: 12, alignSelf: 'flex-start' }}>
      <OrenAvatar size={28} />
      <View style={{
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'transparent',
        paddingHorizontal: 14, paddingVertical: 8,
        borderRadius: radius.md, marginLeft: 8,
      }}>
        <Text style={{ fontSize: 13, color: colors.textSecondary, fontWeight: '500' }}>
          · {safePhases[phaseIndex % safePhases.length]}
        </Text>
      </View>
    </View>
  );
};
