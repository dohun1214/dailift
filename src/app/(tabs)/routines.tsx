import { router } from 'expo-router';
import { Copy, Play, Plus, Repeat, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { RoutineCard, SectionLabel, TemplateRow } from '@/components/routines';
import { ConfirmDialog, IconButton, NoticeDialog, Screen } from '@/components/ui';
import { WorkoutMenuSheet } from '@/components/workout';
import { ROUTINE_TEMPLATES } from '@/data/templates';
import { db } from '@/db/client';
import { deleteRoutine } from '@/db/routine-editor';
import { canAddRoutines, duplicateRoutine } from '@/db/routines';
import { useRoutineSections } from '@/db/use-routine-sections';
import { getActiveWorkout, startWorkout } from '@/db/workout';
import { recommendTemplate } from '@/domain/profile';
import type { RoutineSummary } from '@/domain/routine';
import { LIMITS } from '@/domain/routine-draft';
import { useAppLanguage } from '@/i18n/use-app-language';
import { openWorkout } from '@/lib/open-workout';
import { useToday } from '@/lib/use-today';
import { isScheduledOn } from '@/lib/weekdays';
import { useProfile } from '@/stores/profile';
import { useSettings, workoutDefaults } from '@/stores/settings';

export default function RoutinesScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const lang = useAppLanguage();
  const sections = useRoutineSections();
  const experience = useProfile((s) => s.experience);
  const daysPerWeek = useProfile((s) => s.daysPerWeek);
  const recommended = recommendTemplate({ experience, daysPerWeek });
  const today = useToday();

  const meta = (r: RoutineSummary) =>
    r.exerciseCount === 0
      ? t('routines.metaEmpty')
      : t('routines.meta', { count: r.exerciseCount, minutes: r.minutes });

  // 꾹 누른 루틴(메뉴)과 삭제를 확인 중인 루틴
  const [menuFor, setMenuFor] = useState<RoutineSummary | null>(null);
  const [deleteFor, setDeleteFor] = useState<RoutineSummary | null>(null);

  // 루틴이 다 찼을 때 알림
  const [full, setFull] = useState(false);

  // 다른 운동이 진행 중일 때 시작을 누르면 그 운동의 이름을 담아 알린다.
  const [busyWith, setBusyWith] = useState<string | null>(null);

  const start = (r: RoutineSummary) => {
    const active = getActiveWorkout(db);
    if (active && active.routineId !== r.id) {
      setBusyWith(active.name);
      return;
    }
    if (!active) {
      startWorkout(db, {
        routineId: r.id,
        name: r.name,
        weightUnit: useSettings.getState().weightUnit,
        barWeight: workoutDefaults().barWeight,
      });
    }
    openWorkout();
  };

  return (
    <Screen inTabs>
      <View style={styles.titleRow}>
        <Text style={styles.title} accessibilityRole="header">
          {t('routines.title')}
        </Text>
        <IconButton
          icon={Plus}
          label={t('routines.create')}
          onPress={() => {
            if (!canAddRoutines(db)) return setFull(true);
            router.push({ pathname: '/routine/[id]', params: { id: 'new' } });
          }}
        />
      </View>

      {sections.length === 0 ? <Text style={styles.empty}>{t('routines.empty')}</Text> : null}

      {sections.map((section) => (
        <View key={section.group?.id ?? 'standalone'} style={styles.section}>
          {section.group ? (
            <SectionLabel
              label={section.group.name}
              trailing={
                <View style={styles.mode}>
                  <Repeat size={14} color={theme.colors.text2} strokeWidth={1.8} />
                  <Text style={styles.modeText}>
                    {section.group.rotationMode ? t('routines.rotation') : t('routines.fixedDays')}
                  </Text>
                </View>
              }
            />
          ) : (
            <SectionLabel label={t('routines.standalone')} top={sections.length > 1 ? 8 : 0} />
          )}
          {section.routines.map((r) => (
            <RoutineCard
              key={r.id}
              name={r.name}
              weekdays={r.weekdays}
              meta={meta(r)}
              today={isScheduledOn(r.weekdays, today)}
              onPress={() => router.push({ pathname: '/routine/[id]', params: { id: r.id } })}
              onLongPress={() => setMenuFor(r)}
              onDelete={() => setDeleteFor(r)}
            />
          ))}
        </View>
      ))}

      <View style={styles.section}>
        <SectionLabel label={t('routines.recommended')} top={12} />
        {ROUTINE_TEMPLATES.map((tpl) => (
          <TemplateRow
            key={tpl.key}
            code={tpl.code}
            name={lang === 'ko' ? tpl.ko : tpl.en}
            subtitle={`${t(`routines.template.${tpl.key}.freq`)} · ${t(`routines.template.${tpl.key}.level`)}`}
            badge={tpl.key === recommended ? t('routines.recommendedBadge') : undefined}
            onPress={() =>
              router.push({ pathname: '/routine-template/[key]', params: { key: tpl.key } })
            }
          />
        ))}
      </View>

      <WorkoutMenuSheet
        visible={menuFor !== null}
        title={menuFor?.name ?? ''}
        cancelLabel={t('routines.cancel')}
        onClose={() => setMenuFor(null)}
        items={[
          {
            label: t('routines.start'),
            icon: Play,
            onPress: () => {
              if (menuFor) start(menuFor);
            },
          },
          {
            label: t('routines.duplicate'),
            icon: Copy,
            onPress: () => {
              if (!menuFor) return;
              if (!canAddRoutines(db)) return setFull(true);
              duplicateRoutine(db, menuFor.id, t('routines.copyName', { name: menuFor.name }));
            },
          },
          {
            label: t('routines.delete'),
            icon: Trash2,
            onPress: () => setDeleteFor(menuFor),
            destructive: true,
          },
        ]}
      />
      <NoticeDialog
        visible={full}
        title={t('routines.limitTitle', { max: LIMITS.routines })}
        body={t('routines.limitBody')}
        okLabel={t('common.ok')}
        onClose={() => setFull(false)}
      />
      <ConfirmDialog
        visible={busyWith !== null}
        title={t('workout.recoverTitle')}
        body={t('workout.busyBody', { name: busyWith ?? '' })}
        cancelLabel={t('common.close')}
        confirmLabel={t('workout.resume')}
        onCancel={() => setBusyWith(null)}
        onConfirm={() => {
          setBusyWith(null);
          openWorkout();
        }}
      />
      <ConfirmDialog
        visible={deleteFor !== null}
        title={t('routines.deleteTitle', { name: deleteFor?.name ?? '' })}
        body={t('routines.deleteBody')}
        cancelLabel={t('routines.cancel')}
        confirmLabel={t('routines.delete')}
        destructive
        onCancel={() => setDeleteFor(null)}
        onConfirm={() => {
          if (deleteFor) deleteRoutine(db, deleteFor.id);
          setDeleteFor(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingBottom: 4 },
  title: {
    flex: 1,
    fontSize: 26,
    lineHeight: 34,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  section: { gap: 12 },
  mode: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modeText: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  empty: {
    paddingHorizontal: 6,
    fontSize: 14,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
