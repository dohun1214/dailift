import { useEffect, useId, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

type Props = {
  label: string;
  unit: string;
  min: number;
  max: number;
  onChange: (min: number, max: number) => void;
  invalid?: boolean;
  minLabel: string;
  maxLabel: string;
};

const read = (text: string) => (/^\d+$/.test(text.trim()) ? Number.parseInt(text, 10) : Number.NaN);
const format = (n: number) => (Number.isFinite(n) ? String(n) : '');

/** 렙 범위처럼 두 숫자를 한 칸에 "8–12"로 입력하는 필드 */
export function RangeField({
  label,
  unit,
  min,
  max,
  onChange,
  invalid = false,
  minLabel,
  maxLabel,
}: Props) {
  const { theme } = useUnistyles();
  const id = useId();
  const [minText, setMinText] = useState(format(min));
  const [maxText, setMaxText] = useState(format(max));
  styles.useVariants({ invalid });

  useEffect(() => {
    setMinText((prev) => (read(prev) === min ? prev : format(min)));
  }, [min]);
  useEffect(() => {
    setMaxText((prev) => (read(prev) === max ? prev : format(max)));
  }, [max]);

  const inputProps = {
    keyboardType: 'number-pad' as const,
    inputMode: 'numeric' as const,
    selectTextOnFocus: true,
    selectionColor: theme.colors.accentText,
    maxLength: 3,
    style: styles.input,
  };

  return (
    <View style={styles.wrap}>
      <Text nativeID={id} style={styles.label}>
        {label}
      </Text>
      <View style={styles.box}>
        <TextInput
          {...inputProps}
          accessibilityLabel={`${label} ${minLabel}`}
          value={minText}
          onChangeText={(v) => {
            setMinText(v);
            onChange(read(v), read(maxText));
          }}
        />
        <Text style={styles.dash}>–</Text>
        <TextInput
          {...inputProps}
          accessibilityLabel={`${label} ${maxLabel}`}
          value={maxText}
          onChangeText={(v) => {
            setMaxText(v);
            onChange(read(minText), read(v));
          }}
        />
        <View style={styles.flex} />
        <Text style={styles.unit}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: { flex: 1, gap: 6 },
  label: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  box: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
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
    minWidth: 10,
    height: 45,
    padding: 0,
    fontSize: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  dash: {
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  flex: { flex: 1 },
  unit: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
