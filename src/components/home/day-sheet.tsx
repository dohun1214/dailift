import { and, asc, inArray, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { ChevronRight, Plus } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Badge, BottomSheet, Button } from '@/components/ui';
import { db } from '@/db/client';
import * as schema from '@/db/schema';
import type { HistoryItem } from '@/domain/history';
import type { DayWhen } from '@/domain/home';
import type { RoutineSummary } from '@/domain/routine';

export type DayRoutine = Pick<
  RoutineSummary,
  'id' | 'name' | 'exerciseCount' | 'setCount' | 'minutes'
>;

type Props = {
  /** 보고 있는 날. null이면 닫힌다 */
  day: Date | null;
  when: DayWhen;
  /** 제목에 쓸 날짜 (예: 9월 16일 수요일) */
  dateLabel: string;
  /** 그날 한 운동 (시작한 순서대로) */
  workouts: readonly HistoryItem[];
  /** 그 요일에 잡힌 루틴 */
  planned: readonly DayRoutine[];
  /** 기록을 추가할 때 고를 내 루틴 전체 */
  routines: readonly DayRoutine[];
  /** 지금 진행 중인 운동이 있는가 */
  active: boolean;
  exerciseName: (exerciseId: string) => string;
  exerciseType: (exerciseId: string) => schema.ExerciseType | undefined;
  workoutMeta: (item: HistoryItem) => string;
  workoutNames: (item: HistoryItem) => string;
  onClose: () => void;
  onOpenWorkout: (workoutId: string) => void;
  /** 그 루틴으로 지금 운동을 시작한다 */
  onStart: (routine: DayRoutine) => void;
  /** 진행 중인 운동으로 간다 */
  onResume: () => void;
  /** 운동 시작(루틴 고르기)을 연다 */
  onPickStart: () => void;
  onViewRoutine: (routineId: string | null) => void;
  /** 지난 날 기록 추가: 루틴(또는 빈 운동)으로 그날 기록을 만든다 */
  onAddRecord: (routine: DayRoutine | null) => void;
};

/**
 * 홈의 날짜 칸을 누르면 올라오는 창. 지난 날 · 오늘 · 앞으로 올 날과
 * 운동을 했는지, 루틴이 잡혀 있었는지에 따라 내용이 달라진다.
 * 지난 날에서 '이날 운동 기록 추가'를 누르면 같은 창 안에서 루틴을 고른다.
 */
