import { and, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Camera } from 'lucide-react-native';
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
import { muscleCredits, muscleLevels, sessionPrs, sessionStats } from '@/domain/session-summary';
import { useAppLanguage } from '@/i18n/use-app-language';
import { type PhotoSource, photoUri, pickPhoto, removePhotoFile } from '@/lib/photos';
import { useProfile } from '@/stores/profile';
import { useSettings } from '@/stores/settings';

const fmt = (n: number) => String(Math.round(n * 100) / 100);

/** 세션 요약: 시간·세트·볼륨, 근육맵, PR, 메모, 사진. 운동 완료 직후와 히스토리에서 같이 쓴다. */
export default function WorkoutSummaryScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const lang = useAppLanguage();
  const { id } = useLocalSearchParams<{ id: string }>();
  const unit = useSettings((s) => s.weightUnit);
  const bodyType = useProfile((s) => s.bodyType);
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
