import type { ReactNode } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
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

/** 아래에서 올라오는 시트: 손잡이 · 제목 · 내용. 바깥(어두운 부분)을 누르면 닫힌다. */
export function BottomSheet({ visible, title, subtitle, onClose, closeLabel, children }: Props) {
  const insets = useSafeAreaInsets();
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
        <View
          style={[styles.sheet, { paddingBottom: insets.bottom + 28 }]}
          accessibilityViewIsModal
        >
          <View style={styles.handle} />
          <View style={styles.head}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
          {children}
        </View>
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
