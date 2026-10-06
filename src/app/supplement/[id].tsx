import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { ChevronDown } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppState, Linking, Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { AfterSheet } from '@/components/supplements/after-sheet';
import { TimeSheet } from '@/components/supplements/time-sheet';
import { useSupplementFormat } from '@/components/supplements/use-supplement-format';
import {
  AppText,
  Card,
  Chip,
  ConfirmDialog,
  ListRow,
  Screen,
  TextButton,
  TextField,
  Toggle,
  TopBar,
} from '@/components/ui';
import { db } from '@/db/client';
import type { SupplementTiming } from '@/db/schema';
import {
  createSupplement,
  deleteSupplement,
  getSupplement,
  type SupplementInput,
  updateSupplement,
} from '@/db/supplements';
import { LIMITS } from '@/domain/supplements';
import { useAppLanguage } from '@/i18n/use-app-language';
import { object as objectJosa } from '@/lib/josa';
import { ensurePermission, notificationsDenied } from '@/lib/notifications';

const EMPTY: SupplementInput = {
  name: '',
  dose: '',
  timing: 'time',
  timeMin: 9 * 60,
  afterMin: 30,
  notify: true,
  renotify: true,
  active: true,
};
const KEYS = Object.keys(EMPTY) as (keyof SupplementInput)[];
const TIMINGS: readonly SupplementTiming[] = ['time', 'after_workout'];

type Ask = { kind: 'delete' } | { kind: 'leave'; go: () => void };

