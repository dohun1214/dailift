import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, type LayoutChangeEvent, useWindowDimensions } from 'react-native';

const OPEN_MS = 260;
const CLOSE_MS = 200;

/**
 * 아래에서 올라오는 창의 움직임: 열릴 때 바닥에서 밀려 올라오고 배경이 어두워지며,
 * 닫힐 때는 다시 내려간 뒤에 사라진다(`mounted`가 그때 false가 된다).
 * 창에 `onLayout`을 걸어 높이를 알려 주면 그 높이만큼만 움직인다.
 */
export function useSheetMotion(visible: boolean) {
  const { height: windowHeight } = useWindowDimensions();
  const open = useRef(new Animated.Value(0)).current;
  // 높이를 알기 전에는 화면 밖에서 시작한다.
  const height = useRef(new Animated.Value(windowHeight)).current;
  const [mounted, setMounted] = useState(visible);
  /** 열어야 하는데 아직 창이 그려지지 않았다. 그려지는 순간(onLayout)에 올리기 시작한다 */
  const waiting = useRef(false);
  const mountedRef = useRef(mounted);
  mountedRef.current = mounted;
  const rise = () =>
    Animated.timing(open, {
      toValue: 1,
      duration: OPEN_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

  // biome-ignore lint/correctness/useExhaustiveDependencies: 열림 · 닫힘이 바뀔 때만 움직인다
  useEffect(() => {
    if (visible) {
      // 내려가는 중에 다시 열리면 그 자리에서 바로 올린다.
      if (mountedRef.current) {
        rise();
        return;
      }
      // 창이 화면에 붙기 전에 시작하면 올라오는 앞부분이 보이지 않는다.
      waiting.current = true;
      open.setValue(0);
      setMounted(true);
      return;
    }
    waiting.current = false;
    Animated.timing(open, {
      toValue: 0,
      duration: CLOSE_MS,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setMounted(false);
    });
  }, [visible, open]);

  const translateY = useMemo(
    () => Animated.multiply(height, Animated.subtract(1, open)),
    [height, open],
  );
  const onLayout = (e: LayoutChangeEvent) => {
    height.setValue(e.nativeEvent.layout.height);
    if (!waiting.current) return;
    waiting.current = false;
    rise();
  };

  return { mounted, backdropOpacity: open, translateY, onLayout };
}
