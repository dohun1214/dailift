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
  /** 그 주의 7칸 (0 = 이번 주, -1 = 지난주, 1 = 다음 주) */
  daysFor: (weekOffset: number) => readonly StripDay[];
  dateFormat: Intl.DateTimeFormat;
  /** 보고 있는 주 */
  weekOffset: number;
  /** 넘길 수 있는 범위 */
  minOffset: number;
  maxOffset: number;
  /** 창을 띄워 보고 있는 날 (테두리로 표시) */
  selected: Date | null;
  /** -1: 지난주로, 1: 다음 주로 */
  onShift: (dir: -1 | 1) => void;
  onDayPress: (day: StripDay) => void;
};

/** 이만큼 밀거나 이 속도로 튕기면 주가 넘어간다 */
const SWIPE = 48;
const FLING = 500;

/**
 * 한 주 7칸: 오늘(포인트색) · 운동함(옅은 포인트색 + 체크) · 예정(점) · 쉬는 날.
 * 칸을 누르면 그날 내용을 보고, 좌우로 밀면 주가 넘어간다.
 * 앞뒤 주를 옆에 붙여 그려 두어서, 밀기 시작하면 옆 주의 끝 날짜부터 따라 들어온다.
 */
export function WeekStrip({
  daysFor,
  dateFormat,
  weekOffset,
  minOffset,
  maxOffset,
  selected,
  onShift,
  onDayPress,
}: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  /** 지금 보이는 위치(주 단위, 소수). 0이면 이번 주가 가운데 */
  const page = useSharedValue(weekOffset);
  /** 가고 있는 주(정수). 넘어가는 도중에 또 밀면 여기서 이어서 센다 */
  const target = useSharedValue(weekOffset);
  const start = useSharedValue(weekOffset);
  const origin = useSharedValue(weekOffset);
  const width = useSharedValue(0);
  /** 밀어서 넘긴 것까지 셈한 주. 화면의 주가 이것과 다르면 밖에서 바뀐 것이다 */
  const expected = useRef(weekOffset);
  const shiftRef = useRef(onShift);
  shiftRef.current = onShift;

  // 밀어서 넘긴 게 아닌데 주가 바뀌면(홈을 떠났다 돌아옴, 접근성 동작) 그 주로 옮긴다.
  // 움직임 없이 바로 옮긴다: 홈이 다른 화면에 가려지는 순간에 시작한 움직임은 끝까지 가지 못하고
  // 멈춘 자리에 남는 일이 있었다(날짜 줄만 지난주에 머무름).
  // biome-ignore lint/correctness/useExhaustiveDependencies: 주가 바뀔 때만 맞춘다
  useEffect(() => {
    if (expected.current === weekOffset) return;
    expected.current = weekOffset;
    target.value = weekOffset;
    page.value = weekOffset;
  }, [weekOffset]);

  const pan = useMemo(() => {
    const shift = (dir: -1 | 1) => {
      expected.current += dir;
      shiftRef.current(dir);
    };
    return Gesture.Pan()
      .activeOffsetX([-16, 16])
      .failOffsetY([-14, 14])
      .onBegin(() => {
        // 넘어가는 도중이면 보이는 자리에서 그대로 잡고, 가던 주를 기준으로 삼는다.
        start.value = page.value;
        origin.value = target.value;
      })
      .onUpdate((e) => {
        if (width.value <= 0) return;
        const lower = Math.max(minOffset, origin.value - 1);
        const upper = Math.min(maxOffset, origin.value + 1);
        const raw = start.value - e.translationX / width.value;
        // 더 넘길 주가 없으면 조금만 끌려온다
        page.value =
          raw < lower
            ? lower + (raw - lower) * 0.2
            : raw > upper
              ? upper + (raw - upper) * 0.2
              : raw;
      })
      .onEnd((e) => {
        const next = e.translationX < -SWIPE || e.velocityX < -FLING;
        const prev = e.translationX > SWIPE || e.velocityX > FLING;
        const dir: -1 | 0 | 1 =
          next && origin.value < maxOffset ? 1 : prev && origin.value > minOffset ? -1 : 0;
        target.value = origin.value + dir;
        // 다 넘어가기 전에 또 밀어서 끊겨도 넘긴 것은 넘긴 것으로 센다.
        page.value = withTiming(target.value, { duration: 200 }, () => {
          if (dir !== 0) scheduleOnRN(shift, dir);
        });
      });
  }, [minOffset, maxOffset, page, start, origin, target, width]);

  const slide = useAnimatedStyle(() => ({
    transform: [{ translateX: -page.value * width.value }],
  }));

  const canPrev = weekOffset > minOffset;
  const canNext = weekOffset < maxOffset;
  const weekActions = [
    ...(canNext ? [{ name: 'nextWeek', label: t('home.stripNext') }] : []),
    ...(canPrev ? [{ name: 'prevWeek', label: t('home.stripPrev') }] : []),
  ];
  // 빠르게 두 번 밀어도 빈칸이 보이지 않게 두 주씩 옆에 그려 둔다.
  const offsets = [-2, -1, 0, 1, 2]
    .map((d) => weekOffset + d)
    .filter((o) => o >= minOffset && o <= maxOffset);

  return (
    <GestureDetector gesture={pan}>
      <View
        style={styles.clip}
        onLayout={(e) => {
          width.value = e.nativeEvent.layout.width;
        }}
      >
        <Animated.View style={[styles.track, slide]}>
          {offsets.map((o) => (
            <View
              key={o}
              style={[styles.week, { left: `${o * 100}%` }]}
              // 옆 주는 밀 때만 보이므로 화면 낭독기에는 지금 주만 읽힌다
              importantForAccessibility={o === weekOffset ? 'auto' : 'no-hide-descendants'}
              accessibilityElementsHidden={o !== weekOffset}
            >
              {daysFor(o).map((d) => {
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
                      state: t(
                        `home.state.${d.state === 'today' && d.done ? 'todayDone' : d.state}`,
                      ),
                    })}
                    accessibilityHint={t('home.dayHint')}
                    // 화면 낭독기에서는 밀 수 없으니 날짜 칸의 동작으로 주를 넘긴다.
                    accessibilityActions={weekActions}
                    onAccessibilityAction={(e) => {
                      if (e.nativeEvent.actionName === 'nextWeek' && canNext) onShift(1);
                      if (e.nativeEvent.actionName === 'prevWeek' && canPrev) onShift(-1);
                    }}
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
            </View>
          ))}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create((theme) => ({
  // 화면 양 끝까지 넓혀서(화면 여백 16을 상쇄) 옆 주가 가장자리에서 들어오게 한다.
  // 위아래 4는 누른 칸의 테두리가 잘리지 않을 자리.
  clip: { height: 80, marginHorizontal: -16, marginVertical: -4, overflow: 'hidden' },
  track: { flex: 1 },
  week: {
    position: 'absolute',
    top: 4,
    width: '100%',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 16,
  },
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
