import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { ChevronDown } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Linking, Pressable, Share, Text, View } from 'react-native';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import { SheetScanCard, type SheetScanState } from '@/components/body/sheet-scan-card';
import { useBodyFormat } from '@/components/body/use-body-format';
import { DateSheet } from '@/components/diet/date-sheet';
import {
  ActionSheet,
  AppText,
  Card,
  ConfirmDialog,
  Screen,
  TextButton,
  TextField,
  TopBar,
} from '@/components/ui';
import {
  createBodyEntry,
  deleteBodyEntry,
  getBodyEntry,
  listBodyEntries,
  updateBodyEntry,
} from '@/db/body';
import { db } from '@/db/client';
import {
  BODY_EXTRA_KEYS,
  type BodyExtraKey,
  type BodyExtras,
  type BodyField,
  bodyIssues,
  bodyMass,
  bodyRange,
  EXTRA_GROUPS,
  fatMass,
  INTEGER_EXTRAS,
  MASS_EXTRAS,
  proteinChange,
} from '@/domain/body';
import { dateKey, parseDateKey } from '@/domain/date-key';
import type { SheetField, SheetResult } from '@/domain/inbody';
import { parseDecimal } from '@/lib/number';
import {
  discardSheet,
  pickSheet,
  readSheet,
  type SheetSource,
  sheetScanAvailable,
} from '@/lib/sheet-scan';
import { useBodyAsk } from '@/stores/body-ask';
import { useDietGoals } from '@/stores/diet-goals';
import { useProfile } from '@/stores/profile';
import { useSettings } from '@/stores/settings';

type Draft = { date: string; weight: string; muscle: string; fat: string } & Record<
  BodyExtraKey,
  string
>;
type Ask = { kind: 'delete' } | { kind: 'leave'; go: () => void };
/** 결과지의 값 이름 → 이 화면의 칸 */
const SHEET_TO_DRAFT: Record<SheetField, Exclude<keyof Draft, 'date'>> = {
  weight: 'weight',
  muscle: 'muscle',
  fat: 'fat',
  bmi: 'bmi',
  bmr: 'bmr',
  visceralFat: 'visceralFat',
  whr: 'whr',
  water: 'water',
  protein: 'protein',
  mineral: 'mineral',
};
/** 결과지는 kg로 찍힌다. 무게인 칸은 지금 단위로 바꿔서 채운다 */
const SHEET_MASS: readonly SheetField[] = ['weight', 'muscle', 'protein', 'mineral'];

const text = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));
const EMPTY_EXTRAS = Object.fromEntries(BODY_EXTRA_KEYS.map((k) => [k, ''])) as Record<
  BodyExtraKey,
  string
>;
/** 빈 칸은 null, 숫자가 아니면 NaN(범위 검사에서 걸린다) */
const parse = (s: string) => (s.trim() === '' ? null : (parseDecimal(s) ?? Number.NaN));

/**
 * 체성분 기록 추가 · 고치기: 날짜, 체중 · 골격근량 · 체지방률, 펼쳐서 적는 나머지 값, 삭제.
 * 새 기록은 인바디 결과지 사진을 읽어 채울 수 있다(글자 읽기 모듈이 있는 빌드에서만).
 */
