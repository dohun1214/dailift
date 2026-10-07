import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { progress } from '@/domain/diet';

import { useDietFormat } from './use-diet-format';

type BigProps = {
  label: string;
  value: number;
  /** 없으면 합계만 보여 준다 */
  target: number | null;
  unit: string;
  /** 목표를 넘겨도 좋은 값이면 true(단백질): '넘음' 대신 '목표를 채웠어요' */
  moreIsFine?: boolean;
  /** 막대 아래의 '남음' 한 줄을 뺀다(홈 카드) */
  compact?: boolean;
  /** 이름 줄 오른쪽에 두는 것 */
  trailing?: ReactNode;
};

/** 큰 숫자 한 칸: 이름, 값 / 목표, 막대, 남은 양 (칼로리 · 단백질) */
export function BigMacro({ label, value, target, unit, moreIsFine, compact, trailing }: BigProps) {
  const { t } = useTranslation();
  const fmt = useDietFormat();
  const p = target !== null ? progress(value, target) : null;
  const note =
    p === null
      ? null
      : p.left > 0
        ? t('diet.left', { n: fmt.int(p.left), unit })
        : p.over > 0 && !moreIsFine
          ? t('diet.over', { n: fmt.int(p.over), unit })
          : t('diet.reached');
  const a11y = p
    ? `${label} ${fmt.int(value)} / ${fmt.int(p.target)} ${unit}, ${note}`
    : `${label} ${fmt.int(value)} ${unit}`;
  // 오른쪽에 버튼(목표 바꾸기)이 있으면 칸 전체를 한 덩어리로 읽히지 않게 한다 — 그러면 VoiceOver에서 버튼에 닿을 수 없다.
  // 그때는 이름 글자가 칸 전체를 읽고, 숫자 · 남은 양은 따로 읽히지 않게 숨긴다.
  const split = !!trailing;
  const hide = split
    ? ({ accessibilityElementsHidden: true, importantForAccessibility: 'no' } as const)
    : {};
  return (
    <View style={styles.big} accessible={!split} accessibilityLabel={split ? undefined : a11y}>
      <View style={styles.labelRow}>
        <Text style={styles.label} accessibilityLabel={split ? a11y : undefined}>
          {label}
        </Text>
        {trailing}
      </View>
      <Text
        style={styles.value}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        {...hide}
      >
        {fmt.int(value)}
        <Text style={p ? styles.target : styles.unit}>
          {p ? ` / ${fmt.int(p.target)} ${unit}` : ` ${unit}`}
        </Text>
      </Text>
      {p ? (
        <>
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${p.ratio * 100}%` }]} />
          </View>
          {compact ? null : (
            <Text style={styles.note} {...hide}>
              {note}
            </Text>
          )}
        </>
      ) : null}
    </View>
  );
}

type SmallProps = {
  label: string;
  value: number;
  target: number | null;
  /** 가는 막대를 보일지 (식단 화면) */
  bar?: boolean;
};

/** 작은 한 칸: "탄수화물 104 / 250 g" (+ 가는 막대) */
export function SmallMacro({ label, value, target, bar = false }: SmallProps) {
  const fmt = useDietFormat();
  const p = target !== null ? progress(value, target) : null;
  return (
    <View
      style={styles.small}
      accessible
      accessibilityLabel={
        p ? `${label} ${fmt.int(value)} / ${fmt.int(p.target)} g` : `${label} ${fmt.int(value)} g`
      }
    >
      <Text style={styles.smallText} numberOfLines={1}>
        {label} <Text style={styles.smallValue}>{fmt.int(value)}</Text>
        {p ? ` / ${fmt.int(p.target)} g` : ' g'}
      </Text>
      {p && bar ? (
        <View style={styles.smallTrack}>
          <View style={[styles.smallFill, { width: `${p.ratio * 100}%` }]} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  big: { flex: 1, minWidth: 0, gap: 6 },
  labelRow: { height: 18, flexDirection: 'row', alignItems: 'center' },
  label: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.semibold,
    color: theme.colors.text2,
  },
  value: {
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.5,
    includeFontPadding: false,
    fontFamily: theme.fonts.numBold,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text,
  },
  target: {
    fontSize: 12,
    letterSpacing: 0,
    fontFamily: theme.fonts.numMedium,
    color: theme.colors.text2,
  },
  unit: {
    fontSize: 13,
    letterSpacing: 0,
    fontFamily: theme.fonts.numMedium,
    color: theme.colors.text2,
  },
  track: { height: 6, borderRadius: 3, backgroundColor: theme.colors.track, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3, backgroundColor: theme.colors.accent },
  note: {
    fontSize: 12,
    lineHeight: 16,
    includeFontPadding: false,
    fontFamily: theme.fonts.numRegular,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  small: { flex: 1, minWidth: 0, gap: 6 },
  smallText: {
    fontSize: 12,
    lineHeight: 17,
    includeFontPadding: false,
    fontFamily: theme.fonts.regular,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  smallValue: { fontSize: 13, fontFamily: theme.fonts.numBold, color: theme.colors.text },
  smallTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: theme.colors.track,
    overflow: 'hidden',
  },
  smallFill: { height: 4, borderRadius: 2, backgroundColor: theme.colors.text2 },
}));
