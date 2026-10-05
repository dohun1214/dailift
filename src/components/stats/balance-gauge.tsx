import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { targetLevel, targetProgress } from '@/domain/set-targets';

type Props = {
  name: string;
  value: number;
  /** 이 부위의 주간 목표 세트 */
  target: number;
  a11yLabel: string;
};

/**
 * 부위 밸런스 한 줄: 이름 · 막대 · 세트 / 목표. 막대는 목표를 채우면 꽉 찬다.
 * 0세트는 빈 막대, 목표의 절반 미만은 주황, 절반 이상은 회색, 다 채우면 진한 색 + 체크.
 */
export function BalanceGauge({ name, value, target, a11yLabel }: Props) {
  const { theme } = useUnistyles();
  const { i18n } = useTranslation();
  // 영어 부위 이름(Shoulders 등)은 한글보다 길다.
  const nameWidth = i18n.language.startsWith('ko') ? 40 : 76;
  const level = targetLevel(value, target);
  const shown = Number.isInteger(value) ? String(value) : value.toFixed(1);

  return (
    <View style={styles.row} accessible accessibilityLabel={a11yLabel}>
      <Text
        style={[styles.name, { width: nameWidth }, level === 'none' && styles.muted]}
        numberOfLines={1}
      >
        {name}
      </Text>
      <View style={styles.track}>
        {level !== 'none' ? (
          <View
            style={[
              styles.fill,
              level === 'low' && styles.fillLow,
              level === 'mid' && styles.fillMid,
              { width: `${targetProgress(value, target) * 100}%` },
            ]}
          />
        ) : null}
      </View>
      <Text style={styles.numbers} numberOfLines={1}>
        <Text
          style={[styles.value, level === 'none' && styles.muted, level === 'low' && styles.warm]}
        >
          {shown}
        </Text>
        <Text style={styles.target}>{` / ${target}`}</Text>
      </Text>
      <View style={styles.check}>
        {level === 'done' ? <Check size={14} color={theme.colors.text} strokeWidth={2.6} /> : null}
      </View>
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
  muted: { color: theme.colors.text2 },
  warm: { color: theme.colors.warm },
  track: {
    flex: 1,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.track,
    overflow: 'hidden',
  },
  fill: { height: 12, borderRadius: 6, backgroundColor: theme.colors.accent },
  fillLow: { backgroundColor: theme.colors.warmFill },
  fillMid: { backgroundColor: theme.colors.text2 },
  numbers: { width: 56, textAlign: 'right' },
  value: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  target: {
    fontSize: 12,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.numMedium,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  check: { width: 14, alignItems: 'center', marginLeft: -6 },
}));
