import { useNavigation } from 'expo-router';
import { type RefObject, useCallback, useEffect } from 'react';
import { Keyboard, Platform, type ScrollView, TextInput } from 'react-native';

/** 입력칸 아래로 남겨 둘 여백(입력칸을 감싼 카드의 아래쪽까지 보이도록 넉넉히) */
const GAP = 36;
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

  /** `shrink`: 곧 키보드만큼 줄어들 높이(키보드가 올라오기 시작할 때 미리 맞추려고) */
  const reveal = useCallback(
    (shrink = 0) => {
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
          const visible = sh - shrink;
          if (!(h > 0) || !(visible > 0)) return;
          // 이미 보인다
          if (y + h + GAP <= sy + visible) return;
          // 내용 안에서의 위치를 재서 그 칸의 아래가 보이는 영역의 아래에 오게 한다.
          // 이 스크롤 영역 안의 칸이 아니면 실패로 끝나고 아무 일도 없다.
          measureLayout.call(
            input,
            content,
            (_l, top, _w2, height) => {
              scroll.scrollTo({ y: Math.max(0, top + height + GAP - visible), animated: true });
            },
            () => undefined,
          );
        });
      });
    },
    [scrollRef, navigation],
  );

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // 화면이 키보드만큼 줄어든 뒤에 잰다(줄어드는 것이 이 알림보다 조금 늦을 수 있다).
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(reveal, SETTLE_MS);
    });
    // iOS는 키보드가 올라오기 시작할 때 높이를 알려 준다 → 키보드와 함께 올라가게 미리 맞춘다.
    // (다 올라온 뒤에 위에서 한 번 더 정확히 맞춘다.)
    // 이미 올라와 있는 키보드가 모양만 바뀔 때는 화면이 더 줄지 않으므로 미리 맞추지 않는다.
    const early =
      Platform.OS === 'ios'
        ? Keyboard.addListener('keyboardWillShow', (e) => {
            if (!Keyboard.isVisible()) reveal(e.endCoordinates.height);
          })
        : null;
    const again = () => reveal();
    reveals.add(again);
    return () => {
      sub.remove();
      early?.remove();
      reveals.delete(again);
      if (timer) clearTimeout(timer);
    };
  }, [reveal, enabled]);

  return { reveal };
}
