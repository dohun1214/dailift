/** 유산소 기록 계산: 스톱워치 · 타이머 시간, 단위, 한 줄 요약. 모두 순수 함수. */
import type { DistanceUnit, WeightUnit } from '@/db/schema';

/** 재고 있는 유산소 한 줄의 스톱워치. 시작한 시각을 적어 두므로 앱을 나가도 시간이 이어진다 */
export type CardioTimer = {
  /** 멈춰 있던 동안까지 쌓인 초 */
  baseSec: number;
  /** 지금 재기 시작한 시각(ms). null이면 일시정지 */
  startedAt: number | null;
  /** 타이머 모드에서 정한 시간(초). 없으면 스톱워치(끝이 없다) */
  limitSec?: number;
  /** 잠금 화면 · 알림에 보일 종목 이름 */
  name?: string;
};

export type CardioMode = 'stopwatch' | 'timer';
/** 시작하기 전에 고른 재는 방식 */
export type CardioPlan = { mode: CardioMode; limitSec: number };

/** 타이머 시간을 한 번도 정한 적이 없을 때의 값(20분) */
export const DEFAULT_LIMIT_SEC = 20 * 60;

export const CARDIO_LIMITS = {
  /** 한 번에 남길 수 있는 가장 긴 시간(초) — 24시간 */
  durationSec: 24 * 60 * 60,
  distance: 999,
  speed: 99,
  incline: 40,
  /** 루틴에서 정하는 목표 시간(분). 0은 정하지 않음 */
  targetMin: 600,
} as const;

/** 지금까지 쌓인 초. 타이머 모드에서는 정한 시간을 넘지 않는다 */
export function timerElapsed(timer: CardioTimer, now: number): number {
  const running = timer.startedAt === null ? 0 : Math.max(0, (now - timer.startedAt) / 1000);
  const cap = Math.min(CARDIO_LIMITS.durationSec, timer.limitSec ?? CARDIO_LIMITS.durationSec);
  return Math.min(cap, Math.floor(timer.baseSec + running));
}

/** 타이머가 끝나는 시각(ms). 스톱워치이거나 멈춰 있으면 null */
export function timerEndsAt(timer: CardioTimer): number | null {
  if (timer.startedAt === null || timer.limitSec === undefined) return null;
  return timer.startedAt + Math.max(0, timer.limitSec - timer.baseSec) * 1000;
}

/** 타이머 모드에서 정한 시간을 다 채웠는지 */
export function timerExpired(timer: CardioTimer, now: number): boolean {
  const endsAt = timerEndsAt(timer);
  return endsAt !== null && now >= endsAt;
}

/** limitSec을 주면 타이머, 안 주면 스톱워치 */
export const startTimer = (
  baseSec: number,
  now: number,
  limitSec?: number,
  name?: string,
): CardioTimer => ({
  baseSec: Math.max(0, baseSec),
  startedAt: now,
  ...(limitSec !== undefined && limitSec > 0 ? { limitSec } : {}),
  ...(name ? { name } : {}),
});

export const pauseTimer = (timer: CardioTimer, now: number): CardioTimer => ({
  ...timer,
  baseSec: timerElapsed(timer, now),
  startedAt: null,
});

/**
 * 처음 보여 줄 재는 방식: 루틴에 목표 시간이 있으면 그 시간의 타이머, 없으면 스톱워치.
 * 타이머로 바꾸면 마지막에 쓴 시간이 채워져 있다.
 */
export const defaultPlan = (targetSec: number, lastLimitSec: number): CardioPlan =>
  targetSec > 0
    ? { mode: 'timer', limitSec: Math.min(targetSec, CARDIO_LIMITS.durationSec) }
    : { mode: 'stopwatch', limitSec: lastLimitSec > 0 ? lastLimitSec : DEFAULT_LIMIT_SEC };

/**
 * 잠금 화면에 보일 스톱워치 하나를 고른다: 재고 있는 것 가운데 가장 늦게 시작한 것,
 * 재는 것이 없으면 멈춰 둔 것(시간이 가장 많이 쌓인 것).
 */
export function liveTimer(
  timers: Readonly<Record<string, CardioTimer>>,
): { setId: string; timer: CardioTimer } | null {
  let best: { setId: string; timer: CardioTimer } | null = null;
  for (const [setId, timer] of Object.entries(timers)) {
    if (!best) best = { setId, timer };
    else if (timer.startedAt !== null) {
      if (best.timer.startedAt === null || timer.startedAt > best.timer.startedAt)
        best = { setId, timer };
    } else if (best.timer.startedAt === null && timer.baseSec > best.timer.baseSec) {
      best = { setId, timer };
    }
  }
  return best;
}

/** 거리 · 속도 단위는 무게 단위를 따라간다(kg → km, lb → 마일) */
export const distanceUnitFor = (weightUnit: WeightUnit): DistanceUnit =>
  weightUnit === 'lb' ? 'mi' : 'km';

/** 직접 입력한 분 · 초 → 초. 둘 다 비었거나 범위를 벗어나면 null */
export function clockToSec(minutes: number | null, seconds: number | null): number | null {
  if (minutes === null && seconds === null) return null;
  const m = minutes ?? 0;
  const s = seconds ?? 0;
  if (!Number.isInteger(m) || !Number.isInteger(s) || m < 0 || s < 0 || s > 59) return null;
  const total = m * 60 + s;
  return total > 0 && total <= CARDIO_LIMITS.durationSec ? total : null;
}

type Extras = {
  distance: number | null;
  distanceUnit: DistanceUnit;
  speed: number | null;
  incline: number | null;
};

const trim = (n: number) => String(Math.round(n * 100) / 100);

/**
 * 시간 옆에 붙는 골라 적은 정보(예: ["3.2 km", "8 km/h", "경사 2%"]). 적지 않은 것(null · 0)은 뺀다.
 * `inclineLabel`: 경사 값을 받아 "경사 2%"처럼 만들어 주는 함수(번역).
 */
export function cardioExtras(set: Extras, inclineLabel: (value: string) => string): string[] {
  const out: string[] = [];
  if (set.distance) out.push(`${trim(set.distance)} ${set.distanceUnit}`);
  if (set.speed) out.push(`${trim(set.speed)} ${set.distanceUnit}/h`);
  if (set.incline) out.push(inclineLabel(trim(set.incline)));
  return out;
}

/** 범위를 벗어난 값은 버린다(빈 칸은 그대로 null) */
export function clampExtra(
  field: 'distance' | 'speed' | 'incline',
  value: number | null,
): number | null {
  if (value === null) return null;
  return value >= 0 && value <= CARDIO_LIMITS[field] ? value : null;
}
