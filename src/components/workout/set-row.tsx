import { Check, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { ExerciseType, SetKind } from '@/db/schema';

import { SetField } from './set-field';

export type SetRowValue = {
  weight: number | null;
  reps: number | null;
  durationSec: number | null;
};

type Props = {
  label: string;
  kind: SetKind;
  type: ExerciseType;
  value: SetRowValue;
  unit: string;
  completed: boolean;
  pr: boolean;
  onChange: (patch: Partial<SetRowValue>) => void;
  onToggle: () => void;
  onDelete: () => void;
};

/** 세트 한 줄: 번호(워밍업은 주황 W) · 무게 · 횟수(또는 시간) · 완료 체크. 왼쪽으로 밀면 삭제 */
export function SetRow({
  label,
  kind,
  type,
  value,
  unit,
  completed,
  pr,
  onChange,
  onToggle,
  onDelete,
}: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const warm = kind === 'warmup';
  const setName = warm ? t('workout.warmupA11y', { label }) : t('workout.setA11y', { label });
  const muted = !completed;

  return (
    <ReanimatedSwipeable
      friction={1.5}
      rightThreshold={48}
      overshootRight={false}
      // PR 배지(칸 위로 7px)가 잘리지 않게 행 위에 7px 여백을 두고 같은 만큼 끌어올린다.
      containerStyle={styles.pullUp}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('workout.removeSet')}
          onPress={onDelete}
          style={styles.delete}
        >
          <Trash2 size={18} color={theme.colors.onPr} strokeWidth={1.8} />
        </Pressable>
      )}
    >
      <View
        style={styles.row}
        accessible={false}
        accessibilityActions={[{ name: 'delete', label: t('workout.removeSet') }]}
        onAccessibilityAction={(e) => e.nativeEvent.actionName === 'delete' && onDelete()}
      >
        <View style={[styles.label, warm && styles.labelWarm]}>
          <Text style={[styles.labelText, warm && styles.labelTextWarm]}>{label}</Text>
        </View>
        {type === 'time' ? (
          <SetField
            label={t('workout.timeA11y', { set: setName })}
            value={value.durationSec}
            unit={t('workout.unitSec')}
            muted={muted}
            onChange={(durationSec) => onChange({ durationSec })}
            badge={pr ? t('workout.pr') : undefined}
            badgeLabel={t('workout.prA11y')}
          />
        ) : (
          <>
            <SetField
              label={t('workout.weightA11y', { set: setName })}
              value={value.weight}
              unit={type === 'bodyweight_reps' ? `+${unit}` : unit}
              decimal
              muted={muted}
              onChange={(weight) => onChange({ weight })}
            />
            <SetField
              label={t('workout.repsA11y', { set: setName })}
              value={value.reps}
              unit={t('workout.unitReps')}
              muted={muted}
              onChange={(reps) => onChange({ reps })}
              badge={pr ? t('workout.pr') : undefined}
              badgeLabel={t('workout.prA11y')}
            />
          </>
        )}
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: completed }}
          accessibilityLabel={completed ? t('workout.completed') : t('workout.completeSet')}
          accessibilityHint={setName}
          onPress={onToggle}
          style={styles.check}
        >
          {completed ? (
            <View style={styles.circleOn}>
              <Check size={16} color={theme.colors.onAccent} strokeWidth={2.6} />
            </View>
          ) : (
            <View style={styles.circleOff} />
          )}
        </Pressable>
      </View>
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create((theme) => ({
  pullUp: { marginTop: -7 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 7,
    backgroundColor: theme.colors.surface,
  },
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
  check: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  circleOff: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    borderColor: theme.colors.text2,
  },
  circleOn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.accent,
  },
  delete: {
    width: 64,
    marginTop: 7,
    marginLeft: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.danger,
  },
}));
