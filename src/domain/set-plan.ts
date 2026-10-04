/** 루틴 종목의 세트별 계획: 세트마다 무게 · 횟수(또는 시간)를 정해 둔다. 모두 순수 함수. */
import type { SetKind, WeightUnit } from '@/db/schema';

import { convertWeight } from './strength';

export type PlanKind = 'warmup' | 'working';

export type PlanSet = {
  kind: PlanKind;
  weight: number | null;
  reps: number | null;
  durationSec: number | null;
};

/** unit: 무게를 적은 단위 */
export type SetPlan = { unit: WeightUnit; sets: PlanSet[] };

export const PLAN_LIMITS = { sets: 20, weight: 2000, reps: 100, durationSec: 3600 } as const;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** DB에 저장된 JSON을 읽는다. 비었거나 깨졌거나 본 세트가 없으면 null(= 범위로 정한 종목). */
export function parseSetPlan(text: string | null | undefined): SetPlan | null {
  if (!text) return null;
  try {
    const raw = JSON.parse(text) as { unit?: unknown; sets?: unknown };
    if ((raw.unit !== 'kg' && raw.unit !== 'lb') || !Array.isArray(raw.sets)) return null;
    const sets = raw.sets.map(
      (s: Partial<Record<keyof PlanSet, unknown>>): PlanSet => ({
        kind: s?.kind === 'warmup' ? 'warmup' : 'working',
        weight: num(s?.weight),
        reps: num(s?.reps),
        durationSec: num(s?.durationSec),
      }),
    );
    return sets.some((s) => s.kind === 'working') ? { unit: raw.unit, sets } : null;
  } catch {
    return null;
  }
}

export function serializeSetPlan(plan: SetPlan | null): string | null {
  return plan ? JSON.stringify(plan) : null;
}

export type PlanIssue = 'noWorking' | 'tooMany' | 'value';

/** 저장 전 검사. 빈 칸(null)은 허용한다(운동할 때 빈 칸으로 채워진다). */
export function planIssue(plan: SetPlan): PlanIssue | null {
  if (!plan.sets.some((s) => s.kind === 'working')) return 'noWorking';
  if (plan.sets.length > PLAN_LIMITS.sets) return 'tooMany';
  const ok = (v: number | null, max: number, integer: boolean) =>
    v === null || (Number.isFinite(v) && v >= 0 && v <= max && (!integer || Number.isInteger(v)));
  const bad = plan.sets.some(
    (s) =>
      !ok(s.weight, PLAN_LIMITS.weight, false) ||
      !ok(s.reps, PLAN_LIMITS.reps, true) ||
      !ok(s.durationSec, PLAN_LIMITS.durationSec, true),
  );
  return bad ? 'value' : null;
}

/**
 * '세트별로 정하기'를 처음 켤 때: 지금 세트 수만큼 본 세트 줄을 만든다.
 * 지난 기록(last, unit 단위의 완료 본 세트)이 있으면 그 무게 · 횟수로, 없으면 횟수만 범위의 아래쪽으로 채운다.
 */
export function planFromRange(
  item: { targetSets: number; repMin: number },
  unit: WeightUnit,
  isTime: boolean,
  last: readonly { weight: number | null; reps: number | null; durationSec: number | null }[] = [],
): SetPlan {
  const count = Math.min(PLAN_LIMITS.sets, Math.max(1, Math.round(item.targetSets) || 1));
  const value = Number.isFinite(item.repMin) ? item.repMin : null;
  return {
    unit,
    sets: Array.from({ length: count }, (_, i) => {
      const prev = last[i] ?? last[last.length - 1];
      return {
        kind: 'working' as const,
        weight: isTime ? null : (prev?.weight ?? null),
        reps: isTime ? null : (prev?.reps ?? value),
        durationSec: isTime ? (prev?.durationSec ?? value) : null,
      };
    }),
  };
}

/** '범위로 정하기'로 돌아갈 때 쓸 세트 수 · 횟수 범위 */
export function rangeFromPlan(plan: SetPlan, isTime: boolean) {
  const working = plan.sets.filter((s) => s.kind === 'working');
  const values = working
    .map((s) => (isTime ? s.durationSec : s.reps))
    .filter((v): v is number => v !== null && v > 0);
  return {
    targetSets: Math.max(1, working.length),
    range: values.length ? { min: Math.min(...values), max: Math.max(...values) } : null,
  };
}

/** 목록 한 줄 요약에 쓸 숫자: 워밍업 수 · 본 세트 수 · 본 세트 무게 범위(없으면 null) */
export function planSummary(plan: SetPlan) {
  const working = plan.sets.filter((s) => s.kind === 'working');
  const weights = working.map((s) => s.weight).filter((w): w is number => w !== null && w > 0);
  return {
    warmups: plan.sets.length - working.length,
    working: working.length,
    weight: weights.length ? { min: Math.min(...weights), max: Math.max(...weights) } : null,
  };
}

/** 계획을 다른 단위로 (운동 단위가 계획 단위와 다를 때) */
export function planInUnit(plan: SetPlan, unit: WeightUnit): SetPlan {
  if (plan.unit === unit) return plan;
  return {
    unit,
    sets: plan.sets.map((s) => ({
      ...s,
      weight: s.weight === null ? null : convertWeight(s.weight, plan.unit, unit),
    })),
  };
}

