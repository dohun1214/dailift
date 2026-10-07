import { HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  frame,
  labelsHidden,
  monospacedDigit,
  multilineTextAlignment,
  padding,
  tint,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

export type CardioActivityProps = {
  /** 타이머(남은 시간이 줄어든다)인지 스톱워치(시간이 올라간다)인지 */
  countdown: boolean;
  /** 시간이 0:00이던 시각(ms) — 스톱워치는 여기서부터 올라간다 */
  startsAt: number;
  /** 타이머가 끝나는 시각(ms). 스톱워치는 아주 먼 시각 */
  endsAt: number;
  /** 일시정지했으면 그때의 시간 글자("12:34"). 재는 중이면 빈 문자열 */
  frozen: string;
  /** 타이머에서 일시정지했을 때 막대가 찬 정도(0–1) */
  frozenProgress: number;
  /** "유산소 재는 중" · "유산소 남은 시간" · "일시정지" */
  title: string;
  /** "유산소 끝" — 타이머가 끝나는 시각이 지나면(오래된 내용이 되면) 보여 준다 */
  doneTitle: string;
  /** "러닝머신" · "러닝머신 · 20분" */
  name: string;
};

/**
 * 유산소 스톱워치 · 타이머 실시간 현황 (잠금 화면 · 다이내믹 아일랜드).
 * 이 함수는 위젯 확장에서 따로 실행된다: 훅·앱 상태·모듈 범위 값을 쓸 수 없고, 데이터는 props로만 받는다.
 * 시간은 SwiftUI가 직접 올리거나 줄여 가며 그린다(앱이 꺼져 있어도 움직인다).
 */
const CardioActivity = (props: CardioActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const range = { lower: new Date(props.startsAt), upper: new Date(props.endsAt) };
  const paused = props.frozen !== '';
  const done = props.countdown && !paused && environment.isStale === true;
  const secondary = { type: 'hierarchical' as const, style: 'secondary' as const };
  const primary = { type: 'hierarchical' as const, style: 'primary' as const };
  const icon = done ? 'bell.fill' : paused ? 'pause.fill' : props.countdown ? 'timer' : 'stopwatch';
  const title = done ? props.doneTitle : props.title;
  const still = done ? '0:00' : props.frozen;

  return {
    banner: (
      <VStack alignment="leading" spacing={12} modifiers={[padding({ all: 16 })]}>
        <HStack alignment="center" spacing={12}>
          <VStack alignment="leading" spacing={3}>
            <HStack spacing={6}>
              <Image systemName={icon} size={13} />
              <Text
                modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(secondary)]}
              >
                {title}
              </Text>
            </HStack>
            <Text modifiers={[font({ size: 16, weight: 'bold' })]}>{props.name}</Text>
          </VStack>
          <Spacer />
          {still !== '' ? (
            <Text modifiers={[font({ size: 38, weight: 'bold' }), monospacedDigit()]}>{still}</Text>
          ) : (
            <Text
              timerInterval={range}
              countsDown={props.countdown}
              modifiers={[
                font({ size: 38, weight: 'bold' }),
                monospacedDigit(),
                multilineTextAlignment('trailing'),
                frame({ maxWidth: 150 }),
              ]}
            />
          )}
        </HStack>
        {!props.countdown || done ? null : paused ? (
          <ProgressView value={props.frozenProgress} modifiers={[labelsHidden(), tint(primary)]} />
        ) : (
          <ProgressView
            timerInterval={range}
            countsDown
            modifiers={[labelsHidden(), tint(primary)]}
          />
        )}
      </VStack>
    ),
    compactLeading: <Image systemName={icon} size={15} />,
    compactTrailing:
      still !== '' ? (
        <Text modifiers={[font({ size: 15, weight: 'semibold' }), monospacedDigit()]}>{still}</Text>
      ) : (
        <Text
          timerInterval={range}
          countsDown={props.countdown}
          modifiers={[
            font({ size: 15, weight: 'semibold' }),
            monospacedDigit(),
            multilineTextAlignment('trailing'),
            frame({ maxWidth: 56 }),
          ]}
        />
      ),
    minimal: <Image systemName={icon} size={15} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={3} modifiers={[padding({ leading: 8, top: 4 })]}>
        <HStack spacing={6}>
          <Image systemName={icon} size={13} />
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(secondary)]}>
            {title}
          </Text>
        </HStack>
      </VStack>
    ),
    expandedTrailing:
      still !== '' ? (
        <Text
          modifiers={[
            font({ size: 28, weight: 'bold' }),
            monospacedDigit(),
            padding({ trailing: 8 }),
          ]}
        >
          {still}
        </Text>
      ) : (
        <Text
          timerInterval={range}
          countsDown={props.countdown}
          modifiers={[
            font({ size: 28, weight: 'bold' }),
            monospacedDigit(),
            multilineTextAlignment('trailing'),
            frame({ maxWidth: 120 }),
            padding({ trailing: 8 }),
          ]}
        />
      ),
    expandedBottom: (
      <VStack alignment="leading" spacing={10} modifiers={[padding({ horizontal: 8, bottom: 6 })]}>
        <HStack>
          <Text modifiers={[font({ size: 16, weight: 'bold' })]}>{props.name}</Text>
          <Spacer />
        </HStack>
        {!props.countdown || done || paused ? null : (
          <ProgressView
            timerInterval={range}
            countsDown
            modifiers={[labelsHidden(), tint(primary)]}
          />
        )}
      </VStack>
    ),
  };
};

export default createLiveActivity('CardioActivity', CardioActivity);
