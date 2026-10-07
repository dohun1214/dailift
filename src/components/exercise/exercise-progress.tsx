import { and, asc, eq, isNotNull, isNull, ne } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { ProgressChart } from '@/components/stats/progress-chart';
import { Badge } from '@/components/ui';
import { db } from '@/db/client';
import type { ExerciseType } from '@/db/schema';
import * as schema from '@/db/schema';
import { useTableRev } from '@/db/use-table-rev';
import {
  bestSession,
  defaultPeriod,
  exerciseSessions,
  hasEarlier,
  metricsFor,
  monthMarks,
  PROGRESS_PERIODS,
  type ProgressMetric,
  type ProgressPeriod,
  type ProgressSession,
  type ProgressSet,
  progressAxis,
  progressPoints,
  timePositions,
} from '@/domain/exercise-progress';
import { formatClock } from '@/domain/rest-timer';
import { groupSetsByWeight } from '@/domain/session-summary';
import { useAppLanguage } from '@/i18n/use-app-language';
import { useSettings } from '@/stores/settings';

type Props = { exerciseId: string; name: string; type: ExerciseType };

const RECENT = 3;
const MORE = 10;
const KIND = {
  weight_reps: 'weight',
  bodyweight_reps: 'reps',
  time: 'time',
  cardio: 'time',
} as const;
const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** 종목 상세의 내 기록: 값 전환(최고·추정 1RM·합계), 기간, 추이 그래프, 최근 기록 */
export function ExerciseProgress({ exerciseId, name, type }: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const lang = useAppLanguage();
  const locale = lang === 'ko' ? 'ko-KR' : 'en-US';
  const unit = useSettings((s) => s.weightUnit);
  const [pickedMetric, setMetric] = useState<ProgressMetric>('max');
  const [pickedPeriod, setPeriod] = useState<ProgressPeriod | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visible, setVisible] = useState(RECENT);
  // 화면을 여는 시점 기준(렌더마다 바뀌지 않게)
  const [now] = useState(() => Date.now());

  // 기록을 고치거나 지우면 workouts만 바뀔 수 있다 → 그때도 다시 읽는다.
  const rev = useTableRev(schema.workouts, schema.workoutExercises);
  const { data: rows } = useLiveQuery(
    db
      .select({
        workoutId: schema.workouts.id,
        startedAt: schema.workouts.startedAt,
        weight: schema.sets.weight,
        reps: schema.sets.reps,
        durationSec: schema.sets.durationSec,
        unit: schema.sets.weightUnit,
      })
      .from(schema.sets)
      .innerJoin(
        schema.workoutExercises,
        eq(schema.workoutExercises.id, schema.sets.workoutExerciseId),
      )
      .innerJoin(schema.workouts, eq(schema.workouts.id, schema.workoutExercises.workoutId))
      .where(
        and(
          eq(schema.workoutExercises.exerciseId, exerciseId),
          eq(schema.workouts.status, 'completed'),
          isNull(schema.workouts.deletedAt),
          isNull(schema.workoutExercises.deletedAt),
          isNull(schema.sets.deletedAt),
          isNotNull(schema.sets.completedAt),
          ne(schema.sets.kind, 'warmup'),
        ),
      )
      .orderBy(
        asc(schema.workouts.startedAt),
        asc(schema.workoutExercises.position),
        asc(schema.sets.position),
      ),
    [exerciseId, rev],
  );

  const sessions = useMemo(
    () => exerciseSessions(rows as ProgressSet[], type, unit),
    [rows, type, unit],
  );
  const metrics = metricsFor(type);
  const metric = metrics.includes(pickedMetric) ? pickedMetric : 'max';
  const period = pickedPeriod ?? defaultPeriod(sessions, now);
  const points = useMemo(
    () => progressPoints(sessions, metric, period, now),
    [sessions, metric, period, now],
  );
  const best = useMemo(() => bestSession(sessions), [sessions]);

  const kind = KIND[type];
  const unitLabel =
    kind === 'weight' ? unit : kind === 'reps' ? t('exerciseDetail.progress.repsUnit') : '';
  const value = (v: number) => {
    if (kind === 'time') return formatClock(v);
    if (kind === 'reps') return String(Math.round(v));
    if (metric === 'e1rm') return v.toFixed(1);
    return metric === 'volume' ? Math.round(v).toLocaleString(locale) : fmt(v);
  };
  const tick = (v: number) => {
    if (kind === 'time') return formatClock(v);
    return kind === 'weight' && metric === 'volume' ? Math.round(v).toLocaleString(locale) : fmt(v);
  };
  const thisYear = new Date(now).getFullYear();
  const dateLabel = (at: number) => {
    const d = new Date(at);
    return d.toLocaleDateString(locale, {
      year: d.getFullYear() === thisYear ? undefined : 'numeric',
      month: lang === 'ko' ? 'long' : 'short',
      day: 'numeric',
    });
  };
  const setsLine = (session: ProgressSession) => {
    if (kind === 'time')
      return session.sets.map((s) => formatClock(s.durationSec ?? 0)).join(' · ');
    const groups = groupSetsByWeight(
      session.sets.map((s) => ({ ...s, kind: 'working' as const, unit })),
    );
    const plain = groups.every((g) => g.weight === null);
    const text = groups
      .map((g) =>
        g.weight === null
          ? g.reps.join(' · ')
          : `${kind === 'reps' ? '+' : ''}${fmt(g.weight)}${unit} × ${g.reps.join(' · ')}`,
      )
      .join(' · ');
    return plain ? t('exerciseDetail.progress.reps', { reps: text }) : text;
  };

  if (sessions.length === 0) {
    return (
      <View style={styles.card}>
        <Text style={styles.h2} accessibilityRole="header">
          {t('exerciseDetail.record')}
        </Text>
        <Text style={styles.muted}>{t('exerciseDetail.noRecord')}</Text>
      </View>
    );
  }

  const selectedIndex = points.findIndex((p) => p.session.workoutId === selectedId);
  const selected = selectedIndex >= 0 ? points[selectedIndex] : undefined;
  const first = points[0];
  const last = points[points.length - 1];
  const shown = selected ?? last;

  let caption = t(`exerciseDetail.progress.caption.${kind}.${metric}`);
  let sub = unitLabel;
  if (selected) {
    caption = dateLabel(selected.session.startedAt);
    const uniform =
      kind === 'weight' &&
      metric === 'max' &&
      selected.session.sets.every((s) => s.weight === selected.session.sets[0]?.weight);
    const line = uniform
      ? t('exerciseDetail.progress.reps', {
          reps: selected.session.sets.map((s) => s.reps ?? 0).join(' · '),
        })
      : setsLine(selected.session);
    sub = unitLabel ? `${unitLabel} · ${line}` : line;
  } else if (first && last && points.length >= 2) {
    const diff = last.value - first.value;
    const delta = `${diff < 0 ? '−' : '+'}${value(Math.abs(diff))}${unitLabel}`;
    const text =
      Math.abs(diff) < 1e-9
        ? t('exerciseDetail.progress.same')
        : hasEarlier(sessions, period, now)
          ? t(`exerciseDetail.progress.ago.${period}`, { delta })
          : t('exerciseDetail.progress.sinceFirst', { delta });
    sub = unitLabel ? `${unitLabel} · ${text}` : text;
  } else if (last) {
    const date = dateLabel(last.session.startedAt);
    sub = unitLabel ? `${unitLabel} · ${date}` : date;
  }

  const startedAts = points.map((p) => p.session.startedAt);
  const marks = monthMarks(startedAts).map((index) => {
    const d = new Date(startedAts[index] ?? 0);
    return {
      index,
      label: d.toLocaleDateString(locale, {
        year: d.getFullYear() === thisYear ? undefined : '2-digit',
        month: 'short',
      }),
    };
  });
  const recent = [...sessions].reverse();
  const metricName = t(`exerciseDetail.progress.metric.${kind}.${metric}`);

  return (
    <>
      <View style={styles.card}>
        <View style={styles.head}>
          <Text style={[styles.h2, styles.flex]} accessibilityRole="header">
            {t('exerciseDetail.record')}
          </Text>
          <Text style={styles.small}>
            {t('exerciseDetail.progress.count', {
              count: points.length,
              range: t(`exerciseDetail.progress.range.${period}`),
            })}
          </Text>
        </View>

        <View
          accessibilityRole="tablist"
          accessibilityLabel={t('exerciseDetail.progress.metricA11y')}
          style={styles.metrics}
        >
          {metrics.map((m) => (
            <Pressable
              key={m}
              accessibilityRole="tab"
              accessibilityState={{ selected: m === metric }}
              onPress={() => setMetric(m)}
              hitSlop={{ top: 4, bottom: 4 }}
              style={[styles.metric, m === metric && styles.metricOn]}
            >
              <Text
                style={[styles.metricText, m === metric && styles.metricTextOn]}
                numberOfLines={1}
              >
                {t(`exerciseDetail.progress.metric.${kind}.${m}`)}
              </Text>
            </Pressable>
          ))}
        </View>

        {shown ? (
          <View style={styles.headline}>
            <Text style={styles.caption}>{caption}</Text>
            <View style={styles.valueRow}>
              <Text style={styles.value}>{value(shown.value)}</Text>
              <Text style={styles.sub}>{sub}</Text>
            </View>
          </View>
        ) : null}

        {points.length >= 2 ? (
          <ProgressChart
            values={points.map((p) => p.value)}
            positions={timePositions(startedAts)}
            axis={progressAxis(
              points.map((p) => p.value),
              kind === 'time' ? 'time' : kind === 'reps' ? 'integer' : 'decimal',
            )}
            tickLabel={tick}
            marks={marks}
            selected={selectedIndex >= 0 ? selectedIndex : null}
            onSelect={(i) =>
              setSelectedId(i === null ? null : (points[i]?.session.workoutId ?? null))
            }
            label={t('exerciseDetail.progress.chartA11y', {
              name,
              metric: metricName,
              count: points.length,
              value: `${value(last?.value ?? 0)}${unitLabel}`,
            })}
          />
        ) : (
          <View style={styles.note}>
            <Text style={styles.noteText}>
              {points.length === 1
                ? t('exerciseDetail.progress.needTwo')
                : t('exerciseDetail.progress.emptyPeriod')}
            </Text>
          </View>
        )}

        {sessions.length >= 2 ? (
          <View
            accessibilityRole="tablist"
            accessibilityLabel={t('exerciseDetail.progress.periodA11y')}
            style={styles.periods}
          >
            {PROGRESS_PERIODS.map((p) => (
              <Pressable
                key={p}
                accessibilityRole="tab"
                accessibilityState={{ selected: p === period }}
                onPress={() => {
                  setPeriod(p);
                  setSelectedId(null);
                }}
                hitSlop={{ top: 4, bottom: 4 }}
                style={[styles.period, p === period && styles.periodOn]}
              >
                <Text style={[styles.periodText, p === period && styles.periodTextOn]}>
                  {t(`exerciseDetail.progress.period.${p}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.recentCard}>
        <Text style={[styles.h2, styles.recentTitle]} accessibilityRole="header">
          {t('exerciseDetail.progress.recent')}
        </Text>
        {recent.slice(0, visible).map((session, i, list) => {
          const date = dateLabel(session.startedAt);
          const line = setsLine(session);
          const isBest = sessions.length > 1 && session.workoutId === best?.workoutId;
          return (
            <Pressable
              key={session.workoutId}
              accessibilityRole="button"
              accessibilityLabel={t('exerciseDetail.progress.rowA11y', {
                date,
                sets: line,
                best: isBest ? `, ${t('exerciseDetail.progress.best')}` : '',
              })}
              onPress={() =>
                router.push({
                  pathname: '/workout-summary/[id]',
                  params: { id: session.workoutId },
                })
              }
              style={({ pressed }) => [
                styles.row,
                i < list.length - 1 && styles.rowLine,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.rowDate}>{date}</Text>
              <View style={styles.rowBody}>
                <Text style={styles.rowSets} numberOfLines={1}>
                  {line}
                </Text>
                {isBest ? <Badge label={t('exerciseDetail.progress.best')} kind="pr" /> : null}
              </View>
              <ChevronRight size={18} color={theme.colors.text2} strokeWidth={1.8} />
            </Pressable>
          );
        })}
        {recent.length > visible ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => setVisible((v) => v + MORE)}
            style={({ pressed }) => [styles.more, pressed && styles.pressed]}
          >
            <Text style={styles.moreText}>{t('exerciseDetail.progress.more')}</Text>
          </Pressable>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  card: {
    gap: 12,
    padding: 18,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  head: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  h2: {
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
  muted: {
    fontSize: 13,
    lineHeight: 19.5,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  metrics: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: 15,
    backgroundColor: theme.colors.surface2,
  },
  metric: {
    flex: 1,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricOn: { backgroundColor: theme.colors.accent },
  metricText: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text2,
  },
  metricTextOn: { fontFamily: theme.fonts.bold, color: theme.colors.onAccent },
  headline: { gap: 2 },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  valueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  value: {
    fontSize: 28,
    lineHeight: 36,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  sub: {
    flexShrink: 1,
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  note: {
    paddingVertical: 22,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: theme.colors.surface2,
  },
  noteText: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 20.8,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  periods: { flexDirection: 'row', gap: 4 },
  period: {
    flex: 1,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  periodOn: { backgroundColor: theme.colors.surface2 },
  periodText: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  periodTextOn: { fontFamily: theme.fonts.bold, color: theme.colors.text },
  recentCard: {
    paddingTop: 18,
    paddingRight: 16,
    paddingBottom: 16,
    paddingLeft: 18,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  recentTitle: { marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 52 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  rowDate: {
    minWidth: 68,
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowSets: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.numRegular,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  more: {
    height: 44,
    marginTop: 4,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface2,
  },
  moreText: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
}));
