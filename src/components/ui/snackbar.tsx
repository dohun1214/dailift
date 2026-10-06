import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, PanResponder, Pressable, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

type Props = {
  message: string;
  actionLabel: string;
  onAction: () => void;
  /**
   * 넘기면 아래로 쓸어내려 닫을 수 있다(내려간 뒤에 부른다).
   * `autoHideMs`가 지나 저절로 내려갔을 때도 이것을 부른다.
   */
  onDismiss?: () => void;
  /** 이만큼 지나면 저절로 내려간다. `onDismiss`가 있을 때만 쓴다 */
  autoHideMs?: number;
};

/** 이만큼 끌어내리거나 이 속도로 튕기면 닫는다 */
const CLOSE_DISTANCE = 20;
const CLOSE_VELOCITY = 0.4;
/** 내려가는 거리(줄 높이 + 아래 여백보다 넉넉하게) */
const OUT_Y = 120;

/**
 * 방금 한 동작을 알리고 되돌릴 기회를 주는 한 줄 (화면 아래, 잠깐 떠 있다).
 * 아래에서 살짝 올라오며 나타나고, `onDismiss`를 넘기면 쓸어내리거나 시간이 지났을 때 아래로 내려가며 사라진다.
 */
export function Snackbar({ message, actionLabel, onAction, onDismiss, autoHideMs }: Props) {
  // 0 = 제자리, OUT_Y = 화면 아래로 내려감
  const y = useRef(new Animated.Value(24)).current;
  const dismissRef = useRef(onDismiss);
  dismissRef.current = onDismiss;
  const leaving = useRef(false);

  const leave = useRef(() => {
    if (leaving.current) return;
    leaving.current = true;
    Animated.timing(y, {
      toValue: OUT_Y,
      duration: 180,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(() => dismissRef.current?.());
  }).current;

  useEffect(() => {
    Animated.timing(y, {
      toValue: 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [y]);

  const canDismiss = onDismiss !== undefined;
  useEffect(() => {
    if (!canDismiss || !autoHideMs) return;
    const timer = setTimeout(leave, autoHideMs);
    return () => clearTimeout(timer);
  }, [canDismiss, autoHideMs, leave]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => y.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > CLOSE_DISTANCE || g.vy > CLOSE_VELOCITY) return leave();
          Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(y, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        },
      }),
    [y, leave],
  );

  return (
    <Animated.View
      style={[
        styles.bar,
        {
          opacity: y.interpolate({
            inputRange: [0, 80],
            outputRange: [1, 0],
            extrapolate: 'clamp',
          }),
          transform: [{ translateY: y }],
        },
      ]}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      {...(canDismiss ? pan.panHandlers : null)}
    >
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onAction}
        hitSlop={4}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      >
        <Text style={styles.actionText}>{actionLabel}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  bar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 18,
    paddingRight: 6,
    borderRadius: 18,
    backgroundColor: theme.colors.accent,
  },
  message: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 14,
    lineHeight: 19,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.onAccent,
  },
  action: {
    minWidth: 72,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  actionText: {
    fontSize: 14,
    lineHeight: 19,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.onAccent,
  },
}));
