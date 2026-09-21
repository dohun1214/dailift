import { useId } from 'react';
import { Text, TextInput, type TextInputProps, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  /** 입력칸 오른쪽 단위 (kg, 회, 초 …) */
  unit?: string;
  /** 자동으로 채운 값처럼 회색으로 보이게 한다 */
  muted?: boolean;
  error?: string;
};

export function TextField({ label, unit, muted = false, error, ...props }: Props) {
  const { theme } = useUnistyles();
  const id = useId();
  styles.useVariants({ muted, invalid: !!error });

  return (
    <View style={styles.wrap}>
      <Text nativeID={id} style={styles.label}>
        {label}
      </Text>
      <View style={styles.box}>
        <TextInput
          accessibilityLabel={label}
          accessibilityLabelledBy={id}
          placeholderTextColor={theme.colors.text2}
          selectionColor={theme.colors.accentText}
          {...props}
          style={styles.input}
        />
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: { flex: 1, gap: 6 },
  label: { fontSize: 12, fontWeight: '500', color: theme.colors.text2 },
  box: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface2,
    borderWidth: 1.5,
    variants: {
      invalid: {
        true: { borderColor: theme.colors.danger },
        false: { borderColor: 'transparent' },
      },
    },
  },
  input: {
    flex: 1,
    padding: 0,
    fontSize: 16,
    fontWeight: '600',
    variants: {
      muted: {
        true: { color: theme.colors.prefill },
        false: { color: theme.colors.text },
      },
    },
  },
  unit: { fontSize: 13, color: theme.colors.text2 },
  error: { fontSize: 12, color: theme.colors.danger },
}));
