import { Plus, X } from 'lucide-react-native';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { SetField } from '@/components/workout/set-field';
import type { ExerciseType } from '@/db/schema';
import { PLAN_LIMITS, type PlanSet, type SetPlan } from '@/domain/set-plan';

type Props = {
  plan: SetPlan;
  type: ExerciseType;
  onChange: (plan: SetPlan) => void;
};

/**
 * 루틴 편집의 '세트별로 정하기': 운동 중 화면과 같은 세트 줄(번호 · 무게 · 횟수)에
 * 무게와 횟수를 미리 적어 둔다. 워밍업 줄은 맨 위에 모인다.
 */
export function PlanEditor({ plan, type, onChange }: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const isTime = type === 'time';
  const full = plan.sets.length >= PLAN_LIMITS.sets;
  const workingCount = plan.sets.filter((s) => s.kind === 'working').length;

  // 줄마다 고유 key를 둔다(줄을 끼워 넣거나 지워도 입력 중인 칸이 다른 줄로 옮겨 가지 않게).
  const nextKey = useRef(0);
  const newKey = () => `k${nextKey.current++}`;
  const [keys, setKeys] = useState<string[]>(() => plan.sets.map(newKey));
  const rowKeys = keys.length === plan.sets.length ? keys : plan.sets.map((_, i) => `i${i}`);

  const setAt = (index: number, patch: Partial<PlanSet>) =>
    onChange({ ...plan, sets: plan.sets.map((s, i) => (i === index ? { ...s, ...patch } : s)) });
  const removeAt = (index: number) => {
    setKeys(rowKeys.filter((_, i) => i !== index));
    onChange({ ...plan, sets: plan.sets.filter((_, i) => i !== index) });
  };
  const addWorking = () => {
    const last = [...plan.sets].reverse().find((s) => s.kind === 'working');
    setKeys([...rowKeys, newKey()]);
    onChange({
      ...plan,
      sets: [
        ...plan.sets,
        {
          kind: 'working',
          weight: last?.weight ?? null,
          reps: last?.reps ?? null,
          durationSec: last?.durationSec ?? null,
        },
      ],
    });
  };
  const addWarmup = () => {
    const at = plan.sets.findIndex((s) => s.kind === 'working');
    const next = [...plan.sets];
    const nextKeys = [...rowKeys];
    nextKeys.splice(at === -1 ? next.length : at, 0, newKey());
    setKeys(nextKeys);
    next.splice(at === -1 ? next.length : at, 0, {
      kind: 'warmup',
      weight: null,
      reps: null,
      durationSec: null,
    });
    onChange({ ...plan, sets: next });
  };

  let workingNo = 0;
  return (
    <View style={styles.wrap}>
      <View style={styles.cols}>
        <Text style={[styles.col, styles.colSet]}>{t('workout.colSet')}</Text>
        {isTime ? (
          <Text style={[styles.col, styles.colGrow]}>{t('workout.colTime')}</Text>
        ) : (
          <>
            <Text style={[styles.col, styles.colGrow]}>
              {t(type === 'bodyweight_reps' ? 'workout.colAdded' : 'workout.colWeight')}
            </Text>
            <Text style={[styles.col, styles.colGrow]}>{t('workout.colReps')}</Text>
          </>
        )}
        <View style={styles.colRemove} />
      </View>

      {plan.sets.map((s, index) => {
        const warm = s.kind === 'warmup';
        const label = warm ? t('workout.warmupLabel') : String(++workingNo);
        const setName = warm ? t('workout.warmupA11y', { label }) : t('workout.setA11y', { label });
        // 본 세트가 하나뿐이면 지울 수 없다(세트별 계획에는 본 세트가 있어야 한다).
        const removable = warm || workingCount > 1;
        return (
          <View key={rowKeys[index]} style={styles.row}>
            <View style={[styles.label, warm && styles.labelWarm]}>
              <Text style={[styles.labelText, warm && styles.labelTextWarm]}>{label}</Text>
            </View>
            {isTime ? (
              <SetField
                label={t('workout.timeA11y', { set: setName })}
                value={s.durationSec}
                unit={t('workout.unitSec')}
                muted={false}
                onChange={(durationSec) => setAt(index, { durationSec })}
              />
            ) : (
              <>
                <SetField
                  label={t('workout.weightA11y', { set: setName })}
                  value={s.weight}
                  unit={type === 'bodyweight_reps' ? `+${plan.unit}` : plan.unit}
                  decimal
                  muted={false}
                  onChange={(weight) => setAt(index, { weight })}
                />
                <SetField
                  label={t('workout.repsA11y', { set: setName })}
                  value={s.reps}
                  unit={t('workout.unitReps')}
                  muted={false}
                  onChange={(reps) => setAt(index, { reps })}
                />
              </>
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${setName} ${t('workout.removeSet')}`}
              disabled={!removable}
              onPress={() => removeAt(index)}
              hitSlop={6}
              style={({ pressed }) => [
                styles.remove,
                !removable && styles.hidden,
                pressed && styles.pressed,
              ]}
            >
              <X size={16} color={theme.colors.text2} strokeWidth={1.8} />
            </Pressable>
          </View>
        );
      })}

      {full ? null : (
        <View style={styles.adds}>
          <Pressable
            accessibilityRole="button"
            onPress={addWorking}
            style={({ pressed }) => [styles.add, pressed && styles.pressed]}
          >
            <Plus size={18} color={theme.colors.text} strokeWidth={1.8} />
            <Text style={styles.addText}>{t('workout.addSet')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={addWarmup}
            style={({ pressed }) => [styles.add, pressed && styles.pressed]}
          >
            <Plus size={18} color={theme.colors.text} strokeWidth={1.8} />
            <Text style={styles.addText}>{t('routines.edit.addWarmup')}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  wrap: { gap: 8, paddingTop: 4 },
  cols: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  col: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  colSet: { width: 30 },
  colGrow: { flex: 1 },
  colRemove: { width: 28 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface2,
  },
  labelWarm: { backgroundColor: theme.colors.warmSoft },
  labelText: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    color: theme.colors.text2,
  },
  labelTextWarm: { color: theme.colors.warm },
  remove: { width: 28, height: 42, alignItems: 'center', justifyContent: 'center' },
  hidden: { opacity: 0 },
  pressed: { opacity: 0.6 },
  adds: { flexDirection: 'row', gap: 8 },
  add: {
    flex: 1,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addText: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
}));
