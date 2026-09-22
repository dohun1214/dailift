import { useState } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { useUnistyles } from 'react-native-unistyles';

type Props = {
  /** 주별 값. null은 기록 없음(선을 이어 그리되 점은 없다) */
  values: readonly (number | null)[];
  label: string;
  height?: number;
};

const PAD_Y = 10;
/** 마지막 점(반지름 5)이 잘리지 않을 만큼 */
const PAD_X = 6;

/** 추이 선 차트: 가로 격자 3줄, 선, 점(마지막 점은 채움). 시안 높이 116 */
export function LineChart({ values, label, height = 116 }: Props) {
  const { theme } = useUnistyles();
  const [width, setWidth] = useState(0);
  const points = values
    .map((v, i) => (v === null ? null : { i, v }))
    .filter((p): p is { i: number; v: number } => p !== null);

  const min = Math.min(...points.map((p) => p.v));
  const max = Math.max(...points.map((p) => p.v));
  const span = max - min;
  const inner = height - PAD_Y * 2;
  const x = (i: number) =>
    values.length <= 1 ? width / 2 : PAD_X + (i / (values.length - 1)) * (width - PAD_X * 2);
  // 값이 모두 같으면(점 하나 포함) 가운데 높이에 둔다.
  const y = (v: number) =>
    span === 0 ? height / 2 : PAD_Y + inner - ((v - min) / span) * inner * 0.85 - inner * 0.075;
  const coords = points.map((p) => ({ x: x(p.i), y: y(p.v) }));
  const last = coords[coords.length - 1];

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={{ height }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
    >
      {width > 0 ? (
        <Svg width={width} height={height}>
          {[0.17, 0.52, 0.86].map((r) => (
            <Line
              key={r}
              x1={0}
              x2={width}
              y1={height * r}
              y2={height * r}
              stroke={theme.colors.line}
              strokeWidth={1}
            />
          ))}
          {coords.length > 1 ? (
            <Polyline
              points={coords.map((c) => `${c.x},${c.y}`).join(' ')}
              fill="none"
              stroke={theme.colors.accent}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {coords.slice(0, -1).map((c) => (
            <Circle
              key={`${c.x}`}
              cx={c.x}
              cy={c.y}
              r={3.5}
              fill={theme.colors.surface}
              stroke={theme.colors.accent}
              strokeWidth={2}
            />
          ))}
          {last ? <Circle cx={last.x} cy={last.y} r={5} fill={theme.colors.accent} /> : null}
        </Svg>
      ) : null}
    </View>
  );
}
