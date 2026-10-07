import { Platform } from 'react-native';

/**
 * 유산소 스톱워치 · 타이머를 앱 밖에서도 보이게 한다.
 * - 아이폰: 잠금 화면 · 다이내믹 아일랜드의 실시간 현황 (`widgets/cardio-activity.tsx`)
 * - 안드로이드: 아직 없다(올라가는 스톱워치 알림은 네이티브 모듈을 고쳐야 한다).
 * 표시에 실패해도 앱 안의 스톱워치와 '타이머 끝' 알림은 그대로 동작한다.
 */
export type CardioLiveInfo = {
  /** 타이머(남은 시간)인지 스톱워치(올라가는 시간)인지 */
  countdown: boolean;
  /** 시간이 0:00이던 시각(ms) */
  startsAt: number;
  /** 타이머가 끝나는 시각(ms). 스톱워치 · 일시정지에서는 null */
  endsAt: number | null;
  /** 일시정지했으면 그때의 시간 글자, 재는 중이면 빈 문자열 */
  frozen: string;
  /** 타이머에서 일시정지했을 때 남은 정도(0–1) */
  frozenProgress: number;
  title: string;
  doneTitle: string;
  name: string;
};

/** 눌렀을 때 열 화면 */
const WORKOUT_URL = 'dailift://workout';
/** 스톱워치는 끝이 없다 → 하루 뒤를 끝으로 준다(그 전에 앱이 기록 한도에서 멈춘다) */
const OPEN_END_MS = 24 * 60 * 60 * 1000;

type Factory = typeof import('../../widgets/cardio-activity').default;
type Activity = ReturnType<Factory['start']>;

let activity: Activity | null = null;

/** 위젯 코드는 아이폰에서만, 처음 쓸 때 불러온다. */
function factory(): Factory {
  return (
    require('../../widgets/cardio-activity') as typeof import('../../widgets/cardio-activity')
  ).default;
}

export function showCardioLive(info: CardioLiveInfo) {
  try {
    if (Platform.OS !== 'ios') return;
    const props = {
      countdown: info.countdown,
      startsAt: info.startsAt,
      endsAt: info.endsAt ?? info.startsAt + OPEN_END_MS,
      frozen: info.frozen,
      frozenProgress: info.frozenProgress,
      title: info.title,
      doneTitle: info.doneTitle,
      name: info.name,
    };
    // 타이머는 끝나는 시각이 지나면 '오래된 내용'이 되어 위젯이 스스로 '끝'으로 바뀐다(앱이 꺼져 있어도).
    const staleDate = info.countdown && info.endsAt !== null ? new Date(info.endsAt) : undefined;
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

export function hideCardioLive() {
  try {
    if (Platform.OS !== 'ios') return;
    const list = activity ? [activity] : factory().getInstances();
    activity = null;
    for (const item of list) void item.end('immediate').catch(() => {});
  } catch {
    // 띄운 적이 없거나 지원하지 않는 기기
  }
}
