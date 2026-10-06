import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { BottomSheet, Button } from '@/components/ui';
import { db } from '@/db/client';
import { loggedDates } from '@/db/diet';
import { dateKey, monthGrid, parseDateKey } from '@/domain/date-key';

import { useDietFormat } from './use-diet-format';

type Props = {
  visible: boolean;
  /** 지금 보고 있는 날 */
  value: string;
  today: string;
  onPick: (date: string) => void;
  onClose: () => void;
};

/** 날짜 고르기: 한 달 달력. 적은 음식이 있는 날에는 점이 찍힌다. 오늘보다 뒤는 고를 수 없다. */
export function DateSheet({ visible, value, today, onPick, onClose }: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const fmt = useDietFormat();
  const [month, setMonth] = useState(() => monthOf(value));
  // 열 때마다 보고 있는 날의 달부터 보여 준다.
  useEffect(() => {
    if (visible) setMonth(monthOf(value));
  }, [visible, value]);

  const rows = useMemo(() => monthGrid(month.year, month.month), [month]);
  const first = dateKey(new Date(month.year, month.month, 1));
  const last = dateKey(new Date(month.year, month.month + 1, 0));
  // 창이 열려 있는 동안에는 기록이 바뀌지 않으므로 열 때 · 달을 넘길 때만 읽는다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: visible이 바뀔 때 다시 읽는다
  const logged = useMemo(() => loggedDates(db, first, last), [first, last, visible]);
  const todayMonth = monthOf(today);
  const atLastMonth = month.year === todayMonth.year && month.month === todayMonth.month;
  const weekdays = useMemo(
    // 2024-01-01은 월요일
    () => Array.from({ length: 7 }, (_, i) => fmt.weekday(new Date(2024, 0, 1 + i))),
    [fmt],
  );

  const move = (delta: number) =>
    setMonth((m) => {
      const d = new Date(m.year, m.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  return (
    <BottomSheet
      visible={visible}
      title={t('diet.dateSheet.title')}
      subtitle={t('diet.dateSheet.sub')}
      closeLabel={t('common.close')}
      onClose={onClose}
    >
      <View style={styles.monthRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('diet.dateSheet.prevMonth')}
          onPress={() => move(-1)}
          style={({ pressed }) => [styles.nav, pressed && styles.pressed]}
        >
          <ChevronLeft size={20} color={theme.colors.text} strokeWidth={1.8} />
        </Pressable>
        <Text style={styles.month} accessibilityRole="header" accessibilityLiveRegion="polite">
          {fmt.month(new Date(month.year, month.month, 1))}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('diet.dateSheet.nextMonth')}
          accessibilityState={{ disabled: atLastMonth }}
          disabled={atLastMonth}
          onPress={() => move(1)}
          style={({ pressed }) => [
            styles.nav,
            pressed && styles.pressed,
            atLastMonth && styles.off,
          ]}
        >
          <ChevronRight size={20} color={theme.colors.text} strokeWidth={1.8} />
        </Pressable>
      </View>
      <View style={styles.grid}>
        <View style={styles.week} importantForAccessibility="no-hide-descendants">
          {weekdays.map((w) => (
            <Text key={w} style={styles.weekday}>
              {w}
            </Text>
          ))}
        </View>
        {rows.map((row, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 달력 줄은 순서가 곧 정체다
          <View key={i} style={styles.week}>
            {row.map((cell, j) => {
              // biome-ignore lint/suspicious/noArrayIndexKey: 빈 칸은 자리로만 구분된다
              if (!cell) return <View key={j} style={styles.cell} />;
              const future = cell.key > today;
              const selected = cell.key === value;
              const isToday = cell.key === today;
              const has = logged.has(cell.key);
              const date = parseDateKey(cell.key);
              return (
                <Pressable
                  key={cell.key}
                  accessibilityRole="button"
                  accessibilityLabel={`${date ? fmt.fullDay(date) : cell.key}${has ? `, ${t('diet.dateSheet.hasLogs')}` : ''}`}
                  accessibilityState={{ selected, disabled: future }}
                  disabled={future}
                  onPress={() => onPick(cell.key)}
                  style={({ pressed }) => [
                    styles.cell,
                    styles.day,
                    isToday && !selected && styles.dayToday,
                    selected && styles.dayOn,
                    pressed && styles.pressed,
                    future && styles.off,
                  ]}
                >
                  <Text style={[styles.dayText, selected && styles.dayTextOn]}>{cell.day}</Text>
                  <View
                    style={[styles.dot, has && styles.dotOn, has && selected && styles.dotSel]}
                  />
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <Button
        label={t('diet.dateSheet.today')}
        variant="secondary"
        size="md"
        onPress={() => onPick(today)}
      />
    </BottomSheet>
  );
}

function monthOf(key: string) {
  const d = parseDateKey(key) ?? new Date();
  return { year: d.getFullYear(), month: d.getMonth() };
}

const styles = StyleSheet.create((theme) => ({
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nav: {
    width: theme.hitSize,
    height: theme.hitSize,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  month: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  grid: { gap: 4 },
  week: { flexDirection: 'row', gap: 4 },
  weekday: {
    flex: 1,
    textAlign: 'center',
    paddingBottom: 4,
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  cell: { flex: 1, height: 44 },
  day: { borderRadius: theme.radius.md, alignItems: 'center', justifyContent: 'center', gap: 3 },
  dayToday: { borderWidth: 1.5, borderColor: theme.colors.accent },
  dayOn: { backgroundColor: theme.colors.accent },
  dayText: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.numSemibold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  dayTextOn: { color: theme.colors.onAccent },
  dot: { width: 4, height: 4, borderRadius: 2 },
  dotOn: { backgroundColor: theme.colors.text2 },
  dotSel: { backgroundColor: theme.colors.onAccent },
  pressed: { opacity: 0.6 },
  off: { opacity: 0.3 },
}));
