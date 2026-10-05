import { Check } from 'lucide-react-native';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { scheduleOnRN } from 'react-native-worklets';

import type { StripDay } from '@/domain/home';
import { WEEKDAYS } from '@/lib/weekdays';

type Props = {
  days: readonly StripDay[];
  dateFormat: Intl.DateTimeFormat;
  /** 보고 있는 주 (0 = 이번 주). 바뀌면 새 주가 옆에서 들어온다 */
  weekOffset: number;
  /** 창을 띄워 보고 있는 날 (테두리로 표시) */
  selected: Date | null;
  canPrev: boolean;
  canNext: boolean;
  /** -1: 지난주로, 1: 다음 주로 */
  onShift: (dir: -1 | 1) => void;
  onDayPress: (day: StripDay) => void;
};

/** 이만큼 밀면 주가 넘어간다 */
const SWIPE = 48;

/**
 * 한 주 7칸: 오늘(포인트색) · 운동함(옅은 포인트색 + 체크) · 예정(점) · 쉬는 날.
 * 칸을 누르면 그날 내용을 보고, 좌우로 밀면 주가 넘어간다.
 */
export function WeekStrip({
  days,
  dateFormat,
  weekOffset,
  selected,
  canPrev,
  canNext,
  onShift,
  onDayPress,
}: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const tx = useSharedValue(0);
  const width = useSharedValue(0);
  /** 방금 넘긴 방향. 새 주를 그 반대쪽에서 들여보낸다 */
  const entering = useRef<-1 | 0 | 1>(0);
  const shiftRef = useRef(onShift);
  shiftRef.current = onShift;

  // weekOffset이 바뀌면(새 주가 그려지면) 옆에서 들어오게 한다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: 주가 바뀔 때만 움직인다
  useEffect(() => {
    const from = entering.current;
    entering.current = 0;
    if (from === 0) {
      tx.value = 0;
      return;
    }
    tx.value = from * width.value;
    tx.value = withTiming(0, { duration: 180 });
  }, [weekOffset]);

  const pan = useMemo(() => {
    const shift = (dir: -1 | 1) => {
      entering.current = dir;
      shiftRef.current(dir);
    };
    return Gesture.Pan()
      .activeOffsetX([-16, 16])
      .failOffsetY([-14, 14])
      .onUpdate((e) => {
        const blocked = (e.translationX > 0 && !canPrev) || (e.translationX < 0 && !canNext);
        tx.value = e.translationX * (blocked ? 0.2 : 1);
      })
      .onEnd((e) => {
        const dir: -1 | 0 | 1 =
          e.translationX < -SWIPE && canNext ? 1 : e.translationX > SWIPE && canPrev ? -1 : 0;
        if (dir === 0) {
          tx.value = withTiming(0, { duration: 160 });
          return;
        }
        tx.value = withTiming(-dir * width.value, { duration: 140 }, (finished) => {
          if (finished) scheduleOnRN(shift, dir);
        });
      });
  }, [canPrev, canNext, tx, width]);

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
    opacity: width.value > 0 ? 1 - Math.min(1, Math.abs(tx.value) / width.value) * 0.7 : 1,
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        style={[styles.grid, slide]}
        onLayout={(e) => {
          width.value = e.nativeEvent.layout.width;
        }}
        accessibilityLabel={t(weekOffset === 0 ? 'home.stripA11y' : 'home.stripOtherA11y')}
        accessibilityHint={t('home.stripHint')}
        accessibilityActions={[
          ...(canNext ? [{ name: 'increment' as const }] : []),
          ...(canPrev ? [{ name: 'decrement' as const }] : []),
        ]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'increment' && canNext) onShift(1);
          if (e.nativeEvent.actionName === 'decrement' && canPrev) onShift(-1);
        }}
      >
        {days.map((d) => {
          const dow = WEEKDAYS[d.weekday] ?? 'mon';
          const picked = selected !== null && selected.getTime() === d.date.getTime();
          return (
            <Pressable
              key={d.date.toISOString()}
              style={({ pressed }) => [
                styles.cell,
                d.state === 'today' && styles.today,
                d.state === 'done' && styles.done,
                pressed && styles.pressed,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: picked }}
              accessibilityLabel={t('home.dayA11y', {
                date: dateFormat.format(d.date),
                state: t(`home.state.${d.state === 'today' && d.done ? 'todayDone' : d.state}`),
              })}
              accessibilityHint={t('home.dayHint')}
              onPress={() => onDayPress(d)}
            >
              {picked ? <View style={styles.ring} pointerEvents="none" /> : null}
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
                {d.state === 'today' && d.done ? (
                  <Check size={13} color={theme.colors.onAccent} strokeWidth={2.6} />
                ) : null}
                {d.state === 'plan' ? <View style={styles.dot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </Animated.View>
    </GestureDetector>
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
  pressed: { opacity: 0.7 },
  // 누른 칸: 칸 바깥으로 2 띄운 테두리
  ring: {
    position: 'absolute',
    top: -4,
    right: -4,
    bottom: -4,
    left: -4,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: theme.colors.text,
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
