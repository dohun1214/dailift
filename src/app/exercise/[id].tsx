import { and, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { router, useLocalSearchParams } from 'expo-router';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import type { ExtendedBodyPart, Slug } from 'react-native-body-highlighter';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { ExerciseProgress } from '@/components/exercise/exercise-progress';
import {
  AppText,
  BodyFigure,
  BottomSheet,
  Button,
  ConfirmDialog,
  IconButton,
  Screen,
  TextField,
  TopBar,
} from '@/components/ui';
import { LEVEL_OPACITY, WorkoutMenuSheet } from '@/components/workout';
import { guideFor } from '@/data/exercise-guides';
import { MUSCLES } from '@/data/muscles';
import { db } from '@/db/client';
import { deleteCustomExercise, renameCustomExercise } from '@/db/routine-editor';
import * as schema from '@/db/schema';
import { useExerciseCatalog } from '@/db/use-exercise-catalog';
import { useAppLanguage } from '@/i18n/use-app-language';
import { object as objectJosa } from '@/lib/josa';
import { useProfile } from '@/stores/profile';
import { withAlpha } from '@/theme/color';

/** 뒤에서 더 잘 보이는 근육 — 주동근이 여기 많으면 미니 근육맵을 뒷모습으로 */
const BACK_MUSCLES = new Set([
  'lats',
  'traps',
  'lower_back',
  'glutes',
  'hamstrings',
  'calves',
  'triceps',
]);

/** 종목 상세: 주동·협응근(미니 근육맵), 기구, 내 기록(추이 그래프·최근 기록), 동작 5단계 */
export default function ExerciseDetailScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const lang = useAppLanguage();
  const bodyType = useProfile((s) => s.bodyType);
  const { id } = useLocalSearchParams<{ id: string }>();
  const exerciseId = id ?? '';
  const catalog = useExerciseCatalog(lang);
  const info = catalog.byId.get(exerciseId);
  // 직접 만든 종목만: 오른쪽 위 메뉴(이름 변경 · 삭제)
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [nameError, setNameError] = useState<'empty' | 'duplicate' | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: muscleRows } = useLiveQuery(
    db
      .select({ muscleId: schema.exerciseMuscles.muscleId, role: schema.exerciseMuscles.role })
      .from(schema.exerciseMuscles)
      .where(
        and(
          eq(schema.exerciseMuscles.exerciseId, exerciseId),
          isNull(schema.exerciseMuscles.deletedAt),
        ),
      ),
    [exerciseId],
  );
  if (!info) {
    return (
      <Screen header={<TopBar />}>
        <AppText tone="secondary">{t('exerciseDetail.notFound')}</AppText>
      </Screen>
    );
  }

  const primary = muscleRows.filter((m) => m.role === 'primary').map((m) => m.muscleId);
  const secondary = muscleRows.filter((m) => m.role === 'secondary').map((m) => m.muscleId);
  const muscleName = (mid: string) => {
    const m = MUSCLES.find((x) => x.id === mid);
    return m ? m[lang] : mid;
  };
  const backCount = primary.filter((m) => BACK_MUSCLES.has(m)).length;
  const side = backCount > primary.length - backCount ? 'back' : 'front';
  const data: ExtendedBodyPart[] = [];
  for (const [list, level] of [
    [secondary, 2],
    [primary, 3],
  ] as const) {
    for (const mid of list) {
      const m = MUSCLES.find((x) => x.id === mid);
      for (const slug of (m?.bodySlugs ?? []) as readonly Slug[]) {
        const i = data.findIndex((d) => d.slug === slug);
        const part = {
          slug,
          styles: { fill: withAlpha(theme.colors.accent, LEVEL_OPACITY[level]) },
        };
        if (i >= 0) data[i] = part;
        else data.push(part);
      }
    }
  }
  const editable = info.isCustom && !info.deleted;
  const saveName = () => {
    const result = renameCustomExercise(db, exerciseId, draftName);
    if (result === 'ok') setRenaming(false);
    else setNameError(result);
  };

  const guide = guideFor(exerciseId);
  const steps = guide ? guide[lang] : [];

  return (
    <Screen
      header={
        <TopBar
          title={info.name}
          trailing={
            editable ? (
              <IconButton
                icon={MoreHorizontal}
                label={t('exerciseDetail.menuA11y')}
                onPress={() => setMenuOpen(true)}
              />
            ) : undefined
          }
        />
      }
    >
      <View style={[styles.card, styles.first]}>
        <View style={styles.muscleRow}>
          <View
            accessible
            accessibilityRole="image"
            accessibilityLabel={t('exerciseDetail.musclesA11y', {
              primary: primary.map(muscleName).join(', ') || t('exerciseDetail.none'),
              secondary: secondary.map(muscleName).join(', ') || t('exerciseDetail.none'),
            })}
          >
            <BodyFigure gender={bodyType} side={side} width={64} data={data} />
          </View>
          <View style={styles.tagsCol}>
            <TagGroup label={t('exerciseDetail.primary')} tags={primary.map(muscleName)} strong />
            {secondary.length > 0 ? (
              <TagGroup label={t('exerciseDetail.secondary')} tags={secondary.map(muscleName)} />
            ) : null}
            <TagGroup
              label={t('exerciseDetail.equipment')}
              tags={[t(`exercises.equipment.${info.equipment}`)]}
            />
          </View>
        </View>
      </View>

      <ExerciseProgress exerciseId={exerciseId} name={info.name} type={info.type} />

      <View style={[styles.card, styles.stepsCard]}>
        <Text style={styles.h2} accessibilityRole="header">
          {t('exerciseDetail.steps')}
        </Text>
        {steps.length > 0 ? (
          <View style={styles.steps}>
            {steps.map((text, i) => (
              <View
                key={text}
                style={styles.step}
                accessible
                accessibilityLabel={t('exerciseDetail.stepA11y', { n: i + 1, text })}
              >
                <View style={styles.stepNo}>
                  <Text style={styles.stepNoText}>{i + 1}</Text>
                </View>
                <Text style={styles.stepText}>{text}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.muted}>{t('exerciseDetail.custom')}</Text>
        )}
      </View>
      <WorkoutMenuSheet
        visible={menuOpen}
        title={info.name}
        cancelLabel={t('exerciseDetail.cancel')}
        onClose={() => setMenuOpen(false)}
        items={[
          {
            label: t('exerciseDetail.rename'),
            icon: Pencil,
            onPress: () => {
              setDraftName(info.name);
              setNameError(null);
              setRenaming(true);
            },
          },
          {
            label: t('exerciseDetail.delete'),
            icon: Trash2,
            destructive: true,
            onPress: () => setDeleting(true),
          },
        ]}
      />
      <BottomSheet
        visible={renaming}
        title={t('exerciseDetail.rename')}
        closeLabel={t('exerciseDetail.cancel')}
        onClose={() => setRenaming(false)}
        avoidKeyboard
      >
        <View style={styles.renameField}>
          <TextField
            label={t('exercises.new.name')}
            value={draftName}
            maxLength={40}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={saveName}
            error={
              nameError === 'empty'
                ? t('exercises.new.nameRequired')
                : nameError === 'duplicate'
                  ? t('exercises.new.nameTaken')
                  : undefined
            }
            onChangeText={(v) => {
              setNameError(null);
              setDraftName(v);
            }}
          />
        </View>
        <AppText variant="caption" tone="secondary">
          {t('exerciseDetail.renameHint')}
        </AppText>
        <Button label={t('common.save')} onPress={saveName} />
      </BottomSheet>
      <ConfirmDialog
        visible={deleting}
        title={t('exerciseDetail.deleteTitle', {
          name: lang === 'ko' ? objectJosa(info.name) : info.name,
        })}
        body={t('exerciseDetail.deleteBody')}
        cancelLabel={t('exerciseDetail.cancel')}
        confirmLabel={t('exerciseDetail.deleteConfirm')}
        destructive
        onCancel={() => setDeleting(false)}
        onConfirm={() => {
          setDeleting(false);
          deleteCustomExercise(db, exerciseId);
          router.back();
        }}
      />
    </Screen>
  );
}

function TagGroup({
  label,
  tags,
  strong = false,
}: {
  label: string;
  tags: string[];
  strong?: boolean;
}) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.tags}>
        {tags.map((tag) => (
          <View key={tag} style={[styles.tag, strong && styles.tagStrong]}>
            <Text style={[styles.tagText, strong && styles.tagTextStrong]}>{tag}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  // 창 바탕과 입력칸이 같은 색이라 카드 위에 올린다(종목 만들기와 같은 모양).
  renameField: {
    flexDirection: 'row',
    padding: 14,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  first: { marginTop: 8 },
  card: {
    gap: 12,
    padding: 18,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  muscleRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  tagsCol: { flex: 1, gap: 10 },
  group: { gap: 6 },
  groupLabel: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.surface2,
  },
  tagStrong: { backgroundColor: theme.colors.accent },
  tagText: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  tagTextStrong: { color: theme.colors.onAccent },
  stepsCard: { gap: 14 },
  h2: {
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  steps: { gap: 12 },
  step: { flexDirection: 'row', gap: 12 },
  stepNo: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface2,
  },
  stepNoText: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    color: theme.colors.text,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 22.4,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text,
  },
  muted: {
    fontSize: 13,
    lineHeight: 19.5,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
