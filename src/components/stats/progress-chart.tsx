import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { StyleSheet, useUnistyles } from 'react-native-unistyles';

import type { Axis } from '@/domain/exercise-progress';

type Props = {
  /** 운동한 날마다의 값 (오래된 순) */
  values: readonly number[];
  axis: Axis;
  tickLabel: (value: number) => string;
  /** 가로축에 적을 표시 (달이 바뀌는 점) */
  marks: readonly { index: number; label: string }[];
  selected: number | null;
  onSelect: (index: number | null) => void;
  label: string;
};

const HEIGHT = 132;
const TOP = 12;
const BOTTOM = 100;
const LEFT = 5;
/** 오른쪽 눈금 숫자 자리 */
const GUTTER = 46;
/** 점이 이보다 많으면 작은 점은 그리지 않는다 */
const MAX_DOTS = 40;
const MARK_GAP = 34;

/** 종목 기록 추이: 오른쪽 눈금, 아래 달 표시, 점을 누르면 그날을 고른다. 시안 높이 132 */
export function ProgressChart({
  values,
  axis,
  tickLabel,
  marks,
  selected,
  onSelect,
  label,
}: Props) {
  const { theme } = useUnistyles();
  const [width, setWidth] = useState(0);
  const n = values.length;
  const right = width - GUTTER;
  const x = (i: number) => (n <= 1 ? (LEFT + right) / 2 : LEFT + (i / (n - 1)) * (right - LEFT));
  const y = (v: number) => BOTTOM - ((v - axis.min) / (axis.max - axis.min)) * (BOTTOM - TOP);
  const hot = selected ?? n - 1;

  const shownMarks: { index: number; label: string; x: number }[] = [];
  for (const m of marks) {
    const mx = x(m.index);
    const prev = shownMarks[shownMarks.length - 1];
    if (!prev || mx - prev.x >= MARK_GAP) shownMarks.push({ ...m, x: mx });
  }

  const pick = (locationX: number) => {
    if (n === 0 || width === 0) return;
    let nearest = 0;
    for (let i = 1; i < n; i++) {
      if (Math.abs(x(i) - locationX) < Math.abs(x(nearest) - locationX)) nearest = i;
    }
    onSelect(nearest === selected ? null : nearest);
  };

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={styles.root}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 ? (
        <>
          <Svg width={width} height={HEIGHT}>
            {axis.ticks.map((tick) => (
              <Line
                key={tick}
                x1={0}
                x2={right + 8}
                y1={y(tick)}
                y2={y(tick)}
                stroke={theme.colors.line}
                strokeWidth={1}
              />
            ))}
            {selected !== null ? (
              <Line
                x1={x(selected)}
                x2={x(selected)}
                y1={TOP - 8}
                y2={BOTTOM + 6}
                stroke={theme.colors.text2}
                strokeWidth={1}
                strokeDasharray="3 3"
              />
            ) : null}
            {n > 1 ? (
              <Polyline
                points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
                fill="none"
                stroke={theme.colors.accent}
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
            {n <= MAX_DOTS
              ? values.map((v, i) =>
                  i === hot ? null : (
                    <Circle
                      // biome-ignore lint/suspicious/noArrayIndexKey: 점은 순서가 곧 정체다
                      key={i}
                      cx={x(i)}
                      cy={y(v)}
                      r={3}
                      fill={theme.colors.surface}
                      stroke={theme.colors.accent}
                      strokeWidth={1.8}
                    />
                  ),
                )
              : null}
            {n > 0 ? (
              <Circle cx={x(hot)} cy={y(values[hot] ?? 0)} r={5} fill={theme.colors.accent} />
            ) : null}
          </Svg>
          {axis.ticks.map((tick) => (
            <Text key={tick} style={[styles.tick, { top: y(tick) - 7 }]} numberOfLines={1}>
              {tickLabel(tick)}
            </Text>
          ))}
          {shownMarks.map((m) => (
            <Text
              key={m.index}
              style={[
                styles.mark,
                m.index === 0 ? { left: m.x - 3 } : { left: m.x - 24, textAlign: 'center' },
              ]}
              numberOfLines={1}
            >
              {m.label}
            </Text>
          ))}
          <Pressable
            accessible={false}
            style={styles.touch}
            onPress={(e) => pick(e.nativeEvent.locationX)}
          />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create((theme) => ({
  root: { height: HEIGHT },
  tick: {
    position: 'absolute',
    right: 0,
    width: GUTTER - 10,
    textAlign: 'right',
    fontSize: 10,
    lineHeight: 14,
    includeFontPadding: false,
    fontFamily: theme.fonts.numMedium,
    fontVariant: ['tabular-nums'],
    color: theme.colors.text2,
  },
  mark: {
    position: 'absolute',
    top: BOTTOM + 14,
    width: 48,
    fontSize: 10,
    lineHeight: 14,
    includeFontPadding: false,
    fontFamily: theme.fonts.medium,
    color: theme.colors.text2,
  },
  touch: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
}));
