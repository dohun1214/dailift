import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import {
  AppText,
  Card,
  Chip,
  ConfirmDialog,
  Screen,
  TextButton,
  TextField,
  TopBar,
} from '@/components/ui';
import { db } from '@/db/client';
import { createCustomFood, deleteCustomFood, getCustomFood, updateCustomFood } from '@/db/diet';
import { type CustomFoodInput, LIMITS, toPer100, trimNumber } from '@/domain/diet';
import { useAppLanguage } from '@/i18n/use-app-language';
import { setCreatedFood } from '@/lib/created-food';
import { object as objectJosa } from '@/lib/josa';
import { parseDecimal } from '@/lib/number';

/** 화면에서는 모두 글자로 들고 있다가 저장할 때 숫자로 바꾼다 */
type Draft = {
  name: string;
  per: CustomFoodInput['per'];
  serving: string;
  servingName: string;
  kcal: string;
  protein: string;
  carb: string;
  fat: string;
};
const KEYS = [
  'name',
  'per',
  'serving',
  'servingName',
  'kcal',
  'protein',
  'carb',
  'fat',
] as const satisfies readonly (keyof Draft)[];
const NUMBERS = ['kcal', 'protein', 'carb', 'fat'] as const;
const PERS: readonly CustomFoodInput['per'][] = ['serving', '100g'];

type Ask = { kind: 'delete' } | { kind: 'leave'; go: () => void };
type Problem = 'name' | 'serving' | 'range' | 'number' | null;

