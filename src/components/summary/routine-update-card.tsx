import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { db } from '@/db/client';
import { applyRoutineUpdate } from '@/db/routine-update';
import { useExerciseCatalog } from '@/db/use-exercise-catalog';
import { useAppLanguage } from '@/i18n/use-app-language';
import { useRoutineUpdate } from '@/stores/routine-update';

type Props = { workoutId: string };

/**
 * 운동을 막 끝낸 기록 화면 맨 아래: 루틴과 다르게 한 점(세트별로 정한 종목의 무게·횟수,
 * 추가한 종목, 뺀 종목)을 보여 주고 '루틴 바꾸기'를 누르면 루틴에 반영한다.
 * 다른 점이 없거나 예전 기록을 다시 열었을 때는 아무것도 그리지 않는다.
 */
export function RoutineUpdateCard({ workoutId }: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const lang = useAppLanguage();
  const catalog = useExerciseCatalog(lang);
  const pending = useRoutineUpdate((s) => s.pending);
  const applied = useRoutineUpdate((s) => s.appliedWorkoutId) === workoutId;
  const markApplied = useRoutineUpdate((s) => s.markApplied);

  if (!pending || pending.workoutId !== workoutId) return null;

  if (applied) {
    return (
      <View style={[styles.card, styles.done]} accessibilityLiveRegion="polite">
        <Check size={18} color={theme.colors.text} strokeWidth={2.4} />
        <Text style={styles.doneText}>
          {t('summary.routineUpdate.done', { name: pending.routineName })}
        </Text>
      </View>
    );
  }

  const apply = () => {
    applyRoutineUpdate(db, pending);
    markApplied(workoutId);
  };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {t('summary.routineUpdate.title')}
        </Text>
        <Text style={styles.body}>
          {t('summary.routineUpdate.body', { name: pending.routineName })}
        </Text>
      </View>
      <View style={styles.rows}>
        {pending.changes.map((c, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: 같은 종목이 두 번 나올 수 있고 목록은 바뀌지 않는다.
          <Text key={i} style={styles.row}>
            <Text style={styles.name}>{catalog.byId.get(c.exerciseId)?.name ?? ''}</Text>
            {'  '}
            {t(`summary.routineUpdate.${c.type}`)}
          </Text>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={apply}
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      >
        <Text style={styles.buttonText}>{t('summary.routineUpdate.button')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    gap: 14,
    padding: 18,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  done: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doneText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  head: { gap: 4 },
  title: {
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  body: {
    fontSize: 13,
    lineHeight: 19.5,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  rows: { gap: 2 },
  row: {
    fontSize: 13,
    lineHeight: 19.5,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  name: { fontFamily: theme.fonts.semibold, color: theme.colors.text },
  button: {
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface2,
  },
  pressed: { opacity: 0.7 },
  buttonText: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
}));
