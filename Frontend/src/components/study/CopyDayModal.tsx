import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { KeyboardAwareModal } from '../ui/KeyboardAwareModal';
import { Button } from '../ui/Button';
import { useStudyStore } from '../../stores/studyStore';
import { newLessons, overlaps } from './lessonHelpers';

export function CopyDayModal({ weekday, onClose }: { weekday: number; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const lessons = useStudyStore(s => s.lessons);
  const [days, setDays] = useState<number[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const source = lessons.filter(l => l.weekday === weekday);
  const rows = newLessons(days.flatMap(day => source.map(({ id, user_id, ...l }) => ({ ...l, weekday: day }))), lessons);
  const conflicts = overlaps(rows, lessons);
  const dayName = (day: number) => new Date(2026, 0, 4 + day).toLocaleDateString(i18n.language, { weekday: 'long' });
  return <KeyboardAwareModal visible onRequestClose={onClose}>
    <View className="bg-background p-6">
      <Text className="text-lg font-bold text-textPrimary mb-2">{t('scheduleQuick.copyDay')}</Text>
      <Text className="text-textSecondary mb-4">{dayName(weekday)} · {t('scheduleQuick.copyHint')}</Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {[1, 2, 3, 4, 5, 6, 0].filter(n => n !== weekday).map(n => <TouchableOpacity key={n}
          accessibilityLabel={dayName(n)} accessibilityState={{ selected: days.includes(n) }}
          onPress={() => setDays(current => current.includes(n) ? current.filter(d => d !== n) : [...current, n])}
          className={`px-4 py-2 rounded-full ${days.includes(n) ? 'bg-primary' : 'bg-surface'}`}>
          <Text className={days.includes(n) ? 'text-white' : 'text-textSecondary'}>{dayName(n).slice(0, 3)}</Text>
        </TouchableOpacity>)}
      </View>
      <Text className="text-textSecondary mb-4">{t('scheduleQuick.copyCount', { count: rows.length })}</Text>
      {!!conflicts.length && <View className="bg-surface rounded-xl p-4 mb-4">
        <Text className="text-textPrimary font-bold mb-2">{t('scheduleQuick.copyOverlap')}</Text>
        {conflicts.map(l => <Text key={l.id} className="text-textSecondary mb-1">{dayName(l.weekday)} · {l.start_time.slice(0, 5)}–{l.end_time.slice(0, 5)} · {l.title}</Text>)}
      </View>}
      <Button title={t(conflicts.length ? 'scheduleQuick.copyAnyway' : 'scheduleQuick.copy')} disabled={!rows.length || submitting}
        onPress={() => { setSubmitting(true); void useStudyStore.getState().saveLessons(rows).then(onClose).finally(() => setSubmitting(false)); }} />
      <Button title={t('update15.cancel')} variant="ghost" onPress={onClose} />
    </View>
  </KeyboardAwareModal>;
}