export function DaySheet({
  day,
  when,
  dateLabel,
  workouts,
  planned,
  routines,
  active,
  exerciseName,
  exerciseType,
  workoutMeta,
  workoutNames,
  onClose,
  onOpenWorkout,
  onStart,
  onResume,
  onPickStart,
  onViewRoutine,
  onAddRecord,
}: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const [adding, setAdding] = useState(false);
  // 다른 날을 열 때마다 처음 모습으로
  // biome-ignore lint/correctness/useExhaustiveDependencies: 날이 바뀔 때만 되돌린다
  useEffect(() => setAdding(false), [day]);

  const plannedIds = planned.map((r) => r.id);
  const { data: items } = useLiveQuery(
    db
      .select({
        id: schema.routineExercises.id,
        routineId: schema.routineExercises.routineId,
        exerciseId: schema.routineExercises.exerciseId,
        targetSets: schema.routineExercises.targetSets,
        repMin: schema.routineExercises.repMin,
        repMax: schema.routineExercises.repMax,
      })
      .from(schema.routineExercises)
      .where(
        and(
          inArray(schema.routineExercises.routineId, plannedIds.length ? plannedIds : ['']),
          isNull(schema.routineExercises.deletedAt),
        ),
      )
      .orderBy(asc(schema.routineExercises.position)),
    [plannedIds.join(',')],
  );

  const run = (action: () => void) => {
    onClose();
    action();
  };
  const routineMeta = (r: DayRoutine) =>
    t('home.meta', { count: r.exerciseCount, sets: r.setCount, minutes: r.minutes });

  const routineCard = (r: DayRoutine, badge: string) => {
    const rows = items.filter((i) => i.routineId === r.id);
    return (
      <View key={r.id} style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.cardName} numberOfLines={1}>
            {r.name}
          </Text>
          <Badge label={badge} />
          <Text style={styles.cardMeta} numberOfLines={1}>
            {routineMeta(r)}
          </Text>
        </View>
        {rows.map((i, index) => (
          <View key={i.id} style={[styles.item, index > 0 && styles.line]}>
            <Text style={styles.itemName} numberOfLines={1}>
              {exerciseName(i.exerciseId)}
            </Text>
            <Text style={styles.itemMeta}>
              {t(
                exerciseType(i.exerciseId) === 'time'
                  ? 'workout.collapsedMetaTime'
                  : 'workout.collapsedMeta',
                { count: i.targetSets, min: i.repMin, max: i.repMax },
              )}
            </Text>
          </View>
        ))}
      </View>
    );
  };

  const workoutRows = workouts.map((w) => {
    const names = workoutNames(w);
    const meta = workoutMeta(w);
    return (
      <Pressable
        key={w.id}
        accessibilityRole="button"
        accessibilityLabel={[w.name, names, meta].filter(Boolean).join(', ')}
        accessibilityHint={t('home.day.workoutHint')}
        onPress={() => run(() => onOpenWorkout(w.id))}
        style={({ pressed }) => [styles.workout, pressed && styles.pressed]}
      >
        <View style={styles.workoutBody}>
          <Text style={styles.workoutName} numberOfLines={1}>
            {w.name}
          </Text>
          {names ? (
            <Text style={styles.workoutNames} numberOfLines={1}>
              {names}
            </Text>
          ) : null}
          <Text style={styles.workoutMeta} numberOfLines={1}>
            {meta}
          </Text>
        </View>
        {w.prCount > 0 ? (
          <Badge label={t('history.prBadge', { count: w.prCount })} kind="pr" />
        ) : null}
        <ChevronRight size={18} color={theme.colors.text2} strokeWidth={1.8} />
      </Pressable>
    );
  });

  const addButton = (variant: 'secondary' | 'ghost') => (
    <Button
      label={t('home.day.add')}
      variant={variant}
      size={variant === 'ghost' ? 'sm' : 'lg'}
      onPress={() => setAdding(true)}
    />
  );

  let body: React.ReactNode;
  let actions: React.ReactNode = null;
  if (adding) {
    // 그날 예정이던 루틴을 맨 위로
    const list = [...routines].sort(
      (a, b) => Number(plannedIds.includes(b.id)) - Number(plannedIds.includes(a.id)),
    );
    body = (
      <>
        {list.length > 0 ? (
          <View style={styles.pickCard}>
            {list.map((r, i) => (
              <Pressable
                key={r.id}
                accessibilityRole="button"
                accessibilityLabel={`${r.name}, ${routineMeta(r)}`}
                onPress={() => run(() => onAddRecord(r))}
                style={({ pressed }) => [
                  styles.pickRow,
                  i > 0 && styles.line,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.pickBody}>
                  <View style={styles.pickNameRow}>
                    <Text style={styles.pickName} numberOfLines={1}>
                      {r.name}
                    </Text>
                    {plannedIds.includes(r.id) ? <Badge label={t('home.day.planned')} /> : null}
                  </View>
                  <Text style={styles.pickMeta} numberOfLines={1}>
                    {t('home.day.addMeta', { count: r.exerciseCount, sets: r.setCount })}
                  </Text>
                </View>
                <ChevronRight size={16} color={theme.colors.text2} strokeWidth={1.8} />
              </Pressable>
            ))}
          </View>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('home.day.addEmpty')}, ${t('home.day.addEmptySub')}`}
          onPress={() => run(() => onAddRecord(null))}
          style={({ pressed }) => [styles.empty, pressed && styles.pressed]}
        >
          <View style={styles.plus}>
            <Plus size={18} color={theme.colors.text} strokeWidth={1.8} />
          </View>
          <View style={styles.pickBody}>
            <Text style={styles.pickName}>{t('home.day.addEmpty')}</Text>
            <Text style={styles.pickMeta}>{t('home.day.addEmptySub')}</Text>
          </View>
        </Pressable>
      </>
    );
    actions = (
      <Button
        label={t('home.pick.cancel')}
        variant="ghost"
        size="sm"
        onPress={() => setAdding(false)}
      />
    );
  } else if (workouts.length > 0) {
    body = workoutRows;
    actions =
      when === 'past' ? (
        addButton('ghost')
      ) : active ? (
        <Button label={t('home.resume')} variant="secondary" onPress={() => run(onResume)} />
      ) : (
        <Button
          label={t('home.startMore')}
          variant="ghost"
          size="sm"
          onPress={() => run(onPickStart)}
        />
      );
  } else if (when === 'past') {
    body = (
      <>
        <Text style={styles.note}>
          {t(planned.length > 0 ? 'home.day.noRecord' : 'home.day.restPast')}
        </Text>
        {planned.map((r) => routineCard(r, t('home.day.planned')))}
      </>
    );
    actions = addButton('secondary');
  } else if (planned.length === 0) {
    body = <Text style={styles.note}>{t('home.day.rest')}</Text>;
    actions =
      when === 'today' ? (
        <Button
          label={active ? t('home.resume') : t('home.start')}
          variant={active ? 'primary' : 'secondary'}
          onPress={() => run(active ? onResume : onPickStart)}
        />
      ) : (
        <Button
          label={t('home.day.setDays')}
          variant="secondary"
          onPress={() => run(() => onViewRoutine(null))}
        />
      );
  } else {
    body = planned.map((r) =>
      routineCard(r, t(when === 'today' ? 'home.today' : 'home.day.planned')),
    );
    const single = planned.length === 1 ? planned[0] : undefined;
    actions = (
      <View style={styles.actions}>
        {active ? (
          <Button label={t('home.resume')} onPress={() => run(onResume)} />
        ) : (
          planned.map((r) => (
            <Button
              key={r.id}
              label={
                when === 'today'
                  ? single
                    ? t('home.start')
                    : t('home.day.startNamed', { name: r.name })
                  : single
                    ? t('home.day.startNow')
                    : t('home.day.startNowNamed', { name: r.name })
              }
              onPress={() => run(() => onStart(r))}
            />
          ))
        )}
        {when === 'future' ? (
          <Button
            label={t('home.day.viewRoutine')}
            variant="ghost"
            size="sm"
            onPress={() => run(() => onViewRoutine(single ? single.id : null))}
          />
        ) : null}
      </View>
    );
  }

  return (
    <BottomSheet
      visible={day !== null}
      title={
        adding
          ? t('home.day.addTitle')
          : when === 'today'
            ? t('home.day.todayTitle', { date: dateLabel })
            : dateLabel
      }
      subtitle={adding ? t('home.day.addSub', { date: dateLabel }) : undefined}
      closeLabel={t('common.close')}
      onClose={onClose}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.body} bounces={false}>
        {body}
      </ScrollView>
      {actions}
    </BottomSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  // 내용이 길면(종목이 많은 루틴) 내용만 스크롤된다
  scroll: { maxHeight: 380, flexGrow: 0 },
  body: { gap: 12 },
  pressed: { opacity: 0.7 },
  line: { borderTopWidth: 1, borderTopColor: theme.colors.line },
  note: {
    paddingHorizontal: 4,
    fontSize: 14,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  actions: { gap: 4 },
  workout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingLeft: 16,
    paddingRight: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  workoutBody: { flex: 1, gap: 3 },
  workoutName: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  workoutNames: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text,
  },
  workoutMeta: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.numRegular,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  card: {
    paddingTop: 16,
    paddingHorizontal: 18,
    paddingBottom: 8,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 6 },
  cardName: {
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  cardMeta: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  item: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 10 },
  itemName: {
    flex: 1,
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text,
  },
  itemMeta: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.numRegular,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  pickCard: {
    paddingVertical: 2,
    paddingHorizontal: 18,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  pickRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pickBody: { flex: 1, gap: 2 },
  pickNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pickName: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  pickMeta: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  empty: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 18,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  plus: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface2,
  },
}));
