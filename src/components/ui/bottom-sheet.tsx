import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import { Animated, Modal, PanResponder, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

import { useSheetMotion } from './use-sheet-motion';

type Props = {
  visible: boolean;
  title: string;
  subtitle?: string;
  /** 바깥을 누르거나 뒤로 가기를 눌렀을 때 */
  onClose: () => void;
  closeLabel: string;
  children: ReactNode;
};

/** 이만큼 끌어내리거나 이 속도로 튕기면 닫는다 */
const CLOSE_DISTANCE = 80;
const CLOSE_VELOCITY = 0.8;

/**
 * 아래에서 올라오는 시트: 손잡이 · 제목 · 내용. 열릴 때 바닥에서 밀려 올라오고, 닫힐 때 내려간다.
 * 바깥(어두운 부분)을 누르거나, 손잡이 · 제목 부분을 잡고 아래로 쓸어내리면 닫힌다.
 */
export function BottomSheet({ visible, title, subtitle, onClose, closeLabel, children }: Props) {
  const insets = useSafeAreaInsets();
  const drag = useRef(new Animated.Value(0)).current;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const motion = useSheetMotion(visible);
  // 내려가는 동안에는 닫히기 직전 내용을 그대로 보여 준다(부모가 내용을 먼저 비워도 줄어들지 않게).
  const shown = useRef({ title, subtitle, children });
  if (visible) shown.current = { title, subtitle, children };

  // 다시 열릴 때는 제자리에서 시작한다.
  useEffect(() => {
    if (visible) drag.setValue(0);
  }, [visible, drag]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        // 손잡이 · 제목 부분에는 누를 것이 없으므로 닿는 순간부터 잡는다.
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, g) => g.dy > 4 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => drag.setValue(Math.max(0, g.dy)),
        onPanResponderRelease: (_, g) => {
          if (g.dy > CLOSE_DISTANCE || g.vy > CLOSE_VELOCITY) {
            closeRef.current();
            return;
          }
          Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(drag, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
        },
      }),
    [drag],
  );

  return (
    <Modal
      visible={motion.mounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity: motion.backdropOpacity }]}>
        <Pressable style={styles.fill} onPress={onClose} accessibilityLabel={closeLabel} />
      </Animated.View>
      <View style={styles.wrap} pointerEvents="box-none">
        <Animated.View
          onLayout={motion.onLayout}
          style={[
            styles.sheet,
            {
              paddingBottom: insets.bottom + 28,
              transform: [{ translateY: Animated.add(drag, motion.translateY) }],
            },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.grab} {...pan.panHandlers}>
            <View style={styles.handle} />
            <View style={styles.head}>
              <Text style={styles.title} accessibilityRole="header">
                {shown.current.title}
              </Text>
              {shown.current.subtitle ? (
                <Text style={styles.subtitle}>{shown.current.subtitle}</Text>
              ) : null}
            </View>
          </View>
          {shown.current.children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create((theme) => ({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.scrim },
  fill: { flex: 1 },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    gap: 14,
    paddingTop: 10,
    paddingHorizontal: 16,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: theme.colors.bg,
  },
  // 손잡이와 제목을 한 덩어리로 잡는다(위쪽 여백까지 잡히도록 시트의 위 여백을 여기로 옮겼다).
  grab: { gap: 14, marginTop: -10, paddingTop: 10 },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.track,
  },
  head: { gap: 4, paddingTop: 4, paddingHorizontal: 4 },
  title: {
    fontSize: 18,
    lineHeight: 24,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19.5,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
