import { Pressable, type PressableProps, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

type Props = Omit<PressableProps, 'children' | 'style'> & { label: string };

/** 상단 바 오른쪽 "저장" 같은 글자 버튼 (높이 44, 15/700) */
export function TextButton({ label, disabled, ...props }: Props) {
  styles.useVariants({ disabled: !!disabled });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      hitSlop={4}
      {...props}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  button: {
    minWidth: theme.hitSize,
    height: theme.hitSize,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.6 },
  label: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    variants: {
      disabled: {
        true: { color: theme.colors.text2 },
        false: { color: theme.colors.text },
      },
    },
  },
}));
