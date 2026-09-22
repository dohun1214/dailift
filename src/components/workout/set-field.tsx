import { useEffect, useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { parseDecimal } from '@/lib/number';

type Props = {
  value: number | null;
  unit: string;
  onChange: (value: number | null) => void;
  /** 완료 전 값은 프리필 회색 */
  muted: boolean;
  decimal?: boolean;
  label: string;
  badge?: string;
  badgeLabel?: string;
};

const format = (v: number | null) => (v === null ? '' : String(v));

/** 세트 행의 무게·횟수 칸 (높이 42, 가운데 정렬 숫자 + 작은 단위) */
export function SetField({
  value,
  unit,
  onChange,
  muted,
  decimal = false,
  label,
  badge,
  badgeLabel,
}: Props) {
  const { theme } = useUnistyles();
  const [text, setText] = useState(format(value));

  useEffect(() => {
    setText((prev) => (read(prev, decimal) === value ? prev : format(value)));
  }, [value, decimal]);

  return (
    <View style={styles.wrap}>
      <View style={styles.box}>
        <TextInput
          accessibilityLabel={label}
          value={text}
          placeholder="0"
          placeholderTextColor={theme.colors.prefill}
          keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
          inputMode={decimal ? 'decimal' : 'numeric'}
          selectTextOnFocus
          maxLength={decimal ? 6 : 4}
          selectionColor={theme.colors.accentText}
          onChangeText={(next) => {
            setText(next);
            const n = read(next, decimal);
            if (n !== undefined) onChange(n);
          }}
          style={[styles.input, muted ? styles.muted : styles.solid]}
        />
        <Text style={styles.unit}>{unit}</Text>
      </View>
      {/* 둥근 칸은 안드로이드에서 자식을 잘라내므로 배지는 칸 밖(감싸는 뷰)에 둔다 */}
      {badge ? (
        <View style={styles.badge} accessibilityLabel={badgeLabel}>
          <Text style={styles.badgeText}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** 빈 칸은 null, 읽을 수 없는 값은 undefined(무시) */
function read(text: string, decimal: boolean): number | null | undefined {
  if (text.trim() === '') return null;
  if (decimal) return parseDecimal(text) ?? undefined;
  return /^\d+$/.test(text.trim()) ? Number.parseInt(text, 10) : undefined;
}

const styles = StyleSheet.create((theme) => ({
  wrap: { flex: 1 },
  box: {
    height: 42,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    borderRadius: 12,
    backgroundColor: theme.colors.surface2,
  },
  input: {
    minWidth: 28,
    height: 42,
    padding: 0,
    textAlign: 'center',
    fontSize: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.numSemibold,
    fontVariant: ['tabular-nums'],
  },
  muted: { color: theme.colors.prefill },
  solid: { color: theme.colors.text },
  unit: {
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  badge: {
    position: 'absolute',
    top: -7,
    right: -4,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.pr,
  },
  badgeText: {
    fontSize: 10,
    lineHeight: 13,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    color: theme.colors.onPr,
  },
}));
