import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Pencil, Plus } from 'lucide-react-native';
import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { AmountSheet } from '@/components/diet/amount-sheet';
import { SetPreviewSheet } from '@/components/diet/set-preview-sheet';
import { useDietFormat } from '@/components/diet/use-diet-format';
import {
  ActionSheet,
  AppText,
  Button,
  Chip,
  NoMatchCard,
  NoticeDialog,
  Screen,
  SearchCreateRow,
  Snackbar,
  TextButton,
  TopBar,
} from '@/components/ui';
import { db } from '@/db/client';
import { addFoodLog, canAddCustomFood, deleteFoodLog } from '@/db/diet';
import { addItemsToMeal, canAddSet, deleteFoodLogs } from '@/db/diet-sets';
import type { Meal } from '@/db/schema';
import { useFoodLists, useFoodSets } from '@/db/use-diet';
import { dateKey, parseDateKey } from '@/domain/date-key';
import {
  type Amount,
  defaultAmount,
  type FoodItem,
  type FoodSet,
  foodKey,
  LIMITS,
  MEALS,
  nutrientsFor,
  type SetItem,
  setTotal,
} from '@/domain/diet';
import { searchFoods } from '@/food/catalog';
import { withAllUnits } from '@/food/full-item';
import { catalogItem, loadCatalogItem } from '@/food/items';
import { useFoodDb, useFoodSources } from '@/food/use-food-db';
import { clearCreatedFood, createdFood, takeSetSaved } from '@/lib/created-food';
import { matchesSearch } from '@/lib/hangul';
import { useSetDraft } from '@/stores/set-draft';

type Tab = 'recent' | 'favorites' | 'mine' | 'sets';
const TABS: readonly Tab[] = ['recent', 'favorites', 'mine', 'sets'];
/** '추가했어요' 한 줄이 떠 있는 시간 */
const ADDED_MS = 4000;
const RESULT_LIMIT = 50;

type Row = { item: FoodItem; amount: Amount; recent?: boolean };

/**
 * 음식 찾기: 끼니에 넣을 음식을 고른다. 줄을 누르면 양 창, +는 보이는 양으로 바로 추가. 추가해도 화면에 남는다.
 * `mode=set`으로 열면 고른 음식이 끼니가 아니라 만들고 있는 세트에 담긴다('세트에 담기').
 */
