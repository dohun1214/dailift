import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StyleSheet } from 'react-native-unistyles';

export type SheetAction = {
  label: string;
  onPress: () => void;
  destructive?: boolean;
};

type Props = {
  visible: boolean;
  title?: string;
  actions: readonly SheetAction[];
  cancelLabel: string;
  onClose: () => void;
};

/** 아래에서 올라오는 선택지 목록. 항목을 누르면 닫힌 뒤 실행된다. */
export function ActionSheet({ visible, title, actions, cancelLabel, onClose }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={cancelLabel} />
      <View style={[styles.wrap, { paddingBottom: insets.bottom + 16 }]} pointerEvents="box-none">
        <View style={styles.card}>
          {title ? (
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
          ) : null}
          {actions.map((a, i) => (
            <Pressable
              key={a.label}
              accessibilityRole="button"
              onPress={() => {
                onClose();
                a.onPress();
              }}
              style={({ pressed }) => [
                styles.item,
                i > 0 && styles.line,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.itemText, a.destructive && styles.danger]}>{a.label}</Text>
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
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create((theme) => ({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  wrap: { flex: 1, justifyContent: 'flex-end', gap: 8, paddingHorizontal: 16 },
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
  item: { minHeight: 52, justifyContent: 'center' },
  line: { borderTopWidth: 1, borderTopColor: theme.colors.line },
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
