import { type RefObject, useCallback, useEffect, useRef } from 'react';
import {
  Keyboard,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollView,
  TextInput,
} from 'react-native';

/** 입력칸 아래로 남겨 둘 여백 */
const GAP = 16;
/** 키보드가 다 올라온 뒤 화면 배치가 끝나기를 기다리는 시간 */
const SETTLE_MS = 150;

type Measurable = {
  measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => void;
};

/**
 * 키보드가 올라온 뒤에도 입력 중인 칸이 가려져 있으면 그만큼 스크롤을 올린다.
 * 화면이 키보드만큼 줄어드는 것(KeyboardAvoidingView)만으로는 아래쪽 칸이 따라 올라오지 않는다(iOS).
 * 이미 보이는 칸은 건드리지 않는다. `onScroll`을 ScrollView에 걸어야 한다.
 */
export function useKeyboardReveal(scrollRef: RefObject<ScrollView | null>, enabled = true) {
  const offset = useRef(0);

  const reveal = useCallback(() => {
    const scroll = scrollRef.current as (ScrollView & Partial<Measurable>) | null;
    const input = TextInput.State.currentlyFocusedInput() as Partial<Measurable> | null;
    if (!scroll?.measureInWindow || !input?.measureInWindow) return;
    input.measureInWindow((_x, y, _w, h) => {
      scroll.measureInWindow?.((_sx, sy, _sw, sh) => {
        // 스크롤 영역 밖(다른 창 안)의 칸이거나 높이를 모르면 그대로 둔다.
        if (!(h > 0) || !(sh > 0) || y + h < sy) return;
        const overlap = y + h + GAP - (sy + sh);
        if (overlap > 0) scroll.scrollTo({ y: offset.current + overlap, animated: true });
      });
    });
  }, [scrollRef]);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // 화면이 키보드만큼 줄어든 뒤에 잰다(줄어드는 것이 이 알림보다 조금 늦을 수 있다).
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(reveal, SETTLE_MS);
    });
    return () => {
      sub.remove();
      if (timer) clearTimeout(timer);
    };
  }, [reveal, enabled]);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = e.nativeEvent.contentOffset.y;
  }, []);

  return { onScroll, reveal };
}
