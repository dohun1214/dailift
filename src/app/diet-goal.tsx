import { router, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useDietFormat } from '@/components/diet/use-diet-format';
import { Card, Chip, ConfirmDialog, Screen, TextButton, TextField, TopBar } from '@/components/ui';
import { LIMITS, macroKcal } from '@/domain/diet';
import {
  defaultProteinPerKg,
  PROTEIN_PER_KG_OPTIONS,
  proteinTargetGrams,
  WEIGHT_RANGE,
} from '@/domain/profile';
import { LB_PER_KG, parseDecimal, toKg } from '@/lib/number';
import { useDietGoals } from '@/stores/diet-goals';
import { useProfile } from '@/stores/profile';
import { useSettings } from '@/stores/settings';

type Choice = number | 'direct';
type Draft = {
  choice: Choice;
  weight: string;
  proteinDirect: string;
  kcal: string;
  carb: string;
  fat: string;
};
const KEYS = ['choice', 'weight', 'proteinDirect', 'kcal', 'carb', 'fat'] as const;
const text = (n: number | null) => (n === null ? '' : String(n));

/** 비었으면 null(목표 없음), 정수가 아니거나 범위를 넘으면 'bad' */
function parseTarget(value: string, max: number): number | null | 'bad' {
  const s = value.trim();
  if (s === '') return null;
  if (!/^\d+$/.test(s)) return 'bad';
  const n = Number(s);
  if (n === 0) return null;
  return n > max ? 'bad' : n;
}

/**
 * 식단 목표: 단백질은 몸무게 1 kg당 양을 고르거나 직접 넣고, 칼로리 · 탄수화물 · 지방은 직접 넣는다(비워 둘 수 있다).
 * 몸무게도 여기서 넣고 고친다.
 */
