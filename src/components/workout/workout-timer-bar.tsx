import { BellRing, Pause, Play } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Linking, Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { timerElapsed, timerExpired } from '@/domain/cardio';
import { formatClock, REST_STEP_SEC } from '@/domain/rest-timer';
import { useNow } from '@/lib/use-now';
import { FREE_TIMER_ID, limitLabel, useCardioTimer } from '@/stores/cardio-timer';

/**
 * 운동 중 타이머 · 스톱워치(위쪽 타이머 버튼으로 시작). 휴식 타이머 바로 위에 같은 모양으로 붙는다.
 * 돌고 있는 것이 없으면 아무것도 그리지 않는다. 타이머가 끝나면 '타이머 끝'으로 바뀌고,
 * 확인을 누르거나 잠시 뒤 저절로 사라진다(`useWorkoutTimerAlarm`).
 */
export function WorkoutTimerBar() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const timer = useCardioTimer((s) => s.timers[FREE_TIMER_ID]);
  const blocked = useCardioTimer((s) => s.blocked);
  const now = useNow(250, !!timer && timer.startedAt !== null);

  if (!timer) return null;
  const store = useCardioTimer.getState();
  const end = () => store.take(FREE_TIMER_ID);
  const countdown = timer.limitSec !== undefined;
  const limit = timer.limitSec ?? 0;
  const elapsed = timerElapsed(timer, now);

  if (countdown && timerExpired(timer, now)) {
    return (
      <View style={[styles.box, styles.doneBox]} accessibilityLiveRegion="polite">
        <View style={styles.row}>
          <View style={styles.doneWrap} accessible accessibilityRole="alert">
            <BellRing size={20} color={theme.colors.onAccent} strokeWidth={1.8} />
            <Text style={styles.doneTitle}>{t('workout.timer.doneTitle')}</Text>
            <Text style={styles.doneBody} numberOfLines={1}>
              {t('workout.timer.doneBody', { time: limitLabel(limit) })}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={end}
            hitSlop={{ top: 4, bottom: 4 }}
            style={({ pressed }) => [styles.ok, pressed && styles.pressed]}
          >
            <Text style={styles.okText}>{t('workout.rest.ok')}</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const paused = timer.startedAt === null;
  const clock = formatClock(countdown ? limit - elapsed : elapsed);
  const caption = countdown
    ? t('workout.timer.tabTimer')
    : t(paused ? 'workout.timer.pausedCaption' : 'workout.timer.tabStopwatch');
  const ratio = countdown && limit > 0 ? Math.min(1, elapsed / limit) : 0;

  return (
    <View style={styles.box}>
      <View style={styles.row}>
        <View
          style={styles.timeWrap}
          accessible
          accessibilityRole="timer"
          accessibilityLabel={t(
            countdown ? 'workout.timer.leftA11y' : 'workout.timer.elapsedA11y',
            {
              time: clock,
            },
          )}
        >
          <Text style={styles.caption}>{caption}</Text>
          <Text style={styles.time}>{clock}</Text>
        </View>
        {countdown ? (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('workout.timer.minusA11y')}
              onPress={() => store.adjust(FREE_TIMER_ID, -REST_STEP_SEC)}
              hitSlop={{ top: 4, bottom: 4 }}
              style={({ pressed }) => [styles.small, pressed && styles.pressed]}
            >
              <Text style={styles.smallText}>{t('workout.rest.minus')}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('workout.timer.plusA11y')}
              onPress={() => store.adjust(FREE_TIMER_ID, REST_STEP_SEC)}
              hitSlop={{ top: 4, bottom: 4 }}
              style={({ pressed }) => [styles.small, pressed && styles.pressed]}
            >
              <Text style={styles.smallText}>{t('workout.rest.plus')}</Text>
            </Pressable>
          </>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t(paused ? 'workout.timer.resume' : 'workout.timer.pause')}
            onPress={() => (paused ? store.start(FREE_TIMER_ID) : store.pause(FREE_TIMER_ID))}
            hitSlop={{ top: 4, bottom: 4 }}
            style={({ pressed }) => [styles.small, pressed && styles.pressed]}
          >
            {paused ? (
              <Play size={18} color={theme.colors.text} strokeWidth={1.8} />
            ) : (
              <Pause size={18} color={theme.colors.text} strokeWidth={1.8} />
            )}
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          onPress={end}
          hitSlop={{ top: 4, bottom: 4 }}
          style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
        >
          <Text style={styles.skipText}>{t('workout.timer.end')}</Text>
        </Pressable>
      </View>
      {countdown ? (
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.round(ratio * 100)}%` }]} />
        </View>
      ) : null}
      {countdown && blocked ? (
        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openSettings().catch(() => {})}
          hitSlop={8}
        >
          <Text style={styles.blocked}>{t('workout.rest.blocked')}</Text>
        </Pressable>
      ) : null}
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
  doneBox: { backgroundColor: theme.colors.accent },
  doneWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  doneTitle: {
    fontSize: 17,
    lineHeight: 22,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.onAccent,
  },
  doneBody: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.onAccent,
    opacity: 0.8,
  },
  ok: {
    minWidth: 64,
    height: 40,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.onAccent,
  },
  okText: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.accent,
  },
  blocked: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
    textDecorationLine: 'underline',
  },
  track: { height: 4, borderRadius: 2, backgroundColor: theme.colors.surface2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: theme.colors.accent },
}));
