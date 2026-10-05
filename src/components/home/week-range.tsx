import { useEffect, useRef } from 'react';
import { Text } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

const LINE = 17;
/** 화면의 줄 사이 간격(홈 `page.gap`). 닫혀 있을 때 이 줄이 간격을 하나 더 만들지 않게 지운다 */
const PAGE_GAP = 18;

/**
 * 이번 주가 아닌 주를 볼 때만 날짜 줄 위에 보이는 "9월 7일 – 13일".
 * 갑자기 끼어들어 아래 내용이 튀지 않도록 높이를 부드럽게 펼친다.
 */
export function WeekRange({ label }: { label: string | null }) {
  const open = useSharedValue(label ? 1 : 0);
  // 접히는 동안에는 마지막 글자를 그대로 둔다.
  const shown = useRef(label ?? '');
  if (label) shown.current = label;

  // biome-ignore lint/correctness/useExhaustiveDependencies: 보일지 말지가 바뀔 때만 움직인다
  useEffect(() => {
    open.value = withTiming(label ? 1 : 0, { duration: 180 });
  }, [label !== null]);

  const style = useAnimatedStyle(() => ({
    height: LINE * open.value,
    marginTop: -6 * open.value,
    marginBottom: -PAGE_GAP + 8 * open.value,
    opacity: open.value,
  }));

  return (
    <Animated.View
      style={[styles.wrap, style]}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'auto' : 'no-hide-descendants'}
    >
      <Text style={styles.text} numberOfLines={1}>
        {shown.current}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: { overflow: 'hidden', paddingHorizontal: 4 },
  text: {
    fontSize: 13,
    lineHeight: LINE,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
}));
