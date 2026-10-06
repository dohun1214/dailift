import { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

export type RowLayout = { y: number; h: number };

/** 놓은 뒤 새 순서로 다시 그려지지 않을 때 붙잡아 둔 것을 푸는 시간 */
const RELEASE_MS = 500;

/** 드래그한 행의 중심이 다른 행의 가운데를 넘으면 그 자리로 옮긴다. */
export function targetIndex(from: number, dy: number, layouts: readonly RowLayout[]): number {
  'worklet';
  const cur = layouts[from];
  if (!cur) return from;
  const center = cur.y + cur.h / 2 + dy;
  for (let i = 0; i < from; i++) {
    const l = layouts[i];
    if (l && center < l.y + l.h / 2) return i;
  }
  for (let i = layouts.length - 1; i > from; i--) {
    const l = layouts[i];
    if (l && center > l.y + l.h / 2) return i;
  }
  return from;
}

/** from 행을 to 자리에 놓았을 때 원래 자리에서 얼마나 움직여 있어야 하는지 */
export function slotOffset(from: number, to: number, layouts: readonly RowLayout[]): number {
  'worklet';
  const a = layouts[from];
  const b = layouts[to];
  if (!a || !b) return 0;
  return to > from ? b.y + b.h - (a.y + a.h) : b.y - a.y;
}

/**
 * 끌어서 순서를 바꾸는 목록의 공용 상태.
 * 손을 놓는 순간 원래대로 돌려놓으면, 목록이 새 순서로 다시 그려지기 전까지 잠깐 옛 순서가 보인다.
 * 그래서 놓은 자리(`dropTo`)에 붙잡아 두었다가, 새 순서(`ids`)로 그려질 때 푼다.
 *
 * 푸는 것(UI 스레드)과 새 순서로 그리는 것(React)을 따로 하면 한 프레임이 어긋난다. 그래서 새 순서로
 * 그릴 때 행을 새로 만든다(`epoch`를 key에 넣는다): 새 행은 옮김 값 없이 태어나고 옛 행은 같은 때에 사라진다.
 * 행은 자기 `epoch`가 `dragEpoch`와 같을 때만 끌기 상태를 따른다.
 */
export function useDragReorder(ids: readonly string[], onMove: (from: number, to: number) => void) {
  /** 끌고 있는(또는 놓고 붙잡아 둔) 행의 순서. 없으면 -1 */
  const active = useSharedValue(-1);
  const dy = useSharedValue(0);
  /** 놓은 자리. 끄는 중이거나 쉬는 중이면 -1 */
  const dropTo = useSharedValue(-1);
  const layouts = useSharedValue<RowLayout[]>([]);
  const layoutRef = useRef<RowLayout[]>([]);
  /** 지금 끌기(붙잡아 둔 것 포함)가 어느 세대의 행에서 시작됐는지 */
  const dragEpoch = useSharedValue(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const count = ids.length;
  const order = ids.join('|');
  // 붙잡아 둔 채로 순서가 바뀌면 세대를 올려 행을 새로 만든다.
  const held = useRef(false);
  const shown = useRef({ order, epoch: 0 });
  if (shown.current.order !== order) {
    shown.current = { order, epoch: shown.current.epoch + (held.current ? 1 : 0) };
    held.current = false;
  }
  const epoch = shown.current.epoch;

  const setLayout = useCallback(
    (index: number, e: LayoutChangeEvent) => {
      const { y, height } = e.nativeEvent.layout;
      layoutRef.current[index] = { y, h: height };
      layoutRef.current.length = count;
      layouts.value = [...layoutRef.current];
    },
    [layouts, count],
  );

  const release = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    held.current = false;
    active.value = -1;
    dy.value = 0;
    dropTo.value = -1;
  }, [active, dy, dropTo]);

  // 새 순서로 그려졌으면 끌기 상태도 치운다(새 행은 이미 이 상태를 보지 않는다).
  // biome-ignore lint/correctness/useExhaustiveDependencies: 순서가 바뀔 때마다 푼다
  useLayoutEffect(release, [order]);
  useEffect(() => release, [release]);

  /** 놓았을 때(워클릿에서 부른다): 순서를 바꾸고, 혹시 다시 그려지지 않으면 조금 뒤에 푼다 */
  const drop = useCallback(
    (from: number, to: number) => {
      held.current = true;
      onMove(from, to);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(release, RELEASE_MS);
    },
    [onMove, release],
  );

  return { active, dy, dropTo, dragEpoch, epoch, layouts, setLayout, drop };
}
