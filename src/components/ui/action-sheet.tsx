import { Check } from 'lucide-react-native';
import { useRef } from 'react';
import { Animated, Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { SHEET_CLOSED_MS, useSheetMotion } from './use-sheet-motion';

export type SheetAction = {
  label: string;
  /** 이름 아래에 작게 붙는 설명 */
  description?: string;
  onPress: () => void;
  destructive?: boolean;
  /** 지금 고른 값이면 오른쪽에 체크 */
  selected?: boolean;
  /** 창이 다 닫힌 뒤에 실행한다. 카메라 · 사진 선택 · 확인 창처럼 다른 창을 띄우는 동작에 쓴다 */
  afterClose?: boolean;
};

type Props = {
  visible: boolean;
  title?: string;
  actions: readonly SheetAction[];
  cancelLabel: string;
  onClose: () => void;
};

/** 아래에서 밀려 올라오는 선택지 목록. 항목을 누르면 닫히면서 실행된다. */
export function ActionSheet({ visible, title, actions, cancelLabel, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { theme } = useUnistyles();
  const motion = useSheetMotion(visible);
  // 내려가는 동안에는 닫히기 직전 내용을 그대로 보여 준다.
  const shown = useRef({ title, actions });
  if (visible) shown.current = { title, actions };
  return (
    <Modal
      visible={motion.mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity: motion.backdropOpacity }]}>
        <Pressable
          style={styles.fill}
          disabled={!visible}
          onPress={onClose}
          accessibilityLabel={cancelLabel}
        />
      </Animated.View>
      {/* 내려가는 동안에는 눌리지 않는다(같은 버튼이 두 번 눌리지 않게) */}
      <View style={styles.wrap} pointerEvents={visible ? 'box-none' : 'none'}>
        <Animated.View
          onLayout={motion.onLayout}
          style={[
            styles.stack,
            { paddingBottom: insets.bottom + 16, transform: [{ translateY: motion.translateY }] },
          ]}
        >
          <View style={styles.card}>
            {shown.current.title ? (
              <Text style={styles.title} accessibilityRole="header">
                {shown.current.title}
              </Text>
            ) : null}
            {shown.current.actions.map((a, i) => (
              <Pressable
                key={a.label}
                accessibilityRole="button"
                accessibilityState={a.selected === undefined ? undefined : { selected: a.selected }}
                onPress={() => {
                  onClose();
                  if (a.afterClose) setTimeout(a.onPress, SHEET_CLOSED_MS);
                  else a.onPress();
                }}
                style={({ pressed }) => [
                  styles.item,
                  i > 0 && styles.line,
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.itemBody, a.description ? styles.itemBodyTall : null]}>
                  <Text style={[styles.itemText, a.destructive && styles.danger]}>{a.label}</Text>
                  {a.description ? <Text style={styles.itemDesc}>{a.description}</Text> : null}
                </View>
                {a.selected ? (
                  <Check size={18} color={theme.colors.text} strokeWidth={2.2} />
                ) : null}
              </Pressable>
            ))}
          </View>
          <View style={styles.card}>
            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
            >
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create((theme) => ({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  fill: { flex: 1 },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  stack: { gap: 8, paddingHorizontal: 16 },
  card: {
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 18,
  },
  title: {
    paddingTop: 16,
    paddingBottom: 4,
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text2,
  },
  item: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 8 },
  line: { borderTopWidth: 1, borderTopColor: theme.colors.line },
  itemBody: { flex: 1, gap: 2 },
  itemBodyTall: { paddingVertical: 10 },
  itemDesc: {
    fontSize: 12,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  itemText: {
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  danger: { color: theme.colors.danger },
  cancel: { minHeight: 56, alignItems: 'center', justifyContent: 'center' },
  cancelText: {
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  pressed: { opacity: 0.7 },
}));
