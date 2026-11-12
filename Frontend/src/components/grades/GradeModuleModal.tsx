import React, { useEffect, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { createId } from '../../db/ids';
import { useGradesStore } from '../../stores/gradesStore';
import { criterionTypes, moduleCriterionTypes, criterionLabelKey, defaultGradeCriteria, validGradeCriteria, qualitativeScore, type GradeModule, type CriterionType, type QualitativeGrade } from '../../utils/gradeAverages';
import { GradeValueInput } from './GradeValueInput';
import { KeyboardAwareModal } from '../ui/KeyboardAwareModal';
import { Button } from '../ui/Button';
import { useThemeColors } from '../../constants/theme';

export function GradeModuleModal({ visible, spaceId, editing, template, onClose, onSaved }: {
  visible: boolean;
  spaceId: string;
  editing: GradeModule | null;
  template?: GradeModule;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { t } = useTranslation();
  const colors = useThemeColors();
  const saveModule = useGradesStore(state => state.saveModule);
  const [name, setName] = useState('');
  const [weights, setWeights] = useState<Record<CriterionType, string>>({} as Record<CriterionType, string>);
  const [behavior, setBehavior] = useState('');
  const [participation, setParticipation] = useState('');
  const [behaviorQualitative, setBehaviorQualitative] = useState<QualitativeGrade | null>(null);
  const [participationQualitative, setParticipationQualitative] = useState<QualitativeGrade | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [criteriaExpanded, setCriteriaExpanded] = useState(false);
  const [grouped, setGrouped] = useState(true);
  useEffect(() => {
    if (!visible) return;
    setName(editing?.name ?? '');
    const criteria = editing?.criteria ?? (template?.criteria.grouped ? template.criteria : defaultGradeCriteria);
    setGrouped(criteria.grouped === true);
    setWeights(Object.fromEntries(criterionTypes.map(type => [type, String(criteria[type])])) as Record<CriterionType, string>);
    setBehavior(editing?.behavior_score == null ? '' : String(editing.behavior_score));
    setParticipation(editing?.participation_score == null ? '' : String(editing.participation_score));
    setBehaviorQualitative(editing?.behavior_qualitative ?? null);
    setParticipationQualitative(editing?.participation_qualitative ?? null);
    setError('');
    setCriteriaExpanded(false);
  }, [visible, editing, template]);
  const parse = (value: string) => value.trim() ? Number(value.replace(',', '.')) : NaN;
  const save = async () => {
    const criteria = { ...Object.fromEntries(criterionTypes.map(type => [type, parse(weights[type])])), grouped } as GradeModule['criteria'];
    const behaviorScore = behaviorQualitative ? qualitativeScore(behaviorQualitative) : behavior.trim() ? parse(behavior) : null;
    const participationScore = participationQualitative ? qualitativeScore(participationQualitative) : participation.trim() ? parse(participation) : null;
    const invalidCriteria = !validGradeCriteria(criteria);
    const invalidAttitudes = [behaviorScore, participationScore].some(value => value !== null && (!Number.isFinite(value) || value < 0 || value > 20));
    if (!name.trim() || invalidCriteria || invalidAttitudes) {
      if (invalidCriteria || invalidAttitudes) setCriteriaExpanded(true);
      setError(t('grades.modules.invalid')); return;
    }
    setSaving(true); setError('');
    try {
      const id = editing?.id ?? createId();
      await saveModule({ id, space_id: spaceId, name: name.trim(), criteria, behavior_score: behaviorScore, participation_score: participationScore,
        behavior_qualitative: behaviorQualitative, participation_qualitative: participationQualitative });
      onSaved(id); onClose();
    } catch {
      setError(t('grades.modal.errors.saveFailed'));
    } finally { setSaving(false); }
  };
  return <KeyboardAwareModal visible={visible} onRequestClose={() => { if (!saving) onClose(); }}>
    <View className="bg-background p-6">
      <Text className="text-lg font-bold text-textPrimary mb-4">{t(editing ? 'grades.modules.edit' : 'grades.modules.new')}</Text>
      <Text className="text-textSecondary text-xs mb-2">{t('grades.modules.name')}</Text>
      <TextInput accessibilityLabel={t('grades.modules.name')} value={name} onChangeText={setName} editable={!saving}
        className="bg-surface rounded-xl px-4 py-3 text-textPrimary mb-4" />
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: criteriaExpanded }}
        onPress={() => setCriteriaExpanded(previous => !previous)}
        className="bg-surface rounded-xl px-4 py-3 mb-4 flex-row items-center justify-between">
        <Text className="text-textPrimary font-semibold">{t('grades.modules.criteria')}</Text>
        <Ionicons name={criteriaExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
      </TouchableOpacity>
      {criteriaExpanded && <View>
        {!grouped && <Button title={t('grades.modules.useGroupedPreset')} variant="outline" disabled={saving} onPress={() => {
          setGrouped(true);
          setWeights(Object.fromEntries(criterionTypes.map(type => [type, String(defaultGradeCriteria[type])])) as Record<CriterionType, string>);
          setBehavior(''); setParticipation(''); setBehaviorQualitative(null); setParticipationQualitative(null);
        }} />}
        {moduleCriterionTypes({ grouped }).map(type => <View key={type} className="flex-row items-center mb-3" style={{ gap: 12 }}>
          <Text className="text-textPrimary flex-1">{t(criterionLabelKey({ grouped }, type))}</Text>
          <TextInput accessibilityLabel={`${t(criterionLabelKey({ grouped }, type))} (%)`} value={weights[type] ?? ''} keyboardType="decimal-pad"
            editable={!saving} onChangeText={value => setWeights(previous => ({ ...previous, [type]: value }))}
            className="bg-surface rounded-xl px-3 py-2 text-textPrimary" style={{ width: 80 }} />
          <Text className="text-textSecondary">%</Text>
        </View>)}
        {(grouped ? ['behavior'] as const : ['behavior', 'participation'] as const).map(type => <View key={type} className="mb-3">
          <GradeValueInput label={t(criterionLabelKey({ grouped }, type))} value={type === 'behavior' ? behavior : participation}
            onChange={type === 'behavior' ? setBehavior : setParticipation} disabled={saving}
            qualitative={type === 'behavior' ? behaviorQualitative : participationQualitative}
            onQualitativeChange={type === 'behavior' ? setBehaviorQualitative : setParticipationQualitative} />
        </View>)}
      </View>}
      {!!error && <Text accessibilityRole="alert" className="text-error text-sm mb-3">{error}</Text>}
      <Button title={t('grades.modal.saveButton')} onPress={() => void save()} loading={saving} />
      <Button title={t('grades.modal.cancel')} variant="ghost" disabled={saving} onPress={onClose} />
    </View>
  </KeyboardAwareModal>;
}