export default function FoodSearchScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const fmt = useDietFormat();
  // `q`: 처음 검색어. 화면에서는 쓰지 않고, 주소로 열어 확인할 때 쓴다(에뮬레이터에는 한글을 입력할 수 없다).
  const params = useLocalSearchParams<{
    date?: string;
    meal?: string;
    q?: string;
    mode?: string;
  }>();
  const toSet = params.mode === 'set';
  const date = params.date && parseDateKey(params.date) ? params.date : dateKey(new Date());
  const meal: Meal = MEALS.find((m) => m === params.meal) ?? 'snack';
  const mealName = fmt.meal(meal);

  const { db: foodDb, failed } = useFoodDb();
  const sources = useFoodSources();
  const { mine, recent, favorites } = useFoodLists();
  const sets = useFoodSets();
  const [query, setQuery] = useState(params.q ?? '');
  const [tab, setTab] = useState<Tab>('recent');
  const [picked, setPicked] = useState<Row | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  // 방금 한 일을 알리는 한 줄. `key`가 바뀌면 새로 떠오른다.
  const [added, setAdded] = useState<{ key: number; message: string; undo: () => void } | null>(
    null,
  );
  const addedKey = useRef(0);
  const [notice, setNotice] = useState<'foods' | 'sets' | 'setItems' | null>(null);
  const [noticeShown, setNoticeShown] = useState<'foods' | 'sets' | 'setItems'>('foods');
  const [choosing, setChoosing] = useState(false);
  const [preview, setPreview] = useState<FoodSet | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const warn = (kind: 'foods' | 'sets' | 'setItems') => {
    setNoticeShown(kind);
    setNotice(kind);
  };

  const searching = query.trim().length > 0;
  const mineByKey = useMemo(() => new Map(mine.map((f) => [foodKey(f), f])), [mine]);

  const favoriteRows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const f of favorites) {
      let item: FoodItem | null = null;
      if (f.src === 'custom') item = mineByKey.get(foodKey(f)) ?? null;
      else if (foodDb) item = loadCatalogItem(foodDb, f.src, f.sid);
      if (item) out.push({ item, amount: defaultAmount(item) });
    }
    return out;
  }, [favorites, mineByKey, foodDb]);

  const results = useMemo<Row[]>(() => {
    if (!searching) return [];
    const own = mine.filter((f) => matchesSearch(query, [f.name]));
    const found = foodDb
      ? searchFoods(foodDb, query, sources, RESULT_LIMIT).map((f) => catalogItem(f))
      : [];
    // 즐겨찾기 → 최근 먹은 것 → 나머지 (같은 묶음 안에서는 찾은 순서 그대로)
    const fav = new Set(favorites.map(foodKey));
    const rec = new Map(recent.map((r) => [foodKey(r.item), r.amount]));
    const rank = (f: FoodItem) => (fav.has(foodKey(f)) ? 0 : rec.has(foodKey(f)) ? 1 : 2);
    return [...own, ...found]
      .map((item, i) => ({ item, i, r: rank(item) }))
      .sort((a, b) => a.r - b.r || a.i - b.i)
      .map(({ item }) => ({ item, amount: defaultAmount(item) }));
  }, [searching, query, mine, foodDb, sources, favorites, recent]);

  const rows: Row[] = searching
    ? results
    : tab === 'recent'
      ? recent.map((r) => ({ ...r, recent: true }))
      : tab === 'favorites'
        ? favoriteRows
        : tab === 'mine'
          ? mine.map((item) => ({ item, amount: defaultAmount(item) }))
          : [];

  const say = (message: string, undo: () => void) => {
    addedKey.current += 1;
    setAdded({ key: addedKey.current, message, undo });
  };
  const add = (item: FoodItem, amount: Amount) => {
    const text = { name: item.name, amount: fmt.amount(amount, item.basis) };
    if (toSet) {
      if (!useSetDraft.getState().add(item, amount)) return warn('setItems');
      say(t('diet.sets.putDone', text), () => useSetDraft.getState().removeLast());
      return;
    }
    const id = addFoodLog(db, { date, meal, item, amount });
    say(t('diet.search.added', { meal: mealName, ...text }), () => deleteFoodLog(db, id));
  };
  const addSet = (set: FoodSet, items: readonly SetItem[]) => {
    if (items.length === 0) return;
    const ids = addItemsToMeal(db, { date, meal, items });
    say(t('diet.sets.added', { meal: mealName, name: set.name, count: items.length }), () =>
      deleteFoodLogs(db, ids),
    );
  };
  const undo = () => {
    added?.undo();
    setAdded(null);
  };

  const open = useCallback(
    (row: Row) => {
      Keyboard.dismiss();
      // 양 창에서는 고를 수 있는 단위를 모두 보여 준다(목록에는 기본 1회 양만 실려 있다).
      const item = withAllUnits(row.item, row.amount.unit, foodDb);
      setPicked({ item, amount: row.amount });
      setSheetOpen(true);
    },
    [foodDb],
  );

  const createFood = (name: string | null = null) => {
    if (!canAddCustomFood(db)) return warn('foods');
    router.push({ pathname: '/food/[id]', params: { id: 'new', ...(name ? { name } : {}) } });
  };
  const createSet = () => {
    if (!canAddSet(db)) return warn('sets');
    router.push({ pathname: '/food-set/[id]', params: { id: 'new' } });
  };
  // 세트에 담는 중에는 음식만 만든다(세트 안에서 세트를 만들지 않는다).
  const create = () => (toSet ? createFood() : setChoosing(true));
  // 세트를 저장하고 돌아오면 세트 칩을 보여 준다.
  useFocusEffect(
    useCallback(() => {
      if (!takeSetSaved()) return;
      setQuery('');
      setTab('sets');
    }, []),
  );
  // 음식을 만들고 돌아오면 그 음식의 양 창을 바로 연다.
  // 돌아온 직후에는 새 음식이 아직 목록에 안 실렸을 수 있어, 목록이 바뀔 때도 다시 본다.
  useFocusEffect(
    useCallback(() => {
      const id = createdFood();
      const item = id ? mineByKey.get(`custom:${id}`) : undefined;
      if (!item) return;
      clearCreatedFood();
      setQuery('');
      setTab('mine');
      setPicked({ item, amount: defaultAmount(item) });
      setSheetOpen(true);
    }, [mineByKey]),
  );

  const sub = (row: Row) => {
    const { item, amount } = row;
    const n = nutrientsFor(item, amount.grams);
    const first =
      !row.recent && amount.unit === null && amount.grams === 100
        ? t('diet.per100', { basis: item.basis })
        : fmt.amount(amount, item.basis);
    return `${first} · ${fmt.int(n.kcal)} kcal · ${t('diet.proteinShort', { n: fmt.int(n.protein) })}`;
  };
  const tag = (item: FoodItem) =>
    item.src === 'custom'
      ? searching
        ? t('diet.search.tagMine')
        : null
      : item.src === 'usda' && sources.includes('mfds')
        ? 'USDA'
        : null;

  const name = query.trim().slice(0, LIMITS.foodName) || null;
  const showSets = !searching && tab === 'sets' && !toSet;
  const loading = searching && !foodDb && !failed;

  return (
    <Screen
      avoidKeyboard
      dismissKeyboardOnDrag
      header={
        <TopBar
          title={toSet ? t('diet.sets.pickTitle') : t('diet.search.title', { meal: mealName })}
          trailing={
            toSet ? <TextButton label={t('diet.sets.done')} onPress={() => router.back()} /> : null
          }
        />
      }
      footer={
        added ? (
          <Snackbar
            key={added.key}
            message={added.message}
            actionLabel={t('diet.search.undo')}
            onAction={undo}
            onDismiss={() => setAdded((cur) => (cur?.key === added.key ? null : cur))}
            autoHideMs={ADDED_MS}
          />
        ) : undefined
      }
    >
      <View style={styles.top}>
        <SearchCreateRow
          query={query}
          onChangeQuery={setQuery}
          onCreate={() => create()}
          searchLabel={t('diet.search.label')}
          placeholder={t('diet.search.placeholder')}
          clearLabel={t('diet.search.clear')}
          createLabel={t('diet.search.createShort')}
          createA11y={t('diet.search.createA11y')}
        />
      </View>
      {searching ? null : (
        <View style={styles.chips} accessibilityRole="tablist">
          {TABS.filter((x) => !(toSet && x === 'sets')).map((x) => (
            <Chip
              key={x}
              label={t(`diet.search.tab.${x}`)}
              selected={tab === x}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === x }}
              onPress={() => setTab(x)}
            />
          ))}
        </View>
      )}

      {searching && failed ? <AppText tone="secondary">{t('diet.search.failed')}</AppText> : null}
      {loading ? <AppText tone="secondary">{t('diet.search.loading')}</AppText> : null}

      {showSets ? (
        sets.length > 0 ? (
          <>
            <View style={styles.list}>
              {sets.map((set, i) => {
                const total = setTotal(set.items);
                const line = `${t('diet.sets.count', { count: set.items.length })} · ${fmt.int(total.kcal)} kcal · ${t('diet.proteinShort', { n: fmt.int(total.protein) })}`;
                return (
                  <View key={set.id} style={[styles.row, i < sets.length - 1 && styles.line]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${set.name}, ${line}`}
                      accessibilityHint={t('diet.sets.rowHint')}
                      onPress={() => {
                        Keyboard.dismiss();
                        setPreview(set);
                        setPreviewOpen(true);
                      }}
                      style={({ pressed }) => [styles.rowBody, pressed && styles.pressed]}
                    >
                      <Text style={styles.name} numberOfLines={2}>
                        {set.name}
                      </Text>
                      <Text style={styles.sub} numberOfLines={1}>
                        {line}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('diet.search.editA11y', { name: set.name })}
                      onPress={() =>
                        router.push({ pathname: '/food-set/[id]', params: { id: set.id } })
                      }
                      style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
                    >
                      <Pencil size={18} color={theme.colors.text2} strokeWidth={1.8} />
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('diet.search.quickAddA11y', { name: set.name })}
                      onPress={() => addSet(set, set.items)}
                      style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
                    >
                      <View style={styles.plus}>
                        <Plus size={16} color={theme.colors.text} strokeWidth={2.2} />
                      </View>
                    </Pressable>
                  </View>
                );
              })}
            </View>
            <Text style={styles.hint}>{t('diet.sets.hint')}</Text>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <View style={styles.emptyText}>
              <Text style={styles.emptyTitle}>{t('diet.sets.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>{t('diet.sets.emptyBody')}</Text>
            </View>
            <Button label={t('diet.sets.create')} size="sm" icon={Plus} onPress={createSet} />
          </View>
        )
      ) : rows.length > 0 ? (
        <View style={styles.list}>
          {rows.map((row, i) => {
            const { item } = row;
            const line = sub(row);
            const label = tag(item);
            return (
              <View
                key={`${foodKey(item)}`}
                style={[styles.row, i < rows.length - 1 && styles.line]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${item.name}, ${line}`}
                  accessibilityHint={t('diet.search.rowHint')}
                  onPress={() => open(row)}
                  style={({ pressed }) => [styles.rowBody, pressed && styles.pressed]}
                >
                  <Text style={styles.name} numberOfLines={2}>
                    {item.name}
                  </Text>
                  <View style={styles.subRow}>
                    <Text style={styles.sub} numberOfLines={1}>
                      {line}
                    </Text>
                    {label ? (
                      <View style={styles.tag}>
                        <Text style={styles.tagText}>{label}</Text>
                      </View>
                    ) : null}
                  </View>
                </Pressable>
                {item.src === 'custom' && !searching && tab === 'mine' ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('diet.search.editA11y', { name: item.name })}
                    onPress={() =>
                      router.push({ pathname: '/food/[id]', params: { id: item.sid } })
                    }
                    style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
                  >
                    <Pencil size={18} color={theme.colors.text2} strokeWidth={1.8} />
                  </Pressable>
                ) : null}
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('diet.search.quickAddA11y', { name: item.name })}
                  onPress={() => add(item, row.amount)}
                  style={({ pressed }) => [styles.hit, pressed && styles.pressed]}
                >
                  <View style={styles.plus}>
                    <Plus size={16} color={theme.colors.text} strokeWidth={2.2} />
                  </View>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : searching ? (
        loading || (failed && mine.length === 0) ? null : (
          <NoMatchCard
            title={t('diet.search.noMatchTitle', { query: query.trim() })}
            body={t('diet.search.noMatchBody')}
            createLabel={
              name ? t('diet.search.createNamed', { name }) : t('diet.search.createA11y')
            }
            onCreate={() => createFood(name)}
          />
        )
      ) : (
        <Text style={styles.empty}>{t(`diet.search.empty.${tab}`)}</Text>
      )}

      <AmountSheet
        visible={sheetOpen}
        item={picked?.item ?? null}
        initial={picked?.amount ?? NO_AMOUNT}
        submitLabel={toSet ? t('diet.sets.put') : t('diet.amount.addTo', { meal: mealName })}
        onSubmit={(amount) => {
          if (picked) add(picked.item, amount);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
      <SetPreviewSheet
        visible={previewOpen}
        set={preview}
        mealName={mealName}
        foodDb={foodDb}
        onAdd={(items) => {
          if (preview) addSet(preview, items);
          setPreviewOpen(false);
        }}
        onClose={() => setPreviewOpen(false)}
      />
      <ActionSheet
        visible={choosing}
        title={t('diet.sets.chooseTitle')}
        actions={[
          {
            label: t('diet.sets.chooseFood'),
            description: t('diet.sets.chooseFoodDesc'),
            onPress: () => createFood(),
            afterClose: true,
          },
          {
            label: t('diet.sets.chooseSet'),
            description: t('diet.sets.chooseSetDesc'),
            onPress: createSet,
            afterClose: true,
          },
        ]}
        cancelLabel={t('diet.cancel')}
        onClose={() => setChoosing(false)}
      />
      <NoticeDialog
        visible={notice !== null}
        title={t(`diet.limit.${noticeShown}Title`, { max: LIMIT_OF[noticeShown] })}
        body={t(`diet.limit.${noticeShown}Body`)}
        okLabel={t('common.ok')}
        onClose={() => setNotice(null)}
      />
    </Screen>
  );
}

const NO_AMOUNT = { grams: 100, unit: null } as const;
const LIMIT_OF = {
  foods: LIMITS.customFoods,
  sets: LIMITS.sets,
  setItems: LIMITS.setItems,
} as const;

const styles = StyleSheet.create((theme) => ({
  top: { paddingTop: 4 },
  chips: { flexDirection: 'row', gap: 6 },
  pressed: { opacity: 0.6 },
  list: {
    paddingVertical: 2,
    paddingLeft: 18,
    paddingRight: 6,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  row: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 4 },
  line: { borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  rowBody: { flex: 1, minWidth: 0, gap: 3, paddingVertical: 10, justifyContent: 'center' },
  name: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  subRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sub: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: theme.colors.surface2,
  },
  tagText: {
    fontSize: 10,
    lineHeight: 14,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text2,
  },
  hit: {
    width: theme.hitSize,
    height: theme.hitSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface2,
  },
  hint: {
    paddingHorizontal: 6,
    fontSize: 12,
    lineHeight: 19,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  emptyCard: {
    gap: 14,
    paddingTop: 20,
    paddingHorizontal: 18,
    paddingBottom: 18,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.surface,
  },
  emptyText: { gap: 4 },
  emptyTitle: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 19.5,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  empty: {
    paddingHorizontal: 6,
    paddingTop: 8,
    fontSize: 14,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
