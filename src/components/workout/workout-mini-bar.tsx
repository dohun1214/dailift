import { router } from 'expo-router';
import { ChevronUp } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { formatClock, remainingSec } from '@/domain/rest-timer';
import { useNow } from '@/lib/use-now';
import { useRestTimer } from '@/stores/rest-timer';

type Props = { name: string; startedAt: number };

/** 운동 화면을 접었을 때 탭 위에 보이는 "운동 중" 바. 누르면 운동 화면으로 돌아간다. */
export function WorkoutMiniBar({ name, startedAt }: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const now = useNow(1000);
  const restEnds = useRestTimer((s) => s.endsAt);
  const elapsed = formatClock((now - startedAt) / 1000);
  const rest = restEnds !== null ? formatClock(remainingSec(restEnds, now)) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${t('workout.miniA11y')}, ${name}, ${elapsed}`}
      onPress={() => router.push('/workout')}
      style={({ pressed }) => [styles.bar, pressed && styles.pressed]}
    >
      <View style={styles.dot} />
      <View style={styles.body}>
        <Text style={styles.caption}>{t('workout.miniBar')}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
      </View>
      {rest ? (
        <View style={styles.rest}>
          <Text style={styles.restText}>{rest}</Text>
        </View>
      ) : null}
      <Text style={styles.clock}>{elapsed}</Text>
      <ChevronUp size={20} color={theme.colors.onAccent} strokeWidth={1.8} />
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: theme.space.lg,
    marginTop: theme.space.sm,
    minHeight: 56,
    paddingHorizontal: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.accent,
  },
  pressed: { opacity: 0.85 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.onAccent },
  body: { flex: 1, gap: 1 },
  caption: {
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.onAccent,
    opacity: 0.8,
  },
  name: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.onAccent,
  },
  rest: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.onAccent,
  },
  restText: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.accentText,
  },
  clock: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.numSemibold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.onAccent,
  },
}));