export default function DietGoalScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const fmt = useDietFormat();
  const goals = useDietGoals();
  const profile = useProfile();
  const unit = useSettings((s) => s.weightUnit);
  const byGoal = defaultProteinPerKg(profile.goal);

  // biome-ignore lint/correctness/useExhaustiveDependencies: 화면을 열 때의 값으로 한 번만 만든다
  const initial = useMemo<Draft>(() => {
    // 저장해 둔 몸무게의 단위가 지금 설정과 다르면 바꿔서 보여 준다.
    let w = profile.weight;
    if (w !== null && profile.weightUnit !== unit) {
      w = Math.round((unit === 'kg' ? toKg(w, 'lb') : w * LB_PER_KG) * 10) / 10;
    }
    return {
      choice: goals.proteinMode === 'direct' ? 'direct' : (goals.proteinPerKg ?? byGoal),
      weight: text(w),
      proteinDirect: text(goals.proteinDirect),
      kcal: text(goals.kcal),
      carb: text(goals.carb),
      fat: text(goals.fat),
    };
  }, []);
  const [draft, setDraft] = useState(initial);
  const [invalid, setInvalid] = useState<Set<keyof Draft>>(new Set());
  const [leaveAsk, setLeaveAsk] = useState<(() => void) | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const changed = KEYS.some((k) => initial[k] !== draft[k]);
  useEffect(() => {
    if (leaving) router.back();
  }, [leaving]);
  usePreventRemove(changed && !leaving, ({ data }) => {
    setLeaveAsk(() => () => navigation.dispatch(data.action));
    setLeaveOpen(true);
  });

  const update = (patch: Partial<Draft>) => {
    setInvalid(new Set());
    setDraft((d) => ({ ...d, ...patch }));
  };

  const weight = draft.weight.trim() === '' ? null : parseDecimal(draft.weight);
  const range = WEIGHT_RANGE[unit];
  const weightOk =
    weight === null ? draft.weight.trim() === '' : weight >= range.min && weight <= range.max;
  const direct = draft.choice === 'direct';
  const perKgTarget =
    !direct && weightOk && weight !== null
      ? proteinTargetGrams(weight, unit, profile.goal, draft.choice as number)
      : null;
  const directTarget = parseTarget(draft.proteinDirect, LIMITS.macroTarget);
  const protein = direct ? (directTarget === 'bad' ? null : directTarget) : perKgTarget;
  const carb = parseTarget(draft.carb, LIMITS.macroTarget);
  const fat = parseTarget(draft.fat, LIMITS.macroTarget);
  const sum = macroKcal(protein, carb === 'bad' ? null : carb, fat === 'bad' ? null : fat);

  const save = () => {
    const kcal = parseTarget(draft.kcal, LIMITS.kcalTarget);
    const bad = new Set<keyof Draft>();
    // 직접 입력일 때는 몸무게 칸이 안 보인다: 그 칸 때문에 저장이 막히지 않게 하고, 몸무게도 건드리지 않는다.
    if (!direct && !weightOk) bad.add('weight');
    if (direct && directTarget === 'bad') bad.add('proteinDirect');
    if (kcal === 'bad') bad.add('kcal');
    if (carb === 'bad') bad.add('carb');
    if (fat === 'bad') bad.add('fat');
    if (bad.size > 0 || kcal === 'bad' || carb === 'bad' || fat === 'bad') return setInvalid(bad);
    goals.save({
      proteinMode: direct ? 'direct' : 'perKg',
      // 고르지 않고 둔 사람은 운동 목표를 바꾸면 따라 바뀌게 비워 둔다.
      proteinPerKg: direct
        ? goals.proteinPerKg
        : draft.choice === initial.choice && goals.proteinPerKg === null
          ? null
          : (draft.choice as number),
      proteinDirect: directTarget === 'bad' ? goals.proteinDirect : directTarget,
      kcal,
      carb,
      fat,
    });
    if (!direct && draft.weight !== initial.weight) profile.setWeight(weight, unit);
    setLeaving(true);
  };

  const kg = weight !== null && weightOk ? toKg(weight, unit) : null;
  const goalName = profile.goal ? t(`onboarding.goal.${profile.goal}`) : null;

  return (
    <Screen
      avoidKeyboard
      dismissKeyboardOnDrag
      header={
        <TopBar
          title={t('diet.goal.title')}
          leading="close"
          trailing={<TextButton label={t('common.save')} onPress={save} />}
        />
      }
    >
      <Card style={styles.first} padding="md">
        <Text style={styles.cardTitle} accessibilityRole="header">
          {t('diet.protein')}
        </Text>
        <View style={styles.group}>
          <Text style={styles.label}>{t('diet.goal.perKg')}</Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {[...PROTEIN_PER_KG_OPTIONS, 'direct' as const].map((x) => (
              <Chip
                key={x}
                tone="raised"
                label={x === 'direct' ? t('diet.goal.direct') : `${x.toFixed(1)} g`}
                selected={draft.choice === x}
                accessibilityRole="radio"
                accessibilityState={{ checked: draft.choice === x }}
                onPress={() => update({ choice: x })}
              />
            ))}
          </View>
        </View>
        {direct ? (
          <>
            <TextField
              label={t('diet.goal.proteinDirect')}
              value={draft.proteinDirect}
              placeholder="0"
              unit="g"
              keyboardType="number-pad"
              maxLength={3}
              invalid={invalid.has('proteinDirect')}
              onChangeText={(proteinDirect) => update({ proteinDirect })}
            />
            <Text style={styles.hint}>{t('diet.goal.directHint')}</Text>
          </>
        ) : (
          <>
            <TextField
              label={t('diet.goal.weight')}
              value={draft.weight}
              placeholder="0"
              unit={unit}
              keyboardType="decimal-pad"
              maxLength={5}
              error={invalid.has('weight') ? t('diet.goal.weightRange', range) : undefined}
              onChangeText={(w) => update({ weight: w })}
            />
            <View style={styles.result} accessible accessibilityLiveRegion="polite">
              {perKgTarget !== null && kg !== null ? (
                <>
                  <Text style={styles.formula} numberOfLines={1}>
                    {unit === 'kg'
                      ? t('diet.goal.formula', {
                          weight: fmt.num(kg),
                          perKg: (draft.choice as number).toFixed(1),
                        })
                      : t('diet.goal.formulaLb', {
                          weight: draft.weight.trim(),
                          kg: fmt.num(Math.round(kg * 10) / 10),
                          perKg: (draft.choice as number).toFixed(1),
                        })}
                  </Text>
                  <Text style={styles.perDay}>
                    {t('diet.goal.perDay')}{' '}
                    <Text style={styles.resultValue}>{fmt.int(perKgTarget)}</Text>
                    <Text style={styles.resultUnit}> g</Text>
                  </Text>
                </>
              ) : (
                <Text style={styles.formula}>{t('diet.goal.needWeight')}</Text>
              )}
            </View>
            <Text style={styles.hint}>
              {goalName
                ? t('diet.goal.hintByGoal', { goal: goalName, n: byGoal.toFixed(1) })
                : t('diet.goal.hintNoGoal', { n: byGoal.toFixed(1) })}
            </Text>
          </>
        )}
      </Card>

      <Card padding="md">
        <View style={styles.titleRow}>
          <Text style={styles.cardTitle} accessibilityRole="header">
            {t('diet.goal.othersTitle')}
          </Text>
          <Text style={styles.optional}>{t('diet.goal.optional')}</Text>
        </View>
        <TextField
          label={t('diet.goal.kcal')}
          value={draft.kcal}
          placeholder="0"
          unit="kcal"
          keyboardType="number-pad"
          maxLength={4}
          invalid={invalid.has('kcal')}
          onChangeText={(kcal) => update({ kcal })}
        />
        <View style={styles.pair}>
          <TextField
            label={t('diet.goal.carb')}
            value={draft.carb}
            placeholder="0"
            unit="g"
            keyboardType="number-pad"
            maxLength={3}
            invalid={invalid.has('carb')}
            onChangeText={(c) => update({ carb: c })}
          />
          <TextField
            label={t('diet.goal.fat')}
            value={draft.fat}
            placeholder="0"
            unit="g"
            keyboardType="number-pad"
            maxLength={3}
            invalid={invalid.has('fat')}
            onChangeText={(f) => update({ fat: f })}
          />
        </View>
        {invalid.size > 0 && !invalid.has('weight') ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {t('diet.goal.invalid')}
          </Text>
        ) : null}
        {sum !== null ? (
          <View style={styles.sum}>
            <Text style={styles.sumText}>{t('diet.goal.macroSum', { n: fmt.int(sum) })}</Text>
          </View>
        ) : null}
        <Text style={styles.hint}>{t('diet.goal.othersHint')}</Text>
      </Card>

      <Text style={styles.note}>{t('diet.goal.disclaimer')}</Text>

      <ConfirmDialog
        visible={leaveOpen}
        title={t('diet.discardTitle')}
        body={t('diet.discardBody')}
        cancelLabel={t('diet.keepEditing')}
        confirmLabel={t('diet.discard')}
        destructive
        onCancel={() => setLeaveOpen(false)}
        onConfirm={() => {
          setLeaveOpen(false);
          leaveAsk?.();
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  first: { marginTop: 8 },
  cardTitle: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  optional: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  group: { gap: 8 },
  label: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pair: { flexDirection: 'row', gap: 10 },
  result: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: theme.colors.surface2,
  },
  formula: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  perDay: {
    fontSize: 12,
    lineHeight: 26,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  resultValue: {
    fontSize: 20,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  resultUnit: { fontSize: 13, fontFamily: theme.fonts.numMedium, color: theme.colors.text2 },
  hint: {
    fontSize: 12,
    lineHeight: 19,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  error: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.danger,
  },
  sum: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: theme.colors.surface2,
  },
  sumText: {
    fontSize: 13,
    lineHeight: 19.5,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  note: {
    paddingHorizontal: 6,
    fontSize: 12,
    lineHeight: 19,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
