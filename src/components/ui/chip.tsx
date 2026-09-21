import { Pressable, type PressableProps, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  selected?: boolean;
};

export function Chip({ label, selected = false, ...props }: Props) {
  styles.useVariants({ selected });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={{ top: 4, bottom: 4 }}
      {...props}
      style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
    >
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    variants: {
      selected: {
        true: { backgroundColor: theme.colors.accent },
        false: { backgroundColor: theme.colors.surface },
      },
    },
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    variants: {
      selected: {
        true: { color: theme.colors.onAccent },
        false: { color: theme.colors.text },
      },
    },
  },
  pressed: { opacity: 0.7 },
}));
