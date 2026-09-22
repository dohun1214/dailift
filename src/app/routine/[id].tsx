import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { Plus } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, KeyboardAvoidingView, Platform, Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { ExerciseEditList, NumberField, RangeField } from '@/components/routines';
import { AppText, Card, Screen, TextButton, TextField, TopBar } from '@/components/ui';
import { db } from '@/db/client';
import {
  defaultRestFor,
  deleteRoutine,
  emptyRoutineDraft,
  loadRoutineDraft,
  saveRoutineDraft,
} from '@/db/routine-editor';
import { useExerciseCatalog } from '@/db/use-exercise-catalog';
import {
  type DraftError,
  type DraftItem,
  isDraftChanged,
  itemIssue,
  LIMITS,
  moveItem,
  newDraftItem,
  type RoutineDraft,
  validateDraft,
} from '@/domain/routine-draft';
import { useAppLanguage } from '@/i18n/use-app-language';
import { newId } from '@/lib/id';
import { hasDay, toggleDay, WEEKDAYS } from '@/lib/weekdays';
import { openExercisePicker } from '@/stores/exercise-picker';
import { useSettings } from '@/stores/settings';

/** 루틴 편집 (id가 'new'면 새 루틴). 시작 버튼은 두지 않는다. */
export default function RoutineEditScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const navigation = useNavigation();
  const lang = useAppLanguage();
  const weightUnit = useSettings((s) => s.weightUnit);
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const initial = useMemo<RoutineDraft | null>(
    () => (isNew ? emptyRoutineDraft() : loadRoutineDraft(db, id ?? '')),
    [id, isNew],
  );
  const [draft, setDraft] = useState<RoutineDraft | null>(initial);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [error, setError] = useState<DraftError | null>(null);
  // 저장·삭제 후 나갈 때는 이탈 확인을 건너뛴다(상태가 반영된 다음 렌더에서 뒤로 간다).
  const [leaving, setLeaving] = useState(false);
  const catalog = useExerciseCatalog(lang);

  const changed = initial !== null && draft !== null && isDraftChanged(initial, draft);

  useEffect(() => {
    if (leaving) router.back();
  }, [leaving]);

  usePreventRemove(changed && !leaving, ({ data }) => {
    Alert.alert(t('routines.edit.discardTitle'), t('routines.edit.discardBody'), [
      { text: t('routines.edit.keepEditing'), style: 'cancel' },
      {
        text: t('routines.edit.discard'),
        style: 'destructive',
        onPress: () => navigation.dispatch(data.action),
      },
    ]);
  });

  if (!draft) {
    return (
      <Screen header={<TopBar leading="close" />}>
        <AppText tone="secondary">{t('routines.edit.notFound')}</AppText>
      </Screen>
    );
  }

  const update = (patch: Partial<RoutineDraft>) => {
    setError(null);
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };
  const updateItem = (key: string, patch: Partial<DraftItem>) => {
    setError(null);
    setDraft((d) =>
      d ? { ...d, items: d.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) } : d,
    );
  };

  const addExercises = () => {
    openExercisePicker((ids) => {
      const rests = defaultRestFor(db, ids);
      const added = ids.map((exerciseId) =>
        newDraftItem(newId(), exerciseId, weightUnit, rests.get(exerciseId)),
      );
      setError(null);
      setDraft((d) => (d ? { ...d, items: [...d.items, ...added] } : d));
    });
  };

  const save = () => {
    const problem = validateDraft(draft);
    if (problem) {
      setError(problem);
      if (problem === 'itemInvalid') {
        const bad = draft.items.find((i) => itemIssue(i) !== null);
        if (bad) setExpandedKey(bad.key);
      }
      return;
    }
    saveRoutineDraft(db, draft);
    setLeaving(true);
  };

  const confirmDelete = () => {
    if (!draft.id) return;
    const routineId = draft.id;
    Alert.alert(t('routines.edit.deleteConfirmTitle'), t('routines.edit.deleteConfirmBody'), [
      { text: t('routines.edit.cancel'), style: 'cancel' },
      {
        text: t('routines.edit.deleteConfirm'),
        style: 'destructive',
        onPress: () => {
          deleteRoutine(db, routineId);
          setLeaving(true);
        },
      },
    ]);
  };

  const rows = draft.items.map((item) => {
    const ex = catalog.byId.get(item.exerciseId);
    const metaKey = ex?.type === 'time' ? 'routines.edit.rowMetaTime' : 'routines.edit.rowMeta';
    return {
      item,
      name: ex?.name ?? '',
      meta: t(metaKey, {
        count: item.targetSets,
        min: item.repMin,
        max: item.repMax,
        rest: item.restSec,
      }),
    };
  });

  const renderFields = (item: DraftItem) => {
    const issue = itemIssue(item);
    const isTime = catalog.byId.get(item.exerciseId)?.type === 'time';
    return (
      <View style={styles.fields}>
        <View style={styles.fieldRow}>
          <NumberField
            label={t('routines.edit.sets')}
            unit={t('routines.edit.setsUnit')}
            value={item.targetSets}
            invalid={issue === 'sets'}
            onChange={(v) => updateItem(item.key, { targetSets: v })}
          />
          <RangeField
            label={isTime ? t('routines.edit.time') : t('routines.edit.reps')}
            unit={isTime ? t('routines.edit.timeUnit') : t('routines.edit.repsUnit')}
            min={item.repMin}
            max={item.repMax}
            minLabel={t('routines.edit.min')}
            maxLabel={t('routines.edit.max')}
            invalid={issue === 'reps'}
            onChange={(repMin, repMax) => updateItem(item.key, { repMin, repMax })}
          />
        </View>
        <View style={styles.fieldRow}>
          <NumberField
            label={t('routines.edit.rest')}
            unit={t('routines.edit.restUnit')}
            value={item.restSec}
            invalid={issue === 'rest'}
            onChange={(v) => updateItem(item.key, { restSec: v })}
          />
          <NumberField
            label={t('routines.edit.increment')}
            unit={item.incrementUnit}
            value={item.increment}
            decimal
            invalid={issue === 'increment'}
            onChange={(v) => updateItem(item.key, { increment: v })}
          />
        </View>
        {issue ? <Text style={styles.error}>{t(`routines.edit.errors.${issue}`)}</Text> : null}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen
        header={
          <TopBar
            title={isNew ? t('routines.edit.newTitle') : t('routines.edit.title')}
            leading="close"
            trailing={<TextButton label={t('routines.edit.save')} onPress={save} />}
          />
        }
      >
        <Card style={styles.first}>
          <TextField
            label={t('routines.edit.name')}
            value={draft.name}
            placeholder={t('routines.edit.namePlaceholder')}
            maxLength={LIMITS.nameMax}
            error={error === 'nameRequired' ? t('routines.edit.errors.nameRequired') : undefined}
            onChangeText={(name) => update({ name })}
          />
          <View style={styles.daysWrap}>
            <Text style={styles.daysLabel}>{t('routines.edit.days')}</Text>
            <View style={styles.days}>
              {WEEKDAYS.map((d, i) => {
                const on = hasDay(draft.weekdays, i);
                return (
                  <Pressable
                    key={d}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    accessibilityLabel={t(`weekday.long.${d}`)}
                    onPress={() => update({ weekdays: toggleDay(draft.weekdays, i) })}
                    style={[styles.day, on && styles.dayOn]}
                  >
                    <Text style={[styles.dayText, on && styles.dayTextOn]}>
                      {t(`weekday.short.${d}`)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Card>

        <Card padding="none" style={styles.list}>
          <ExerciseEditList
            rows={rows}
            expandedKey={expandedKey}
            onToggle={(key) => setExpandedKey((k) => (k === key ? null : key))}
            onMove={(from, to) => update({ items: moveItem(draft.items, from, to) })}
            onRemove={(key) => update({ items: draft.items.filter((i) => i.key !== key) })}
            renderFields={renderFields}
          />
          <Pressable accessibilityRole="button" onPress={addExercises} style={styles.add}>
            <Plus size={18} color={theme.colors.text} strokeWidth={1.8} />
            <Text style={styles.addText}>{t('routines.edit.addExercise')}</Text>
          </Pressable>
        </Card>
        {error === 'noExercises' || error === 'itemInvalid' ? (
          <Text style={[styles.error, styles.errorPad]} accessibilityLiveRegion="polite">
            {t(`routines.edit.errors.${error}`)}
          </Text>
        ) : null}

        {draft.id ? (
          <Pressable accessibilityRole="button" onPress={confirmDelete} style={styles.delete}>
            <Text style={styles.deleteText}>{t('routines.edit.delete')}</Text>
          </Pressable>
        ) : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1, backgroundColor: theme.colors.bg },
  first: { marginTop: 8, gap: 16 },
  daysWrap: { gap: 6 },
  daysLabel: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  days: { flexDirection: 'row', gap: 6 },
  day: {
    flex: 1,
    height: 44,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface2,
  },
  dayOn: { backgroundColor: theme.colors.accent },
  dayText: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text2,
  },
  dayTextOn: { color: theme.colors.onAccent },
  list: { paddingTop: 4, paddingRight: 16, paddingBottom: 4, paddingLeft: 12, overflow: 'hidden' },
  fields: { gap: 8 },
  fieldRow: { flexDirection: 'row', gap: 8 },
  add: { height: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  addText: {
    fontSize: 14,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  error: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.danger,
  },
  errorPad: { paddingHorizontal: 6 },
  delete: { height: 48, alignItems: 'center', justifyContent: 'center' },
  deleteText: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.danger,
  },
}));
