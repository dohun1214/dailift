import { router, useFocusEffect } from 'expo-router';
import { ChevronRight, Plus, Weight } from 'lucide-react-native';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { useBodyFormat } from '@/components/body/use-body-format';
import { ProgressChart } from '@/components/stats/progress-chart';
import { Button, ConfirmDialog, Screen, TopBar } from '@/components/ui';
import { useBodyEntries } from '@/db/use-body';
import {
  BODY_METRICS,
  type BodyMetric,
  bodyPoints,
  defaultBodyPeriod,
  latestBody,
  metricValue,
} from '@/domain/body';
import {
  monthMarks,
  PROGRESS_PERIODS,
  type ProgressPeriod,
  progressAxis,
  timePositions,
} from '@/domain/exercise-progress';
import { type ProteinAsk, useBodyAsk } from '@/stores/body-ask';
import { useProfile } from '@/stores/profile';
import { useSettings } from '@/stores/settings';

const RECENT = 5;
const MORE = 10;

/** 체성분: 위 세 칸에서 고른 항목의 추이 그래프 + 기록 목록. 기록 줄을 누르면 고치는 화면 */
export default function BodyScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const unit = useSettings((s) => s.weightUnit);
  const fmt = useBodyFormat(unit);
  const entries = useBodyEntries();
  const [metric, setMetric] = useState<BodyMetric>('weight');
  const [pickedPeriod, setPeriod] = useState<ProgressPeriod | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [visible, setVisible] = useState(RECENT);
  // 화면을 여는 시점 기준(렌더마다 바뀌지 않게)
  const [now] = useState(() => Date.now());

  // 체중을 저장하고 돌아왔을 때: 단백질 목표를 새 체중에 맞출지 한 번 묻는다.
  const [ask, setAsk] = useState<ProteinAsk | null>(null);
  const [askOpen, setAskOpen] = useState(false);
  useFocusEffect(
    useCallback(() => {
      const pending = useBodyAsk.getState().protein;
      if (!pending) return;
      useBodyAsk.getState().clear();
      setAsk(pending);
      setAskOpen(true);
    }, []),
  );

  const latest = useMemo(() => latestBody(entries, unit), [entries, unit]);
  const all = useMemo(() => bodyPoints(entries, metric, unit), [entries, metric, unit]);
  const period = pickedPeriod ?? defaultBodyPeriod(all, now);
  const points = useMemo(
    () => bodyPoints(entries, metric, unit, period, now),
    [entries, metric, unit, period, now],
  );
  const recent = useMemo(() => [...entries].reverse(), [entries]);

  const header = <TopBar title={t('body.title')} />;
  const add = () => router.push({ pathname: '/body-entry/[id]', params: { id: 'new' } });
  const footer = <Button label={t('body.add')} icon={Plus} onPress={add} />;

  if (entries.length === 0) {
    return (
      <Screen header={header} footer={footer}>
        <View style={[styles.card, styles.empty]}>
          <View style={styles.emptyIcon}>
            <Weight size={26} color={theme.colors.text} strokeWidth={1.8} />
          </View>
          <Text style={styles.emptyTitle}>{t('body.empty.title')}</Text>
          <Text style={styles.emptyBody}>{t('body.empty.body')}</Text>
        </View>
      </Screen>
    );
  }

  const metricName = t(`body.metric.${metric}`);
  const selectedIndex = points.findIndex((p) => p.id === selectedId);
  const selected = selectedIndex >= 0 ? points[selectedIndex] : undefined;
  // 그래프에서 점을 고르면 위 세 칸도 그날 적은 값으로 바꿔 보여 준다(그날 안 적은 항목은 '–').
  const selectedEntry = selected ? entries.find((e) => e.id === selected.id) : undefined;
  const tileValue = (m: BodyMetric) =>
    selectedEntry ? metricValue(selectedEntry, m, unit) : latest.values[m];
  const first = points[0];
  const last = points[points.length - 1];
  let caption: string | null = null;
  if (selected) {
    caption = t('body.onDate', {
      date: fmt.date(selected.at, now),
      value: fmt.withUnit(metric, selected.value),
    });
  } else if (first && last && points.length >= 2) {
    caption = t('body.change', {
      date: fmt.date(first.at, now),
      from: fmt.withUnit(metric, first.value),
      to: fmt.withUnit(metric, last.value),
    });
  }
  const ats = points.map((p) => p.at);
  const thisYear = new Date(now).getFullYear();
  const marks = monthMarks(ats).map((index) => {
    const d = new Date(ats[index] ?? 0);
    return {
      index,
      label: d.toLocaleDateString(fmt.locale, {
        year: d.getFullYear() === thisYear ? undefined : '2-digit',
        month: 'short',
      }),
    };
  });

  return (
    <Screen header={header} footer={footer}>
      <View style={styles.card}>
        <View
          accessibilityRole="tablist"
          accessibilityLabel={t('body.metricA11y')}
          style={styles.tiles}
        >
          {BODY_METRICS.map((m) => {
            const v = tileValue(m);
            const on = m === metric;
            return (
              <Pressable
                key={m}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={t('body.tileA11y', {
                  name: t(`body.metric.${m}`),
                  value: v === null ? t('body.none') : fmt.withUnit(m, v),
                })}
                // 고른 날은 그대로 둔다 — 그날 이 항목도 적었으면 같은 날의 점이 골라진 채로 바뀐다.
                onPress={() => setMetric(m)}
                style={({ pressed }) => [
                  styles.tile,
                  on && styles.tileOn,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.tileLabel} numberOfLines={1}>
                  {t(`body.metric.${m}`)}
                </Text>
                <View style={styles.tileValueRow}>
                  <Text style={[styles.tileValue, v === null && styles.none]}>
                    {v === null ? '–' : fmt.num(v)}
                  </Text>
                  {v === null ? null : <Text style={styles.tileUnit}>{fmt.unitOf(m)}</Text>}
                </View>
              </Pressable>
            );
          })}
        </View>

        {all.length >= 2 ? (
          <View
            accessibilityRole="tablist"
            accessibilityLabel={t('body.period.a11y')}
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
                  {t(`body.period.${p}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        ) : null}

        {caption ? (
          <Text style={styles.caption} accessibilityLiveRegion="polite">
            {caption}
          </Text>
        ) : null}

        {points.length >= 2 ? (
          <ProgressChart
            values={points.map((p) => p.value)}
            positions={timePositions(ats)}
            axis={progressAxis(
              points.map((p) => p.value),
              'decimal',
            )}
            tickLabel={(v) => String(Math.round(v * 10) / 10)}
            marks={marks}
            selected={selectedIndex >= 0 ? selectedIndex : null}
            onSelect={(i) => setSelectedId(i === null ? null : (points[i]?.id ?? null))}
            label={t('body.chartA11y', {
              name: metricName,
              count: points.length,
              value: last ? fmt.withUnit(metric, last.value) : '',
            })}
          />
        ) : (
          <View style={styles.note}>
            <Text style={styles.noteText}>
              {all.length === 0
                ? t('body.noMetric', { name: metricName })
                : all.length === 1
                  ? t('body.needTwo')
                  : t('body.emptyPeriod')}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel} accessibilityRole="header">
          {t('body.logs')}
        </Text>
        <View style={styles.list}>
          {recent.slice(0, visible).map((e, i, list) => {
            const date = fmt.day(e.measuredAt);
            const line = fmt.line(e);
            return (
              <Pressable
                key={e.id}
                accessibilityRole="button"
                accessibilityLabel={t('body.row.a11y', { date, values: line })}
                onPress={() => router.push({ pathname: '/body-entry/[id]', params: { id: e.id } })}
                style={({ pressed }) => [
                  styles.row,
                  i < list.length - 1 && styles.rowLine,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.rowBody}>
                  <Text style={styles.rowDate}>{date}</Text>
                  <Text style={styles.rowLineText} numberOfLines={1}>
                    {line}
                  </Text>
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
              <Text style={styles.moreText}>{t('body.more')}</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <ConfirmDialog
        visible={askOpen}
        title={t(ask?.from === null ? 'body.protein.titleNew' : 'body.protein.title')}
        body={
          ask
            ? ask.from === null || ask.fromWeight === null
              ? t('body.protein.bodyNew', { toWeight: ask.toWeight, to: ask.to })
              : t('body.protein.body', {
                  fromWeight: ask.fromWeight,
                  toWeight: ask.toWeight,
                  from: ask.from,
                  to: ask.to,
                })
            : undefined
        }
        cancelLabel={t('body.protein.keep')}
        confirmLabel={t(ask?.from === null ? 'body.protein.set' : 'body.protein.change')}
        onCancel={() => setAskOpen(false)}
        onConfirm={() => {
          if (ask) useProfile.getState().setWeight(ask.weight, ask.unit);
          setAskOpen(false);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  pressed: { opacity: 0.7 },
  card: {
    marginTop: 4,
    gap: 12,
    paddingTop: 16,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    gap: 4,
    padding: 10,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: theme.colors.surface2,
  },
  tileOn: { borderColor: theme.colors.accent },
  tileLabel: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  tileValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  tileValue: {
    fontSize: 22,
    lineHeight: 28,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  none: { color: theme.colors.prefill },
  tileUnit: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  periods: { flexDirection: 'row', gap: 6 },
  period: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface2,
  },
  periodOn: { backgroundColor: theme.colors.accent },
  periodText: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  periodTextOn: { color: theme.colors.onAccent },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  note: {
    minHeight: 96,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 20,
    borderRadius: 16,
    backgroundColor: theme.colors.surface2,
  },
  noteText: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19.5,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  section: { gap: 8, paddingTop: 4 },
  sectionLabel: {
    paddingHorizontal: 6,
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text2,
  },
  list: {
    paddingVertical: 2,
    paddingLeft: 18,
    paddingRight: 14,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  row: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  rowBody: { flex: 1, gap: 3 },
  rowDate: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  rowLineText: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  more: { height: 48, alignItems: 'center', justifyContent: 'center' },
  moreText: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  empty: { alignItems: 'center', gap: 10, paddingVertical: 44, paddingHorizontal: 24 },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface2,
  },
  emptyTitle: {
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  emptyBody: {
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 19.5,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
