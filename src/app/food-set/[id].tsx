import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { Plus } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { AmountSheet } from '@/components/diet/amount-sheet';
import { useDietFormat } from '@/components/diet/use-diet-format';
import {
  AppText,
  Card,
  ConfirmDialog,
  NoticeDialog,
  Screen,
  TextButton,
  TextField,
  TopBar,
} from '@/components/ui';
import { db } from '@/db/client';
import { createSet, deleteSet, getSet, updateSet } from '@/db/diet-sets';
import { LIMITS, nutrientsFor, type SetItem, setTotal } from '@/domain/diet';
import { withAllUnits } from '@/food/full-item';
import { useFoodDb } from '@/food/use-food-db';
import { useAppLanguage } from '@/i18n/use-app-language';
import { markSetSaved } from '@/lib/created-food';
import { object as objectJosa } from '@/lib/josa';
import { useSetDraft } from '@/stores/set-draft';

type Ask = { kind: 'delete' } | { kind: 'leave'; go: () => void };

/** 담은 음식이 바뀌었는지 견줄 때 쓰는 글자 */
const signature = (items: readonly SetItem[]) =>
  items
    .map(
      ({ item, amount }) =>
        `${item.src}:${item.sid}:${amount.grams}:${amount.unit?.name ?? ''}:${amount.unit?.grams ?? ''}`,
    )
    .join('|');

/**
 * 세트 만들기 · 고치기: 이름, 담은 음식(양 포함), 합계, 삭제.
 * 담은 음식은 `useSetDraft`에 두고 '음식 담기'로 여는 음식 찾기 화면과 같이 쓴다.
 */
