import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { balanceState } from '@/domain/stats';

type Props = {
  name: string;
  value: number;
  range: { min: number; max: number };
  a11yLabel: string;
};

/** 부위 밸런스 한 줄: 이름 · 게이지(권장 구간 띠) · 세트 수. 범위를 벗어나면(미달·초과 모두) 주황 */
export function BalanceGauge({ name, value, range, a11yLabel }: Props) {
  const scale = range.max * 1.25;
  const ok = balanceState(value, range) === 'ok';
  const pct = (n: number) => `${Math.min(100, Math.max(0, (n / scale) * 100))}%` as const;
  const shown = Number.isInteger(value) ? String(value) : value.toFixed(1);

  return (
    <View style={styles.row} accessible accessibilityLabel={a11yLabel}>
      <Text style={styles.name}>{name}</Text>
      <View style={styles.track}>
        <View style={[styles.band, { left: pct(range.min), width: pct(range.max - range.min) }]} />
        <View style={[styles.fill, ok ? styles.fillOk : styles.fillWarm, { width: pct(value) }]} />
      </View>
      <Text style={[styles.value, !ok && styles.valueWarm]}>{shown}</Text>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, height: 40 },
  name: {
    width: 40,
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text,
  },
  track: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.track,
    overflow: 'hidden',
  },
  band: { position: 'absolute', top: 0, bottom: 0, backgroundColor: theme.colors.band },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 6 },
  fillOk: { backgroundColor: theme.colors.accent },
  fillWarm: { backgroundColor: theme.colors.warmFill },
  value: {
    width: 30,
    textAlign: 'right',
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  valueWarm: { color: theme.colors.warm },
}));
