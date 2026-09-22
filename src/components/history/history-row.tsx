import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Badge } from '@/components/ui';

type Props = {
  weekday: string;
  day: number;
  name: string;
  meta: string;
  pr?: string;
  a11yLabel: string;
  a11yHint: string;
  onPress: () => void;
  onLongPress: () => void;
};

/** 히스토리 한 줄: 왼쪽 고정폭 날짜(요일·일) + 세션 카드(이름·시간·세트·볼륨, PR 배지) */
export function HistoryRow({
  weekday,
  day,
  name,
  meta,
  pr,
  a11yLabel,
  a11yHint,
  onPress,
  onLongPress,
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={pr ? `${a11yLabel}, ${pr}` : a11yLabel}
      accessibilityHint={a11yHint}
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.date}>
        <Text style={styles.dow}>{weekday}</Text>
        <Text style={styles.day}>{day}</Text>
      </View>
      <View style={styles.card}>
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        {pr ? (
          <View>
            <Badge label={pr} kind="pr" />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  pressed: { opacity: 0.7 },
  date: { width: 44, alignItems: 'center', justifyContent: 'center', gap: 2 },
  dow: {
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  day: {
    fontSize: 20,
    lineHeight: 26,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  card: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  body: { flex: 1, gap: 3 },
  name: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
}));
