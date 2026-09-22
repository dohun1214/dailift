import type { LucideIcon } from 'lucide-react-native';
import type { Ref } from 'react';
import { Pressable, type PressableProps, Text, type View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

type Props = Omit<PressableProps, 'children'> & {
  icon: LucideIcon;
  label: string;
  /** expo-router의 TabTrigger(asChild)가 넣어 준다. */
  isFocused?: boolean;
  ref?: Ref<View>;
};

export function TabButton({ icon: Icon, label, isFocused = false, ref, style, ...props }: Props) {
  const { theme } = useUnistyles();
  const color = isFocused ? theme.colors.text : theme.colors.text2;
  styles.useVariants({ focused: isFocused });

  return (
    <Pressable
      ref={ref}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      {...props}
      // TabTrigger가 넣는 기본 스타일(flexDirection: row)을 우리 스타일이 덮어쓰도록 뒤에 둔다.
      style={(state) => [typeof style === 'function' ? style(state) : style, styles.button]}
    >
      <Icon size={22} color={color} strokeWidth={1.8} />
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  button: {
    flex: 1,
    flexDirection: 'column',
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    variants: {
      focused: {
        true: { backgroundColor: theme.colors.surface2 },
        false: { backgroundColor: 'transparent' },
      },
    },
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
    variants: {
      focused: {
        true: { color: theme.colors.text, fontFamily: theme.fonts.bold },
        false: { color: theme.colors.text2, fontFamily: theme.fonts.medium },
      },
    },
  },
}));
