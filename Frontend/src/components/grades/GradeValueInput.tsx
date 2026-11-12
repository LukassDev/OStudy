import React from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { qualitativeScore, qualitativeTypes, type QualitativeGrade } from '../../utils/gradeAverages';

export function GradeValueInput({ label, value, qualitative, maxScore = 20, disabled = false, onChange, onQualitativeChange }: {
  label: string;
  value: string;
  qualitative: QualitativeGrade | null;
  maxScore?: number;
  disabled?: boolean;
  onChange: (value: string) => void;
  onQualitativeChange: (value: QualitativeGrade | null) => void;
}) {
  const { t } = useTranslation();
  const maximum = Number.isFinite(maxScore) && maxScore > 0 ? maxScore : 20;
  const choose = (type: QualitativeGrade) => {
    onQualitativeChange(type);
    onChange(String(qualitativeScore(type, maximum)));
  };
  return <View style={{ gap: 8 }}>
    <Text className="text-textSecondary text-xs">{label}</Text>
    <View className="flex-row flex-wrap" style={{ gap: 6 }}>
      {(['numeric', 'qualitative'] as const).map(mode => <TouchableOpacity key={mode} disabled={disabled}
        accessibilityRole="button" accessibilityLabel={`${label}: ${t(`grades.qualitative.${mode}`)}`}
        accessibilityState={{ selected: mode === 'qualitative' ? qualitative !== null : qualitative === null }}
        onPress={() => mode === 'numeric' ? onQualitativeChange(null) : choose(qualitative ?? 'sufficient')}
        className={`rounded-xl px-3 py-2 ${(mode === 'qualitative') === (qualitative !== null) ? 'bg-border' : 'bg-surface'}`}>
        <Text className="text-textPrimary text-xs">{t(`grades.qualitative.${mode}`)}</Text>
      </TouchableOpacity>)}
    </View>
    {qualitative === null ? <TextInput accessibilityLabel={label} value={value} onChangeText={onChange}
      keyboardType="decimal-pad" editable={!disabled} className="bg-surface rounded-xl px-4 py-3 text-textPrimary text-base" />
      : <View className="flex-row flex-wrap" style={{ gap: 6 }}>
          {qualitativeTypes.map(type => <TouchableOpacity key={type} disabled={disabled} accessibilityRole="button"
            accessibilityState={{ selected: qualitative === type }} onPress={() => choose(type)}
            className={`rounded-xl px-3 py-2 ${qualitative === type ? 'bg-border' : 'bg-surface'}`}>
            <Text className="text-textPrimary text-sm">{t(`grades.qualitative.labels.${type}`)}</Text>
          </TouchableOpacity>)}
        </View>}
  </View>;
}
