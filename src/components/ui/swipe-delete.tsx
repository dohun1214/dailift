import { Trash2 } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

type Props = {
  children: ReactNode;
  /** 줄이 화면 밖으로 다 밀려 나간 뒤에 부른다 */
  onDelete: () => void;
};

/** 줄 너비의 이만큼 넘게 밀거나, 이 속도보다 빠르게 튕기면 지운다 */
const DELETE_RATIO = 0.4;
const DELETE_VELOCITY = -900;

/**
 * 왼쪽으로 쭉 밀면 바로 지워지는 줄. 미는 동안 뒤에 빨간 바탕과 휴지통이 보이고,
 * 충분히 밀고 놓으면 줄이 끝까지 밀려 나간 뒤 `onDelete`를 부른다. 덜 밀었으면 제자리로 돌아온다.
 * 버튼이 따로 없으므로 스크린리더용 삭제 동작은 안의 줄에 `accessibilityActions`로 달아 준다.
 */
export function SwipeDelete({ children, onDelete }: Props) {
  const { theme } = useUnistyles();
  const x = useSharedValue(0);
  const width = useSharedValue(0);

  const pan = Gesture.Pan()
    // 왼쪽으로 조금 밀었을 때만 잡고, 위아래로 움직이면 목록 스크롤에 넘긴다.
    .activeOffsetX(-12)
    .failOffsetX(12)
    .failOffsetY([-10, 10])
    .onUpdate((e) => {
      x.value = Math.min(0, e.translationX);
    })
    .onEnd((e) => {
      const far = width.value > 0 && x.value < -width.value * DELETE_RATIO;
      if (far || e.velocityX < DELETE_VELOCITY) {
        x.value = withTiming(
          -width.value,
          { duration: 160, easing: Easing.out(Easing.cubic) },
          (finished) => {
            if (finished) runOnJS(onDelete)();
          },
        );
      } else {
        x.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
      }
    });

  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));
  // 밀지 않을 때는 빨간 바탕을 숨긴다(둥근 모서리 틈으로 비치지 않게).
  const behind = useAnimatedStyle(() => ({ opacity: x.value < 0 ? 1 : 0 }));

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => {
        width.value = e.nativeEvent.layout.width;
      }}
    >
      <Animated.View
        style={[styles.behind, { backgroundColor: theme.colors.danger }, behind]}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Trash2 size={20} color={theme.colors.onPr} strokeWidth={1.8} />
      </Animated.View>
      <GestureDetector gesture={pan}>
        <Animated.View style={[{ backgroundColor: theme.colors.surface }, slide]}>
          {children}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create(() => ({
  wrap: { overflow: 'hidden' },
  behind: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingRight: 20,
  },
}));
