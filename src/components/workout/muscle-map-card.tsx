import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import type { ExtendedBodyPart, Slug } from 'react-native-body-highlighter';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { BodyFigure } from '@/components/ui';
import { MUSCLES } from '@/data/muscles';
import type { MuscleLevel } from '@/domain/session-summary';
import { useAppLanguage } from '@/i18n/use-app-language';
import { withAlpha } from '@/theme/color';

/** 단계별 채움 투명도 (시안: 집중 1 · 주요 0.6 · 보조 0.3) */
export const LEVEL_OPACITY: Record<MuscleLevel, number> = { 3: 1, 2: 0.6, 1: 0.3 };

type Props = {
  levels: ReadonlyMap<string, MuscleLevel>;
  gender: 'male' | 'female';
  title: string;
};

/** 근육맵 카드: 앞·뒤 바디 + 집중/주요/보조 범례 */
export function MuscleMapCard({ levels, gender, title }: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const lang = useAppLanguage();

  const bySlug = new Map<Slug, MuscleLevel>();
  for (const m of MUSCLES) {
    const level = levels.get(m.id);
    if (!level) continue;
    for (const slug of m.bodySlugs as readonly Slug[]) {
      bySlug.set(slug, Math.max(bySlug.get(slug) ?? 0, level) as MuscleLevel);
    }
  }
  const data: ExtendedBodyPart[] = [...bySlug].map(([slug, level]) => ({
    slug,
    styles: { fill: withAlpha(theme.colors.accent, LEVEL_OPACITY[level]) },
  }));

  const worked = MUSCLES.filter((m) => levels.has(m.id))
    .sort((a, b) => (levels.get(b.id) ?? 0) - (levels.get(a.id) ?? 0))
    .map((m) => m[lang]);
  const legend: [MuscleLevel, string][] = [
    [3, t('summary.focus')],
    [2, t('summary.major')],
    [1, t('summary.minor')],
  ];

  return (
    <View style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>
      <View
        style={styles.bodies}
        accessible
        accessibilityLabel={
          worked.length
            ? t('summary.musclesA11y', { list: worked.join(', ') })
            : t('summary.noMuscles')
        }
      >
        <BodyFigure gender={gender} side="front" width={104} data={data} />
        <BodyFigure gender={gender} side="back" width={104} data={data} />
      </View>
      <View style={styles.legend} importantForAccessibility="no-hide-descendants">
        {legend.map(([level, label]) => (
          <View key={level} style={styles.legendItem}>
            <View
              style={[
                styles.swatch,
                { backgroundColor: withAlpha(theme.colors.accent, LEVEL_OPACITY[level]) },
              ]}
            />
            <Text style={styles.legendText}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    gap: 12,
    padding: 18,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  title: {
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  bodies: { flexDirection: 'row', justifyContent: 'center', gap: 28, paddingVertical: 4 },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 4 },
  legendText: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
