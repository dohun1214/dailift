import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { Card, ListRow, ListSection, Screen, TextField, TopBar } from '@/components/ui';
import type { WeightUnit } from '@/db/schema';
import { calculatePlates, groupPlates } from '@/domain/plates';
import { LB_PER_KG, parseDecimal } from '@/lib/number';
import { useSettings } from '@/stores/settings';

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** 원판 크기(시안: 20kg 130×26, 1.25kg 60×14). kg 기준으로 단계를 나눈다. */
function plateSize(plate: number, unit: WeightUnit) {
  const kg = unit === 'kg' ? plate : plate / LB_PER_KG;
  if (kg >= 19) return { h: 130, w: 26 };
  if (kg >= 14) return { h: 116, w: 24 };
  if (kg >= 9) return { h: 102, w: 22 };
  if (kg >= 4.5) return { h: 84, w: 18 };
  if (kg >= 2) return { h: 70, w: 16 };
  return { h: 60, w: 14 };
}

/** 원판 계산기. 운동 중 바벨 종목 카드에서 열면 지금 세트 무게가 들어온다. */
export default function PlateCalculatorScreen() {
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ weight?: string; unit?: string }>();
  const settingsUnit = useSettings((s) => s.weightUnit);
  const unit: WeightUnit =
    params.unit === 'kg' || params.unit === 'lb' ? params.unit : settingsUnit;
  const owned = useSettings((s) => s.plates[unit]);
  const defaultBar = useSettings((s) => s.barWeights[unit]);
  const [targetText, setTargetText] = useState(params.weight ?? '');
  const [barText, setBarText] = useState(fmt(defaultBar));

  const target = parseDecimal(targetText);
  const bar = parseDecimal(barText) ?? 0;
  const result = target === null ? null : calculatePlates(target, bar, owned);
  const side = result ? result.perSide.reduce((a, b) => a + b, 0) : 0;
  // 원판이 많으면 폭을 줄여 카드 안에 맞춘다
  const shrink = result && result.perSide.length > 6 ? 6 / result.perSide.length : 1;

  let message: string | null = null;
  if (target === null) message = t('plates.enter');
  else if (result && target < bar) message = t('plates.belowBar');
  else if (result && !result.exact)
    message = t('plates.nearest', { total: fmt(result.total), unit });

  return (
    <Screen header={<TopBar title={t('plates.title')} leading="close" />}>
      <Card>
        <View style={styles.fields}>
          <View style={styles.field}>
            <TextField
              label={t('plates.target')}
              unit={unit}
              value={targetText}
              onChangeText={setTargetText}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
          </View>
          <View style={styles.field}>
            <TextField
              label={t('plates.bar')}
              unit={unit}
              value={barText}
              onChangeText={setBarText}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
          </View>
        </View>
      </Card>

      <Card style={styles.resultCard}>
        <Text style={styles.cardTitle}>{t('plates.perSide')}</Text>
        <View style={styles.bar} importantForAccessibility="no-hide-descendants">
          <View style={styles.sleeveEnd} />
          <View style={styles.collar} />
          {(result?.perSide ?? []).map((p, i) => {
            const { h, w } = plateSize(p, unit);
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: 같은 원판이 여러 장일 수 있다
              <View key={i} style={[styles.plate, { height: h, width: w * shrink }]}>
                <Text style={[styles.plateText, { width: h }]} numberOfLines={1}>
                  {fmt(p)}
                </Text>
              </View>
            );
          })}
          <View style={styles.sleeve} />
        </View>
        {result && result.perSide.length > 0 ? (
          <View style={styles.sumRow}>
            <Text style={styles.sum}>{result.perSide.map(fmt).join(' + ')}</Text>
            <Text style={styles.sumUnit}>{t('plates.sideTotal', { unit, side: fmt(side) })}</Text>
          </View>
        ) : (
          <Text style={styles.none}>{t('plates.none')}</Text>
        )}
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </Card>

      {result && result.perSide.length > 0 ? (
        <ListSection>
          {groupPlates(result.perSide).map((g) => (
            <ListRow
              key={g.plate}
              label={`${fmt(g.plate)} ${unit}`}
              value={t('plates.count', { count: g.count })}
            />
          ))}
        </ListSection>
      ) : null}

      <Text style={styles.hint}>{t('plates.hint')}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  fields: { flexDirection: 'row', gap: 12 },
  field: { flex: 1 },
  resultCard: { gap: 8 },
  cardTitle: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  bar: {
    height: 150,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  sleeveEnd: { width: 70, height: 10, borderRadius: 3, backgroundColor: theme.colors.text2 },
  collar: { width: 8, height: 30, borderRadius: 3, backgroundColor: theme.colors.text2 },
  sleeve: { width: 36, height: 10, borderRadius: 3, backgroundColor: theme.colors.text2 },
  plate: {
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
  },
  plateText: {
    textAlign: 'center',
    transform: [{ rotate: '90deg' }],
    fontSize: 10,
    lineHeight: 13,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    color: theme.colors.onAccent,
  },
  sumRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    flexWrap: 'wrap',
    columnGap: 8,
  },
  sum: {
    fontSize: 26,
    lineHeight: 34,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    color: theme.colors.text,
  },
  sumUnit: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  none: {
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 34,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text2,
  },
  message: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.warm,
  },
  hint: {
    paddingHorizontal: 6,
    fontSize: 12,
    lineHeight: 19,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
