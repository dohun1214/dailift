/** 유산소 기록 계산: 스톱워치 시간, 단위, 한 줄 요약. 모두 순수 함수. */
import type { DistanceUnit, WeightUnit } from '@/db/schema';

/** 재고 있는 유산소 한 줄의 스톱워치. 시작한 시각을 적어 두므로 앱을 나가도 시간이 이어진다 */
export type CardioTimer = {
  /** 멈춰 있던 동안까지 쌓인 초 */
  baseSec: number;
  /** 지금 재기 시작한 시각(ms). null이면 일시정지 */
  startedAt: number | null;
};

export const CARDIO_LIMITS = {
  /** 한 번에 남길 수 있는 가장 긴 시간(초) — 24시간 */
  durationSec: 24 * 60 * 60,
  distance: 999,
  speed: 99,
  incline: 40,
  /** 루틴에서 정하는 목표 시간(분). 0은 정하지 않음 */
  targetMin: 600,
} as const;

/** 스톱워치에 지금까지 쌓인 초 */
export function timerElapsed(timer: CardioTimer, now: number): number {
  const running = timer.startedAt === null ? 0 : Math.max(0, (now - timer.startedAt) / 1000);
  return Math.min(CARDIO_LIMITS.durationSec, Math.floor(timer.baseSec + running));
}

export const startTimer = (baseSec: number, now: number): CardioTimer => ({
  baseSec: Math.max(0, baseSec),
  startedAt: now,
});

export const pauseTimer = (timer: CardioTimer, now: number): CardioTimer => ({
  baseSec: timerElapsed(timer, now),
  startedAt: null,
});

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
