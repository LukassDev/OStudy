import React, { useRef, useState } from 'react';
import { Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { KeyboardAwareModal } from '../ui/KeyboardAwareModal';
import { Button } from '../ui/Button';
import { showAppDialog } from '../ui/AppDialog';
import { useThemeColors } from '../../constants/theme';
import { useStudyStore, type Lesson } from '../../stores/studyStore';
import { newLessons, overlaps, minutes, timeOf } from './lessonHelpers';
import { TimeInput } from './TimeInput';
import type { Space } from '../../stores/spaceStore';

// Same native fields, local form state and modal container as CalendarTab.EventModal.
export function LessonModal({ lesson, spaces, onClose, onSave, onDelete }: {
  lesson: Lesson;
  spaces: Space[];
  onClose: () => void;
  onSave: (lesson: Lesson, days: number[], another: boolean) => Promise<void>;
  onDelete: (lesson: Lesson) => Promise<void>;
}) {
  const colors = useThemeColors();
  const { t, i18n } = useTranslation();
  const [title, setTitle] = useState(lesson.title);
  const [room, setRoom] = useState(lesson.room);
  const [start, setStart] = useState(lesson.start_time.slice(0, 5));
  const [end, setEnd] = useState(lesson.end_time.slice(0, 5));
  const [days, setDays] = useState([lesson.weekday]);
  const lessons = useStudyStore(state => state.lessons);
  const titleInput = useRef<TextInput>(null);
  const submitting = useRef(false);
  const recentSubjects = [...lessons].reverse().filter((l, index, rows) => rows.findIndex(other => other.title.trim().toLowerCase() === l.title.trim().toLowerCase()) === index);
  const [confirmedConflict, setConfirmedConflict] = useState('');
  const [added, setAdded] = useState(false);
  const [spaceId, setSpaceId] = useState(lesson.space_id);
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);
  const [spacePicker, setSpacePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const day = (n: number) => new Date(2026, 0, 4 + n).toLocaleDateString(i18n.language, { weekday: 'long' });
  const close = () => { if (!saving) onClose(); };
  const submit = async (remove = false, another = false) => {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setError('');
    try {
      const value = { ...lesson, title: title.trim(), room: room.trim(), start_time: start, end_time: end, weekday: days[0], space_id: spaceId };
      if (remove) await onDelete(value);
      else {
        if (!title.trim() || !days.length || !/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || end <= start) throw new Error(t('update15.invalidLesson'));
        const rows = days.map(weekday => ({ ...value, weekday }));
        const fresh = lesson.id ? rows : newLessons(rows, lessons);
        if (!fresh.length) throw new Error(t('scheduleQuick.duplicateExists'));
        if (lesson.id && lessons.some(l => l.id !== lesson.id && l.weekday === days[0] && l.title.trim().toLowerCase() === title.trim().toLowerCase() && l.start_time.slice(0, 5) === start && l.end_time.slice(0, 5) === end)) throw new Error(t('scheduleQuick.duplicateExists'));
        const conflicts = overlaps(fresh, lessons, lesson.id);
        const signature = JSON.stringify([value, days, conflicts]);
        if (conflicts.length && confirmedConflict !== signature) {
          setConfirmedConflict(signature);
          setError(t('scheduleQuick.overlap') + '\n' + conflicts.map(l => day(l.weekday) + ' · ' + l.start_time.slice(0, 5) + '–' + l.end_time.slice(0, 5) + ' · ' + l.title).join('\n'));
          return;
        }
        await onSave(value, days, another);
        if (another) {
          const next = minutes(end);
          const duration = minutes(end) - minutes(start);
          if (next + duration < 1440) { setStart(timeOf(next)); setEnd(timeOf(next + duration)); }
          setTitle(''); setRoom(''); setSpaceId(null); setConfirmedConflict(''); setAdded(true);
          titleInput.current?.focus();
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  };
  const pickerDate = new Date();
  const [hour, minute] = (picker === 'end' ? end : start).split(':').map(Number);
  pickerDate.setHours(hour, minute, 0, 0);

  return (
    <KeyboardAwareModal visible onRequestClose={close}>
      <View className="bg-background p-6">
        <Text className="text-lg font-bold text-textPrimary mb-4">
          {t(lesson.id ? 'studyVisual.editClass' : 'update15.addLesson')}
        </Text>
        {added && !error ? <Text className="text-primary text-sm mb-3">{t('scheduleQuick.added')}</Text> : null}
        {error ? <Text className="text-error text-sm mb-3">{error}</Text> : null}
        <Text className="text-xs font-semibold text-textTertiary mb-1.5 uppercase">{t('update15.subject')}</Text>
        <TextInput className="bg-surface rounded-xl px-4 py-3.5 text-textPrimary text-base mb-4"
          ref={titleInput} value={title} onChangeText={value => { setTitle(value); setAdded(false); }} maxLength={160} editable={!saving} />
        <View className="flex-row flex-wrap gap-2 mb-3">
          {recentSubjects.filter(l => !title || l.title.toLowerCase().includes(title.toLowerCase())).slice(0, 5).map(l => (
            <TouchableOpacity key={l.title} className="bg-surface rounded-full px-3 py-2" onPress={() => { setTitle(l.title); setRoom(l.room); setSpaceId(l.space_id); }}>
              <Text className="text-textSecondary text-sm">{l.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text className="text-xs font-semibold text-textTertiary mb-1.5 uppercase">{t('update15.room')}</Text>
        <TextInput className="bg-surface rounded-xl px-4 py-3.5 text-textPrimary text-base mb-4"
          value={room} onChangeText={setRoom} maxLength={160} editable={!saving} />
        <View className="flex-row flex-wrap gap-2 mb-3">
          {[...new Set([...lessons].reverse().map(l => l.room).filter(Boolean))].slice(0, 5).map(value => (
            <TouchableOpacity key={value} className="bg-surface rounded-full px-3 py-2" onPress={() => setRoom(value)}><Text className="text-textSecondary text-sm">{value}</Text></TouchableOpacity>
          ))}
        </View>
        <View className="flex-row gap-3 mb-4">
          {(['start', 'end'] as const).map(field => (
            <View key={field} className="flex-1">
              <Text className="text-xs font-semibold text-textTertiary mb-1.5 uppercase">{t(`update15.${field}`)}</Text>
              {Platform.OS === 'web' ? (
                <View pointerEvents={saving ? 'none' : 'auto'}><TimeInput label="" value={field === 'start' ? start : end} onChangeText={field === 'start' ? setStart : setEnd} /></View>
              ) : (
                <TouchableOpacity className="bg-surface rounded-xl px-4 py-3.5 flex-row items-center justify-between"
                  disabled={saving} onPress={() => setPicker(field)}>
                  <Text className="text-textPrimary text-base">{field === 'start' ? start : end}</Text>
                  <Ionicons name="time-outline" size={18} color={colors.textTertiary} />
                </TouchableOpacity>
              )}
            </View>
          ))}
        </View>
        {picker && Platform.OS !== 'web' && (
          <DateTimePicker value={pickerDate} mode="time" is24Hour display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={(_, selected) => {
              const field = picker;
              setPicker(Platform.OS === 'ios' ? picker : null);
              if (selected) {
                const value = `${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`;
                if (field === 'start') setStart(value); else setEnd(value);
              }
            }} />
        )}
        <Text className="text-xs font-semibold text-textTertiary mb-2 uppercase">{t('studyVisual.weekday')}</Text>
        <View className="flex-row flex-wrap gap-2 mb-4">
          {[1, 2, 3, 4, 5, 6, 0].map(n => (
            <TouchableOpacity key={n} disabled={saving} onPress={() => setDays(current => lesson.id ? [n] : current.includes(n) ? current.filter(d => d !== n) : [...current, n])} accessibilityState={{ selected: days.includes(n) }} accessibilityLabel={day(n)}
              className={`px-4 py-2 rounded-full ${days.includes(n) ? 'bg-primary' : 'bg-surface'}`}>
              <Text className={days.includes(n) ? 'text-white text-sm font-medium' : 'text-textSecondary text-sm'}>{day(n).slice(0, 3)}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text className="text-xs font-semibold text-textTertiary mb-2 uppercase">{t('studyVisual.linkSpace')}</Text>
        <TouchableOpacity className="bg-surface rounded-xl px-4 py-3.5 mb-4" disabled={saving} onPress={() => setSpacePicker(!spacePicker)}>
          <Text className="text-textPrimary text-base">{spaces.find(space => space.id === spaceId)?.name || t('update15.noSpace')}</Text>
        </TouchableOpacity>
        {spacePicker && [{ id: '', name: t('update15.noSpace') }, ...spaces].map(space => (
          <TouchableOpacity key={space.id} className="px-4 py-3" disabled={saving} onPress={() => { setSpaceId(space.id || null); setSpacePicker(false); }}>
            <Text className="text-textPrimary">{space.name}</Text>
          </TouchableOpacity>
        ))}
        <Button title={t('update15.save')} disabled={saving} onPress={() => void submit()} />
        <Button title={t('update15.cancel')} variant="ghost" disabled={saving} onPress={close} style={{ marginTop: 12, backgroundColor: `${colors.border}66`, borderWidth: 0 }} />
        {!!lesson.id && (
          <TouchableOpacity
            className="py-2 items-center mt-2"
            disabled={saving}
            onPress={() =>
              showAppDialog(t('update15.delete'), title, [
                { text: t('update15.cancel'), style: 'cancel' },
                { text: t('update15.delete'), style: 'destructive', onPress: () => void submit(true) },
              ])
            }
          >
            <Text style={{ color: colors.error, fontSize: 13 }}>{t('update15.delete')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAwareModal>
  );
}