export default function FoodSetScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const navigation = useNavigation();
  const lang = useAppLanguage();
  const fmt = useDietFormat();
  const { db: foodDb } = useFoodDb();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';

  const initial = useMemo(() => {
    if (isNew) return { name: '', items: [] as SetItem[] };
    const set = getSet(db, id ?? '');
    return set ? { name: set.name, items: set.items } : null;
  }, [id, isNew]);
  // 화면을 열 때 담겨 있던 음식으로 시작한다(첫 그림 전에 채워야 빈 목록이 잠깐 보이지 않는다).
  useState(() => useSetDraft.getState().start(initial?.items ?? []));
  const items = useSetDraft((s) => s.items);
  const [name, setName] = useState(initial?.name ?? '');
  const [problem, setProblem] = useState<'name' | 'items' | null>(null);
  const [full, setFull] = useState(false);
  const [editing, setEditing] = useState<{ index: number; entry: SetItem } | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [ask, setAsk] = useState<Ask | null>(null);
  // 닫히는 동안에도 내용이 남아 있도록 마지막으로 띄운 것을 기억한다.
  const [asked, setAsked] = useState<Ask | null>(null);
  // 저장 · 삭제 뒤 나갈 때는 나가기 확인을 건너뛴다(상태가 반영된 다음 렌더에서 뒤로 간다).
  const [leaving, setLeaving] = useState(false);

  const changed =
    initial !== null && (name !== initial.name || signature(items) !== signature(initial.items));

  useEffect(() => {
    if (leaving) router.back();
  }, [leaving]);

  usePreventRemove(changed && !leaving, ({ data }) => {
    const next: Ask = { kind: 'leave', go: () => navigation.dispatch(data.action) };
    setAsked(next);
    setAsk(next);
  });

  if (!initial) {
    return (
      <Screen header={<TopBar leading="close" />}>
        <AppText tone="secondary">{t('diet.sets.notFound')}</AppText>
      </Screen>
    );
  }

  const save = () => {
    if (!name.trim()) return setProblem('name');
    if (items.length === 0) return setProblem('items');
    if (isNew) createSet(db, name, items);
    else updateSet(db, id ?? '', name, items);
    markSetSaved();
    setLeaving(true);
  };

  const remove = () => {
    deleteSet(db, id ?? '');
    setAsk(null);
    markSetSaved();
    setLeaving(true);
  };

  const pick = () => {
    if (items.length >= LIMITS.setItems) return setFull(true);
    setProblem(null);
    router.push({ pathname: '/food-search', params: { mode: 'set' } });
  };

  const edit = (index: number) => {
    const entry = items[index];
    if (!entry) return;
    setEditing({
      index,
      entry: { ...entry, item: withAllUnits(entry.item, entry.amount.unit, foodDb) },
    });
    setEditOpen(true);
  };

  const total = setTotal(items);
  const cell = (label: string, value: number, unit: string) => (
    <View style={styles.cell}>
      <Text style={styles.cellLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.cellValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {fmt.int(value)}
        <Text style={styles.cellUnit}> {unit}</Text>
      </Text>
    </View>
  );

  return (
    <Screen
      avoidKeyboard
      dismissKeyboardOnDrag
      header={
        <TopBar
          title={t(isNew ? 'diet.sets.titleNew' : 'diet.sets.title')}
          leading="close"
          trailing={<TextButton label={t('common.save')} onPress={save} />}
        />
      }
    >
      <Card style={styles.first}>
        <TextField
          label={t('diet.sets.name')}
          value={name}
          placeholder={t('diet.sets.namePlaceholder')}
          maxLength={LIMITS.setName}
          error={problem === 'name' ? t('diet.sets.nameRequired') : undefined}
          onChangeText={(v) => {
            setProblem(null);
            setName(v);
          }}
        />
      </Card>

      <Card padding="none" style={styles.list}>
        <View style={[styles.head, items.length > 0 && styles.line]}>
          <Text style={styles.headTitle} accessibilityRole="header">
            {t('diet.sets.items')}
          </Text>
          <Text style={styles.headCount}>{t('diet.sets.itemsCount', { count: items.length })}</Text>
        </View>
        {items.length === 0 ? (
          <Text style={[styles.emptyText, problem === 'items' && styles.errorText]}>
            {t(problem === 'items' ? 'diet.sets.itemsRequired' : 'diet.sets.itemsEmpty')}
          </Text>
        ) : (
          items.map(({ item, amount }, i) => {
            const n = nutrientsFor(item, amount.grams);
            const sub = `${fmt.amount(amount, item.basis)} · ${t('diet.proteinShort', { n: fmt.int(n.protein) })}`;
            return (
              <Pressable
                // biome-ignore lint/suspicious/noArrayIndexKey: 같은 음식을 두 번 담을 수 있어 자리로 구분한다
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${sub}, ${fmt.int(n.kcal)} kcal`}
                accessibilityHint={t('diet.rowHint')}
                onPress={() => edit(i)}
                style={({ pressed }) => [styles.row, styles.line, pressed && styles.pressed]}
              >
                <View style={styles.body}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.sub} numberOfLines={1}>
                    {sub}
                  </Text>
                </View>
                <Text style={styles.kcal}>
                  {fmt.int(n.kcal)}
                  <Text style={styles.kcalUnit}> kcal</Text>
                </Text>
              </Pressable>
            );
          })
        )}
        <Pressable
          accessibilityRole="button"
          onPress={pick}
          style={({ pressed }) => [styles.add, pressed && styles.pressed]}
        >
          <Plus size={16} color={theme.colors.text} strokeWidth={2.2} />
          <Text style={styles.addText}>{t('diet.sets.addFood')}</Text>
        </Pressable>
      </Card>

      {items.length > 0 ? (
        <>
          <View style={styles.total}>
            {cell(t('diet.kcal'), total.kcal, 'kcal')}
            {cell(t('diet.protein'), total.protein, 'g')}
            {cell(t('diet.carb'), total.carb, 'g')}
            {cell(t('diet.fat'), total.fat, 'g')}
          </View>
          <Text style={styles.note}>{t('diet.sets.note')}</Text>
        </>
      ) : null}

      {isNew ? null : (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setAsked({ kind: 'delete' });
            setAsk({ kind: 'delete' });
          }}
          style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
        >
          <Text style={styles.deleteText}>{t('diet.sets.delete')}</Text>
        </Pressable>
      )}

      <AmountSheet
        visible={editOpen}
        item={editing?.entry.item ?? null}
        initial={editing?.entry.amount ?? NO_AMOUNT}
        submitLabel={t('common.save')}
        deleteLabel={t('diet.sets.remove')}
        onSubmit={(amount) => {
          if (editing) useSetDraft.getState().setAmount(editing.index, amount);
          setEditOpen(false);
        }}
        onDelete={() => {
          if (editing) useSetDraft.getState().removeAt(editing.index);
          setEditOpen(false);
        }}
        onClose={() => setEditOpen(false)}
      />
      <NoticeDialog
        visible={full}
        title={t('diet.limit.setItemsTitle', { max: LIMITS.setItems })}
        body={t('diet.limit.setItemsBody')}
        okLabel={t('common.ok')}
        onClose={() => setFull(false)}
      />
      {asked?.kind === 'leave' ? (
        <ConfirmDialog
          visible={ask !== null}
          title={t('diet.discardTitle')}
          body={t('diet.discardBody')}
          cancelLabel={t('diet.keepEditing')}
          confirmLabel={t('diet.discard')}
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
          title={t('diet.sets.deleteTitle', {
            name: lang === 'ko' ? objectJosa(initial.name) : initial.name,
          })}
          body={t('diet.sets.deleteBody')}
          cancelLabel={t('diet.cancel')}
          confirmLabel={t('diet.sets.deleteConfirm')}
          destructive
          onCancel={() => setAsk(null)}
          onConfirm={remove}
        />
      )}
    </Screen>
  );
}

const NO_AMOUNT = { grams: 100, unit: null } as const;

const styles = StyleSheet.create((theme) => ({
  first: { marginTop: 8 },
  pressed: { opacity: 0.6 },
  list: { paddingTop: 2, paddingLeft: 18, paddingRight: 18, paddingBottom: 14 },
  line: { borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  head: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headTitle: {
    flex: 1,
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  headCount: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.numRegular,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  emptyText: {
    paddingVertical: 4,
    fontSize: 13,
    lineHeight: 19.5,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  errorText: { color: theme.colors.danger },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12 },
  body: { flex: 1, minWidth: 0, gap: 2 },
  name: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  sub: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  kcal: {
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.numSemibold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  kcalUnit: { fontFamily: theme.fonts.numMedium, color: theme.colors.text2 },
  add: {
    height: 48,
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 16,
    backgroundColor: theme.colors.surface2,
  },
  addText: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  total: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  cell: { flex: 1, minWidth: 0, gap: 2 },
  cellLabel: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  cellValue: {
    fontSize: 17,
    lineHeight: 22,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  cellUnit: { fontSize: 12, fontFamily: theme.fonts.numMedium, color: theme.colors.text2 },
  note: {
    paddingHorizontal: 6,
    fontSize: 12,
    lineHeight: 19,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  delete: { height: 48, alignItems: 'center', justifyContent: 'center' },
  deleteText: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.danger,
  },
}));
