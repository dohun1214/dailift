import { Modal, Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

type Props = {
  visible: boolean;
  title: string;
  body?: string;
  cancelLabel: string;
  confirmLabel: string;
  /** 되돌릴 수 없는 동작이면 확인 글자를 빨갛게. 아니면 확인 버튼을 주요 버튼(채움)으로 */
  destructive?: boolean;
  /** 왼쪽 버튼이 되돌릴 수 없는 동작일 때 (예: 버리기 / 이어하기) */
  cancelDestructive?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  /** 바깥을 누르거나 뒤로 가기를 눌렀을 때. 없으면 onCancel */
  onDismiss?: () => void;
};

/** 화면 가운데 뜨는 확인 창: 제목 · 설명 · 취소/확인 */
export function ConfirmDialog({
  visible,
  title,
  body,
  cancelLabel,
  confirmLabel,
  destructive,
  cancelDestructive,
  onCancel,
  onConfirm,
  onDismiss = onCancel,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onDismiss} accessible={false} />
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={styles.card} accessibilityRole="alert" accessibilityViewIsModal>
          <View style={styles.text}>
            <Text style={styles.title}>{title}</Text>
            {body ? <Text style={styles.body}>{body}</Text> : null}
          </View>
          <View style={styles.buttons}>
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              style={({ pressed }) => [styles.button, pressed && styles.pressed]}
            >
              <Text style={[styles.label, cancelDestructive && styles.danger]}>{cancelLabel}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.button,
                !destructive && styles.primary,
                pressed && styles.pressed,
              ]}
            >
              <Text style={[styles.label, destructive ? styles.danger : styles.onPrimary]}>
                {confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type NoticeProps = {
  visible: boolean;
  title: string;
  body?: string;
  okLabel: string;
  onClose: () => void;
};

/** 알려 주기만 하는 창: 제목 · 설명 · 확인 하나 */
export function NoticeDialog({ visible, title, body, okLabel, onClose }: NoticeProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessible={false} />
      <View style={styles.wrap} pointerEvents="box-none">
        <View style={styles.card} accessibilityRole="alert" accessibilityViewIsModal>
          <View style={styles.text}>
            <Text style={styles.title}>{title}</Text>
            {body ? <Text style={styles.body}>{body}</Text> : null}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={onClose}
            style={({ pressed }) => [styles.single, pressed && styles.pressed]}
          >
            <Text style={styles.label}>{okLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create((theme) => ({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.colors.scrim },
  wrap: { flex: 1, justifyContent: 'center', paddingHorizontal: 32 },
  card: {
    gap: 18,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderRadius: 28,
    backgroundColor: theme.colors.bg,
  },
  text: { gap: 8 },
  title: {
    fontSize: 18,
    lineHeight: 24,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  body: {
    fontSize: 14,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  buttons: { flexDirection: 'row', gap: 8 },
  button: {
    flex: 1,
    height: 52,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  single: {
    height: 52,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  primary: { backgroundColor: theme.colors.accent },
  onPrimary: { color: theme.colors.onAccent },
  pressed: { opacity: 0.7 },
  label: {
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  danger: { color: theme.colors.danger },
}));
