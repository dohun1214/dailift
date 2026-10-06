import { ChevronDown, ChevronRight, Equal, Trash2 } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { type LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import Animated, { type SharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';
import { scheduleOnRN } from 'react-native-worklets';

import type { DraftItem } from '@/domain/routine-draft';
import { type RowLayout, slotOffset, targetIndex, useDragReorder } from '@/lib/use-drag-reorder';

export type EditRowInfo = {
  item: DraftItem;
  name: string;
  meta: string;
};

type Props = {
  rows: readonly EditRowInfo[];
  expandedKey: string | null;
  onToggle: (key: string) => void;
  onMove: (from: number, to: number) => void;
  onRemove: (key: string) => void;
  /** 펼친 행 아래에 들어갈 입력칸 */
  renderFields: (item: DraftItem) => ReactNode;
};

/** 루틴 편집의 종목 목록: 손잡이로 순서 변경, 왼쪽으로 밀어 삭제, 눌러서 펼치기 */
export function ExerciseEditList({
  rows,
  expandedKey,
  onToggle,
  onMove,
  onRemove,
  renderFields,
}: Props) {
  const { active, dy, dropTo, dragEpoch, epoch, layouts, setLayout, drop } = useDragReorder(
    rows.map((r) => r.item.key),
    onMove,
  );

  return (
    <View>
      {rows.map((row, index) => (
        <EditRow
          key={`${row.item.key}:${epoch}`}
          row={row}
          index={index}
          count={rows.length}
          last={index === rows.length - 1}
          expanded={expandedKey === row.item.key}
          active={active}
          dy={dy}
          dropTo={dropTo}
          dragEpoch={dragEpoch}
          epoch={epoch}
          onDrop={drop}
          layouts={layouts}
          onLayout={setLayout}
          onToggle={onToggle}
          onMove={onMove}
          onRemove={onRemove}
          fields={expandedKey === row.item.key ? renderFields(row.item) : null}
        />
      ))}
    </View>
  );
}

type RowProps = {
  row: EditRowInfo;
  index: number;
  count: number;
  last: boolean;
  expanded: boolean;
  active: SharedValue<number>;
  dy: SharedValue<number>;
  /** 놓은 자리(새 순서로 다시 그려질 때까지 붙잡아 둔다) */
  dropTo: SharedValue<number>;
  /** 이 행의 세대와, 지금 끌기가 시작된 세대. 다르면 끌기 상태를 따르지 않는다 */
  dragEpoch: SharedValue<number>;
  epoch: number;
  onDrop: (from: number, to: number) => void;
  layouts: SharedValue<RowLayout[]>;
  onLayout: (index: number, e: LayoutChangeEvent) => void;
  onToggle: (key: string) => void;
  onMove: (from: number, to: number) => void;
  onRemove: (key: string) => void;
  fields: ReactNode;
};

function EditRow({
  row,
  index,
  count,
  last,
  expanded,
  active,
  dy,
  dropTo,
  dragEpoch,
  epoch,
  onDrop,
  layouts,
  onLayout,
  onToggle,
  onMove,
  onRemove,
  fields,
}: RowProps) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const key = row.item.key;

  const pan = Gesture.Pan()
    .minDistance(0)
    .onStart(() => {
      dropTo.value = -1;
      dragEpoch.value = epoch;
      active.value = index;
      dy.value = 0;
    })
    .onUpdate((e) => {
      dy.value = e.translationY;
    })
    .onEnd(() => {
      const to = targetIndex(index, dy.value, layouts.value);
      if (to === index) {
        active.value = -1;
        dy.value = 0;
        return;
      }
      // 놓은 자리에 붙여 두고, 목록이 새 순서로 그려지면 푼다(바로 풀면 옛 순서가 잠깐 보인다).
      dropTo.value = to;
      dy.value = withTiming(slotOffset(index, to, layouts.value), { duration: 120 }, () => {
        scheduleOnRN(onDrop, index, to);
      });
    })
    .onFinalize(() => {
      if (dropTo.value !== -1) return;
      active.value = -1;
      dy.value = 0;
    });

  const animated = useAnimatedStyle(() => {
    const from = dragEpoch.value === epoch ? active.value : -1;
    if (from === -1) return { transform: [{ translateY: 0 }], zIndex: 0, opacity: 1 };
    if (from === index) return { transform: [{ translateY: dy.value }], zIndex: 10, opacity: 0.92 };
    const to = dropTo.value !== -1 ? dropTo.value : targetIndex(from, dy.value, layouts.value);
    const h = layouts.value[from]?.h ?? 0;
    let shift = 0;
    if (from < to && index > from && index <= to) shift = -h;
    if (from > to && index >= to && index < from) shift = h;
    return {
      transform: [{ translateY: withTiming(shift, { duration: 120 }) }],
      zIndex: 0,
      opacity: 1,
    };
  });

  const grip = (
    <GestureDetector gesture={pan}>
      <View
        style={styles.grip}
        accessibilityLabel={t('routines.edit.drag')}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
      >
        <Equal size={20} color={theme.colors.text2} strokeWidth={1.8} />
      </View>
    </GestureDetector>
  );

  const actions = [
    ...(index > 0 ? [{ name: 'moveUp', label: t('routines.edit.moveUp') }] : []),
    ...(index < count - 1 ? [{ name: 'moveDown', label: t('routines.edit.moveDown') }] : []),
    { name: 'delete', label: t('routines.edit.removeExercise') },
  ];

  return (
    <Animated.View
      onLayout={(e) => onLayout(index, e)}
      style={[animated, !last && styles.line, { backgroundColor: theme.colors.surface }]}
    >
      <ReanimatedSwipeable
        friction={1.5}
        rightThreshold={48}
        overshootRight={false}
        renderRightActions={() => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('routines.edit.removeExercise')}
            onPress={() => onRemove(key)}
            style={styles.delete}
          >
            <Trash2 size={20} color={theme.colors.onPr} strokeWidth={1.8} />
          </Pressable>
        )}
      >
        <View style={[styles.surface, expanded && styles.expanded]}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={expanded ? row.name : `${row.name}, ${row.meta}`}
            accessibilityHint={
              expanded ? t('routines.edit.collapseHint') : t('routines.edit.expandHint')
            }
            accessibilityActions={actions}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'moveUp') onMove(index, index - 1);
              if (e.nativeEvent.actionName === 'moveDown') onMove(index, index + 1);
              if (e.nativeEvent.actionName === 'delete') onRemove(key);
            }}
            onPress={() => onToggle(key)}
            style={expanded ? styles.headOpen : styles.head}
          >
            {grip}
            {expanded ? (
              <Text style={styles.nameOpen} numberOfLines={1}>
                {row.name}
              </Text>
            ) : (
              <View style={styles.body}>
                <Text style={styles.name} numberOfLines={1}>
                  {row.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {row.meta}
                </Text>
              </View>
            )}
            {expanded ? (
              <ChevronDown size={16} color={theme.colors.text2} strokeWidth={1.8} />
            ) : (
              <ChevronRight size={16} color={theme.colors.text2} strokeWidth={1.8} />
            )}
          </Pressable>
          {fields}
        </View>
      </ReanimatedSwipeable>
    </Animated.View>
  );
}

const styles = StyleSheet.create((theme) => ({
  line: { borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  surface: { backgroundColor: theme.colors.surface },
  expanded: { gap: 12, paddingTop: 4, paddingBottom: 16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 60 },
  headOpen: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 },
  grip: { width: 28, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 2 },
  name: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  nameOpen: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  meta: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  delete: {
    width: 76,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.danger,
  },
}));