export default function BodyEntryScreen() {
  const { t } = useTranslation();
  const { theme } = useUnistyles();
  const navigation = useNavigation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const unit = useSettings((s) => s.weightUnit);
  const fmt = useBodyFormat(unit);
  const [today] = useState(() => dateKey(new Date()));

  const entry = useMemo(() => (isNew ? null : getBodyEntry(db, id ?? '')), [id, isNew]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: 화면을 열 때의 값으로 한 번만 만든다
  const initial = useMemo<Draft | null>(() => {
    if (isNew) return { date: today, weight: '', muscle: '', fat: '', ...EMPTY_EXTRAS };
    if (!entry) return null;
    // 저장된 단위가 지금 설정과 다르면 바꿔서 보여 준다.
    const mass = (n: number | null | undefined) =>
      n === null || n === undefined ? '' : String(bodyMass(n, entry.weightUnit, unit));
    const extras = { ...EMPTY_EXTRAS };
    for (const key of BODY_EXTRA_KEYS) {
      extras[key] = MASS_EXTRAS.includes(key) ? mass(entry.extras[key]) : text(entry.extras[key]);
    }
    return {
      date: dateKey(new Date(entry.measuredAt)),
      weight: mass(entry.weight),
      muscle: mass(entry.skeletalMuscle),
      fat: text(entry.bodyFatPct),
      ...extras,
    };
  }, []);
  const [draft, setDraft] = useState<Draft | null>(initial);
  const [moreOpen, setMoreOpen] = useState(
    () => initial !== null && BODY_EXTRA_KEYS.some((k) => initial[k] !== ''),
  );
  const [bad, setBad] = useState<readonly BodyField[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dateOpen, setDateOpen] = useState(false);
  const [ask, setAsk] = useState<Ask | null>(null);
  // 닫히는 동안에도 내용이 남아 있도록 마지막으로 띄운 것을 기억한다.
  const [asked, setAsked] = useState<Ask | null>(null);
  // 저장 · 삭제 뒤 나갈 때는 나가기 확인을 건너뛴다(상태가 반영된 다음 렌더에서 뒤로 간다).
  const [leaving, setLeaving] = useState(false);

  // 결과지 사진으로 채우기
  const [scan, setScan] = useState<SheetScanState>({ kind: 'idle' });
  /** 결과지에서 읽어 채운 칸(고치면 빠진다) */
  const [read, setRead] = useState<readonly (keyof Draft)[]>([]);
  const [scanNote, setScanNote] = useState<'date' | 'noDate' | null>(null);
  const [scanFailed, setScanFailed] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  const scanning = useRef(false);
  const sheetUri = useRef<string | null>(null);
  const rawText = useRef<string | null>(null);
  // 결과지 사진은 보관하지 않는다 — 화면을 나갈 때 임시 파일을 지운다.
  useEffect(() => () => discardSheet(sheetUri.current), []);

  const changed =
    initial !== null &&
    draft !== null &&
    (Object.keys(initial) as (keyof Draft)[]).some((k) => initial[k] !== draft[k]);
  useEffect(() => {
    if (leaving) router.back();
  }, [leaving]);
  usePreventRemove(changed && !leaving, ({ data }) => {
    const next: Ask = { kind: 'leave', go: () => navigation.dispatch(data.action) };
    setAsked(next);
    setAsk(next);
  });

  // 달력에 점을 찍을 날: 체성분을 적은 날(창을 열 때 읽는다)
  // biome-ignore lint/correctness/useExhaustiveDependencies: 창을 열 때마다 다시 읽는다
  const loggedDays = useMemo(
    () => new Set(listBodyEntries(db).map((e) => dateKey(new Date(e.measuredAt)))),
    [dateOpen],
  );

  if (!draft) {
    return (
      <Screen header={<TopBar />}>
        <AppText tone="secondary">{t('body.none')}</AppText>
      </Screen>
    );
  }

  const update = (patch: Partial<Draft>) => {
    setBad([]);
    setError(null);
    setRead((r) => r.filter((k) => !(k in patch)));
    setDraft((d) => (d ? { ...d, ...patch } : d));
  };

  const weight = parse(draft.weight);
  const fat = parse(draft.fat);
  const computedFat =
    weight !== null && fat !== null && Number.isFinite(weight) && Number.isFinite(fat)
      ? fatMass(weight, fat)
      : null;
  const day = parseDateKey(draft.date) ?? new Date();
  const dateLabel = fmt.day(
    new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).getTime(),
  );

  /** 읽은 값을 칸에 채운다. 하나도 못 읽었으면 아무것도 바꾸지 않고 false */
  const applySheet = (uri: string, result: SheetResult): boolean => {
    const patch: Partial<Draft> = {};
    for (const [field, value] of Object.entries(result.values) as [SheetField, number][]) {
      patch[SHEET_TO_DRAFT[field]] = String(
        SHEET_MASS.includes(field) ? bodyMass(value, 'kg', unit) : value,
      );
    }
    const filled = Object.keys(patch) as (keyof Draft)[];
    if (filled.length === 0) return false;
    // 앞서 다른 사진에서 읽어 둔 칸은 비운다.
    for (const key of read) if (key !== 'date' && !(key in patch)) patch[key] = '';
    if (result.date) patch.date = result.date;
    setBad([]);
    setError(null);
    setDraft((d) => (d ? { ...d, ...patch } : d));
    setRead(result.date ? [...filled, 'date'] : filled);
    setScanNote(result.date ? 'date' : 'noDate');
    if (filled.some((k) => BODY_EXTRA_KEYS.includes(k as BodyExtraKey))) setMoreOpen(true);
    setScan({ kind: 'done', uri, count: filled.length });
    return true;
  };

  const scanSheet = async (source: SheetSource) => {
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
      const { result, raw } = await readSheet(pick, today);
      if (!applySheet(pick, result)) throw new Error('no values found');
      rawText.current = JSON.stringify(raw, (_, v) =>
        typeof v === 'number' ? Math.round(v * 10000) / 10000 : v,
      );
      if (sheetUri.current !== pick) discardSheet(sheetUri.current);
      sheetUri.current = pick;
    } catch (e) {
      console.warn('[sheet] read failed', e);
      if (picked !== sheetUri.current) discardSheet(picked);
      setScan(before.kind === 'done' ? before : { kind: 'idle' });
      setScanFailed(true);
    } finally {
      scanning.current = false;
    }
  };

  const save = () => {
    const extras: BodyExtras = {};
    for (const key of BODY_EXTRA_KEYS) {
      const v = parse(draft[key]);
      if (v !== null) extras[key] = v;
    }
    const input = { weight, skeletalMuscle: parse(draft.muscle), bodyFatPct: fat, extras };
    const issues = bodyIssues(input, unit);
    if (issues === 'empty') return setError(t('body.form.errorEmpty'));
    if (issues.length > 0) {
      setBad(issues);
      // 골격근량만 걸렸고 값 자체는 범위 안이면 체중보다 큰 경우다.
      const r = bodyRange('muscle', unit);
      const m = input.skeletalMuscle;
      const overWeight =
        issues.length === 1 && issues[0] === 'muscle' && m !== null && m >= r.min && m <= r.max;
      if (issues.some((f) => BODY_EXTRA_KEYS.includes(f as BodyExtraKey))) setMoreOpen(true);
      return setError(t(overWeight ? 'body.form.errorMuscle' : 'body.form.errorRange'));
    }

    // 날짜를 그대로 뒀으면 잰 시각도 그대로, 오늘이면 지금, 지난 날이면 그날 낮 12시로 둔다.
    const keep = entry && dateKey(new Date(entry.measuredAt)) === draft.date;
    const measuredAt = keep
      ? entry.measuredAt
      : draft.date === today
        ? Date.now()
        : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12).getTime();
    let savedId = id ?? '';
    if (isNew) {
      savedId = createBodyEntry(
        db,
        input,
        unit,
        measuredAt,
        undefined,
        read.length > 0 ? 'ocr' : 'manual',
      );
    } else updateBodyEntry(db, savedId, input, unit, measuredAt);

    // 가장 최근 체중을 고쳤으면 프로필 몸무게(단백질 목표 계산)에 반영한다 — 목표가 달라지면 먼저 묻는다.
    const latest = listBodyEntries(db)
      .filter((e) => e.weight !== null)
      .at(-1);
    if (latest?.id === savedId && input.weight !== null) {
      const profile = useProfile.getState();
      const same = profile.weight === input.weight && profile.weightUnit === unit;
      const change = proteinChange(
        { weight: profile.weight, unit: profile.weightUnit },
        { weight: input.weight, unit },
        profile.goal,
        useDietGoals.getState(),
      );
      if (change) {
        useBodyAsk.getState().askProtein({
          weight: input.weight,
          unit,
          from: change.from,
          to: change.to,
          fromWeight:
            profile.weight === null ? null : `${fmt.num(profile.weight)} ${profile.weightUnit}`,
          toWeight: `${fmt.num(input.weight)} ${unit}`,
        });
      } else if (!same) profile.setWeight(input.weight, unit);
    }
    setLeaving(true);
  };

  const remove = () => {
    deleteBodyEntry(db, id ?? '');
    setAsk(null);
    setLeaving(true);
  };
  const openAsk = (next: Ask) => {
    setAsked(next);
    setAsk(next);
  };

  // 오류 문구는 틀린 칸이 있는 카드에 보여 준다(펼친 칸이 길어 위 카드가 화면 밖일 수 있다).
  const extraBad = bad.some((f) => BODY_EXTRA_KEYS.includes(f as BodyExtraKey));
  const extraUnit = (key: BodyExtraKey) =>
    MASS_EXTRAS.includes(key) ? unit : key === 'bmr' ? 'kcal' : key === 'water' ? 'L' : undefined;
  const extraField = (key: BodyExtraKey) => (
    <TextField
      key={key}
      label={t(`body.form.extra.${key}`)}
      mark={read.includes(key) ? t('body.scan.mark') : undefined}
      value={draft[key]}
      placeholder="0"
      unit={extraUnit(key)}
      keyboardType={INTEGER_EXTRAS.includes(key) ? 'number-pad' : 'decimal-pad'}
      maxLength={6}
      invalid={bad.includes(key)}
      onChangeText={(v) => update({ [key]: v } as Partial<Draft>)}
    />
  );
  /** 두 칸씩 한 줄. 홀수면 마지막 줄의 오른쪽은 비워 둔다 */
  const rows = (keys: readonly BodyExtraKey[]) => {
    const out = [];
    for (let i = 0; i < keys.length; i += 2) {
      const a = keys[i];
      const b = keys[i + 1];
      if (!a) continue;
      out.push(
        <View key={a} style={styles.pair}>
          {extraField(a)}
          {b ? extraField(b) : <View style={styles.flex} />}
        </View>,
      );
    }
    return out;
  };

  return (
    <Screen
      avoidKeyboard
      dismissKeyboardOnDrag
      header={
        <TopBar
          title={t(isNew ? 'body.form.newTitle' : 'body.form.editTitle')}
          trailing={<TextButton label={t('common.save')} onPress={save} />}
        />
      }
    >
      {isNew && sheetScanAvailable ? (
        <View style={styles.first}>
          <SheetScanCard
            state={scan}
            onPick={(source) => void scanSheet(source)}
            onAgain={() => setSourceOpen(true)}
            onShareRaw={() => {
              if (rawText.current) void Share.share({ message: rawText.current });
            }}
          />
        </View>
      ) : null}

      <Card style={isNew && sheetScanAvailable ? undefined : styles.first} padding="md">
        <View style={styles.group}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>{t('body.form.date')}</Text>
            {read.includes('date') ? (
              <View accessible accessibilityLabel={t('body.scan.mark')} style={styles.mark} />
            ) : null}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${t('body.form.date')}, ${dateLabel}`}
            onPress={() => setDateOpen(true)}
            style={({ pressed }) => [styles.dateField, pressed && styles.pressed]}
          >
            <Text style={styles.dateText}>{dateLabel}</Text>
            <ChevronDown size={18} color={theme.colors.text2} strokeWidth={1.8} />
          </Pressable>
        </View>
        <View style={styles.pair}>
          <TextField
            label={t('body.metric.weight')}
            mark={read.includes('weight') ? t('body.scan.mark') : undefined}
            value={draft.weight}
            placeholder="0"
            unit={unit}
            keyboardType="decimal-pad"
            maxLength={5}
            invalid={bad.includes('weight')}
            onChangeText={(v) => update({ weight: v })}
          />
          <TextField
            label={t('body.metric.muscle')}
            mark={read.includes('muscle') ? t('body.scan.mark') : undefined}
            value={draft.muscle}
            placeholder="0"
            unit={unit}
            keyboardType="decimal-pad"
            maxLength={5}
            invalid={bad.includes('muscle')}
            onChangeText={(v) => update({ muscle: v })}
          />
        </View>
        <View style={styles.pair}>
          <TextField
            label={t('body.metric.fat')}
            mark={read.includes('fat') ? t('body.scan.mark') : undefined}
            value={draft.fat}
            placeholder="0"
            unit="%"
            keyboardType="decimal-pad"
            maxLength={4}
            invalid={bad.includes('fat')}
            onChangeText={(v) => update({ fat: v })}
          />
          <View style={[styles.flex, styles.group]}>
            <Text style={styles.label}>{t('body.form.fatMass')}</Text>
            <View style={styles.auto} accessible accessibilityLiveRegion="polite">
              <Text style={styles.autoText}>
                {computedFat === null
                  ? t('body.form.fatMassNone')
                  : `${fmt.num(computedFat)} ${unit}`}
              </Text>
            </View>
          </View>
        </View>
        {error && !extraBad ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </Card>

      <Text style={styles.hint}>
        {scanNote ? t(`body.scan.note.${scanNote}`) : t('body.form.hint')}
      </Text>

      <Card padding="md">
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: moreOpen }}
          onPress={() => setMoreOpen((o) => !o)}
          style={({ pressed }) => [styles.moreHead, pressed && styles.pressed]}
        >
          <View style={styles.flex}>
            <Text style={styles.moreTitle}>{t('body.form.moreTitle')}</Text>
            <Text style={styles.moreSub}>
              {t(moreOpen ? 'body.form.moreSubOpen' : 'body.form.moreSubClosed')}
            </Text>
          </View>
          <View style={moreOpen && styles.flipped}>
            <ChevronDown size={20} color={theme.colors.text2} strokeWidth={1.8} />
          </View>
        </Pressable>
        {moreOpen
          ? EXTRA_GROUPS.map((g) => (
              <View key={g.id} style={styles.extraGroup}>
                {g.id === 'index' ? null : (
                  <Text style={styles.groupTitle}>{t(`body.form.group.${g.id}`)}</Text>
                )}
                {rows(g.keys)}
              </View>
            ))
          : null}
        {error && extraBad ? (
          <Text style={styles.error} accessibilityLiveRegion="polite">
            {error}
          </Text>
        ) : null}
      </Card>

      {isNew ? null : (
        <Pressable
          accessibilityRole="button"
          onPress={() => openAsk({ kind: 'delete' })}
          style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
        >
          <Text style={styles.deleteText}>{t('body.form.delete')}</Text>
        </Pressable>
      )}

      <DateSheet
        visible={dateOpen}
        value={draft.date}
        today={today}
        title={t('body.form.date')}
        subtitle={t('body.form.dateSheetSub')}
        loggedLabel={t('body.form.dateHasLog')}
        loggedOf={() => loggedDays}
        onPick={(date) => {
          update({ date });
          setDateOpen(false);
        }}
        onClose={() => setDateOpen(false)}
      />

      <ActionSheet
        visible={sourceOpen}
        cancelLabel={t('body.form.cancel')}
        onClose={() => setSourceOpen(false)}
        actions={[
          {
            label: t('body.scan.camera'),
            afterClose: true,
            onPress: () => void scanSheet('camera'),
          },
          {
            label: t('body.scan.library'),
            afterClose: true,
            onPress: () => void scanSheet('library'),
          },
        ]}
      />
      <ConfirmDialog
        visible={scanFailed}
        title={t('body.scan.failTitle')}
        body={t('body.scan.failBody')}
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
          title={t('body.form.discardTitle')}
          body={t('body.form.discardBody')}
          cancelLabel={t('body.form.keepEditing')}
          confirmLabel={t('body.form.discard')}
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
          title={t('body.form.deleteTitle')}
          body={t('body.form.deleteBody', { date: dateLabel })}
          cancelLabel={t('body.form.cancel')}
          confirmLabel={t('body.form.deleteConfirm')}
          destructive
          onCancel={() => setAsk(null)}
          onConfirm={remove}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create((theme) => ({
  flex: { flex: 1 },
  pressed: { opacity: 0.7 },
  first: { marginTop: 4 },
  group: { gap: 6 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  mark: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.accent },
  label: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  dateField: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: theme.colors.surface2,
  },
  dateText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text,
  },
  pair: { flexDirection: 'row', gap: 8 },
  auto: { height: 48, justifyContent: 'center', paddingHorizontal: 14 },
  autoText: {
    fontSize: 16,
    lineHeight: 21,
    includeFontPadding: false,
    fontFamily: theme.fonts.numMedium,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  error: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.danger,
  },
  hint: {
    paddingHorizontal: 6,
    fontSize: 12,
    lineHeight: 18,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  moreHead: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 28 },
  moreTitle: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.bold,
    color: theme.colors.text,
  },
  moreSub: {
    paddingTop: 2,
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    color: theme.colors.text2,
  },
  flipped: { transform: [{ rotate: '180deg' }] },
  delete: { height: 48, alignItems: 'center', justifyContent: 'center' },
  deleteText: {
    fontSize: 15,
    lineHeight: 20,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.danger,
  },
  extraGroup: { gap: 12 },
  groupTitle: {
    paddingTop: 4,
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text2,
  },
}));
