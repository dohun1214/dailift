import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Pencil, Plus } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Keyboard, Pressable, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { AmountSheet } from '@/components/diet/amount-sheet';
import { useDietFormat } from '@/components/diet/use-diet-format';
import {
  AppText,
  Chip,
  NoMatchCard,
  NoticeDialog,
  Screen,
  SearchCreateRow,
  Snackbar,
  TopBar,
} from '@/components/ui';
import { db } from '@/db/client';
import { addFoodLog, canAddCustomFood, deleteFoodLog } from '@/db/diet';
import type { Meal } from '@/db/schema';
import { useFoodLists } from '@/db/use-diet';
import { dateKey, parseDateKey } from '@/domain/date-key';
import {
  type Amount,
  defaultAmount,
  type FoodItem,
  foodKey,
  LIMITS,
  MEALS,
  nutrientsFor,
} from '@/domain/diet';
import { searchFoods } from '@/food/catalog';
import { catalogItem, loadCatalogItem } from '@/food/items';
import { useFoodDb, useFoodSources } from '@/food/use-food-db';
import { clearCreatedFood, createdFood } from '@/lib/created-food';
import { matchesSearch } from '@/lib/hangul';

type Tab = 'recent' | 'favorites' | 'mine';
const TABS: readonly Tab[] = ['recent', 'favorites', 'mine'];
/** '추가했어요' 한 줄이 떠 있는 시간 */
const ADDED_MS = 4000;
const RESULT_LIMIT = 50;

type Row = { item: FoodItem; amount: Amount; recent?: boolean };

/** 음식 찾기: 끼니에 넣을 음식을 고른다. 줄을 누르면 양 창, +는 보이는 양으로 바로 추가. 추가해도 화면에 남는다. */
export default function FoodSearchScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const fmt = useDietFormat();
  // `q`: 처음 검색어. 화면에서는 쓰지 않고, 주소로 열어 확인할 때 쓴다(에뮬레이터에는 한글을 입력할 수 없다).
  const params = useLocalSearchParams<{ date?: string; meal?: string; q?: string }>();
  const date = params.date && parseDateKey(params.date) ? params.date : dateKey(new Date());
  const meal: Meal = MEALS.find((m) => m === params.meal) ?? 'snack';
  const mealName = fmt.meal(meal);

  const { db: foodDb, failed } = useFoodDb();
  const sources = useFoodSources();
  const { mine, recent, favorites } = useFoodLists();
  const [query, setQuery] = useState(params.q ?? '');
  const [tab, setTab] = useState<Tab>('recent');
  const [picked, setPicked] = useState<Row | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [added, setAdded] = useState<{ id: string; message: string } | null>(null);
  const [full, setFull] = useState(false);
  const addedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (addedTimer.current) clearTimeout(addedTimer.current);
    },
    [],
  );

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
        : mine.map((item) => ({ item, amount: defaultAmount(item) }));

  const showAdded = (id: string, item: FoodItem, amount: Amount) => {
    if (addedTimer.current) clearTimeout(addedTimer.current);
    setAdded({
      id,
      message: t('diet.search.added', {
        meal: mealName,
        name: item.name,
        amount: fmt.amount(amount, item.basis),
      }),
    });
    addedTimer.current = setTimeout(() => setAdded(null), ADDED_MS);
  };
  const add = (item: FoodItem, amount: Amount) => {
    const id = addFoodLog(db, { date, meal, item, amount });
    showAdded(id, item, amount);
  };
  const undo = () => {
    if (!added) return;
    if (addedTimer.current) clearTimeout(addedTimer.current);
    deleteFoodLog(db, added.id);
    setAdded(null);
  };

  const open = useCallback(
    (row: Row) => {
      Keyboard.dismiss();
      // 양 창에서는 고를 수 있는 단위를 모두 보여 준다(목록에는 기본 1회 양만 실려 있다).
      let item = row.item;
      if (item.src !== 'custom' && foodDb) {
        const full_ = loadCatalogItem(foodDb, item.src, item.sid);
        if (full_) item = { ...full_, units: mergeUnits(full_.units, row.amount) };
      }
      setPicked({ item, amount: row.amount });
      setSheetOpen(true);
    },
    [foodDb],
  );

  const create = (name: string | null = null) => {
    if (!canAddCustomFood(db)) return setFull(true);
    router.push({ pathname: '/food/[id]', params: { id: 'new', ...(name ? { name } : {}) } });
  };
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
  const loading = searching && !foodDb && !failed;

  return (
    <Screen
      avoidKeyboard
      dismissKeyboardOnDrag
      header={<TopBar title={t('diet.search.title', { meal: mealName })} />}
      footer={
        added ? (
          <Snackbar message={added.message} actionLabel={t('diet.search.undo')} onAction={undo} />
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
          {TABS.map((x) => (
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

      {rows.length > 0 ? (
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
            onCreate={() => create(name)}
          />
        )
      ) : (
        <Text style={styles.empty}>{t(`diet.search.empty.${tab}`)}</Text>
      )}

      <AmountSheet
        visible={sheetOpen}
        item={picked?.item ?? null}
        initial={picked?.amount ?? NO_AMOUNT}
        submitLabel={t('diet.amount.addTo', { meal: mealName })}
        onSubmit={(amount) => {
          if (picked) add(picked.item, amount);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
      <NoticeDialog
        visible={full}
        title={t('diet.search.limitTitle', { max: LIMITS.customFoods })}
        body={t('diet.search.limitBody')}
        okLabel={t('common.ok')}
        onClose={() => setFull(false)}
      />
    </Screen>
  );
}

const NO_AMOUNT = { grams: 100, unit: null } as const;

/** 지난번에 쓴 단위가 지금 목록에 없으면 앞에 끼워 넣는다 */
function mergeUnits(units: FoodItem['units'], amount: Amount) {
  const u = amount.unit;
  if (!u || units.some((x) => x.name === u.name && x.grams === u.grams)) return units;
  return [u, ...units];
}

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
