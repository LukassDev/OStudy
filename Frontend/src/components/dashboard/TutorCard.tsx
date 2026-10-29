import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { OrenLogo } from '../common/OrenLogo';

interface TutorCardProps {
  message: string;
  title?: string;
  headerIcon?: keyof typeof Ionicons.glyphMap;
  ctaLabel?: string;
  onPressCta?: () => void;
}

export function TutorCard({ message, ctaLabel, onPressCta, title, headerIcon }: TutorCardProps) {
  const { t } = useTranslation();

  return (
    <View className="bg-primary rounded-[18px] px-5 py-4 mb-6 border border-white/10 shadow-sm">
      
      {/* Cabeçalho com mini-avatar do ícone */}
      <View className="flex-row items-center mb-3">
        <View className="bg-white/10 w-7 h-7 rounded-full items-center justify-center mr-2">
          {headerIcon ? <Ionicons name={headerIcon} size={20} color="#fff" /> : <OrenLogo size={32} />}
        </View>
        <Text className="text-white text-base leading-6">
          {title || t('dashboard.orenSays')}
        </Text>
      </View>
      
      {/* Mensagem Principal */}
      <Text className="text-white text-base leading-6 mb-4">
        {message}
      </Text>
      
      {/* Botão de Call-to-Action polido */}
      {ctaLabel && onPressCta ? (
        <TouchableOpacity
          activeOpacity={0.8}
          className="self-start bg-white/15 rounded-full py-2 px-4 flex-row items-center border border-white/10"
          onPress={onPressCta}
        >
          <Text className="text-white font-semibold text-sm mr-2">{ctaLabel}</Text>
          <Ionicons name="arrow-forward" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
      
    </View>
  );
}