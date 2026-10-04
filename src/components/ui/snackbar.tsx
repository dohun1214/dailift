import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

type Props = {
  message: string;
  actionLabel: string;
  onAction: () => void;
};

/** 방금 한 동작을 알리고 되돌릴 기회를 주는 한 줄 (화면 아래, 잠깐 떠 있다) */
export function Snackbar({ message, actionLabel, onAction }: Props) {
  return (
    <View style={styles.bar} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onAction}
        hitSlop={4}
        style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      >
        <Text style={styles.actionText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  bar: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 18,
    paddingRight: 6,
    borderRadius: 18,
    backgroundColor: theme.colors.accent,
  },
  message: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 14,
    lineHeight: 19,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.onAccent,
  },
  action: {
    minWidth: 72,
    height: 40,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  actionText: {
    fontSize: 14,
    lineHeight: 19,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.onAccent,
  },
}));
