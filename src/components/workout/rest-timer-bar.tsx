import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { elapsedRatio, formatClock, REST_STEP_SEC, remainingSec } from '@/domain/rest-timer';
import { useNow } from '@/lib/use-now';
import { useRestTimer } from '@/stores/rest-timer';

/** 운동 완료 버튼 위에 붙는 휴식 타이머. 쉬는 중이 아니면 아무것도 그리지 않는다(내용을 덮지 않음). */
export function RestTimerBar() {
  const { t } = useTranslation();
  const endsAt = useRestTimer((s) => s.endsAt);
  const totalSec = useRestTimer((s) => s.totalSec);
  const adjust = useRestTimer((s) => s.adjust);
  const stop = useRestTimer((s) => s.stop);
  const now = useNow(250, endsAt !== null);

  if (endsAt === null) return null;
  const left = remainingSec(endsAt, now);
  const ratio = elapsedRatio(endsAt, totalSec, now);
  const clock = formatClock(left);

  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <View
          style={styles.timeWrap}
          accessible
          accessibilityRole="timer"
          accessibilityLabel={t('workout.rest.remainingA11y', { time: clock })}
        >
          <Text style={styles.caption}>{t('workout.rest.resting')}</Text>
          <Text style={styles.time}>{clock}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('workout.rest.minusA11y')}
          onPress={() => adjust(-REST_STEP_SEC)}
          style={({ pressed }) => [styles.small, pressed && styles.pressed]}
        >
          <Text style={styles.smallText}>{t('workout.rest.minus')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('workout.rest.plusA11y')}
          onPress={() => adjust(REST_STEP_SEC)}
          style={({ pressed }) => [styles.small, pressed && styles.pressed]}
        >
          <Text style={styles.smallText}>{t('workout.rest.plus')}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={stop}
          style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
        >
          <Text style={styles.skipText}>{t('workout.rest.skip')}</Text>
        </Pressable>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  box: {
    gap: 10,
    paddingTop: 12,
    paddingRight: 12,
    paddingBottom: 14,
    paddingLeft: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.accentSoft,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  timeWrap: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  time: {
    fontSize: 22,
    lineHeight: 28,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  small: {
    minWidth: 48,
    height: 40,
    paddingHorizontal: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface2,
  },
  smallText: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.numSemibold,
    color: theme.colors.text,
  },
  skip: {
    minWidth: 72,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
  },
  skipText: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.onAccent,
  },
  pressed: { opacity: 0.7 },
  track: { height: 4, borderRadius: 2, backgroundColor: theme.colors.surface2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: theme.colors.accent },
}));
