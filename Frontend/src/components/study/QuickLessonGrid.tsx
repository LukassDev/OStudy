import React, { useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Lesson } from '../../stores/studyStore';
import { minutes, timeOf } from './lessonHelpers';

// A compact day grid: the duration and gap can match each school's timetable.
export function QuickLessonGrid({ lessons, onCreate }: {
  lessons: Lesson[]; onCreate: (start: string, end: string) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [start, setStart] = useState('08:00');
  const [finish, setFinish] = useState('18:00');
  const [duration, setDuration] = useState('50');
  const [gap, setGap] = useState('10');
  const validTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  const valid = validTime(start) && validTime(finish) && finish > start && /^\d+$/.test(duration) && Number(duration) > 0 && /^\d+$/.test(gap);
  const slots: Array<{ start: string; end: string; occupied: Lesson[] }> = [];
  if (valid) {
    for (let n = minutes(start); n + Number(duration) <= minutes(finish) && slots.length < 96; n += Number(duration) + Number(gap)) {
      const end = n + Number(duration);
      slots.push({ start: timeOf(n), end: timeOf(end), occupied: lessons.filter(l => minutes(l.start_time) < end && minutes(l.end_time) > n) });
    }
  }
  return <View className="mb-5">
    {open && <View className="bg-surface rounded-2xl p-4">
      <Text className="text-textSecondary text-sm mb-3">{t('scheduleQuick.gridHint')}</Text>
      <View className="flex-row flex-wrap gap-3 mb-4">
        {[
          { label: t('update15.start'), value: start, change: setStart, numeric: false },
          { label: t('update15.end'), value: finish, change: setFinish, numeric: false },
          { label: t('scheduleQuick.duration'), value: duration, change: setDuration, numeric: true },
          { label: t('scheduleQuick.gap'), value: gap, change: setGap, numeric: true },
        ].map(field => <View key={field.label} style={{ width: '45%' }}>
          <Text className="text-textSecondary text-xs mb-1">{field.label}</Text>
          <TextInput value={field.value} onChangeText={field.change} maxLength={field.numeric ? 3 : 5}
            keyboardType={field.numeric ? 'number-pad' : 'default'} accessibilityLabel={field.label}
            className="bg-background rounded-xl px-3 py-3 text-textPrimary" />
        </View>)}
      </View>
      {!valid && <Text className="text-error mb-3">{t('scheduleQuick.invalidGrid')}</Text>}
      <View className="flex-row flex-wrap gap-2">
        {slots.map(slot => <TouchableOpacity key={slot.start} disabled={!!slot.occupied.length}
          onPress={() => onCreate(slot.start, slot.end)} style={{ width: '47%', opacity: slot.occupied.length ? 0.55 : 1 }}
          className="bg-background rounded-xl p-3">
          <Text className="text-textPrimary font-semibold">{slot.start}–{slot.end}</Text>
          <Text numberOfLines={2} className="text-primary text-xs mt-1">{slot.occupied.length ? slot.occupied.map(l => l.title).join(' · ') : '+ ' + t('update15.addLesson')}</Text>
        </TouchableOpacity>)}
      </View>
    </View>}
  </View>;
}
