import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { StripDay } from '@/domain/home';
import { WEEKDAYS } from '@/lib/weekdays';

type Props = { days: readonly StripDay[]; dateFormat: Intl.DateTimeFormat };

/** 이번 주 7칸: 오늘(포인트색) · 운동함(옅은 포인트색 + 체크) · 예정(점) · 쉬는 날 */
export function WeekStrip({ days, dateFormat }: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  return (
    <View style={styles.grid} accessibilityLabel={t('home.stripA11y')}>
      {days.map((d) => {
        const dow = WEEKDAYS[d.weekday] ?? 'mon';
        return (
          <View
            key={d.date.toISOString()}
            style={[
              styles.cell,
              d.state === 'today' && styles.today,
              d.state === 'done' && styles.done,
            ]}
            accessible
            accessibilityLabel={t('home.dayA11y', {
              date: dateFormat.format(d.date),
              state: t(`home.state.${d.state}`),
            })}
          >
            <Text
              style={[
                styles.dow,
                d.state === 'today' && styles.onAccent,
                d.state === 'done' && styles.accentText,
                d.state === 'plan' && styles.text,
              ]}
            >
              {t(`weekday.short.${dow}`)}
            </Text>
            <Text
              style={[
                styles.day,
                d.state === 'today' && styles.onAccent,
                d.state === 'done' && styles.accentText,
                d.state === 'plan' && styles.text,
              ]}
            >
              {d.date.getDate()}
            </Text>
            <View style={styles.mark}>
              {d.state === 'done' ? (
                <Check size={13} color={theme.colors.accentText} strokeWidth={2.6} />
              ) : null}
              {d.state === 'plan' ? <View style={styles.dot} /> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  grid: { flexDirection: 'row', gap: 6 },
  cell: {
    flex: 1,
    height: 72,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    backgroundColor: theme.colors.surface,
  },
  today: { backgroundColor: theme.colors.accent },
  done: { backgroundColor: theme.colors.accentSoft },
  dow: {
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  day: {
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  onAccent: { color: theme.colors.onAccent },
  accentText: { color: theme.colors.accentText },
  text: { color: theme.colors.text },
  mark: { height: 13, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: theme.colors.text2 },
}));
