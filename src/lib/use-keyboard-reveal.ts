import { useNavigation } from 'expo-router';
import { type RefObject, useCallback, useEffect } from 'react';
import { Keyboard, type ScrollView, TextInput } from 'react-native';

/** 입력칸 아래로 남겨 둘 여백 */
const GAP = 16;
/** 키보드가 다 올라온 뒤 화면 배치가 끝나기를 기다리는 시간 */
const SETTLE_MS = 150;

type Rect = (x: number, y: number, w: number, h: number) => void;
type Host = {
  measureInWindow: (cb: Rect) => void;
  measureLayout: (relativeTo: unknown, onSuccess: Rect, onFail?: () => void) => void;
};
/** 스크롤 내용이 담긴 안쪽 뷰(실제로는 있지만 타입 선언에는 없다) */
type Scroll = ScrollView & Partial<Host> & { getInnerViewRef?: () => unknown };

const reveals = new Set<() => void>();

/** 입력칸의 높이가 바뀌었을 때(여러 줄 메모) 다시 맞춘다. 지금 보이는 화면만 반응한다. */
export function revealFocusedInput() {
  for (const reveal of reveals) reveal();
}

/**
 * 키보드가 올라온 뒤에도 입력 중인 칸이 가려져 있으면 보이는 곳까지 스크롤을 올린다.
 * 화면이 키보드만큼 줄어드는 것(KeyboardAvoidingView)만으로는 아래쪽 칸이 따라 올라오지 않는다(iOS).
 * 이미 보이는 칸, 이 스크롤 영역 밖의 칸(다른 창 · 다른 화면)은 건드리지 않는다.
 */
export function useKeyboardReveal(scrollRef: RefObject<ScrollView | null>, enabled = true) {
  const navigation = useNavigation();

  const reveal = useCallback(() => {
    // 다른 화면에 가려져 있으면 그 화면의 입력칸이다.
    if (!navigation.isFocused()) return;
    const scroll = scrollRef.current as Scroll | null;
    const input = TextInput.State.currentlyFocusedInput() as Partial<Host> | null;
    const content = scroll?.getInnerViewRef?.();
    if (!scroll?.measureInWindow || !input?.measureInWindow || !input.measureLayout || !content)
      return;
    const { measureLayout } = input;
    input.measureInWindow((_x, y, _w, h) => {
      scroll.measureInWindow?.((_sx, sy, _sw, sh) => {
        if (!(h > 0) || !(sh > 0)) return;
        // 이미 보인다
        if (y + h + GAP <= sy + sh) return;
        // 내용 안에서의 위치를 재서 그 칸의 아래가 보이는 영역의 아래에 오게 한다.
        // 이 스크롤 영역 안의 칸이 아니면 실패로 끝나고 아무 일도 없다.
        measureLayout.call(
          input,
          content,
          (_l, top, _w2, height) => {
            scroll.scrollTo({ y: Math.max(0, top + height + GAP - sh), animated: true });
          },
          () => undefined,
        );
      });
    });
  }, [scrollRef, navigation]);

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // 화면이 키보드만큼 줄어든 뒤에 잰다(줄어드는 것이 이 알림보다 조금 늦을 수 있다).
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(reveal, SETTLE_MS);
    });
    reveals.add(reveal);
    return () => {
      sub.remove();
      reveals.delete(reveal);
      if (timer) clearTimeout(timer);
    };
  }, [reveal, enabled]);

  return { reveal };
}
