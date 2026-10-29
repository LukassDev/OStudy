import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useSpaceColorMap, useThemeColors } from '../../constants/theme';
import type { Lesson } from '../../stores/studyStore';
import type { Space } from '../../stores/spaceStore';
import { minutes, timeOf } from './lessonHelpers';
import { earliestLessonMinute, layoutDay, visibleScheduleHours } from './scheduleLayout';
import { Button } from '../ui/Button';

const DAYS = [1, 2, 3, 4, 5, 6, 0];
const HOUR_HEIGHT = 64;

export const WeekSchedule = React.memo(function WeekSchedule({ lessons, spaces, disabled, onCreate, onEdit }: {
  lessons: Lesson[]; spaces: Space[]; disabled: boolean;
  onCreate: (weekday: number, start: string, end: string) => void;
  onEdit: (lesson: Lesson) => void;
}) {
  const colors = useThemeColors();
  const palette = useSpaceColorMap();
  const { t, i18n } = useTranslation();
  const [width, setWidth] = useState(0);
  const columnWidth = width >= 760 ? (width - 44) / 7 : Math.max(96, (width - 44) / 3);
  const timeline = useRef<ScrollView>(null);
  const positioned = useRef(false);
  const today = new Date().getDay();
  const valid = useMemo(() => lessons.filter(l => Number.isFinite(minutes(l.start_time)) && Number.isFinite(minutes(l.end_time))
    && minutes(l.start_time) >= 0 && minutes(l.end_time) <= 1440 && minutes(l.end_time) > minutes(l.start_time)), [lessons]);
  const initialMinute = earliestLessonMinute(valid);
  const hasLessons = valid.length > 0;
  const layouts = useMemo(() => Object.fromEntries(DAYS.map(day =>
    [day, layoutDay(valid.filter(lesson => lesson.weekday === day))])), [valid]);
  const [viewportHeight, setViewportHeight] = useState(400);
  const measuredHeight = useRef(0);
  const [scrollHour, setScrollHour] = useState(Math.floor(initialMinute / 60));
  const visible = visibleScheduleHours(scrollHour * HOUR_HEIGHT, viewportHeight + HOUR_HEIGHT, HOUR_HEIGHT);
  const visibleHours = Array.from({ length: visible.end - visible.start }, (_, index) => visible.start + index);
  const contentReady = useRef(false);
  const positionTimeline = useCallback(() => {
    if (contentReady.current && measuredHeight.current > 0 && !positioned.current && timeline.current) {
      setScrollHour(Math.floor(initialMinute / 60));
      timeline.current.scrollTo({ y: initialMinute / 60 * HOUR_HEIGHT, animated: false });
      positioned.current = hasLessons;
    }
  }, [initialMinute, hasLessons]);
  useEffect(positionTimeline, [positionTimeline]);
  const firstHour = 0;
  const lastHour = 24;
  const hours = Array.from({ length: lastHour - firstHour }, (_, index) => firstHour + index);
  const dayLabels = useMemo(() => Object.fromEntries(DAYS.map(day => [day, {
    long: new Date(2026, 0, 4 + day).toLocaleDateString(i18n.language, { weekday: 'long' }),
    short: new Date(2026, 0, 4 + day).toLocaleDateString(i18n.language, { weekday: 'short' }),
  }])), [i18n.language]);
  const dayName = (day: number) => dayLabels[day].long;
  return <View style={{ flex: 1, minHeight: 0 }} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <View style={{ gap: 8, marginBottom: 12 }}>
      <Text style={{ color: colors.textPrimary, fontSize: 18, fontFamily: 'DMSans_700Bold' }}>{t('studyVisual.timetable')}</Text>
      <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{t('scheduleMobile.hint')}</Text>
      <Button title={t('update15.addLesson')} disabled={disabled} size="sm" fullWidth={false}
        style={{ alignSelf: 'flex-start', paddingHorizontal: 20 }} onPress={() => onCreate(today, '09:00', '10:00')} />
    </View>
    <ScrollView horizontal nestedScrollEnabled style={{ flex: 1 }} showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ width: 44 + columnWidth * 7 }}>
      <View style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 16, overflow: 'hidden', backgroundColor: colors.surface }}>
        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border }}>
          <View style={{ width: 44 }} />
          {DAYS.map(day => <View key={day} style={{ width: columnWidth, paddingVertical: 10, alignItems: 'center', backgroundColor: day === today ? colors.primarySoft : colors.surface }}>
            <Text style={{ color: day === today ? colors.primary : colors.textPrimary, fontFamily: 'DMSans_600SemiBold', fontSize: 12, textTransform: 'capitalize' }}>{dayLabels[day].short}</Text>
          </View>)}
        </View>
        <ScrollView ref={timeline} nestedScrollEnabled style={{ flex: 1 }} showsVerticalScrollIndicator={false}
          onLayout={event => {
            const height = event.nativeEvent.layout.height;
            measuredHeight.current = height;
            if (height > 0) { setViewportHeight(height); positionTimeline(); }
          }}
          scrollEventThrottle={64}
          onScroll={event => setScrollHour(Math.floor(Math.max(0, event.nativeEvent.contentOffset.y) / HOUR_HEIGHT))}
          onScrollBeginDrag={() => { positioned.current = true; }}
          onContentSizeChange={(_, height) => {
            contentReady.current = height > 0;
            positionTimeline();
          }}>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ width: 44 }}>{hours.map(hour => <Text key={hour} style={{ height: HOUR_HEIGHT, paddingTop: 8, textAlign: 'center', fontSize: 11, color: colors.textSecondary }}>{timeOf(hour * 60)}</Text>)}</View>
            {DAYS.map(day => <View key={day} style={{ width: columnWidth, height: 24 * HOUR_HEIGHT, borderLeftWidth: 1, borderColor: colors.border }}>
              <View style={{ height: visible.start * HOUR_HEIGHT }} />
              {visibleHours.flatMap(hour => [0, 30].map(offset => {
                const start = hour * 60 + offset;
                return <TouchableOpacity key={start} disabled={disabled} accessibilityRole="button"
                  accessibilityLabel={`${t('update15.addLesson')} · ${dayName(day)} ${timeOf(start)}`}
                  onPress={() => onCreate(day, timeOf(start), timeOf(Math.min(start + 60, 1439)))}
                  style={{ height: HOUR_HEIGHT / 2, borderTopWidth: offset === 0 ? 1 : 0, borderColor: colors.border, backgroundColor: day === today ? colors.primarySoft : 'transparent' }} />;
              }))}
              {layouts[day].map(({ lesson, lane, lanes }) => {
                const space = spaces.find(s => s.id === lesson.space_id);
                const tint = space ? palette[space.color] || colors.primary : colors.primary;
                const height = (minutes(lesson.end_time) - minutes(lesson.start_time)) / 60 * HOUR_HEIGHT;
                const cardHeight = Math.max(12, height - 3);
                const padding = cardHeight < 45 ? 2 : 5;
                const contentHeight = cardHeight - padding * 2;
                const compact = contentHeight < 48;
                const fontSize = compact ? 10 : 12;
                const lineHeight = compact ? 11 : 15;
                const lines = Math.max(1, Math.floor(contentHeight / lineHeight));
                const details = [lesson.title];
                if (lines >= 2) details.push(lesson.start_time.slice(0, 5) + '–' + lesson.end_time.slice(0, 5));
                if (lines >= 4 && (lesson.room || space?.name)) details.push(lesson.room || space!.name);
                return <TouchableOpacity key={lesson.id} disabled={disabled} accessibilityRole="button"
                  accessibilityLabel={`${lesson.title}, ${lesson.start_time.slice(0, 5)}–${lesson.end_time.slice(0, 5)}, ${lesson.room || space?.name || ''}`}
                  onPress={() => onEdit(lesson)} style={{ position: 'absolute', top: (minutes(lesson.start_time) - firstHour * 60) / 60 * HOUR_HEIGHT,
                    left: lane * columnWidth / lanes + 3, width: columnWidth / lanes - 6, height: cardHeight,
                    padding, borderRadius: 8, borderLeftWidth: 3, borderLeftColor: tint, backgroundColor: colors.surfaceElevated, overflow: 'hidden' }}>
                  <Text numberOfLines={lines} adjustsFontSizeToFit minimumFontScale={0.75}
                    style={{ color: colors.textPrimary, fontFamily: 'DMSans_600SemiBold', fontSize, lineHeight, includeFontPadding: false, height: contentHeight }}>
                    {details.join('\n')}
                  </Text>
                </TouchableOpacity>;
              })}
            </View>)}
          </View>
        </ScrollView>
      </View>
    </ScrollView>
  </View>;
});
