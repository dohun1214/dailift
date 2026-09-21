import { Check } from 'lucide-react-native';
import { Pressable, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

type Props = {
  checked: boolean;
  onChange: (checked: boolean) => void;
  accessibilityLabel: string;
};

export function Checkbox({ checked, onChange, accessibilityLabel }: Props) {
  const { theme } = useUnistyles();
  styles.useVariants({ checked });
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked }}
      onPress={() => onChange(!checked)}
      style={styles.hit}
    >
      <View style={styles.box}>
        {checked ? <Check size={15} strokeWidth={2.6} color={theme.colors.onAccent} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  hit: {
    width: theme.hitSize,
    height: theme.hitSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  box: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    variants: {
      checked: {
        true: { backgroundColor: theme.colors.accent },
        false: { borderWidth: 2, borderColor: theme.colors.line },
      },
    },
  },
}));
