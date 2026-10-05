import { Check, ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { targetLevel, targetProgress } from '@/domain/set-targets';

type Props = {
  /** 부위 이름, 이번 주 세트 수, 주간 목표 세트 (보여 줄 순서대로) */
  rows: readonly { name: string; value: number; target: number }[];
  onPress: () => void;
};

/**
 * 홈의 '이번 주 부위별 세트' 카드. 막대는 목표를 채우면 꽉 찬다.
 * 0세트는 빈 막대, 목표의 절반 미만은 주황, 절반 이상은 회색, 다 채우면 진한 색 + 체크. 누르면 통계로 간다.
 */
export function MuscleSetsCard({ rows, onPress }: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('home.muscleA11y')}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.head}>
        <Text style={styles.title}>{t('home.muscleTitle')}</Text>
        <Text style={styles.link}>{t('home.muscleLink')}</Text>
        <ChevronRight size={18} color={theme.colors.text2} strokeWidth={1.8} />
      </View>
      <View style={styles.rows}>
        {rows.map((r) => {
          const shown = Number.isInteger(r.value) ? String(r.value) : r.value.toFixed(1);
          const level = targetLevel(r.value, r.target);
          return (
            <View
              key={r.name}
              style={styles.row}
              accessible
              accessibilityLabel={t('home.muscleRowA11y', {
                name: r.name,
                value: shown,
                target: r.target,
                state: t(`stats.state.${level}`),
              })}
            >
              <Text style={[styles.name, level === 'none' && styles.muted]} numberOfLines={1}>
                {r.name}
              </Text>
              <View style={styles.track}>
                {level !== 'none' ? (
                  <View
                    style={[
                      styles.fill,
                      level === 'low' && styles.fillLow,
                      level === 'mid' && styles.fillMid,
                      { width: `${targetProgress(r.value, r.target) * 100}%` },
                    ]}
                  />
                ) : null}
              </View>
              <Text style={styles.numbers} numberOfLines={1}>
                <Text
                  style={[
                    styles.value,
                    level === 'none' && styles.muted,
                    level === 'low' && styles.warm,
                  ]}
                >
                  {shown}
                </Text>
                <Text style={styles.target}>{` / ${r.target}`}</Text>
              </Text>
              <View style={styles.check}>
                {level === 'done' ? (
                  <Check size={14} color={theme.colors.text} strokeWidth={2.6} />
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    gap: 14,
    paddingTop: 16,
    paddingLeft: 16,
    paddingRight: 12,
    paddingBottom: 18,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  pressed: { opacity: 0.7 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  link: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  rows: { gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  name: {
    width: 34,
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  muted: { color: theme.colors.text2 },
  track: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: theme.colors.track,
  },
  fill: { height: 8, borderRadius: 4, backgroundColor: theme.colors.accent },
  fillLow: { backgroundColor: theme.colors.warmFill },
  fillMid: { backgroundColor: theme.colors.text2 },
  warm: { color: theme.colors.warm },
  numbers: { width: 50, textAlign: 'right' },
  value: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  target: {
    fontSize: 11,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.numMedium,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  check: { width: 14, alignItems: 'center', marginLeft: -4 },
}));
