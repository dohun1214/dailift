import { ChevronDown } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { ActionSheet } from '@/components/ui';
import { useExerciseCatalog } from '@/db/use-exercise-catalog';
import { useStatsData } from '@/db/use-stats';
import { weeklySetRange } from '@/domain/profile';
import {
  BALANCE_GROUPS,
  balanceState,
  groupBalance,
  isStagnant,
  mostFrequentExercise,
  sessionBestE1rm,
  weeklyE1rm,
  weeklyProgress,
} from '@/domain/stats';
import { useAppLanguage } from '@/i18n/use-app-language';
import { topicParticle } from '@/lib/josa';
import { useProfile } from '@/stores/profile';
import { useSettings } from '@/stores/settings';

import { BalanceGauge } from './balance-gauge';
import { LineChart } from './line-chart';

const WEEKS = 8;
const fmt1 = (n: number) => (Math.round(n * 10) / 10).toFixed(1);

/** 통계 (지난 7일 기준): 진행도 두 숫자, 부위 밸런스, 추정 1RM 추이, 정체 한 줄 */
export function StatsView() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const lang = useAppLanguage();
  const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
  const unit = useSettings((s) => s.weightUnit);
  const experience = useProfile((s) => s.experience);
  const range = weeklySetRange(experience);
  const catalog = useExerciseCatalog(lang);
  const { sets, musclesOf } = useStatsData();
  const [picked, setPicked] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  // 화면을 여는 시점 기준(렌더마다 바뀌지 않게)
  const [now] = useState(() => Date.now());

  const progress = weeklyProgress(sets, now, unit);
  const balance = groupBalance(sets, now, musclesOf);

  // 무게 기록이 있는 종목(최근 순) — 차트 종목 선택지와 정체 감지 대상
  const weighted = useMemo(() => {
    const last = new Map<string, number>();
    for (const s of sets) {
      if (s.weight === null || !s.reps) continue;
      last.set(s.exerciseId, Math.max(last.get(s.exerciseId) ?? 0, s.startedAt));
    }
    return [...last].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }, [sets]);

  const exerciseId =
    picked && weighted.includes(picked) ? picked : mostFrequentExercise(sets, now, WEEKS);
  const sessions = useMemo(
    () => (exerciseId ? sessionBestE1rm(sets, exerciseId, unit) : []),
    [sets, exerciseId, unit],
  );
  const weeks = weeklyE1rm(sessions, now, WEEKS);
  const latest = [...weeks].reverse().find((w) => w !== null) ?? null;
  const firstIdx = weeks.findIndex((w) => w !== null);
  const first = firstIdx >= 0 ? (weeks[firstIdx] ?? null) : null;
  const exName = exerciseId ? (catalog.byId.get(exerciseId)?.name ?? '') : '';

  const stagnant = useMemo(() => {
    for (const id of weighted) {
      const list = sessionBestE1rm(sets, id, unit);
      if (isStagnant(list)) return { id, count: Math.min(6, list.length) };
    }
    return null;
  }, [weighted, sets, unit]);
  const stagnantName = stagnant ? (catalog.byId.get(stagnant.id)?.name ?? '') : '';

  const pairs: [string, string, string][] = [
    [
      t('stats.volume', { unit }),
      progress.current.volume.toLocaleString(locale),
      progress.previous.volume.toLocaleString(locale),
    ],
    [t('stats.sets'), String(progress.current.sets), String(progress.previous.sets)],
  ];

  return (
    <>
      <View style={styles.pairs}>
        {pairs.map(([label, cur, prev]) => (
          <View
            key={label}
            style={styles.pair}
            accessible
            accessibilityLabel={t('stats.pairA11y', { label, current: cur, previous: prev })}
          >
            <Text style={styles.caption}>{label}</Text>
            <View style={styles.pairRow}>
              <Text style={styles.pairMain}>{cur}</Text>
              <Text style={styles.pairSub}>{prev}</Text>
            </View>
            <Text style={styles.foot}>{t('stats.compare')}</Text>
          </View>
        ))}
      </View>

      <View style={styles.balanceCard}>
        <View style={styles.balanceHead}>
          <Text style={styles.h2} accessibilityRole="header">
            {t('stats.balance')}
          </Text>
          <Text style={styles.small}>{t('stats.recommended', range)}</Text>
        </View>
        {BALANCE_GROUPS.map((g) => {
          const value = balance.get(g) ?? 0;
          const name = t(`exercises.group.${g}`);
          return (
            <BalanceGauge
              key={g}
              name={name}
              value={value}
              range={range}
              a11yLabel={t('stats.gaugeA11y', {
                name,
                value,
                state: t(`stats.state.${balanceState(value, range)}`),
              })}
            />
          );
        })}
      </View>

      <View style={styles.e1rmCard}>
        <View style={styles.e1rmHead}>
          <Text style={styles.h2} accessibilityRole="header">
            {t('stats.e1rm')}
          </Text>
          {weighted.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('stats.pickExercise')}, ${exName}`}
              onPress={() => setPickerOpen(true)}
              style={({ pressed }) => [styles.picker, pressed && styles.pressed]}
            >
              <Text style={styles.pickerText} numberOfLines={1}>
                {exName}
              </Text>
              <ChevronDown size={16} color={theme.colors.text} strokeWidth={1.8} />
            </Pressable>
          ) : null}
        </View>
        {latest !== null ? (
          <>
            <View style={styles.e1rmValueRow}>
              <Text style={styles.e1rmValue}>{fmt1(latest)}</Text>
              <Text style={styles.e1rmSub}>
                {first !== null &&
                firstIdx < WEEKS - 1 &&
                weeks.filter((w) => w !== null).length > 1
                  ? t('stats.e1rmAgo', { unit, weeks: WEEKS - 1 - firstIdx, value: fmt1(first) })
                  : t('stats.e1rmUnit', { unit })}
              </Text>
            </View>
            <LineChart
              values={weeks}
              label={t('stats.chartA11y', { name: exName, value: fmt1(latest), unit })}
            />
          </>
        ) : (
          <Text style={styles.small}>{t('stats.e1rmEmpty')}</Text>
        )}
      </View>

      {stagnant ? (
        <View style={styles.note}>
          <Text style={styles.noteText}>
            <Trans
              i18nKey="stats.stagnant"
              values={{
                name: stagnantName,
                particle: topicParticle(stagnantName),
                count: stagnant.count,
              }}
              components={{ b: <Text style={styles.noteStrong} /> }}
            />
          </Text>
        </View>
      ) : null}

      <ActionSheet
        visible={pickerOpen}
        title={t('stats.pickExercise')}
        cancelLabel={t('history.actions.cancel')}
        onClose={() => setPickerOpen(false)}
        actions={weighted.slice(0, 8).map((id) => ({
          label: catalog.byId.get(id)?.name ?? id,
          onPress: () => setPicked(id),
        }))}
      />
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  pairs: { flexDirection: 'row', gap: 12 },
  pair: {
    flex: 1,
    gap: 8,
    padding: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  pairRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  pairMain: {
    fontSize: 22,
    lineHeight: 28,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  pairSub: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.numMedium,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  foot: {
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  balanceCard: {
    paddingTop: 18,
    paddingRight: 16,
    paddingBottom: 10,
    paddingLeft: 18,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  balanceHead: { flexDirection: 'row', alignItems: 'baseline', gap: 8, paddingBottom: 6 },
  h2: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  small: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  e1rmCard: {
    gap: 10,
    paddingTop: 14,
    paddingRight: 16,
    paddingBottom: 16,
    paddingLeft: 18,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  e1rmHead: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  picker: {
    maxWidth: 190,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface2,
  },
  pickerText: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  pressed: { opacity: 0.7 },
  e1rmValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  e1rmValue: {
    fontSize: 28,
    lineHeight: 36,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  e1rmSub: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  note: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  noteText: {
    fontSize: 13,
    lineHeight: 19.5,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  noteStrong: { fontFamily: theme.fonts.semibold, color: theme.colors.text },
}));
