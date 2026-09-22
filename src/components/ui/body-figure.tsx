import { useMemo } from 'react';
import Body, { type ExtendedBodyPart, type Slug } from 'react-native-body-highlighter';
import { useUnistyles } from 'react-native-unistyles';

type Props = {
  gender: 'male' | 'female';
  side?: 'front' | 'back';
  /** 시안 기준 너비(px). 높이는 두 배. */
  width?: number;
  data?: readonly ExtendedBodyPart[];
};

/** 라이브러리 에셋에 박힌 기본색(#3f3f3f)을 덮기 위해 모든 부위를 명시한다. */
const ALL_SLUGS: readonly Slug[] = [
  'abs',
  'adductors',
  'ankles',
  'biceps',
  'calves',
  'chest',
  'deltoids',
  'feet',
  'forearm',
  'gluteal',
  'hamstring',
  'hands',
  'hair',
  'head',
  'knees',
  'lower-back',
  'neck',
  'obliques',
  'quadriceps',
  'tibialis',
  'trapezius',
  'triceps',
  'upper-back',
];

/** react-native-body-highlighter 바디. 강조하지 않은 부위는 테마 트랙색 단색, 외곽선 없음. */
export function BodyFigure({ gender, side = 'front', width = 96, data = [] }: Props) {
  const { theme } = useUnistyles();
  const track = theme.colors.track;
  const merged = useMemo(() => {
    const bySlug = new Map(data.filter((d) => d.slug).map((d) => [d.slug, d]));
    return ALL_SLUGS.map((slug) => bySlug.get(slug) ?? { slug, styles: { fill: track } });
  }, [data, track]);
  return (
    <Body
      data={merged}
      gender={gender}
      side={side}
      scale={width / 200}
      border="none"
      defaultFill={track}
      defaultStroke="none"
      colors={[theme.colors.accent]}
    />
  );
}
