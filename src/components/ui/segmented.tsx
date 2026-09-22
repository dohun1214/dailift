import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

export type SegmentOption<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel?: string;
};

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: Props<T>) {
  return (
    <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={styles.track}>
      {options.map((o) => (
        <Segment
          key={o.value}
          label={o.label}
          selected={o.value === value}
          onPress={() => onChange(o.value)}
        />
      ))}
    </View>
  );
}

function Segment({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  styles.useVariants({ selected });
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={styles.segment}
    >
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  track: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 18,
    backgroundColor: theme.colors.surface,
  },
  segment: {
    flex: 1,
    height: 40,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    variants: {
      selected: {
        true: { backgroundColor: theme.colors.surface2 },
        false: { backgroundColor: 'transparent' },
      },
    },
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    variants: {
      selected: {
        true: { color: theme.colors.text, fontFamily: theme.fonts.bold },
        false: { color: theme.colors.text2, fontFamily: theme.fonts.semibold },
      },
    },
  },
}));
