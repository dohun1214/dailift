import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, Text } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
/** 시안의 버튼 높이: 56(주요) · 52 · 48 · 44. 모서리 20, 글자 16/700은 모두 같다. */
export type ButtonSize = 'lg' | 'md' | 'sm' | 'xs';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  /** 아이콘 대신 넣을 요소 (Apple·Google 로고 등) */
  leading?: ReactNode;
  /** 기본은 가로를 꽉 채운다 */
  fill?: boolean;
};

export function Button({
  label,
  variant = 'primary',
  size = 'lg',
  icon: Icon,
  leading,
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
      {leading ?? (Icon ? <Icon size={18} color={color} strokeWidth={2} /> : null)}
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
    borderRadius: theme.radius.lg,
    variants: {
      variant: {
        primary: { backgroundColor: theme.colors.accent },
        secondary: { backgroundColor: theme.colors.surface },
        ghost: { backgroundColor: 'transparent' },
        danger: { backgroundColor: theme.colors.pr },
      },
      size: {
        lg: { height: 56 },
        md: { height: 52 },
        sm: { height: 48 },
        xs: { height: 44 },
      },
    },
  },
  fill: { alignSelf: 'stretch' },
  label: { fontSize: 16, lineHeight: 21, includeFontPadding: false, fontFamily: theme.fonts.bold },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.4 },
}));
