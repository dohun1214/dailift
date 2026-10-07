import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useBodyEntries } from '@/db/use-body';
import { BODY_METRICS, latestBody } from '@/domain/body';
import { useSettings } from '@/stores/settings';

import { useBodyFormat } from './use-body-format';

/** 통계 맨 위의 체성분 카드: 항목마다 가장 최근 값. 누르면 체성분 화면 */
export function BodyCard() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const unit = useSettings((s) => s.weightUnit);
  const fmt = useBodyFormat(unit);
  const entries = useBodyEntries();
  const latest = useMemo(() => latestBody(entries, unit), [entries, unit]);
  const open = () => router.push('/body');

  if (latest.at === null) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${t('body.card.empty')}, ${t('body.card.emptySub')}`}
        onPress={open}
        style={({ pressed }) => [styles.card, styles.emptyRow, pressed && styles.pressed]}
      >
        <View style={styles.flex}>
          <Text style={styles.title}>{t('body.card.empty')}</Text>
          <Text style={styles.sub}>{t('body.card.emptySub')}</Text>
        </View>
        <ChevronRight size={18} color={theme.colors.text2} strokeWidth={1.8} />
      </Pressable>
    );
  }

  const summary = BODY_METRICS.map((m) => {
    const v = latest.values[m];
    return `${t(`body.metric.${m}`)} ${v === null ? t('body.none') : fmt.withUnit(m, v)}`;
  }).join(', ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('body.card.a11y', { summary })}
      onPress={open}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.head}>
        <Text style={[styles.title, styles.flex]}>{t('body.title')}</Text>
        <Text style={styles.date}>{fmt.date(latest.at)}</Text>
        <ChevronRight size={18} color={theme.colors.text2} strokeWidth={1.8} />
      </View>
      <View style={styles.values}>
        {BODY_METRICS.map((m) => {
          const v = latest.values[m];
          return (
            <View key={m} style={styles.item}>
              <Text style={styles.label}>{t(`body.metric.${m}`)}</Text>
              <View style={styles.valueRow}>
                <Text style={[styles.value, v === null && styles.valueNone]}>
                  {v === null ? '–' : fmt.num(v)}
                </Text>
                {v === null ? null : <Text style={styles.unit}>{fmt.unitOf(m)}</Text>}
              </View>
            </View>
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  card: {
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: {
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  sub: {
    paddingTop: 3,
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  date: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  values: { flexDirection: 'row', gap: 8 },
  item: { flex: 1, gap: 3 },
  label: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  value: {
    fontSize: 20,
    lineHeight: 26,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  valueNone: { color: theme.colors.prefill },
  unit: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
