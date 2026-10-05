/** 종목별 기록 추이: 운동한 날마다의 값, 기간, 눈금, 최고 기록. 모두 순수 함수. */
import type { ExerciseType, WeightUnit } from '@/db/schema';

import { convertWeight, epley1RM } from './strength';

/** 완료한 본세트 하나 (워밍업 제외, 세트 순서대로 넘긴다) */
export type ProgressSet = {
  workoutId: string;
  startedAt: number;
  weight: number | null;
  reps: number | null;
  durationSec: number | null;
  unit: WeightUnit;
};

/** max: 그날 최고(무게·횟수·시간), e1rm: 추정 1RM, volume: 그날 합계(볼륨·총 횟수·총 시간) */
export type ProgressMetric = 'max' | 'e1rm' | 'volume';
export type ProgressPeriod = '1m' | '3m' | '6m' | 'all';
export const PROGRESS_PERIODS: readonly ProgressPeriod[] = ['1m', '3m', '6m', 'all'];

export type SessionSet = { weight: number | null; reps: number | null; durationSec: number | null };

/** 운동한 날 하나. 무게는 표시 단위로 바꿔 둔다 */
export type ProgressSession = {
  workoutId: string;
  startedAt: number;
  sets: SessionSet[];
  max: number;
  /** 최고 값을 낸 세트의 횟수 (무게 종목만, 최고 기록 비교용) */
  maxReps: number;
  e1rm: number | null;
  volume: number;
};

/** 종목 종류별로 고를 수 있는 값 */
export function metricsFor(type: ExerciseType): ProgressMetric[] {
  return type === 'weight_reps' ? ['max', 'e1rm', 'volume'] : ['max', 'volume'];
}

/** 운동별로 묶어 그날 값을 구한다. 값이 없는 날은 뺀다. 오래된 순 */
export function exerciseSessions(
  sets: readonly ProgressSet[],
  type: ExerciseType,
  unit: WeightUnit,
): ProgressSession[] {
  const byWorkout = new Map<string, ProgressSession>();
  for (const s of sets) {
    let value: number;
    let add: number;
    let e1rm: number | null = null;
    let weight: number | null = null;
    if (type === 'time') {
      if (!s.durationSec || s.durationSec <= 0) continue;
      value = s.durationSec;
      add = s.durationSec;
    } else if (type === 'bodyweight_reps') {
      if (!s.reps || s.reps <= 0) continue;
      value = s.reps;
      add = s.reps;
      weight = s.weight === null ? null : convertWeight(s.weight, s.unit, unit);
    } else {
      if (s.weight === null || !s.reps || s.reps <= 0) continue;
      weight = convertWeight(s.weight, s.unit, unit);
      value = weight;
      add = weight * s.reps;
      e1rm = epley1RM(weight, s.reps);
    }
    let session = byWorkout.get(s.workoutId);
    if (!session) {
      session = {
        workoutId: s.workoutId,
        startedAt: s.startedAt,
        sets: [],
        max: 0,
        maxReps: 0,
        e1rm: null,
        volume: 0,
      };
      byWorkout.set(s.workoutId, session);
    }
    session.sets.push({ weight, reps: s.reps, durationSec: s.durationSec });
    const reps = s.reps ?? 0;
    if (value > session.max || (value === session.max && reps > session.maxReps)) {
      session.max = value;
      session.maxReps = reps;
    }
    if (e1rm !== null && (session.e1rm === null || e1rm > session.e1rm)) session.e1rm = e1rm;
    session.volume += add;
  }
  return [...byWorkout.values()].sort((a, b) => a.startedAt - b.startedAt);
}

/** 기간이 시작하는 시각. 전체면 null */
export function periodStart(period: ProgressPeriod, now: number): number | null {
  if (period === 'all') return null;
  const d = new Date(now);
  d.setMonth(d.getMonth() - (period === '1m' ? 1 : period === '3m' ? 3 : 6));
  return d.getTime();
}

export type ProgressPoint = { session: ProgressSession; value: number };