export type DoneSet = {
  kind: SetKind;
  weight: number | null;
  reps: number | null;
  durationSec: number | null;
};

const planKind = (kind: SetKind): PlanKind => (kind === 'warmup' ? 'warmup' : 'working');
const same = (a: number | null, b: number | null) => (a ?? 0) === (b ?? 0);

/** 완료한 세트를 그대로 계획으로 (드롭 · 실패 세트는 본 세트로 친다) */
export function planFromDone(sets: readonly DoneSet[], unit: WeightUnit): SetPlan {
  return {
    unit,
    sets: sets.map((s) => ({
      kind: planKind(s.kind),
      weight: s.weight,
      reps: s.reps,
      durationSec: s.durationSec,
    })),
  };
}

/** 완료한 세트가 계획과 다른가 (세트 수 · 종류 · 무게 · 횟수 · 시간). done은 unit 단위. */
export function differsFromPlan(plan: SetPlan, done: readonly DoneSet[], unit: WeightUnit) {
  const p = planInUnit(plan, unit).sets;
  if (p.length !== done.length) return true;
  return p.some((s, i) => {
    const d = done[i];
    return (
      !d ||
      s.kind !== planKind(d.kind) ||
      !same(s.weight, d.weight) ||
      !same(s.reps, d.reps) ||
      !same(s.durationSec, d.durationSec)
    );
  });
}

/**
 * 지난번에 계획한 본 세트를 모두 채웠는가 → '무게를 올려 볼까요?' 안내.
 * last는 지난 세션의 완료 본 세트(unit 단위). 계획 값이 빈 칸이면 그 값은 따지지 않는다.
 */
export function planAchieved(
  plan: SetPlan,
  last: readonly { weight: number | null; reps: number | null; durationSec: number | null }[],
  unit: WeightUnit,
): boolean {
  const working = planInUnit(plan, unit).sets.filter((s) => s.kind === 'working');
  if (working.length === 0 || last.length < working.length) return false;
  const reached = (target: number | null, value: number | null) =>
    target === null || target <= 0 || (value ?? 0) >= target;
  return working.every((s, i) => {
    const d = last[i];
    return (
      !!d &&
      reached(s.weight, d.weight) &&
      reached(s.reps, d.reps) &&
      reached(s.durationSec, d.durationSec)
    );
  });
}

// ---------- 운동을 끝낸 뒤 '오늘 한 대로 루틴 바꾸기'

export type RoutineItemRef = { id: string; exerciseId: string; plan: SetPlan | null };

/** 운동에 남아 있는 종목과 그 완료 세트 (화면 순서) */
export type WorkoutItemRef = {
  exerciseId: string;
  restSec: number;
  done: readonly DoneSet[];
};

export type RoutineChange =
  /** 세트별로 정한 종목을 다르게 했다 → 계획을 오늘 한 세트로 */
  | { type: 'sets'; routineExerciseId: string; exerciseId: string; plan: SetPlan }
  /** 운동 중에 추가한 종목 → afterExerciseId 뒤에 넣는다(null이면 맨 앞) */
  | {
      type: 'added';
      exerciseId: string;
      afterExerciseId: string | null;
      targetSets: number;
      restSec: number;
    }
  /** 운동 중에 뺀 종목 */
  | { type: 'removed'; routineExerciseId: string; exerciseId: string };

/**
 * 루틴과 오늘 운동의 차이. 운동을 끝내기 직전(안 한 세트를 지우기 전)에 계산한다.
 * - 루틴에는 있는데 운동에 남아 있지 않은 종목 = 뺀 종목
 * - 운동에는 있는데 루틴에 없는 종목 = 추가한 종목 (완료한 세트가 있을 때만)
 * - 세트별로 정한 종목은 완료한 세트가 계획과 다르면 바뀐 종목 (하나도 안 했으면 그대로 둔다)
 * 같은 종목이 여러 번 있으면 순서대로 짝을 맞춘다.
 */
export function routineChanges(
  routine: readonly RoutineItemRef[],
  workout: readonly WorkoutItemRef[],
  unit: WeightUnit,
): RoutineChange[] {
  const pool = [...routine];
  const changes: RoutineChange[] = [];
  let previous: string | null = null;
  for (const w of workout) {
    const at = pool.findIndex((r) => r.exerciseId === w.exerciseId);
    if (at === -1) {
      const working = w.done.filter((s) => s.kind !== 'warmup').length;
      if (w.done.length > 0) {
        changes.push({
          type: 'added',
          exerciseId: w.exerciseId,
          afterExerciseId: previous,
          targetSets: Math.max(1, working),
          restSec: w.restSec,
        });
        previous = w.exerciseId;
      }
      continue;
    }
    const [item] = pool.splice(at, 1);
    previous = w.exerciseId;
    if (item?.plan && w.done.length > 0 && differsFromPlan(item.plan, w.done, unit)) {
      changes.push({
        type: 'sets',
        routineExerciseId: item.id,
        exerciseId: w.exerciseId,
        plan: planFromDone(w.done, unit),
      });
    }
  }
  for (const r of pool) {
    changes.push({ type: 'removed', routineExerciseId: r.id, exerciseId: r.exerciseId });
  }
  return changes;
}
