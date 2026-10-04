import { Equal, Trash2 } from 'lucide-react-native';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { type LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { scheduleOnRN } from 'react-native-worklets';

type Layout = { y: number; h: number };

export type WorkoutEditRow = { id: string; name: string; meta: string };

type Props = {
  rows: readonly WorkoutEditRow[];
  /** 꾹 눌러서 들어왔을 때 그 종목을 집은 것처럼 강조한다 */
  highlightId: string | null;
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
};

/** 행 사이 간격 (styles.list의 gap과 같아야 한다) */
const GAP = 10;

/** 드래그한 행의 중심이 다른 행의 가운데를 넘으면 그 자리로 옮긴다. */
function targetIndex(from: number, dy: number, layouts: readonly Layout[]): number {
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

/** 운동 중 종목 편집: 손잡이(또는 행을 꾹 눌러) 끌어서 순서 변경, 휴지통으로 삭제 */
export function WorkoutEditList({ rows, highlightId, onMove, onRemove }: Props) {
  const active = useSharedValue(-1);
  const dy = useSharedValue(0);
  const layouts = useSharedValue<Layout[]>([]);
  const layoutRef = useRef<Layout[]>([]);

  const setLayout = useCallback(
    (index: number, e: LayoutChangeEvent) => {
      const { y, height } = e.nativeEvent.layout;
      layoutRef.current[index] = { y, h: height };
      layoutRef.current.length = rows.length;
      layouts.value = [...layoutRef.current];
    },
    [layouts, rows.length],
  );

  return (
    <View style={styles.list}>
      {rows.map((row, index) => (
        <Row
          key={row.id}
          row={row}
          index={index}
          count={rows.length}
          highlighted={row.id === highlightId}
          active={active}
          dy={dy}
          layouts={layouts}
          onLayout={setLayout}
          onMove={onMove}
          onRemove={onRemove}
        />
      ))}
    </View>
  );
}

type RowProps = {
  row: WorkoutEditRow;
  index: number;
  count: number;
  highlighted: boolean;
  active: SharedValue<number>;
  dy: SharedValue<number>;
  layouts: SharedValue<Layout[]>;
  onLayout: (index: number, e: LayoutChangeEvent) => void;
  onMove: (from: number, to: number) => void;
  onRemove: (id: string) => void;
};

function Row({
  row,
  index,
  count,
  highlighted,
  active,
  dy,
  layouts,
  onLayout,
  onMove,
  onRemove,
}: RowProps) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  // 빌더를 함수로 감싸면 콜백이 자동으로 워클릿이 되지 않아 직접 표시한다.
  const drag = (pan: ReturnType<typeof Gesture.Pan>) =>
    pan
      .onStart(() => {
        'worklet';
        active.value = index;
        dy.value = 0;
      })
      .onUpdate((e) => {
        'worklet';
        dy.value = e.translationY;
      })
      .onEnd(() => {
        'worklet';
        const to = targetIndex(index, dy.value, layouts.value);
        active.value = -1;
        dy.value = 0;
        if (to !== index) scheduleOnRN(onMove, index, to);
      })
      .onFinalize(() => {
        'worklet';
        active.value = -1;
        dy.value = 0;
      });
  // 손잡이는 바로, 행의 나머지 부분은 꾹 누른 뒤에 끌린다(목록 스크롤과 겹치지 않게).
  const gripPan = drag(Gesture.Pan().minDistance(0));
  const rowPan = drag(Gesture.Pan().activateAfterLongPress(250));

  const animated = useAnimatedStyle(() => {
    const from = active.value;
    if (from === -1) return { transform: [{ translateY: 0 }], zIndex: 0 };
    if (from === index) return { transform: [{ translateY: dy.value }], zIndex: 10 };
    const to = targetIndex(from, dy.value, layouts.value);
    const h = (layouts.value[from]?.h ?? 0) + GAP;
    let shift = 0;
    if (from < to && index > from && index <= to) shift = -h;
    if (from > to && index >= to && index < from) shift = h;
    return { transform: [{ translateY: withTiming(shift, { duration: 120 }) }], zIndex: 0 };
  });
  // 끄는 중인 행(또는 꾹 눌러 들어온 행)은 테두리로 들린 것처럼 보인다.
  const accent = theme.colors.accent;
  const raised = theme.colors.surface2;
  const flat = theme.colors.surface;
  const lifted = useAnimatedStyle(() => {
    const on = active.value === index || (highlighted && active.value === -1);
    return { borderColor: on ? accent : 'transparent', backgroundColor: on ? raised : flat };
  });

  const actions = [
    ...(index > 0 ? [{ name: 'moveUp', label: t('routines.edit.moveUp') }] : []),
    ...(index < count - 1 ? [{ name: 'moveDown', label: t('routines.edit.moveDown') }] : []),
  ];

  return (
    <Animated.View onLayout={(e) => onLayout(index, e)} style={animated}>
      <GestureDetector gesture={rowPan}>
        <Animated.View style={[styles.row, lifted]}>
          <GestureDetector gesture={gripPan}>
            <View
              style={styles.grip}
              accessible
              accessibilityLabel={`${row.name}, ${t('routines.edit.drag')}`}
              accessibilityActions={actions}
              onAccessibilityAction={(e) => {
                if (e.nativeEvent.actionName === 'moveUp') onMove(index, index - 1);
                if (e.nativeEvent.actionName === 'moveDown') onMove(index, index + 1);
              }}
            >
              <Equal
                size={20}
                color={highlighted ? theme.colors.text : theme.colors.text2}
                strokeWidth={1.8}
              />
            </View>
          </GestureDetector>
          <View style={styles.body}>
            <Text style={styles.name} numberOfLines={1}>
              {row.name}
            </Text>
            <Text style={styles.meta} numberOfLines={1}>
              {row.meta}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('workout.edit.removeA11y', { name: row.name })}
            onPress={() => onRemove(row.id)}
            style={({ pressed }) => [styles.trash, pressed && styles.pressed]}
          >
            <Trash2 size={20} color={theme.colors.danger} strokeWidth={1.8} />
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  list: { gap: GAP },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 4,
    paddingRight: 6,
    borderRadius: theme.radius.lg,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: theme.colors.surface,
  },
  grip: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  name: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  trash: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
}));