/** 기간 안에서 그 값이 있는 날만 (오래된 순) */
export function progressPoints(
  sessions: readonly ProgressSession[],
  metric: ProgressMetric,
  period: ProgressPeriod,
  now: number,
): ProgressPoint[] {
  const from = periodStart(period, now);
  const out: ProgressPoint[] = [];
  for (const session of sessions) {
    if (from !== null && session.startedAt < from) continue;
    const value = session[metric];
    if (value !== null) out.push({ session, value });
  }
  return out;
}

/** 처음 열 때 고를 기간: 3개월에 점이 둘 이상이면 3개월, 아니면 전체 */
export function defaultPeriod(sessions: readonly ProgressSession[], now: number): ProgressPeriod {
  return progressPoints(sessions, 'max', '3m', now).length >= 2 ? '3m' : 'all';
}

/** 기간 시작보다 앞선 기록이 있는가 ('3개월 전보다'라고 말해도 되는가) */
export function hasEarlier(
  sessions: readonly ProgressSession[],
  period: ProgressPeriod,
  now: number,
): boolean {
  const from = periodStart(period, now);
  return from !== null && sessions.some((s) => s.startedAt < from);
}

/** 가장 좋은 날 (무게 종목은 무게, 같으면 횟수). 같은 기록이면 먼저 세운 날 */
export function bestSession(sessions: readonly ProgressSession[]): ProgressSession | null {
  let best: ProgressSession | null = null;
  for (const s of sessions) {
    if (!best || s.max > best.max || (s.max === best.max && s.maxReps > best.maxReps)) best = s;
  }
  return best;
}

const DECIMAL_STEPS = [1, 2, 2.5, 5];
const TIME_STEPS = [5, 10, 15, 30, 60, 120, 300, 600, 900, 1800, 3600];

function stepAtLeast(raw: number, kind: 'decimal' | 'integer' | 'time'): number {
  if (kind === 'time') return TIME_STEPS.find((s) => s >= raw) ?? Math.ceil(raw / 3600) * 3600;
  const floor = kind === 'integer' ? 1 : 0.5;
  const target = Math.max(raw, floor);
  const pow = 10 ** Math.floor(Math.log10(target));
  for (const m of [...DECIMAL_STEPS, 10]) {
    const step = m * pow;
    if (step >= target - 1e-9 && (kind !== 'integer' || Number.isInteger(step))) return step;
  }
  return 10 * pow;
}

export type Axis = { ticks: number[]; min: number; max: number };

/** 값들을 모두 담는 눈금(2–4개)과 그래프 범위 (눈금 위아래로 조금 여유) */
export function progressAxis(
  values: readonly number[],
  kind: 'decimal' | 'integer' | 'time',
): Axis {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  let step = stepAtLeast((hi - lo) / 3, kind);
  let base = Math.floor(lo / step + 1e-9);
  let top = Math.ceil(hi / step - 1e-9);
  while (top - base > 3) {
    step = stepAtLeast(step * 1.01, kind);
    base = Math.floor(lo / step + 1e-9);
    top = Math.ceil(hi / step - 1e-9);
  }
  // 값이 모두 한 눈금에 걸리면 위아래로 한 칸씩 넓힌다
  if (top === base) {
    top += 1;
    if (base > 0) base -= 1;
  }
  const ticks: number[] = [];
  for (let i = base; i <= top; i++) ticks.push(i * step);
  return { ticks, min: base * step - step * 0.3, max: top * step + step * 0.25 };
}

/** 가로축 표시: 달이 바뀌는 첫 점. 많으면 고르게 넷까지 */
export function monthMarks(startedAts: readonly number[], limit = 4): number[] {
  const marks: number[] = [];
  let prev = '';
  startedAts.forEach((at, i) => {
    const d = new Date(at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (key !== prev) marks.push(i);
    prev = key;
  });
  if (marks.length <= limit) return marks;
  const out: number[] = [];
  for (let k = 0; k < limit; k++) {
    const mark = marks[Math.round((k * (marks.length - 1)) / (limit - 1))];
    if (mark !== undefined) out.push(mark);
  }
  return out;
}
