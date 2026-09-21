import { useEffect } from 'react';
import { Pressable } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { StyleSheet } from 'react-native-unistyles';

type Props = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  /** 스크린리더용 이름 (옆 행의 라벨과 같게) */
  accessibilityLabel: string;
  disabled?: boolean;
};

const TRACK_W = 48;
const KNOB = 22;
const PAD = 3;

export function Toggle({ value, onValueChange, accessibilityLabel, disabled }: Props) {
  styles.useVariants({ on: value });
  const x = useSharedValue(value ? TRACK_W - KNOB - PAD * 2 : 0);

  useEffect(() => {
    x.value = withTiming(value ? TRACK_W - KNOB - PAD * 2 : 0, { duration: 160 });
  }, [value, x]);

  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      hitSlop={8}
      style={[styles.hit, disabled && styles.disabled]}
    >
      <Animated.View style={styles.track}>
        <Animated.View style={[styles.knob, knobStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  hit: { height: theme.hitSize, justifyContent: 'center' },
  track: {
    width: TRACK_W,
    height: 28,
    borderRadius: 14,
    padding: PAD,
    variants: {
      on: {
        true: { backgroundColor: theme.colors.accent },
        false: { backgroundColor: theme.colors.track },
      },
    },
  },
  knob: {
    width: KNOB,
    height: KNOB,
    borderRadius: KNOB / 2,
    variants: {
      on: {
        true: { backgroundColor: theme.colors.onAccent },
        false: {
          backgroundColor: theme.mode === 'light' ? theme.colors.surface2 : theme.colors.text2,
        },
      },
    },
  },
  disabled: { opacity: 0.4 },
}));
