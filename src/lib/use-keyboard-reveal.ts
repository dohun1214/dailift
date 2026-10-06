import { useNavigation } from 'expo-router';
import { type RefObject, useCallback, useEffect } from 'react';
import { Keyboard, Platform, type ScrollView, TextInput } from 'react-native';

/** 입력칸 아래로 남겨 둘 여백(입력칸을 감싼 카드의 아래쪽까지 보이도록 넉넉히) */
const GAP = 36;
/**
 * 키보드가 다 올라온 뒤 화면 배치가 끝나기를 기다리는 시간.
 * iOS는 키보드가 올라오기 시작할 때 화면이 이미 줄어 있어 거의 기다릴 필요가 없다.
 */
const SETTLE_MS = Platform.OS === 'ios' ? 30 : 150;
/** 키보드가 올라오기 시작했는데 아직 포커스가 안 잡혔을 때 다시 해 보는 간격 · 횟수 */
const EARLY_RETRY_MS = 16;
const EARLY_RETRIES = 12;

/** 올라오고 있는 키보드: 다 올라왔을 때의 위쪽 좌표와 높이 */
type Rising = { top: number; height: number };

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

  /**
   * `rising`: 키보드가 올라오기 시작할 때 미리 맞추려고 넘긴다(화면이 아직 줄지 않았으면 줄어들 만큼 뺀다).
   * 입력 중인 칸을 아직 알 수 없으면 false(잠시 뒤 다시 해 볼 수 있다).
   */
  const reveal = useCallback(
    (rising?: Rising): boolean => {
      // 다른 화면에 가려져 있으면 그 화면의 입력칸이다.
      if (!navigation.isFocused()) return true;
      const scroll = scrollRef.current as Scroll | null;
      const content = scroll?.getInnerViewRef?.();
      if (!scroll?.measureInWindow || !content) return true;
      const input = TextInput.State.currentlyFocusedInput() as Partial<Host> | null;
      if (!input?.measureInWindow || !input.measureLayout) return false;
      const { measureLayout } = input;
      input.measureInWindow((_x, y, _w, h) => {
        scroll.measureInWindow?.((_sx, sy, _sw, sh) => {
          // 스크롤 영역이 키보드 자리까지 내려와 있으면 아직 줄기 전이다 → 키보드 높이만큼 줄어든다.
          const shrink = rising && sy + sh > rising.top + 1 ? rising.height : 0;
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
      return true;
    },
    [scrollRef, navigation],
  );

  useEffect(() => {
    if (!enabled) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // 화면이 키보드만큼 줄어든 뒤에 잰다(줄어드는 것이 이 알림보다 조금 늦을 수 있다).
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => reveal(), SETTLE_MS);
    });
    // iOS는 키보드가 올라오기 시작할 때 높이를 알려 준다 → 키보드와 함께 올라가게 미리 맞춘다.
    // (다 올라온 뒤에 위에서 한 번 더 정확히 맞춘다.)
    // 이미 올라와 있는 키보드가 모양만 바뀔 때는 화면이 더 줄지 않으므로 미리 맞추지 않는다.
    // 여러 줄 입력칸(메모)은 이 알림이 포커스보다 먼저 와서, 포커스가 잡힐 때까지 잠깐 다시 해 본다.
    let earlyTimer: ReturnType<typeof setTimeout> | null = null;
    const early =
      Platform.OS === 'ios'
        ? Keyboard.addListener('keyboardWillShow', (e) => {
            if (Keyboard.isVisible()) return;
            const rising = { top: e.endCoordinates.screenY, height: e.endCoordinates.height };
            let tries = 0;
            const attempt = () => {
              earlyTimer = null;
              if (reveal(rising)) return;
              tries += 1;
              if (tries <= EARLY_RETRIES) earlyTimer = setTimeout(attempt, EARLY_RETRY_MS);
            };
            if (earlyTimer) clearTimeout(earlyTimer);
            // 포커스로 화면이 바뀌는 곳(운동 화면의 아래 버튼 → 키보드 위 줄)이 먼저 그려진 뒤에 잰다.
            earlyTimer = setTimeout(attempt, 0);
          })
        : null;
    const again = () => reveal();
    reveals.add(again);
    return () => {
      sub.remove();
      early?.remove();
      reveals.delete(again);
      if (timer) clearTimeout(timer);
      if (earlyTimer) clearTimeout(earlyTimer);
    };
  }, [reveal, enabled]);

  return { reveal };
}
