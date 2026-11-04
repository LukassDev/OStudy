import React, { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useSpaceColorMap, useThemeColors } from '../../constants/theme';
import type { Lesson } from '../../stores/studyStore';
import type { Space } from '../../stores/spaceStore';
import { minutes, timeOf } from './lessonHelpers';
import { earliestLessonMinute, layoutDay } from './scheduleLayout';

const DAYS = [1, 2, 3, 4, 5, 6, 0];
const HOUR_HEIGHT = 72;

export const WeekSchedule = React.memo(function WeekSchedule({ lessons, spaces, disabled, onCreate, onEdit }: {
  lessons: Lesson[]; spaces: Space[]; disabled: boolean;
  onCreate: (weekday: number, start: string, end: string) => void;
  onEdit: (lesson: Lesson) => void;
}) {
  const colors = useThemeColors();
  const palette = useSpaceColorMap();
  const { t, i18n } = useTranslation();
  const timeline = useRef<HTMLDivElement>(null);
  const positioned = useRef(false);
  const today = new Date().getDay();
  const validLessons = lessons.filter(l => Number.isFinite(minutes(l.start_time)) && Number.isFinite(minutes(l.end_time))
    && minutes(l.start_time) >= 0 && minutes(l.end_time) <= 1440 && minutes(l.end_time) > minutes(l.start_time));
  const initialMinute = earliestLessonMinute(validLessons);
  const hasLessons = validLessons.length > 0;
  useEffect(() => {
    if (timeline.current && !positioned.current) {
      timeline.current.scrollTop = initialMinute / 60 * HOUR_HEIGHT;
      positioned.current = hasLessons;
    }
  }, [initialMinute, hasLessons]);
  const firstHour = 0;
  const lastHour = 24;
  const hours = Array.from({ length: lastHour - firstHour }, (_, index) => firstHour + index);
  const dayLabels = useMemo(() => Object.fromEntries(DAYS.map(day => [day, {
    long: new Date(2026, 0, 4 + day).toLocaleDateString(i18n.language, { weekday: 'long' }),
    short: new Date(2026, 0, 4 + day).toLocaleDateString(i18n.language, { weekday: 'short' }),
  }])), [i18n.language]);
  const dayName = (day: number) => dayLabels[day].long;
  const buttonStyle: React.CSSProperties = { font: 'inherit', fontSize: 13, borderRadius: 12,
    padding: '10px 14px', cursor: 'pointer', border: `1px solid ${colors.border}`, color: colors.textPrimary, background: colors.surface };

  return <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, color: colors.textPrimary }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
      <div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{t('studyVisual.timetable')}</div>
        <div style={{ color: colors.textSecondary, fontSize: 13, marginTop: 5 }}>{t('scheduleWeb.hint', { defaultValue: 'A tua semana de aulas. Clica num horário livre para adicionar.' })}</div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <button disabled={disabled} onClick={() => onCreate(today, '09:00', '10:00')}
          style={{ ...buttonStyle, background: colors.primary, color: '#fff', borderColor: colors.primary }}>+ {t('update15.addLesson')}</button>
      </div>
    </div>
    <div ref={timeline} onWheel={() => { positioned.current = true; }} onTouchStart={() => { positioned.current = true; }} style={{ flex: 1, minHeight: 0, overflow: 'auto', border: `1px solid ${colors.border}`, borderRadius: 16, background: colors.surface }}>
      <div style={{ minWidth: 860 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '64px repeat(7, minmax(0, 1fr))', position: 'sticky', top: 0, zIndex: 3, background: colors.surface, borderBottom: `1px solid ${colors.border}` }}>
          <div />
          {DAYS.map(day => <div key={day} style={{ padding: '18px 6px', textAlign: 'center', textTransform: 'capitalize', fontSize: 13,
            fontWeight: 600, color: day === today ? colors.primary : colors.textPrimary, background: day === today ? colors.primarySoft : undefined,
            borderLeft: `1px solid ${colors.border}` }}>{dayName(day)}</div>)}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '64px repeat(7, minmax(0, 1fr))' }}>
          <div>{hours.map(hour => <div key={hour} style={{ height: HOUR_HEIGHT, boxSizing: 'border-box', paddingTop: 8, textAlign: 'center', fontSize: 11, color: colors.textSecondary }}>{timeOf(hour * 60)}</div>)}</div>
          {DAYS.map(day => <div key={day} style={{ position: 'relative', borderLeft: `1px solid ${colors.border}` }}>
            {hours.flatMap(hour => [0, 30].map(offset => {
              const start = hour * 60 + offset;
              return <button key={start} disabled={disabled} aria-label={`${t('update15.addLesson')} · ${dayName(day)} ${timeOf(start)}`}
                onClick={() => onCreate(day, timeOf(start), timeOf(Math.min(start + 60, 1439)))}
                style={{ display: 'block', width: '100%', height: HOUR_HEIGHT / 2, boxSizing: 'border-box', cursor: 'pointer', border: 0,
                  borderTop: `${offset === 0 ? 1 : 0}px solid ${colors.border}`, background: day === today ? colors.primarySoft : 'transparent' }} />;
            }))}
            {layoutDay(validLessons.filter(l => l.weekday === day)).map(({ lesson, lane, lanes }) => {
              const space = spaces.find(s => s.id === lesson.space_id);
              const tint = space ? palette[space.color] || colors.primary : colors.primary;
              const height = (minutes(lesson.end_time) - minutes(lesson.start_time)) / 60 * HOUR_HEIGHT;
              return <button key={lesson.id} disabled={disabled} onClick={() => onEdit(lesson)}
                title={`${lesson.title}\n${lesson.start_time.slice(0, 5)}–${lesson.end_time.slice(0, 5)}${lesson.room ? '\n' + lesson.room : ''}`}
                style={{ position: 'absolute', top: (minutes(lesson.start_time) - firstHour * 60) / 60 * HOUR_HEIGHT,
                  left: `calc(${lane * 100 / lanes}% + 3px)`, width: `calc(${100 / lanes}% - 6px)`, height: Math.max(12, height - 3),
                  boxSizing: 'border-box', overflow: 'hidden', textAlign: 'left', cursor: 'pointer', font: 'inherit',
                  padding: height < 35 ? '2px 6px' : '8px', borderRadius: 8, border: `1px solid ${colors.border}`, borderLeft: `3px solid ${tint}`,
                  background: colors.surfaceElevated, color: colors.textPrimary }}>
                <div style={{ fontSize: 12, fontWeight: 700, lineHeight: '17px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lesson.title}</div>
                {height >= 45 && <div style={{ fontSize: 10, marginTop: 3, color: colors.textSecondary }}>{lesson.start_time.slice(0, 5)}–{lesson.end_time.slice(0, 5)}</div>}
                {height >= 75 && <div style={{ fontSize: 11, marginTop: 5, color: colors.textSecondary }}>{lesson.room || space?.name}</div>}
              </button>;
            })}
          </div>)}
        </div>
      </div>
    </div>
  </div>;
});
