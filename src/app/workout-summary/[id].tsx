import { and, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, Text, TextInput, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { ActionSheet, AppText, Badge, Button, Screen, TopBar } from '@/components/ui';
import { MuscleMapCard } from '@/components/workout';
import { db } from '@/db/client';
import * as schema from '@/db/schema';
import { addWorkoutPhoto, deleteWorkoutPhoto, loadSummary, setWorkoutNote } from '@/db/summary';
import { useExerciseCatalog } from '@/db/use-exercise-catalog';
import { splitDuration } from '@/domain/rest-timer';
import {
  groupSetsByWeight,
  muscleCredits,
  muscleLevels,
  sessionPrs,
  sessionStats,
} from '@/domain/session-summary';
import { useAppLanguage } from '@/i18n/use-app-language';
import { type PhotoSource, photoUri, pickPhoto, removePhotoFile } from '@/lib/photos';
import { useProfile } from '@/stores/profile';
import { useSettings } from '@/stores/settings';

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** 세션 요약: 시간·세트·볼륨, 근육맵, PR, 한 운동(접는 카드), 메모, 사진. 운동 완료 직후와 히스토리에서 같이 쓴다. */
export default function WorkoutSummaryScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const lang = useAppLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const unit = useSettings((s) => s.weightUnit);
  const bodyType = useProfile((s) => s.bodyType);
  const exercisesOpen = useSettings((s) => s.summaryExercisesOpen);
  const setExercisesOpen = useSettings((s) => s.setSummaryExercisesOpen);
  const catalog = useExerciseCatalog(lang);
  const data = useMemo(() => loadSummary(db, id ?? ''), [id]);
  const [note, setNote] = useState(data?.workout.note ?? '');
  const [photoSheet, setPhotoSheet] = useState(false);
  const noteRef = useRef(note);
  noteRef.current = note;

  const { data: photos } = useLiveQuery(
    db
      .select()
      .from(schema.workoutPhotos)
      .where(
        and(eq(schema.workoutPhotos.workoutId, id ?? ''), isNull(schema.workoutPhotos.deletedAt)),
      ),
    [id],
  );

  // 메모는 입력을 멈추면 저장하고, 화면을 떠날 때도 저장한다.
  useEffect(() => {
    if (!data) return;
    const handle = setTimeout(() => setWorkoutNote(db, data.workout.id, note), 500);
    return () => clearTimeout(handle);
  }, [note, data]);
  useEffect(
    () => () => {
      if (data) setWorkoutNote(db, data.workout.id, noteRef.current);
    },
    [data],
  );

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!data) {
    return (
      <Screen header={<TopBar leading="close" onLeadingPress={close} />}>
        <AppText tone="secondary">{t('summary.notFound')}</AppText>
      </Screen>
    );
  }
  const summary = data;

  const stats = sessionStats(
    summary.sets,
    summary.workout.startedAt,
    summary.workout.endedAt,
    unit,
  );
  const levels = muscleLevels(muscleCredits(summary.sets, summary.musclesOf));
  const prs = sessionPrs(summary.sets, summary.bests, unit);
  const date = new Intl.DateTimeFormat(lang === 'ko' ? 'ko-KR' : 'en-US', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date(summary.workout.startedAt));

  const addPhoto = async (source: PhotoSource) => {
    const path = await pickPhoto(source);
    if (path) addWorkoutPhoto(db, summary.workout.id, path);
  };
  const confirmDeletePhoto = (photoId: string, path: string) =>
    Alert.alert(t('summary.photoDeleteTitle'), undefined, [
      { text: t('summary.photoCancel'), style: 'cancel' },
      {
        text: t('summary.photoDelete'),
        style: 'destructive',
        onPress: () => {
          deleteWorkoutPhoto(db, photoId);
          removePhotoFile(path);
        },
      },
    ]);

  const formatDuration = (sec: number) => {
    const { m, s: rest } = splitDuration(sec);
    if (m > 0 && rest > 0) return t('duration.minSec', { m, s: rest });
    return m > 0 ? t('duration.min', { m }) : t('duration.sec', { s: rest });
  };
  // 한 운동: 본 세트가 있는 종목만, 종목마다 세트 수와 한 줄 기록
  const exerciseRows = summary.exercises.flatMap((ex) => {
    const info = catalog.byId.get(ex.exerciseId);
    const working = ex.sets.filter((x) => x.kind !== 'warmup');
    if (working.length === 0) return [];
    let line: string;
    if (info?.type === 'time') {
      line = working.map((x) => formatDuration(x.durationSec ?? 0)).join(' · ');
    } else {
      const groups = groupSetsByWeight(working);
      const text = groups
        .map((g) =>
          g.weight === null
            ? g.reps.join(' · ')
            : `${info?.type === 'bodyweight_reps' ? '+' : ''}${fmt(g.weight)}${g.unit} × ${g.reps.join(' · ')}`,
        )
        .join(' · ');
      line = groups.every((g) => g.weight === null) ? t('summary.repsOnly', { reps: text }) : text;
    }
    return [
      {
        id: ex.id,
        name: info?.name ?? '',
        sets: t('summary.setCount', { count: working.length }),
        line,
      },
    ];
  });
  const exerciseCount = t('summary.exerciseCount', { count: exerciseRows.length });

  const statItems: [string, string, string][] = [
    [t('summary.time'), String(stats.minutes), t('summary.minutes')],
    [t('summary.sets'), String(stats.sets), ''],
    [t('summary.volume'), stats.volume.toLocaleString(lang === 'ko' ? 'ko-KR' : 'en-US'), unit],
  ];

  return (
    <Screen footer={<Button label={t('summary.done')} onPress={close} />}>
      <View style={styles.head}>
        <Text style={styles.date}>
          {t('summary.dateLine', { date, name: summary.workout.name })}
        </Text>
        <Text style={styles.headline} accessibilityRole="header">
          {t('summary.headline')}
        </Text>
      </View>

      <View style={styles.stats}>
        {statItems.map(([label, value, suffix]) => (
          <View
            key={label}
            style={styles.stat}
            accessible
            accessibilityLabel={`${label} ${value}${suffix}`}
          >
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={styles.statValue}>
              {value}
              {suffix ? <Text style={styles.statUnit}>{` ${suffix}`}</Text> : null}
            </Text>
          </View>
        ))}
      </View>

      <MuscleMapCard levels={levels} gender={bodyType} title={t('summary.muscles')} />

      {prs.length > 0 ? (
        <View style={styles.listCard}>
          {prs.map((p, i) => {
            const name = catalog.byId.get(p.exerciseId)?.name ?? '';
            const value =
              p.kind === 'weight'
                ? t('summary.prWeight', { weight: `${fmt(p.weight)}${p.unit}`, reps: p.reps })
                : t('summary.prE1rm', { weight: `${p.e1rm.toFixed(1)}${p.unit}` });
            return (
              <View
                key={p.exerciseId}
                style={[styles.prRow, i < prs.length - 1 && styles.line]}
                accessible
                accessibilityLabel={t('summary.prA11y', { name, value })}
              >
                <View>
                  <Badge label="PR" kind="pr" />
                </View>
                <Text style={styles.prName} numberOfLines={1}>
                  {name}
                </Text>
                <Text style={styles.prValue}>{value}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      {exerciseRows.length > 0 ? (
        <View style={styles.exCard}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: exercisesOpen }}
            accessibilityLabel={t('summary.exercisesA11y', { count: exerciseCount })}
            onPress={() => setExercisesOpen(!exercisesOpen)}
            style={({ pressed }) => [styles.exHead, pressed && styles.pressed]}
          >
            <Text style={styles.exTitle}>{t('summary.exercises')}</Text>
            <Text style={styles.exCount}>{exerciseCount}</Text>
            {exercisesOpen ? (
              <ChevronUp size={20} color={theme.colors.text2} strokeWidth={1.8} />
            ) : (
              <ChevronDown size={20} color={theme.colors.text2} strokeWidth={1.8} />
            )}
          </Pressable>
          {exercisesOpen
            ? exerciseRows.map((row, i) => (
                <View
                  key={row.id}
                  style={[styles.exRow, i < exerciseRows.length - 1 && styles.line]}
                  accessible
                  accessibilityLabel={t('summary.exerciseA11y', {
                    name: row.name,
                    sets: row.sets,
                    line: row.line,
                  })}
                >
                  <View style={styles.exTop}>
                    <Text style={styles.exName} numberOfLines={1}>
                      {row.name}
                    </Text>
                    <Text style={styles.exSets}>{row.sets}</Text>
                  </View>
                  <Text style={styles.exLine}>{row.line}</Text>
                </View>
              ))
            : null}
        </View>
      ) : null}

      <View style={styles.memoCard}>
        <Text style={styles.memoLabel} nativeID="memo-label">
          {t('summary.memo')}
        </Text>
        <TextInput
          accessibilityLabel={t('summary.memo')}
          accessibilityLabelledBy="memo-label"
          value={note}
          onChangeText={setNote}
          placeholder={t('summary.memoPlaceholder')}
          placeholderTextColor={theme.colors.text2}
          selectionColor={theme.colors.accentText}
          multiline
          maxLength={1000}
          style={styles.memo}
        />
      </View>

      {photos.length > 0 ? (
        <View style={styles.photos}>
          {photos.map((p, i) => (
            <Pressable
              key={p.id}
              accessibilityRole="image"
              accessibilityLabel={t('summary.photoA11y', { index: i + 1 })}
              accessibilityHint={t('summary.photoDeleteHint')}
              onLongPress={() => confirmDeletePhoto(p.id, p.path)}
            >
              <Image source={{ uri: photoUri(p.path) }} style={styles.photo} contentFit="cover" />
            </Pressable>
          ))}
        </View>
      ) : null}

      <Button
        label={t('summary.addPhoto')}
        variant="secondary"
        size="md"
        icon={Camera}
        onPress={() => setPhotoSheet(true)}
      />

      <ActionSheet
        visible={photoSheet}
        cancelLabel={t('summary.photoCancel')}
        onClose={() => setPhotoSheet(false)}
        actions={[
          { label: t('summary.photoCamera'), onPress: () => void addPhoto('camera') },
          { label: t('summary.photoLibrary'), onPress: () => void addPhoto('library') },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  head: { gap: 4, marginTop: 16, paddingHorizontal: 4, paddingBottom: 8 },
  date: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  headline: {
    fontSize: 28,
    lineHeight: 36,
    letterSpacing: -0.28,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  stats: { flexDirection: 'row', gap: 8 },
  stat: {
    flex: 1,
    gap: 6,
    padding: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  statValue: {
    fontSize: 20,
    lineHeight: 26,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  statUnit: {
    fontSize: 12,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  listCard: {
    paddingVertical: 2,
    paddingHorizontal: 18,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52 },
  line: { borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  prName: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  prValue: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  exCard: {
    paddingTop: 6,
    paddingHorizontal: 18,
    paddingBottom: 6,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  exHead: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pressed: { opacity: 0.7 },
  exTitle: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  exCount: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  exRow: { gap: 3, paddingVertical: 12 },
  exTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  exName: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  exSets: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  exLine: {
    fontSize: 13,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.numRegular,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  memoCard: {
    gap: 6,
    padding: 18,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  memoLabel: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  memo: {
    minHeight: 45,
    padding: 0,
    textAlignVertical: 'top',
    fontSize: 15,
    lineHeight: 22.5,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text,
  },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  photo: {
    width: 76,
    height: 76,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
  },
}));
