import { router } from 'expo-router';
import { ChevronDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Card, SwipeDelete } from '@/components/ui';
import { db } from '@/db/client';
import { deleteFoodLog, updateFoodLogAmount } from '@/db/diet';
import type { Meal } from '@/db/schema';
import { useDietDay, useDietTargets, useHasDietLogs } from '@/db/use-diet';
import { dateKey, parseDateKey, shiftDateKey } from '@/domain/date-key';
import { type FoodItem, type FoodLog, logItem, type MealGroup, nutrientsFor } from '@/domain/diet';
import { withAllUnits } from '@/food/full-item';
import { useFoodDb, useFoodSources } from '@/food/use-food-db';
import { useToday } from '@/lib/use-today';

import { AmountSheet } from './amount-sheet';
import { DateSheet } from './date-sheet';
import { BigMacro, SmallMacro } from './macro';
import { useDietFormat } from './use-diet-format';

/** 영양 탭의 '식단' 구간: 날짜, 하루 합계와 목표, 끼니별 음식 */
export function DietView() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const fmt = useDietFormat();
  const today = dateKey(useToday());
  // 따로 고르지 않으면 오늘을 따라간다(자정이 지나면 새 날로 넘어간다).
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked !== null && picked < today ? picked : today;
  const isToday = date === today;
  const { meals, total } = useDietDay(date);
  const targets = useDietTargets();
  const hasLogs = useHasDietLogs();
  const sources = useFoodSources();
  const { db: foodDb } = useFoodDb();
  const [dateOpen, setDateOpen] = useState(false);
  const [editing, setEditing] = useState<{ log: FoodLog; item: FoodItem } | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const go = (next: string) => setPicked(next >= today ? null : next);
  const day = parseDateKey(date) ?? new Date();
  const dayLabel = isToday ? t('diet.today', { date: fmt.day(day) }) : fmt.day(day);
  const noGoals = Object.values(targets).every((v) => v === null);
  const openGoal = () => router.push('/diet-goal');

  const add = (meal: Meal) => router.push({ pathname: '/food-search', params: { date, meal } });

  const edit = (log: FoodLog) => {
    // 영양값은 기록에 남긴 그때 값을 쓰고, 고를 수 있는 단위만 지금 음식 정보에서 다시 찾는다.
    const item = withAllUnits(logItem(log), log.unit, foodDb);
    setEditing({ log, item });
    setEditOpen(true);
  };

  const mealCard = ({ meal, logs, total: sum }: MealGroup) => {
    const name = fmt.meal(meal);
    return (
      <Card key={meal} padding="none" style={styles.meal}>
        <View style={[styles.mealHead, logs.length > 0 && styles.line]}>
          <Text style={styles.mealName} accessibilityRole="header">
            {name}
          </Text>
          {logs.length > 0 ? <Text style={styles.mealKcal}>{fmt.int(sum.kcal)} kcal</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('diet.addToMealA11y', { meal: name })}
            onPress={() => add(meal)}
            style={({ pressed }) => [styles.plusHit, pressed && styles.pressed]}
          >
            <View style={styles.plus}>
              <Plus size={16} color={theme.colors.text} strokeWidth={2.2} />
            </View>
          </Pressable>
        </View>
        {logs.map((log, i) => {
          const n = nutrientsFor(log, log.grams);
          const sub = `${fmt.amount(log, log.basis)} · ${t('diet.proteinShort', { n: fmt.int(n.protein) })}`;
          return (
            <SwipeDelete key={log.id} onDelete={() => deleteFoodLog(db, log.id)}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${log.name}, ${sub}, ${fmt.int(n.kcal)} kcal`}
                accessibilityHint={`${t('diet.rowHint')}. ${t('diet.swipeHint')}`}
                accessibilityActions={[{ name: 'delete', label: t('diet.deleteAction') }]}
                onAccessibilityAction={(e) => {
                  if (e.nativeEvent.actionName === 'delete') deleteFoodLog(db, log.id);
                }}
                onPress={() => edit(log)}
                style={({ pressed }) => [
                  styles.food,
                  i < logs.length - 1 && styles.line,
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.foodBody}>
                  <Text style={styles.foodName} numberOfLines={1}>
                    {log.name}
                  </Text>
                  <Text style={styles.foodSub} numberOfLines={1}>
                    {sub}
                  </Text>
                </View>
                <Text style={styles.foodKcal}>
                  {fmt.int(n.kcal)}
                  <Text style={styles.foodKcalUnit}> kcal</Text>
                </Text>
              </Pressable>
            </SwipeDelete>
          );
        })}
      </Card>
    );
  };

  return (
    <>
      <View style={styles.dateRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('diet.prevDay')}
          onPress={() => go(shiftDateKey(date, -1))}
          style={({ pressed }) => [styles.nav, pressed && styles.pressed]}
        >
          <ChevronLeft size={20} color={theme.colors.text} strokeWidth={1.8} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${dayLabel}, ${t('diet.pickDate')}`}
          onPress={() => setDateOpen(true)}
          style={({ pressed }) => [styles.dateButton, pressed && styles.pressed]}
        >
          <Text style={styles.dateText} numberOfLines={1}>
            {dayLabel}
          </Text>
          <ChevronDown size={16} color={theme.colors.text2} strokeWidth={1.8} />
        </Pressable>
        {isToday ? null : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('diet.dateSheet.today')}
            hitSlop={6}
            onPress={() => go(today)}
            style={({ pressed }) => [styles.todayPill, pressed && styles.pressed]}
          >
            <Text style={styles.todayText}>{t('diet.backToToday')}</Text>
          </Pressable>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('diet.nextDay')}
          accessibilityState={{ disabled: isToday }}
          disabled={isToday}
          onPress={() => go(shiftDateKey(date, 1))}
          style={({ pressed }) => [styles.nav, pressed && styles.pressed, isToday && styles.off]}
        >
          <ChevronRight size={20} color={theme.colors.text} strokeWidth={1.8} />
        </Pressable>
      </View>

      <Card style={styles.summary}>
        <View style={styles.bigRow}>
          <BigMacro label={t('diet.kcal')} value={total.kcal} target={targets.kcal} unit="kcal" />
          <BigMacro
            label={t('diet.protein')}
            value={total.protein}
            target={targets.protein}
            unit="g"
            moreIsFine
            trailing={
              noGoals ? null : (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('diet.goalLinkA11y')}
                  hitSlop={{ top: 13, bottom: 13, left: 8, right: 6 }}
                  onPress={openGoal}
                  style={({ pressed }) => [styles.goalLink, pressed && styles.pressed]}
                >
                  <Text style={styles.goalLinkText}>{t('diet.goalLink')}</Text>
                  <ChevronRight size={16} color={theme.colors.text2} strokeWidth={1.8} />
                </Pressable>
              )
            }
          />
        </View>
        {noGoals ? (
          <View style={styles.cta}>
            <Text style={styles.ctaText}>{t('diet.noGoal')}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={openGoal}
              style={({ pressed }) => [styles.ctaButton, pressed && styles.pressed]}
            >
              <Text style={styles.ctaButtonText}>{t('diet.setGoal')}</Text>
            </Pressable>
          </View>
        ) : null}
        <View style={styles.smallRow}>
          <SmallMacro label={t('diet.carb')} value={total.carb} target={targets.carb} bar />
          <SmallMacro label={t('diet.fat')} value={total.fat} target={targets.fat} bar />
        </View>
      </Card>

      {hasLogs ? null : (
        <Card style={styles.hint}>
          <Text style={styles.hintTitle}>{t('diet.emptyTitle')}</Text>
          <Text style={styles.hintBody}>{t('diet.emptyBody')}</Text>
        </Card>
      )}

      {meals.map(mealCard)}

      <Text style={styles.note}>
        {t(sources.includes('mfds') ? 'diet.sourceNote.kr' : 'diet.sourceNote.usda')}
      </Text>

      <DateSheet
        visible={dateOpen}
        value={date}
        today={today}
        onPick={(next) => {
          go(next);
          setDateOpen(false);
        }}
        onClose={() => setDateOpen(false)}
      />
      <AmountSheet
        visible={editOpen}
        item={editing?.item ?? null}
        initial={editing ? { grams: editing.log.grams, unit: editing.log.unit } : NO_AMOUNT}
        submitLabel={t('common.save')}
        onSubmit={(amount) => {
          if (editing) updateFoodLogAmount(db, editing.log.id, amount);
          setEditOpen(false);
        }}
        onDelete={() => {
          if (editing) deleteFoodLog(db, editing.log.id);
          setEditOpen(false);
        }}
        onClose={() => setEditOpen(false)}
      />
    </>
  );
}

const NO_AMOUNT = { grams: 100, unit: null } as const;

const styles = StyleSheet.create((theme) => ({
  pressed: { opacity: 0.6 },
  off: { opacity: 0.3 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  nav: {
    width: theme.hitSize,
    height: theme.hitSize,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  dateButton: {
    flex: 1,
    minWidth: 0,
    height: theme.hitSize,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  dateText: {
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  todayPill: {
    height: 32,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accentSoft,
  },
  todayText: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.accentText,
  },
  summary: { gap: 14 },
  bigRow: { flexDirection: 'row', gap: 16 },
  goalLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  goalLinkText: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text2,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 12,
    borderRadius: 16,
    backgroundColor: theme.colors.surface2,
  },
  ctaText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19.5,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  ctaButton: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
  },
  ctaButtonText: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.onAccent,
  },
  smallRow: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.line,
  },
  hint: { gap: 4 },
  hintTitle: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  hintBody: {
    fontSize: 13,
    lineHeight: 19.5,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  // 음식 줄이 카드 끝에서 끝까지 밀리도록 가로 여백은 안의 줄들이 갖는다.
  meal: { paddingVertical: 2, overflow: 'hidden' },
  line: { borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  mealHead: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 18,
    marginRight: 6,
  },
  mealName: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  mealKcal: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.numRegular,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  plusHit: {
    width: theme.hitSize,
    height: theme.hitSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface2,
  },
  food: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginLeft: 18,
    marginRight: 16,
  },
  foodBody: { flex: 1, minWidth: 0, gap: 2 },
  foodName: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  foodSub: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  foodKcal: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.numSemibold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  foodKcalUnit: { fontFamily: theme.fonts.numMedium, color: theme.colors.text2 },
  note: {
    paddingHorizontal: 6,
    fontSize: 12,
    lineHeight: 19,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
