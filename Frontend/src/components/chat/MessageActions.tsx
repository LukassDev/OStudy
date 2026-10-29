import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useThemeColors } from '../../constants/theme';
import { useCopyToClipboard } from '../../hooks/useCopyToClipboard';

interface MessageActionsProps {
  /** Texto completo da mensagem a copiar (sem blocos json_action, já limpo). */
  content: string;
  /** 'tutor' mostra o botão sempre visível por baixo da mensagem; 'user'
   * é pensado para aparecer via long-press (ver onLongPress no bubble). */
  role: 'tutor' | 'user';
  /** Alinhamento do botão — normalmente 'flex-start' para o Oren e
   * 'flex-end' para o utilizador, para acompanhar o lado da bolha. */
  align?: 'flex-start' | 'flex-end';
}

/**
 * Ação de copiar mensagem completa. Para o Oren, mostra-se como um pequeno
 * botão persistente por baixo da resposta (como um "action button"). Para o
 * utilizador, o componente que renderiza a bolha deve chamar `copy(content)`
 * a partir de um onLongPress na própria bolha — este componente exporta o
 * hook para isso, ou pode ser usado standalone da mesma forma.
 *
 * O texto também continua selecionável normalmente (comportamento nativo do
 * <Text selectable> no componente de mensagem), para permitir copiar apenas
 * um excerto em vez da mensagem inteira.
 */
export const MessageActions: React.FC<MessageActionsProps> = ({ content, role, align = 'flex-start' }) => {
  const colors = useThemeColors();
  const { t } = useTranslation();
  const { copied, copy } = useCopyToClipboard();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: align }}>
      <TouchableOpacity
        onPress={() => copy(content)}
        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        style={{
          minWidth: 28,
          height: 28,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        accessibilityLabel={t('chat.copyMessage')}
      >
        <Ionicons
          name={copied ? 'checkmark' : 'copy-outline'}
          size={14}
          color={copied ? '#22C55E' : colors.textTertiary}
        />
        {copied && (
          <Text style={{ fontSize: 11, color: '#22C55E', marginLeft: 4, fontWeight: '600' }}>
            {t('chat.copied')}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
};
