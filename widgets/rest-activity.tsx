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

export type RestActivityProps = {
  /** 휴식 시작·종료 시각 (ms) */
  startsAt: number;
  endsAt: number;
  /** "휴식 중" */
  title: string;
  /** "휴식 끝" — 종료 시각이 지나면(오래된 내용이 되면) 보여 준다 */
  doneTitle: string;
  /** "다음 · 벤치프레스 3세트" (없으면 빈 문자열) */
  next: string;
};

/**
 * 휴식 타이머 실시간 현황 (잠금 화면 · 다이내믹 아일랜드).
 * 이 함수는 위젯 확장에서 따로 실행된다: 훅·앱 상태·모듈 범위 값을 쓸 수 없고, 데이터는 props로만 받는다.
 * 남은 시간은 SwiftUI가 직접 줄여 가며 그린다(앱이 꺼져 있어도 움직인다).
 */
const RestActivity = (props: RestActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const range = { lower: new Date(props.startsAt), upper: new Date(props.endsAt) };
  const done = environment.isStale === true;
  const secondary = { type: 'hierarchical' as const, style: 'secondary' as const };
  const primary = { type: 'hierarchical' as const, style: 'primary' as const };

  return {
    banner: (
      <VStack alignment="leading" spacing={12} modifiers={[padding({ all: 16 })]}>
        <HStack alignment="center" spacing={12}>
          <VStack alignment="leading" spacing={3}>
            <HStack spacing={6}>
              <Image systemName={done ? 'bell.fill' : 'timer'} size={13} />
              <Text
                modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(secondary)]}
              >
                {done ? props.doneTitle : props.title}
              </Text>
            </HStack>
            <Text modifiers={[font({ size: 16, weight: 'bold' })]}>{props.next}</Text>
          </VStack>
          <Spacer />
          {done ? (
            <Text modifiers={[font({ size: 38, weight: 'bold' }), monospacedDigit()]}>0:00</Text>
          ) : (
            <Text
              timerInterval={range}
              countsDown
              modifiers={[
                font({ size: 38, weight: 'bold' }),
                monospacedDigit(),
                multilineTextAlignment('trailing'),
                frame({ maxWidth: 120 }),
              ]}
            />
          )}
        </HStack>
        {done ? null : (
          <ProgressView
            timerInterval={range}
            countsDown
            modifiers={[labelsHidden(), tint(primary)]}
          />
        )}
      </VStack>
    ),
    compactLeading: <Image systemName={done ? 'bell.fill' : 'timer'} size={15} />,
    compactTrailing: done ? (
      <Text modifiers={[font({ size: 15, weight: 'semibold' }), monospacedDigit()]}>0:00</Text>
    ) : (
      <Text
        timerInterval={range}
        countsDown
        modifiers={[
          font({ size: 15, weight: 'semibold' }),
          monospacedDigit(),
          multilineTextAlignment('trailing'),
          frame({ maxWidth: 48 }),
        ]}
      />
    ),
    minimal: <Image systemName={done ? 'bell.fill' : 'timer'} size={15} />,
    expandedLeading: (
      <VStack alignment="leading" spacing={3} modifiers={[padding({ leading: 8, top: 4 })]}>
        <HStack spacing={6}>
          <Image systemName={done ? 'bell.fill' : 'timer'} size={13} />
          <Text modifiers={[font({ size: 13, weight: 'semibold' }), foregroundStyle(secondary)]}>
            {done ? props.doneTitle : props.title}
          </Text>
        </HStack>
      </VStack>
    ),
    expandedTrailing: done ? (
      <Text modifiers={[font({ size: 28, weight: 'bold' }), monospacedDigit()]}>0:00</Text>
    ) : (
      <Text
        timerInterval={range}
        countsDown
        modifiers={[
          font({ size: 28, weight: 'bold' }),
          monospacedDigit(),
          multilineTextAlignment('trailing'),
          frame({ maxWidth: 96 }),
          padding({ trailing: 8 }),
        ]}
      />
    ),
    expandedBottom: (
      <VStack alignment="leading" spacing={10} modifiers={[padding({ horizontal: 8, bottom: 6 })]}>
        <HStack>
          <Text modifiers={[font({ size: 16, weight: 'bold' })]}>{props.next}</Text>
          <Spacer />
        </HStack>
        {done ? null : (
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

export default createLiveActivity('RestActivity', RestActivity);
