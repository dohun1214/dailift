import type { LucideIcon } from 'lucide-react-native';
import { Pressable, type PressableProps, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'lg' | 'md' | 'sm';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  /** 기본은 가로를 꽉 채운다 */
  fill?: boolean;
};

export function Button({
  label,
  variant = 'primary',
  size = 'lg',
  icon: Icon,
  fill = true,
  disabled,
  ...props
}: Props) {
  const { theme } = useUnistyles();
  styles.useVariants({ variant, size });
  const color = {
    primary: theme.colors.onAccent,
    secondary: theme.colors.text,
    ghost: theme.colors.text2,
    danger: theme.colors.onPr,
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      {...props}
      style={({ pressed }) => [
        styles.button,
        fill && styles.fill,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {Icon ? <Icon size={18} color={color} strokeWidth={2} /> : null}
      <Text style={[styles.label, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.space.sm,
    paddingHorizontal: theme.space.xl,
    variants: {
      variant: {
        primary: { backgroundColor: theme.colors.accent },
        secondary: { backgroundColor: theme.colors.surface },
        ghost: { backgroundColor: 'transparent' },
        danger: { backgroundColor: theme.colors.pr },
      },
      size: {
        lg: { height: 56, borderRadius: theme.radius.lg },
        md: { height: 48, borderRadius: theme.radius.md + 2 },
        sm: { height: theme.hitSize, borderRadius: theme.radius.md },
      },
    },
  },
  fill: { alignSelf: 'stretch' },
  label: {
    fontWeight: '700',
    variants: {
      size: {
        lg: { fontSize: 16 },
        md: { fontSize: 15 },
        sm: { fontSize: 14 },
      },
    },
  },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
}));
