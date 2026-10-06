import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { BottomSheet, Button } from '@/components/ui';
import { SHEET_NEXT_MS } from '@/components/ui/use-sheet-motion';
import { type FoodSet, nutrientsFor, type SetItem, setTotal } from '@/domain/diet';
import type { FoodDb } from '@/food/catalog';
import { withAllUnits } from '@/food/full-item';

import { AmountSheet } from './amount-sheet';
import { useDietFormat } from './use-diet-format';

type Props = {
  visible: boolean;
  /** 닫히는 동안에도 내용이 남도록, 닫을 때 null로 바꾸지 않아도 된다 */
  set: FoodSet | null;
  mealName: string;
  foodDb: FoodDb | null;
  /** 지금 보이는 음식 · 양 그대로 넣는다 */
  onAdd: (items: SetItem[]) => void;
  onClose: () => void;
};

/**
 * 세트 미리 보기: 무엇이 들었는지 보고 끼니에 넣는다.
 * 음식 줄을 누르면 양 창이 떠서 이번에 넣을 양만 고치거나 뺄 수 있다(세트는 그대로).
 * 창 위에 창을 겹치지 않도록, 양 창을 띄우는 동안에는 이 창을 내려 두었다가 다시 올린다.
 */
export function SetPreviewSheet({ visible, set, mealName, foodDb, onAdd, onClose }: Props) {
  const { t } = useTranslation();
  const fmt = useDietFormat();
  const [items, setItems] = useState<SetItem[]>([]);
  const [editing, setEditing] = useState<{ index: number; entry: SetItem } | null>(null);
  const [amountOpen, setAmountOpen] = useState(false);
  // 양 창이 떠 있는 동안 미리 보기를 내려 둔다.
  const [parked, setParked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // 열 때마다 세트에 담긴 그대로 시작한다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: 열릴 때만 다시 맞춘다
  useEffect(() => {
    if (!visible || !set) return;
    setItems(set.items);
    setParked(false);
    setAmountOpen(false);
  }, [visible, set?.id]);

  if (!set) return null;
  const total = setTotal(items);

  const later = (fn: () => void) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(fn, SHEET_NEXT_MS);
  };
  const edit = (index: number) => {
    const entry = items[index];
    if (!entry) return;
    setEditing({
      index,
      entry: { ...entry, item: withAllUnits(entry.item, entry.amount.unit, foodDb) },
    });
    setParked(true);
    later(() => setAmountOpen(true));
  };
  const backToPreview = () => {
    setAmountOpen(false);
    later(() => setParked(false));
  };

  return (
    <>
      <BottomSheet
        visible={visible && !parked}
        title={set.name}
        titleLines={2}
        subtitle={`${t('diet.sets.count', { count: items.length })} · ${fmt.int(total.kcal)} kcal · ${t('diet.proteinShort', { n: fmt.int(total.protein) })}`}
        closeLabel={t('common.close')}
        onClose={onClose}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {items.map(({ item, amount }, i) => {
            const n = nutrientsFor(item, amount.grams);
            const sub = `${fmt.amount(amount, item.basis)} · ${t('diet.proteinShort', { n: fmt.int(n.protein) })}`;
            return (
              <Pressable
                // biome-ignore lint/suspicious/noArrayIndexKey: 같은 음식을 두 번 담을 수 있어 자리로 구분한다
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${sub}, ${fmt.int(n.kcal)} kcal`}
                accessibilityHint={t('diet.sets.itemHint')}
                onPress={() => edit(i)}
                style={({ pressed }) => [
                  styles.row,
                  i < items.length - 1 && styles.line,
                  pressed && styles.pressed,
                ]}
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
          })}
        </ScrollView>
        <Text style={styles.hint}>{t('diet.sets.previewHint')}</Text>
        <Button
          label={t('diet.sets.addN', { meal: mealName, count: items.length })}
          disabled={items.length === 0}
          onPress={() => onAdd(items)}
        />
      </BottomSheet>
      <AmountSheet
        visible={amountOpen}
        item={editing?.entry.item ?? null}
        initial={editing?.entry.amount ?? NO_AMOUNT}
        submitLabel={t('diet.sets.useAmount')}
        deleteLabel={t('diet.sets.remove')}
        onSubmit={(amount) => {
          if (editing)
            setItems((list) => list.map((it, i) => (i === editing.index ? { ...it, amount } : it)));
          backToPreview();
        }}
        onDelete={() => {
          if (editing) setItems((list) => list.filter((_, i) => i !== editing.index));
          backToPreview();
        }}
        onClose={backToPreview}
      />
    </>
  );
}

const NO_AMOUNT = { grams: 100, unit: null } as const;

const styles = StyleSheet.create((theme) => ({
  // 음식이 많아도 창이 화면을 넘지 않게 목록만 스크롤한다.
  scroll: { flexGrow: 0, maxHeight: 300 },
  list: {
    paddingVertical: 2,
    paddingLeft: 18,
    paddingRight: 16,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surface,
  },
  row: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 12 },
  line: { borderBottomWidth: 1, borderBottomColor: theme.colors.line },
  pressed: { opacity: 0.6 },
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
  hint: {
    paddingHorizontal: 4,
    fontSize: 12,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
}));
