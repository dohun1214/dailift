import type { LucideIcon } from 'lucide-react-native';
import { Pressable, type PressableProps } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  icon: LucideIcon;
  /** 스크린리더용 이름 (아이콘만 있는 버튼이라 필수) */
  label: string;
  /** filled: 카드색 배경, plain: 배경 없음, raised: 카드 안에서 쓰는 한 단계 밝은 배경 */
  tone?: 'filled' | 'plain' | 'raised';
  size?: number;
};

export function IconButton({ icon: Icon, label, tone = 'filled', size = 20, ...props }: Props) {
  const { theme } = useUnistyles();
  styles.useVariants({ tone });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      {...props}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Icon size={size} color={theme.colors.text} strokeWidth={1.8} />
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  button: {
    width: theme.hitSize,
    height: theme.hitSize,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    variants: {
      tone: {
        filled: { backgroundColor: theme.colors.surface },
        plain: { backgroundColor: 'transparent' },
        raised: { backgroundColor: theme.colors.surface2 },
      },
    },
  },
  pressed: { opacity: 0.6 },
}));