/** 음식 직접 만들기 · 고치기: 포장지의 영양성분표에 적힌 숫자를 그대로 넣는다 */
export default function CustomFoodScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const lang = useAppLanguage();
  const { id, name: presetName } = useLocalSearchParams<{ id: string; name?: string }>();
  const isNew = id === 'new';

  const initial = useMemo<Draft | null>(() => {
    if (isNew) {
      return {
        name: (presetName ?? '').slice(0, LIMITS.foodName),
        per: 'serving',
        serving: '',
        servingName: '',
        kcal: '',
        protein: '',
        carb: '',
        fat: '',
      };
    }
    const row = getCustomFood(db, id ?? '');
    if (!row) return null;
    // 저장은 100 g당이라, 1회 제공량이 있으면 넣었던 모양(1회 제공량당)으로 되돌려 보여 준다.
    const k = row.serving ? row.serving / 100 : 1;
    const show = (v: number) => trimNumber(Math.round(v * k * 10) / 10);
    return {
      name: row.name,
      per: row.serving ? 'serving' : '100g',
      serving: row.serving ? trimNumber(row.serving) : '',
      servingName: row.servingName ?? '',
      kcal: show(row.kcal),
      protein: show(row.protein),
      carb: show(row.carb),
      fat: show(row.fat),
    };
  }, [id, isNew, presetName]);
  const [draft, setDraft] = useState<Draft | null>(initial);
  const [problem, setProblem] = useState<Problem>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  // 닫히는 동안에도 내용이 남아 있도록 마지막으로 띄운 것을 기억한다.
  const [asked, setAsked] = useState<Ask | null>(null);
  // 저장 · 삭제 뒤 나갈 때는 나가기 확인을 건너뛴다(상태가 반영된 다음 렌더에서 뒤로 간다).
  const [leaving, setLeaving] = useState(false);

  // 새로 만들 때 검색어로 채운 이름은 '바꾼 것'으로 치지 않는다.
  const changed = initial !== null && draft !== null && KEYS.some((k) => initial[k] !== draft[k]);

  useEffect(() => {
    if (leaving) router.back();
  }, [leaving]);

  usePreventRemove(changed && !leaving, ({ data }) => {
    const next: Ask = { kind: 'leave', go: () => navigation.dispatch(data.action) };
    setAsked(next);
    setAsk(next);
  });

  if (!draft) {
    return (
      <Screen header={<TopBar leading="close" />}>
        <AppText tone="secondary">{t('diet.custom.notFound')}</AppText>
      </Screen>
    );
  }

  const update = (patch: Partial<Draft>) => {
    setProblem(null);
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };

  const save = () => {
    if (!draft.name.trim()) return setProblem('name');
    const values = NUMBERS.map((k) => (draft[k].trim() === '' ? 0 : parseDecimal(draft[k])));
    const serving = draft.per === 'serving' ? parseDecimal(draft.serving) : null;
    if (values.some((v) => v === null)) return setProblem('number');
    const [kcal, protein, carb, fat] = values as number[];
    const input: CustomFoodInput = {
      name: draft.name,
      per: draft.per,
      serving,
      servingName: draft.servingName,
      kcal: kcal ?? 0,
      protein: protein ?? 0,
      carb: carb ?? 0,
      fat: fat ?? 0,
    };
    const check = toPer100(input);
    if (!check.ok) return setProblem(check.error);
    if (isNew) {
      const created = createCustomFood(db, input);
      if (created) setCreatedFood(created);
    } else {
      updateCustomFood(db, id ?? '', input);
    }
    setLeaving(true);
  };

  const remove = () => {
    deleteCustomFood(db, id ?? '');
    setAsk(null);
    setLeaving(true);
  };

  const number = (key: (typeof NUMBERS)[number], unit: string) => (
    <TextField
      label={t(`diet.${key}`)}
      value={draft[key]}
      placeholder="0"
      unit={unit}
      keyboardType="decimal-pad"
      maxLength={6}
      invalid={
        problem === 'range' ||
        (problem === 'number' && parseDecimal(draft[key]) === null && draft[key].trim() !== '')
      }
      onChangeText={(v) => update({ [key]: v })}
    />
  );
  const savedName = initial?.name ?? '';

  return (
    <Screen
      avoidKeyboard
      dismissKeyboardOnDrag
      header={
        <TopBar
          title={t(isNew ? 'diet.custom.titleNew' : 'diet.custom.title')}
          leading="close"
          trailing={<TextButton label={t('common.save')} onPress={save} />}
        />
      }
    >
      <Card style={styles.first}>
        <TextField
          label={t('diet.custom.name')}
          value={draft.name}
          placeholder={t('diet.custom.namePlaceholder')}
          maxLength={LIMITS.foodName}
          error={problem === 'name' ? t('diet.custom.nameRequired') : undefined}
          onChangeText={(name) => update({ name })}
        />
      </Card>

      <Card>
        <View style={styles.group}>
          <Text style={styles.groupTitle} accessibilityRole="header">
            {t('diet.custom.per')}
          </Text>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {PERS.map((x) => (
              <Chip
                key={x}
                tone="raised"
                label={t(x === 'serving' ? 'diet.custom.perServing' : 'diet.custom.per100')}
                selected={draft.per === x}
                accessibilityRole="radio"
                accessibilityState={{ checked: draft.per === x }}
                onPress={() => update({ per: x })}
              />
            ))}
          </View>
        </View>
        {draft.per === 'serving' ? (
          <View style={styles.pair}>
            <TextField
              label={t('diet.custom.serving')}
              value={draft.serving}
              placeholder="0"
              unit="g"
              keyboardType="decimal-pad"
              maxLength={6}
              invalid={problem === 'serving'}
              onChangeText={(serving) => update({ serving })}
            />
            <TextField
              label={t('diet.custom.servingName')}
              value={draft.servingName}
              placeholder={t('diet.custom.servingNamePlaceholder')}
              maxLength={LIMITS.servingName}
              onChangeText={(servingName) => update({ servingName })}
            />
          </View>
        ) : null}
        {problem === 'serving' ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {t('diet.custom.servingRequired')}
          </Text>
        ) : null}
      </Card>

      <Card>
        <View style={styles.pair}>
          {number('kcal', 'kcal')}
          {number('protein', 'g')}
        </View>
        <View style={styles.pair}>
          {number('carb', 'g')}
          {number('fat', 'g')}
        </View>
        {problem === 'range' || problem === 'number' ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {t(problem === 'range' ? 'diet.custom.range' : 'diet.custom.number')}
          </Text>
        ) : null}
      </Card>

      <Text style={styles.note}>{t('diet.custom.note')}</Text>

      {isNew ? null : (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setAsked({ kind: 'delete' });
            setAsk({ kind: 'delete' });
          }}
          style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
        >
          <Text style={styles.deleteText}>{t('diet.custom.delete')}</Text>
        </Pressable>
      )}

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
          title={t('diet.custom.deleteTitle', {
            name: lang === 'ko' ? objectJosa(savedName) : savedName,
          })}
          body={t('diet.custom.deleteBody')}
          cancelLabel={t('diet.cancel')}
          confirmLabel={t('diet.custom.deleteConfirm')}
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
  groupTitle: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  chips: { flexDirection: 'row', gap: 6 },
  pair: { flexDirection: 'row', gap: 10 },
  error: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.danger,
  },
  note: {
    paddingHorizontal: 6,
    fontSize: 12,
    lineHeight: 19,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  pressed: { opacity: 0.7 },
  delete: { height: 48, alignItems: 'center', justifyContent: 'center' },
  deleteText: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.danger,
  },
}));
