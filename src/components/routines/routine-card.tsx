import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Badge } from '@/components/ui';
import { fromMask, hasDay, WEEKDAYS } from '@/lib/weekdays';

type Props = {
  name: string;
  weekdays: number;
  meta: string;
  today: boolean;
  onPress: () => void;
  onLongPress: () => void;
};

/** 내 루틴 카드: 이름·오늘 배지 / 요일 7칸·종목 수와 예상 시간 */
export function RoutineCard({ name, weekdays, meta, today, onPress, onLongPress }: Props) {
  const { t } = useTranslation();
  const days = fromMask(weekdays);
  const daysLabel = days.length
    ? days.map((d) => t(`weekday.long.${d}`)).join(', ')
    : t('routines.noDays');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('routines.cardA11y', {
        name: today ? `${name}, ${t('routines.today')}` : name,
        days: daysLabel,
        meta,
      })}
      accessibilityHint={t('routines.openHint')}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.head}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {today ? <Badge label={t('routines.today')} kind="solid" /> : null}
      </View>
      <View style={styles.row}>
        {WEEKDAYS.map((d, i) => {
          const on = hasDay(weekdays, i);
          return (
            <View key={d} style={[styles.day, on && styles.dayOn]}>
              <Text style={[styles.dayText, on && styles.dayTextOn]}>
                {t(`weekday.short.${d}`)}
              </Text>
            </View>
          );
        })}
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    gap: 12,
    padding: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  pressed: { opacity: 0.7 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  day: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface2,
  },
  dayOn: { backgroundColor: theme.colors.accent },
  dayText: {
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text2,
  },
  dayTextOn: { color: theme.colors.onAccent },
  meta: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
