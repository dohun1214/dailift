/** 통계 계산: 지난 7일 진행도, 부위 밸런스, 주별 추정 1RM, 정체 감지. 모두 순수 함수. */
import type { MuscleGroup, MuscleRole, WeightUnit } from '@/db/schema';

import { convertWeight, epley1RM } from './strength';

export const DAY_MS = 24 * 60 * 60 * 1000;
export const WEEK_MS = 7 * DAY_MS;

/** 완료한 본세트 (워밍업 제외된 것만 넘긴다) */
export type StatSet = {
  workoutId: string;
  startedAt: number;
  exerciseId: string;
  weight: number | null;
  reps: number | null;
  unit: WeightUnit;
};

type Totals = { volume: number; sets: number };

function totals(sets: readonly StatSet[], unit: WeightUnit): Totals {
  let volume = 0;
  for (const s of sets) {
    if (s.weight !== null && s.reps !== null) {
      volume += (s.unit === unit ? s.weight : convertWeight(s.weight, s.unit, unit)) * s.reps;
    }
  }
  return { volume: Math.round(volume), sets: sets.length };
}

/** 지난 7일과 그 전 7일의 총 볼륨·세트 */
export function weeklyProgress(sets: readonly StatSet[], now: number, unit: WeightUnit) {
  const cur = sets.filter((s) => s.startedAt > now - WEEK_MS && s.startedAt <= now);
  const prev = sets.filter((s) => s.startedAt > now - 2 * WEEK_MS && s.startedAt <= now - WEEK_MS);
  return { current: totals(cur, unit), previous: totals(prev, unit) };
}

/** 밸런스 게이지에 보여줄 부위 (시안 순서) */
export const BALANCE_GROUPS: readonly MuscleGroup[] = [
  'chest',
  'back',
  'shoulders',
  'legs',
  'arms',
];

/**
 * 지난 7일 부위별 세트 수. 한 세트가 부위의 주동근을 쓰면 1, 협응근만 쓰면 0.5
 * (한 부위에 여러 근육이 걸려도 세트당 한 번만 센다).
 */
export function groupBalance(
  sets: readonly StatSet[],
  now: number,
  musclesOf: ReadonlyMap<string, readonly { group: MuscleGroup; role: MuscleRole }[]>,
): Map<MuscleGroup, number> {
  const out = new Map<MuscleGroup, number>(BALANCE_GROUPS.map((g) => [g, 0]));
  for (const s of sets) {
    if (s.startedAt <= now - WEEK_MS || s.startedAt > now) continue;
    const credit = new Map<MuscleGroup, number>();
    for (const m of musclesOf.get(s.exerciseId) ?? []) {
      const c = m.role === 'primary' ? 1 : 0.5;
      credit.set(m.group, Math.max(credit.get(m.group) ?? 0, c));
    }
    for (const [g, c] of credit) out.set(g, (out.get(g) ?? 0) + c);
  }
  return out;
}

export type BalanceState = 'low' | 'ok' | 'high';

export function balanceState(value: number, range: { min: number; max: number }): BalanceState {
  if (value < range.min) return 'low';
  if (value > range.max) return 'high';
  return 'ok';
}

/** 세션별 최고 추정 1RM (표시 단위), 오래된 순 */
export function sessionBestE1rm(
  sets: readonly StatSet[],
  exerciseId: string,
  unit: WeightUnit,
): { workoutId: string; startedAt: number; e1rm: number }[] {
  const byWorkout = new Map<string, { startedAt: number; e1rm: number }>();
  for (const s of sets) {
    if (s.exerciseId !== exerciseId || s.weight === null || !s.reps) continue;
    const w = s.unit === unit ? s.weight : convertWeight(s.weight, s.unit, unit);
    const e = epley1RM(w, s.reps);
    if (e === null) continue;
    const prev = byWorkout.get(s.workoutId);
    if (!prev || e > prev.e1rm) byWorkout.set(s.workoutId, { startedAt: s.startedAt, e1rm: e });
  }
  return [...byWorkout]
    .map(([workoutId, v]) => ({ workoutId, ...v }))
    .sort((a, b) => a.startedAt - b.startedAt);
}

/**
 * 최근 weeks주를 한 주씩 나눠 주별 최고 추정 1RM. 기록 없는 주는 null.
 * [0]이 가장 오래된 주, 마지막이 이번 주(지난 7일).
 */
export function weeklyE1rm(
  sessions: readonly { startedAt: number; e1rm: number }[],
  now: number,
  weeks = 8,
): (number | null)[] {
  const out: (number | null)[] = Array.from({ length: weeks }, () => null);
  for (const s of sessions) {
    const age = Math.floor((now - s.startedAt) / WEEK_MS);
    if (age < 0 || age >= weeks) continue;
    const i = weeks - 1 - age;
    out[i] = Math.max(out[i] ?? 0, s.e1rm);
  }
  return out;
}

/**
 * 정체: 최근 4회 이상, 3주 이상에 걸친 세션의 최고 추정 1RM 추세(최소제곱 기울기)가 0 이하.
 * sessions는 오래된 순. 마지막 6회까지만 본다.
 */
export function isStagnant(sessions: readonly { startedAt: number; e1rm: number }[]): boolean {
  const recent = sessions.slice(-6);
  if (recent.length < 4) return false;
  const first = recent[0];
  const last = recent[recent.length - 1];
  if (!first || !last || last.startedAt - first.startedAt < 3 * WEEK_MS) return false;
  const xs = recent.map((s) => (s.startedAt - first.startedAt) / DAY_MS);
  const ys = recent.map((s) => s.e1rm);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0;
  let den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += ((xs[i] ?? 0) - mx) * ((ys[i] ?? 0) - my);
    den += ((xs[i] ?? 0) - mx) ** 2;
  }
  return den > 0 && num / den <= 0;
}

/** 최근 weeks주 동안 세션 수가 가장 많은 종목 (e1RM 차트 기본값). 동률이면 최근에 한 종목 */
export function mostFrequentExercise(
  sets: readonly StatSet[],
  now: number,
  weeks = 8,
): string | null {
  const count = new Map<string, { n: number; workouts: Set<string>; last: number }>();
  for (const s of sets) {
    if (s.startedAt <= now - weeks * WEEK_MS || s.weight === null) continue;
    const c = count.get(s.exerciseId) ?? { n: 0, workouts: new Set<string>(), last: 0 };
    if (!c.workouts.has(s.workoutId)) {
      c.workouts.add(s.workoutId);
      c.n += 1;
    }
    c.last = Math.max(c.last, s.startedAt);
    count.set(s.exerciseId, c);
  }
  let best: string | null = null;
  let bestN = 0;
  let bestLast = 0;
  for (const [id, c] of count) {
    if (c.n > bestN || (c.n === bestN && c.last > bestLast)) {
      best = id;
      bestN = c.n;
      bestLast = c.last;
    }
  }
  return best;
}