/** 영양제 추가 · 편집: 이름, 용량, 언제 먹는지, 알림, 사용 중, 삭제 */
export default function SupplementEditScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const navigation = useNavigation();
  const lang = useAppLanguage();
  const fmt = useSupplementFormat();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const initial = useMemo<SupplementInput | null>(() => {
    if (isNew) return EMPTY;
    const s = getSupplement(db, id ?? '');
    return s ? { ...s, dose: s.dose ?? '' } : null;
  }, [id, isNew]);
  const [draft, setDraft] = useState<SupplementInput | null>(initial);
  const [nameError, setNameError] = useState(false);
  const [sheet, setSheet] = useState<'time' | 'after' | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  // 닫히는 동안에도 내용이 남아 있도록 마지막으로 띄운 것을 기억한다.
  const [asked, setAsked] = useState<Ask | null>(null);
  // 저장 · 삭제 뒤 나갈 때는 나가기 확인을 건너뛴다(상태가 반영된 다음 렌더에서 뒤로 간다).
  const [leaving, setLeaving] = useState(false);
  const [denied, setDenied] = useState(false);

  const changed = initial !== null && draft !== null && KEYS.some((k) => initial[k] !== draft[k]);

  useEffect(() => {
    if (leaving) router.back();
  }, [leaving]);

  usePreventRemove(changed && !leaving, ({ data }) => {
    const next: Ask = { kind: 'leave', go: () => navigation.dispatch(data.action) };
    setAsked(next);
    setAsk(next);
  });

  // 기기에서 알림을 꺼 둔 경우 알려 준다(설정에 다녀오면 다시 본다).
  const checkPermission = useCallback(() => {
    void notificationsDenied().then(setDenied);
  }, []);
  useEffect(() => {
    checkPermission();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkPermission();
    });
    return () => sub.remove();
  }, [checkPermission]);

  if (!draft) {
    return (
      <Screen header={<TopBar leading="close" />}>
        <AppText tone="secondary">{t('supplements.edit.notFound')}</AppText>
      </Screen>
    );
  }

  const update = (patch: Partial<SupplementInput>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const save = async () => {
    if (!draft.name.trim()) return setNameError(true);
    // 알림을 켠 채 저장하면 그때 권한을 묻는다(처음 한 번). 거절해도 저장은 한다.
    if (draft.notify && draft.active) await ensurePermission().catch(() => false);
    if (isNew) createSupplement(db, draft);
    else updateSupplement(db, id ?? '', draft);
    setLeaving(true);
  };

  const remove = () => {
    deleteSupplement(db, id ?? '');
    setAsk(null);
    setLeaving(true);
  };

  const openAsk = (next: Ask) => {
    setAsked(next);
    setAsk(next);
  };

  const whenValue =
    draft.timing === 'time'
      ? fmt.clock(draft.timeMin)
      : draft.afterMin === 0
        ? t('supplements.edit.afterNowValue')
        : t('supplements.edit.afterValue', { time: fmt.duration(draft.afterMin) });
  const whenLabel = t(draft.timing === 'time' ? 'supplements.edit.time' : 'supplements.edit.after');
  const savedName = initial?.name ?? '';

  return (
    <Screen
      avoidKeyboard
      dismissKeyboardOnDrag
      header={
        <TopBar
          title={t(isNew ? 'supplements.edit.titleNew' : 'supplements.edit.title')}
          leading="close"
          trailing={<TextButton label={t('common.save')} onPress={() => void save()} />}
        />
      }
    >
      <Card style={styles.first}>
        <TextField
          label={t('supplements.edit.name')}
          value={draft.name}
          placeholder={t('supplements.edit.namePlaceholder')}
          maxLength={LIMITS.name}
          error={nameError ? t('supplements.edit.nameRequired') : undefined}
          onChangeText={(name) => {
            setNameError(false);
            update({ name });
          }}
        />
        <TextField
          label={t('supplements.edit.dose')}
          value={draft.dose}
          placeholder={t('supplements.edit.dosePlaceholder')}
          maxLength={LIMITS.dose}
          onChangeText={(dose) => update({ dose })}
        />
      </Card>

      <Card>
        <View style={styles.group}>
          <Text style={styles.groupTitle} accessibilityRole="header">
            {t('supplements.edit.when')}
          </Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {TIMINGS.map((x) => (
              <Chip
                key={x}
                tone="raised"
                label={t(
                  x === 'time' ? 'supplements.edit.timingTime' : 'supplements.edit.timingAfter',
                )}
                selected={draft.timing === x}
                accessibilityRole="radio"
                accessibilityState={{ checked: draft.timing === x }}
                onPress={() => update({ timing: x })}
              />
            ))}
          </View>
        </View>
        <View style={styles.group6}>
          <Text style={styles.groupTitle}>{whenLabel}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${whenLabel}, ${whenValue}`}
            onPress={() => setSheet(draft.timing === 'time' ? 'time' : 'after')}
            style={({ pressed }) => [styles.select, pressed && styles.pressed]}
          >
            <Text style={styles.selectValue}>{whenValue}</Text>
            <ChevronDown size={18} color={theme.colors.text2} strokeWidth={1.8} />
          </Pressable>
        </View>
      </Card>

      {denied ? (
        <View style={styles.perm}>
          <Text style={styles.permText}>{t('supplements.edit.permOff')}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void Linking.openSettings()}
            style={({ pressed }) => [styles.permButton, pressed && styles.pressed]}
          >
            <Text style={styles.permButtonText}>{t('supplements.edit.openSettings')}</Text>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.toggles}>
        <ListRow
          label={t('supplements.edit.notify')}
          trailing={
            <Toggle
              value={draft.notify}
              onValueChange={(notify) => update({ notify })}
              accessibilityLabel={t('supplements.edit.notify')}
            />
          }
        />
        <View style={!draft.notify && styles.dim}>
          <ListRow
            label={t('supplements.edit.renotify')}
            description={t('supplements.edit.renotifyDesc')}
            trailing={
              <Toggle
                value={draft.notify && draft.renotify}
                disabled={!draft.notify}
                onValueChange={(renotify) => update({ renotify })}
                accessibilityLabel={t('supplements.edit.renotify')}
              />
            }
          />
        </View>
        <ListRow
          last
          label={t('supplements.edit.active')}
          description={t('supplements.edit.activeDesc')}
          trailing={
            <Toggle
              value={draft.active}
              onValueChange={(active) => update({ active })}
              accessibilityLabel={t('supplements.edit.active')}
            />
          }
        />
      </View>

      {isNew ? null : (
        <Pressable
          accessibilityRole="button"
          onPress={() => openAsk({ kind: 'delete' })}
          style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
        >
          <Text style={styles.deleteText}>{t('supplements.edit.delete')}</Text>
        </Pressable>
      )}

      <TimeSheet
        visible={sheet === 'time'}
        value={draft.timeMin}
        onChange={(timeMin) => update({ timeMin })}
        onClose={() => setSheet(null)}
      />
      <AfterSheet
        visible={sheet === 'after'}
        value={draft.afterMin}
        onChange={(afterMin) => update({ afterMin })}
        onClose={() => setSheet(null)}
      />
      {asked?.kind === 'leave' ? (
        <ConfirmDialog
          visible={ask !== null}
          title={t('supplements.edit.discardTitle')}
          body={t('supplements.edit.discardBody')}
          cancelLabel={t('supplements.edit.keepEditing')}
          confirmLabel={t('supplements.edit.discard')}
          destructive
          onCancel={() => setAsk(null)}
          onConfirm={() => {
            setAsk(null);
            asked.go();
          }}
        />
      ) : (
        <ConfirmDialog
          visible={ask !== null}
          title={t('supplements.edit.deleteTitle', {
            name: lang === 'ko' ? objectJosa(savedName) : savedName,
          })}
          body={t('supplements.edit.deleteBody')}
          cancelLabel={t('supplements.edit.cancel')}
          confirmLabel={t('supplements.edit.deleteConfirm')}
          destructive
          onCancel={() => setAsk(null)}
          onConfirm={remove}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  first: { marginTop: 8 },
  group: { gap: 8 },
  group6: { gap: 6 },
  groupTitle: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  chips: { flexDirection: 'row', gap: 6 },
  select: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface2,
  },
  selectValue: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  pressed: { opacity: 0.7 },
  perm: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingLeft: 16,
    paddingRight: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.warmSoft,
  },
  permText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19.5,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.warm,
  },
  permButton: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface2,
  },
  permButtonText: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  toggles: {
    paddingVertical: 2,
    paddingLeft: 18,
    paddingRight: 12,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  dim: { opacity: 0.4 },
  delete: { height: 48, alignItems: 'center', justifyContent: 'center' },
  deleteText: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.danger,
  },
}));
