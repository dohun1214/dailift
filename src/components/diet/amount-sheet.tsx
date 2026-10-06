import { Delete, Star } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { BottomSheet, Button, Chip } from '@/components/ui';
import { db } from '@/db/client';
import { isFavorite, setFavorite } from '@/db/diet';
import {
  type Amount,
  amountText,
  type FoodItem,
  type FoodUnit,
  nutrientsFor,
  parseAmount,
  pressKey,
  sameUnit,
} from '@/domain/diet';

import { useDietFormat } from './use-diet-format';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const;

type Props = {
  visible: boolean;
  /** 닫히는 동안에도 내용이 남도록, 닫을 때 null로 바꾸지 않아도 된다 */
  item: FoodItem | null;
  /** 처음 보여 줄 양 */
  initial: Amount;
  /** 주요 버튼 글자: "점심에 추가" 또는 "저장" */
  submitLabel: string;
  onSubmit: (amount: Amount) => void;
  /** 있으면 '삭제' 버튼을 같이 보여 준다(적은 음식을 고칠 때) */
  onDelete?: () => void;
  /** 삭제 버튼 글자. 기본은 '삭제', 세트에서는 '빼기' */
  deleteLabel?: string;
  onClose: () => void;
};

/**
 * 음식의 양 넣기: 큰 숫자 + 단위 고르기(g 또는 1회 양) + 그 양의 영양값 + 숫자판.
 * 기기 키보드 대신 창 안의 숫자판을 쓴다(아래에서 올라오는 창과 키보드가 겹치지 않게).
 */
