import React from 'react';
import type { BaseProps } from '@react-native-community/datetimepicker';
import { useThemeColors } from '../../constants/theme';
import { useProfileStore } from '../../stores/profileStore';

type Props = BaseProps & { mode?: 'date' | 'time'; disabled?: boolean };
const pad = (value: number) => String(value).padStart(2, '0');
const dateValue = (value: Date) => `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;

export default function DateTimePicker({ value, mode = 'date', onChange, minimumDate, maximumDate, disabled }: Props) {
  const colors = useThemeColors();
  const theme = useProfileStore(state => state.theme);
  const time = mode === 'time';
  return <input
    type={time ? 'time' : 'date'}
    aria-label={time ? 'Hora' : 'Data'}
    disabled={disabled}
    value={time ? `${pad(value.getHours())}:${pad(value.getMinutes())}` : dateValue(value)}
    min={!time && minimumDate ? dateValue(minimumDate) : undefined}
    max={!time && maximumDate ? dateValue(maximumDate) : undefined}
    onClick={event => {
      try { event.currentTarget.showPicker?.(); } catch { /* Native editing remains available. */ }
    }}
    onChange={event => {
      const raw = event.currentTarget.value;
      if (!raw || !event.currentTarget.validity.valid) return;
      const selected = new Date(value);
      if (time) {
        const [hours, minutes] = raw.split(':').map(Number);
        selected.setHours(hours, minutes, 0, 0);
      } else {
        const [year, month, day] = raw.split('-').map(Number);
        // Keep local dates; UTC conversion can shift the selected calendar day.
        selected.setFullYear(year, month - 1, day);
      }
      if (!Number.isNaN(selected.getTime())) onChange?.({ type: 'set', nativeEvent: {
        timestamp: selected.getTime(), utcOffset: -selected.getTimezoneOffset(),
      } }, selected);
    }}
    style={{ boxSizing: 'border-box', width: '100%', minWidth: 0, minHeight: 48,
      padding: '12px 16px', borderRadius: 12, border: `1px solid ${colors.border}`,
      background: colors.surface, color: colors.textPrimary, colorScheme: theme === 'dark' ? 'dark' : 'light',
      font: 'inherit', fontSize: 16, cursor: 'pointer' }}
  />;
}
