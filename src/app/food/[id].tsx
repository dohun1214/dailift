import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Pressable, Share, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { SheetScanCard, type SheetScanState } from '@/components/body/sheet-scan-card';
import {
  ActionSheet,
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
import { type LabelResult, labelCount } from '@/domain/nutrition-label';
import { useAppLanguage } from '@/i18n/use-app-language';
import { setCreatedFood } from '@/lib/created-food';
import { object as objectJosa } from '@/lib/josa';
import { labelScanAvailable, readLabel } from '@/lib/label-scan';
import { parseDecimal } from '@/lib/number';
import { discardSheet, pickSheet, type SheetSource } from '@/lib/sheet-scan';

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

  // 성분표 사진으로 채우기
  const [scan, setScan] = useState<SheetScanState>({ kind: 'idle' });
  /** 성분표에서 읽어 채운 칸(고치면 빠진다) */
  const [read, setRead] = useState<readonly (keyof Draft)[]>([]);
  const [scanNote, setScanNote] = useState<string | null>(null);
  const [scanFailed, setScanFailed] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const scanning = useRef(false);
  const labelUri = useRef<string | null>(null);
  const rawText = useRef<string | null>(null);
  // 성분표 사진은 보관하지 않는다 — 화면을 나갈 때 임시 파일을 지운다(읽는 중에 나가면 읽기가 끝난 뒤에).
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
      discardSheet(labelUri.current);
    },
    [],
  );

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
    setRead((r) => r.filter((k) => !(k in patch)));
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };

  /** 읽은 값을 칸에 채운다. 영양소를 하나도 못 읽었으면 아무것도 바꾸지 않고 false */
  const applyLabel = (uri: string, result: LabelResult): boolean => {
    const found = NUMBERS.filter((k) => result.values[k] !== undefined);
    if (found.length === 0) return false;
    const patch: Partial<Draft> = {};
    for (const k of found) patch[k] = trimNumber(result.values[k] ?? 0);
    const unitName = t('diet.scan.oneUnit');
    if (result.basis === '100g') patch.per = '100g';
    else if (result.basis) {
      patch.per = 'serving';
      if (result.serving !== null) patch.serving = trimNumber(result.serving);
      const name = result.basis === 'total' ? unitName : result.servingName;
      if (name) patch.servingName = name.slice(0, LIMITS.servingName);
    }
    const filled = Object.keys(patch) as (keyof Draft)[];
    // 앞서 다른 사진에서 읽어 둔 칸은 비운다(기준은 그대로 둔다).
    for (const key of read) if (key !== 'per' && !(key in patch)) patch[key] = '';

    const g = result.serving !== null ? trimNumber(result.serving) : '';
    const notes = [
      result.basis === '100g'
        ? t('diet.scan.note.per100')
        : result.basis === 'total' && g
          ? t('diet.scan.note.total', { g, name: unitName })
          : result.basis === 'serving' && g
            ? t('diet.scan.note.serving', { g })
            : t('diet.scan.note.noBasis'),
    ];
    if (result.ml) notes.push(t('diet.scan.note.ml'));
    if (!draft.name.trim()) notes.push(t('diet.scan.note.name'));

    setProblem(null);
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setRead(filled);
    setScanNote(notes.join(' '));
    setScan({ kind: 'done', uri, count: labelCount(result) });
    return true;
  };

  const scanLabel = async (source: SheetSource) => {
    // 선택 창이 떠 있거나 읽는 동안에는 한 번 더 열지 않는다.
    if (scanning.current) return;
    scanning.current = true;
    // 새 사진을 못 읽으면 앞서 읽은 것을 그대로 둔다.
    const before = scan;
    let picked: string | null = null;
    try {
      const pick = await pickSheet(source);
      if (pick === 'denied') {
        Alert.alert(t('summary.cameraDeniedTitle'), t('summary.cameraDenied'), [
          { text: t('common.close'), style: 'cancel' },
          { text: t('summary.openSettings'), onPress: () => void Linking.openSettings() },
        ]);
        return;
      }
      if (!pick) return;
      picked = pick;
      setScan({ kind: 'reading', uri: pick });
      const { result, raw } = await readLabel(pick);
      // 읽는 사이에 화면을 나갔으면 사진만 지운다.
      if (!alive.current) return discardSheet(pick);
      if (!applyLabel(pick, result)) throw new Error('no values found');
      rawText.current = JSON.stringify(raw, (_, v) =>
        typeof v === 'number' ? Math.round(v * 10000) / 10000 : v,
      );
      if (labelUri.current !== pick) discardSheet(labelUri.current);
      labelUri.current = pick;
    } catch (e) {
      console.warn('[label] read failed', e);
      if (picked !== labelUri.current) discardSheet(picked);
      if (!alive.current) return;
      setScan(before.kind === 'done' ? before : { kind: 'idle' });
      setScanFailed(true);
    } finally {
      scanning.current = false;
    }
  };

  const save = () => {
    if (leaving) return;
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

  const mark = (key: keyof Draft) => (read.includes(key) ? t('diet.scan.mark') : undefined);
  const number = (key: (typeof NUMBERS)[number], unit: string) => (
    <TextField
      label={t(`diet.${key}`)}
      value={draft[key]}
      placeholder="0"
      unit={unit}
      keyboardType="decimal-pad"
      maxLength={6}
      mark={mark(key)}
      invalid={
        problem === 'range' ||
        (problem === 'number' && parseDecimal(draft[key]) === null && draft[key].trim() !== '')
      }
      onChangeText={(v) => update({ [key]: v })}
    />
  );
  const savedName = initial?.name ?? '';
  const showScan = isNew && labelScanAvailable;

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
      {showScan ? (
        <View style={styles.first}>
          <SheetScanCard
            kind="label"
            state={scan}
            onPick={(source) => void scanLabel(source)}
            onAgain={() => setSourceOpen(true)}
            onShareRaw={() => {
              if (rawText.current) void Share.share({ message: rawText.current });
            }}
          />
        </View>
      ) : null}

      <Card style={showScan ? undefined : styles.first}>
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
          <View style={styles.titleRow}>
            <Text style={styles.groupTitle} accessibilityRole="header">
              {t('diet.custom.per')}
            </Text>
            {read.includes('per') ? (
              <View accessible accessibilityLabel={t('diet.scan.mark')} style={styles.mark} />
            ) : null}
          </View>
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
              mark={mark('serving')}
              invalid={problem === 'serving'}
              onChangeText={(serving) => update({ serving })}
            />
            <TextField
              label={t('diet.custom.servingName')}
              value={draft.servingName}
              placeholder={t('diet.custom.servingNamePlaceholder')}
              maxLength={LIMITS.servingName}
              mark={mark('servingName')}
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

      <Text style={styles.note}>{scanNote ?? t('diet.custom.note')}</Text>

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

      <ActionSheet
        visible={sourceOpen}
        cancelLabel={t('diet.cancel')}
        onClose={() => setSourceOpen(false)}
        actions={[
          {
            label: t('body.scan.camera'),
            afterClose: true,
            onPress: () => void scanLabel('camera'),
          },
          {
            label: t('body.scan.library'),
            afterClose: true,
            onPress: () => void scanLabel('library'),
          },
        ]}
      />
      <ConfirmDialog
        visible={scanFailed}
        title={t('diet.scan.failTitle')}
        body={t('diet.scan.failBody')}
        cancelLabel={t('common.close')}
        confirmLabel={t('body.scan.again')}
        onCancel={() => setScanFailed(false)}
        onConfirm={() => {
          setScanFailed(false);
          setSourceOpen(true);
        }}
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
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  groupTitle: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  mark: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.accent },
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