export function AmountSheet({
  visible,
  item,
  initial,
  submitLabel,
  onSubmit,
  onDelete,
  deleteLabel,
  onClose,
}: Props) {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const fmt = useDietFormat();
  const [text, setText] = useState(() => amountText(initial));
  const [unit, setUnit] = useState<FoodUnit | null>(initial.unit);
  // 처음 한 번은 누른 숫자가 보이던 값을 갈아 치운다(지우지 않고 바로 새 양을 넣을 수 있게).
  const [fresh, setFresh] = useState(true);
  const [favorite, setFav] = useState(false);

  // 열릴 때마다 그 음식의 처음 양으로 맞춘다.
  // biome-ignore lint/correctness/useExhaustiveDependencies: 열릴 때만 다시 맞춘다
  useEffect(() => {
    if (!visible || !item) return;
    setText(amountText(initial));
    setUnit(initial.unit);
    setFresh(true);
    setFav(isFavorite(db, item.src, item.sid));
  }, [visible, item?.src, item?.sid]);

  if (!item) return null;
  const basis = item.basis;
  const amount = parseAmount(text, unit);
  const n = amount ? nutrientsFor(item, amount.grams) : null;
  const decimals = unit ? 2 : 1;

  const press = (key: string) => {
    setText((cur) => pressKey(fresh && key !== 'back' ? '' : cur, key, decimals));
    setFresh(false);
  };
  const pickUnit = (next: FoodUnit | null) => {
    if (sameUnit(next, unit)) return;
    // 단위를 바꾸면: 1회 양 단위는 1개부터, g은 지금 양 그대로
    setText(next ? '1' : amount ? amountText({ grams: amount.grams, unit: null }) : '100');
    setUnit(next);
    setFresh(true);
  };
  const toggleFavorite = () => {
    setFavorite(db, item.src, item.sid, !favorite);
    setFav(!favorite);
  };

  const cell = (label: string, value: number | null, unitLabel: string) => (
    <View style={styles.cell}>
      <Text style={styles.cellLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text style={styles.cellValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value === null ? '–' : fmt.int(value)}
        <Text style={styles.cellUnit}> {unitLabel}</Text>
      </Text>
    </View>
  );

  return (
    <BottomSheet
      visible={visible}
      title={item.name}
      titleLines={2}
      subtitle={t('diet.amount.source', {
        source: fmt.source(item.src),
        basis,
        kcal: fmt.int(item.kcal),
      })}
      closeLabel={t('common.close')}
      onClose={onClose}
      headerRight={
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('diet.amount.favorite')}
          accessibilityState={{ selected: favorite }}
          onPress={toggleFavorite}
          style={({ pressed }) => [styles.star, pressed && styles.pressed]}
        >
          <Star
            size={20}
            color={favorite ? theme.colors.text : theme.colors.text2}
            fill={favorite ? theme.colors.text : 'transparent'}
            strokeWidth={1.8}
          />
        </Pressable>
      }
    >
      <View
        style={styles.big}
        accessible
        accessibilityLiveRegion="polite"
        accessibilityLabel={amount ? fmt.amount(amount, basis) : t('diet.amount.empty')}
      >
        <View style={styles.bigRow}>
          <Text style={[styles.bigValue, text === '' && styles.bigEmpty]}>{text || '0'}</Text>
          <Text style={styles.bigUnit}>{unit ? fmt.unitSuffix(unit) : basis}</Text>
        </View>
        {unit ? (
          <Text style={styles.equals}>
            {amount ? t('diet.amount.equals', { n: fmt.num(amount.grams), basis }) : ' '}
          </Text>
        ) : null}
      </View>

      {item.units.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          style={styles.unitsScroll}
          contentContainerStyle={styles.units}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('diet.amount.unitA11y')}
        >
          <Chip
            label={basis}
            selected={unit === null}
            accessibilityRole="radio"
            accessibilityState={{ checked: unit === null }}
            onPress={() => pickUnit(null)}
          />
          {item.units.map((u) => (
            <Chip
              key={`${u.name}:${u.grams}`}
              label={fmt.unitChip(u, basis)}
              selected={sameUnit(u, unit)}
              accessibilityRole="radio"
              accessibilityState={{ checked: sameUnit(u, unit) }}
              onPress={() => pickUnit(u)}
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.macros}>
        {cell(t('diet.kcal'), n?.kcal ?? null, 'kcal')}
        {cell(t('diet.protein'), n?.protein ?? null, 'g')}
        {cell(t('diet.carb'), n?.carb ?? null, 'g')}
        {cell(t('diet.fat'), n?.fat ?? null, 'g')}
      </View>

      <View style={styles.pad}>
        {KEYS.map((key) => (
          <Pressable
            key={key}
            accessibilityRole="button"
            accessibilityLabel={key === 'back' ? t('diet.amount.keyBack') : key}
            onPress={() => press(key)}
            style={({ pressed }) => [styles.key, pressed && styles.keyPressed]}
          >
            {key === 'back' ? (
              <Delete size={22} color={theme.colors.text} strokeWidth={1.8} />
            ) : (
              <Text style={styles.keyText}>{key}</Text>
            )}
          </Pressable>
        ))}
      </View>

      {onDelete ? (
        <View style={styles.buttons}>
          <Pressable
            accessibilityRole="button"
            onPress={onDelete}
            style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
          >
            <Text style={styles.deleteText}>{deleteLabel ?? t('diet.amount.delete')}</Text>
          </Pressable>
          <View style={styles.submit}>
            <Button
              label={submitLabel}
              disabled={!amount}
              onPress={() => amount && onSubmit(amount)}
            />
          </View>
        </View>
      ) : (
        <Button label={submitLabel} disabled={!amount} onPress={() => amount && onSubmit(amount)} />
      )}
    </BottomSheet>
  );
}

const styles = StyleSheet.create((theme) => ({
  star: {
    width: theme.hitSize,
    height: theme.hitSize,
    marginTop: 4,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  pressed: { opacity: 0.6 },
  big: { alignItems: 'center', gap: 2, paddingVertical: 2 },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  bigValue: {
    fontSize: 40,
    lineHeight: 46,
    letterSpacing: -0.4,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  bigEmpty: { color: theme.colors.prefill },
  bigUnit: {
    flexShrink: 1,
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text2,
  },
  equals: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.numRegular,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  // 칩이 적으면 가운데, 많으면 옆으로 밀어 본다(창의 좌우 여백까지 넘겨 쓴다).
  unitsScroll: { flexGrow: 0, marginHorizontal: -16 },
  units: { flexGrow: 1, justifyContent: 'center', gap: 6, paddingHorizontal: 16 },
  macros: {
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
  pad: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  key: {
    // 한 줄에 셋: (전체 − 간격 둘) / 3
    flexBasis: '30%',
    flexGrow: 1,
    height: 48,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  keyPressed: { backgroundColor: theme.colors.track },
  keyText: {
    fontSize: 20,
    lineHeight: 26,
    includeFontPadding: false,
    fontFamily: theme.fonts.numSemibold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  buttons: { flexDirection: 'row', gap: 8 },
  submit: { flex: 2 },
  delete: {
    flex: 1,
    height: 56,
    borderRadius: theme.radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
  },
  deleteText: {
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.danger,
  },
}));
