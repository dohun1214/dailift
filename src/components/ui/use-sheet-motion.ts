import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Keyboard,
  type LayoutChangeEvent,
  useWindowDimensions,
} from 'react-native';

const OPEN_MS = 260;
const CLOSE_MS = 200;
/**
 * 창이 다 내려가서 화면에서 떨어질 때까지 걸리는 시간(여유 포함).
 * 카메라 · 사진 선택 · 시스템 알림 같은 기기 화면은 이 뒤에 띄워야 한다 —
 * iOS는 닫히는 창 위에 띄운 화면을 창과 함께 닫아 버리고, 그 뒤로 앱이 눌리지 않게 된다.
 */
export const SHEET_CLOSED_MS = CLOSE_MS + 250;
/** 창이 내려간 뒤 앱의 다른 창(확인 창 · 다른 아래쪽 창)을 이어서 띄울 때 기다리는 시간 */
export const SHEET_NEXT_MS = CLOSE_MS + 120;

/**
 * 아래에서 올라오는 창의 움직임: 열릴 때 바닥에서 밀려 올라오고 배경이 어두워지며,
 * 닫힐 때는 다시 내려간 뒤에 사라진다(`mounted`가 그때 false가 된다).
 * 창에 `onLayout`을 걸어 높이를 알려 주면 그 높이만큼만 움직인다.
 */
export function useSheetMotion(visible: boolean, keepKeyboard = false) {
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
      // 입력 중에 열리면 키보드가 창을 가리지 않게 내린다(창 안에 입력칸이 있으면 그대로).
      if (!keepKeyboard) Keyboard.dismiss();
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
