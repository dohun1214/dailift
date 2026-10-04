import { type ReactNode, useEffect, useMemo, useRef } from 'react';
import { Animated, Modal, PanResponder, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

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
 * 아래에서 올라오는 시트: 손잡이 · 제목 · 내용.
 * 바깥(어두운 부분)을 누르거나, 손잡이 · 제목 부분을 잡고 아래로 쓸어내리면 닫힌다.
 */
export function BottomSheet({ visible, title, subtitle, onClose, closeLabel, children }: Props) {
  const insets = useSafeAreaInsets();
  const drag = useRef(new Animated.Value(0)).current;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

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
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={closeLabel} />
      <View style={styles.wrap} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + 28, transform: [{ translateY: drag }] },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.grab} {...pan.panHandlers}>
            <View style={styles.handle} />
            <View style={styles.head}>
              <Text style={styles.title} accessibilityRole="header">
                {title}
              </Text>
              {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
            </View>
          </View>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create((theme) => ({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.scrim },
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
