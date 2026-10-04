import { Platform } from 'react-native';

import RestNotification from '../../modules/rest-notification';

/**
 * 휴식 타이머를 앱 밖에서도 보이게 한다.
 * - 아이폰: 잠금 화면 · 다이내믹 아일랜드의 실시간 현황 (`widgets/rest-activity.tsx`)
 * - 안드로이드: 남은 시간이 줄어드는 진행 중 알림 (`modules/rest-notification`)
 * 표시에 실패해도 앱 안의 타이머와 '휴식 끝' 알림은 그대로 동작한다.
 */
export type RestLiveInfo = {
  /** 휴식 시작·종료 시각 (ms) */
  startsAt: number;
  endsAt: number;
  /** "휴식 중" */
  title: string;
  /** "휴식 끝" */
  doneTitle: string;
  /** "다음 · 벤치프레스 3세트" (없으면 빈 문자열) */
  next: string;
  /** 안드로이드 알림 채널 이름 */
  channel: string;
};

/** 눌렀을 때 열 화면 */
const WORKOUT_URL = 'dailift://workout';

type Factory = typeof import('../../widgets/rest-activity').default;
type Activity = ReturnType<Factory['start']>;

let activity: Activity | null = null;

/** 위젯 코드는 아이폰에서만, 처음 쓸 때 불러온다. */
function factory(): Factory {
  return (require('../../widgets/rest-activity') as typeof import('../../widgets/rest-activity'))
    .default;
}

export function showRestLive(info: RestLiveInfo) {
  try {
    if (Platform.OS === 'android') {
      RestNotification?.show(info.endsAt, info.title, info.next, info.channel, WORKOUT_URL);
      return;
    }
    if (Platform.OS !== 'ios') return;
    const props = {
      startsAt: info.startsAt,
      endsAt: info.endsAt,
      title: info.title,
      doneTitle: info.doneTitle,
      next: info.next,
    };
    // 종료 시각이 지나면 '오래된 내용'이 되어 위젯이 스스로 '휴식 끝'으로 바뀐다(앱이 꺼져 있어도).
    const staleDate = new Date(info.endsAt);
    if (!activity) {
      // 앱이 다시 켜졌다면 전에 띄운 것이 남아 있을 수 있다: 하나만 이어 쓰고 나머지는 닫는다.
      const [first, ...rest] = factory().getInstances();
      for (const extra of rest) void extra.end('immediate').catch(() => {});
      activity = first ?? null;
    }
    if (activity) void activity.update(props, staleDate).catch(() => {});
    else activity = factory().start(props, WORKOUT_URL, staleDate);
  } catch {
    // 실시간 현황을 꺼 두었거나 지원하지 않는 기기
  }
}

export function hideRestLive() {
  try {
    if (Platform.OS === 'android') {
      RestNotification?.hide();
      return;
    }
    if (Platform.OS !== 'ios') return;
    const list = activity ? [activity] : factory().getInstances();
    activity = null;
    for (const item of list) void item.end('immediate').catch(() => {});
  } catch {
    // 띄운 적이 없거나 지원하지 않는 기기
  }
}
