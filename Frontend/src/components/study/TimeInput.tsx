import React, { useState } from 'react';
import { Platform, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '../ui/DateTimePicker';
import { Input } from '../ui/Input';
import { useThemeColors } from '../../constants/theme';

export function TimeInput({ label, value, onChangeText }: { label: string; value: string; onChangeText: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const colors = useThemeColors();
  const date = new Date();
  const [hour, minute] = value.split(':').map(Number);
  date.setHours(Number.isFinite(hour) ? hour : 9, Number.isFinite(minute) ? minute : 0, 0, 0);
  if (Platform.OS === 'web') return <View style={{ marginBottom: 14 }}><Text style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 6 }}>{label}</Text><DateTimePicker value={date} mode="time" onChange={(_, selected) => { if (selected) onChangeText(`${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`); }} /></View>;
  const picker = <DateTimePicker value={date} mode="time" is24Hour display={Platform.OS === 'ios' ? 'compact' : 'default'} accentColor={colors.primary} onChange={(_event, selected) => { setOpen(false); if (selected) onChangeText(`${String(selected.getHours()).padStart(2, '0')}:${String(selected.getMinutes()).padStart(2, '0')}`); }} />;
  if (Platform.OS === 'ios') return <View style={{ marginBottom: 14 }}><Text style={{ color: colors.textSecondary, fontFamily: 'DMSans_500Medium', fontSize: 13, marginBottom: 6 }}>{label}</Text><View style={{ backgroundColor: colors.surface, padding: 8, borderRadius: 12 }}>{picker}</View></View>;
  return <><TouchableOpacity accessibilityLabel={label} onPress={() => setOpen(true)}><View pointerEvents="none"><Input label={label} icon="time-outline" value={value} editable={false} /></View></TouchableOpacity>{open && picker}</>;
}
