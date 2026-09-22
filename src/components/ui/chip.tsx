import { Pressable, type PressableProps, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  label: string;
  selected?: boolean;
  /** surface: 화면 바탕 위(높이 36), raised: 카드 안(높이 40, 한 단계 밝은 배경) */
  tone?: 'surface' | 'raised';
};

export function Chip({ label, selected = false, tone = 'surface', ...props }: Props) {
  styles.useVariants({ selected });
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={{ top: 4, bottom: 4 }}
      {...props}
      style={({ pressed }) => [
        styles.chip,
        tone === 'raised' && styles.raised,
        tone === 'raised' && !selected && styles.raisedIdle,
        pressed && styles.pressed,
      ]}
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
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    variants: {
      selected: {
        true: { color: theme.colors.onAccent },
        false: { color: theme.colors.text },
      },
    },
  },
  raised: { height: 40 },
  raisedIdle: { backgroundColor: theme.colors.surface2 },
  pressed: { opacity: 0.7 },
}));
