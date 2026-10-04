import { router } from 'expo-router';
import { Timer } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { Badge, Button } from '@/components/ui';
import { useExerciseCatalog } from '@/db/use-exercise-catalog';
import { useWorkoutExercises } from '@/db/use-workout';
import { formatClock, remainingSec } from '@/domain/rest-timer';
import { workoutProgress } from '@/domain/workout-session';
import { useAppLanguage } from '@/i18n/use-app-language';
import { useNow } from '@/lib/use-now';
import { useRestTimer } from '@/stores/rest-timer';

type Props = { workout: { id: string; name: string; startedAt: number } };

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/**
 * 홈의 운동 중 카드: 지금 종목 · 몇 세트째 · 전체 진행 · 다음 종목.
 * 쉬는 동안에는 남은 휴식 시간과 다음에 할 세트를 보여 준다.
 */
export function LiveWorkoutCard({ workout }: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const lang = useAppLanguage();
  const catalog = useExerciseCatalog(lang);
  const exercises = useWorkoutExercises(workout.id);
  const now = useNow(1000);
  const restEnds = useRestTimer((s) => s.endsAt);
  const progress = useMemo(() => workoutProgress(exercises), [exercises]);

  const restLeft = restEnds !== null ? remainingSec(restEnds, now) : 0;
  const resting = restLeft > 0;
  const elapsed = formatClock((now - workout.startedAt) / 1000);
  const nameOf = (exerciseId: string) => catalog.byId.get(exerciseId)?.name ?? '';

  const { current, next, done, total } = progress;
  let line = '';
  if (current) {
    const { set, number } = current;
    const which =
      number !== null
        ? t(resting ? 'home.live.setNext' : 'home.live.setNow', { set: number })
        : set.kind === 'warmup'
          ? t(resting ? 'home.live.warmupNext' : 'home.live.warmupNow')
          : t(resting ? 'home.live.otherNext' : 'home.live.otherNow');
    const parts: string[] = [];
    if (set.weight) parts.push(`${fmt(set.weight)}${set.weightUnit}`);
    if (set.reps) parts.push(t('home.live.reps', { count: set.reps }));
    if (set.durationSec) parts.push(formatClock(set.durationSec));
    line = parts.length ? `${which} · ${parts.join(' × ')}` : which;
  } else if (total > 0) {
    line = t('home.live.allDone');
  }

  return (
    <View style={styles.card}>
      <View style={styles.meta}>
        <View>
          <Badge label={t('workout.miniBar')} kind="solid" />
        </View>
        <Text style={styles.metaText} numberOfLines={1}>
          {current ? `${workout.name} · ${elapsed}` : elapsed}
        </Text>
      </View>

      <View style={styles.body}>
        {resting ? (
          <View style={styles.rest} accessible>
            <Timer size={15} color={theme.colors.text2} strokeWidth={1.8} />
            <Text style={styles.restText}>
              {t('home.live.rest', { time: formatClock(restLeft) })}
            </Text>
          </View>
        ) : null}
        <Text style={styles.title} numberOfLines={2}>
          {current ? nameOf(current.exercise.exerciseId) : workout.name}
        </Text>
        {line ? <Text style={styles.line}>{line}</Text> : null}
      </View>

      {total > 0 ? (
        <View style={styles.progress}>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${(done / total) * 100}%` }]} />
          </View>
          <View style={styles.progressRow}>
            <Text
              style={styles.count}
              accessibilityLabel={t('home.live.progressA11y', { done, total })}
            >
              {t('home.live.progress', { done, total })}
            </Text>
            {next ? (
              <Text style={styles.next} numberOfLines={1}>
                {t('home.live.nextExercise', { name: nameOf(next.exerciseId) })}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <Button label={t('home.resume')} onPress={() => router.push('/workout')} />
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  card: {
    gap: 16,
    padding: 20,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaText: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  body: { gap: 6 },
  rest: {
    alignSelf: 'flex-start',
    height: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 8,
    paddingRight: 10,
    borderRadius: 15,
    backgroundColor: theme.colors.surface2,
  },
  restText: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  title: {
    fontSize: 24,
    lineHeight: 31,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  line: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  progress: { gap: 8 },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: theme.colors.track,
  },
  fill: { height: 6, borderRadius: 3, backgroundColor: theme.colors.accent },
  progressRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  count: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.numSemibold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  next: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
