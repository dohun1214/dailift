/** 세션 요약 계산: 통계, 부위 자극 단계, PR 목록. 모두 순수 함수. */
import type { DistanceUnit, MuscleRole, SetKind, WeightUnit } from '@/db/schema';

import { toKg } from '@/lib/number';

import { type Best, convertWeight, epley1RM } from './strength';

export type SummarySet = {
  exerciseId: string;
  kind: SetKind;
  weight: number | null;
  reps: number | null;
  unit: WeightUnit;
  completed: boolean;
  /** 유산소 한 줄. 세트 수 · 볼륨 · 근육 점수 · PR에는 넣지 않고 시간만 따로 더한다 */
  cardio?: boolean;
  durationSec?: number | null;
};

/** 기록 상세에 보여 줄 세트 하나 */
export type RecordedSet = {
  kind: SetKind;
  weight: number | null;
  unit: WeightUnit;
  reps: number | null;
  durationSec: number | null;
  /** 유산소에서 골라 적은 것 */
  distance?: number | null;
  distanceUnit?: DistanceUnit;
  speed?: number | null;
  incline?: number | null;
};

export type SetGroup = { weight: number | null; unit: WeightUnit; reps: number[] };

/**
 * 본 세트를 같은 무게끼리 이어 묶는다 (예: 62.5kg × 10 · 9 · 9, 무게가 바뀌면 새 묶음).
 * 워밍업은 뺀다. 화면 한 줄 요약용.
 */
export function groupSetsByWeight(sets: readonly RecordedSet[]): SetGroup[] {
  const out: SetGroup[] = [];
  for (const s of sets) {
    if (s.kind === 'warmup') continue;
    const last = out[out.length - 1];
    if (last && last.weight === s.weight && (s.weight === null || last.unit === s.unit))
      last.reps.push(s.reps ?? 0);
    else out.push({ weight: s.weight, unit: s.unit, reps: [s.reps ?? 0] });
  }
  return out;
}

/** 협응근은 주동근의 절반으로 센다(볼륨 계산 규칙과 같음) */
const ROLE_CREDIT: Record<MuscleRole, number> = { primary: 1, secondary: 0.5 };

const counted = (s: SummarySet) => s.completed && s.kind !== 'warmup' && !s.cardio;

/** 기록한 유산소 시간 합(초) */
export function cardioSeconds(sets: readonly SummarySet[]): number {
  return sets.reduce((n, s) => n + (s.cardio && s.completed ? (s.durationSec ?? 0) : 0), 0);
}

/** 운동 시간(분, 반올림), 본세트 수, 볼륨(무게×횟수 합, 표시 단위로 환산) */
export function sessionStats(
  sets: readonly SummarySet[],
  startedAt: number,
  endedAt: number | null,
  unit: WeightUnit,
) {
  const working = sets.filter(counted);
  const volume = working.reduce((sum, s) => {
    if (s.weight === null || s.reps === null) return sum;
    const w = s.unit === unit ? s.weight : convertWeight(s.weight, s.unit, unit);
    return sum + w * s.reps;
  }, 0);
  const minutes = endedAt ? Math.max(1, Math.round((endedAt - startedAt) / 60000)) : 0;
  return { minutes, sets: working.length, volume: Math.round(volume) };
}

/** 근육별 세트 점수 (주동 1 · 협응 0.5, 워밍업·미완료 제외) */
export function muscleCredits(
  sets: readonly SummarySet[],
  musclesOf: ReadonlyMap<string, readonly { muscleId: string; role: MuscleRole }[]>,
): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of sets) {
    if (!counted(s)) continue;
    for (const m of musclesOf.get(s.exerciseId) ?? []) {
      out.set(m.muscleId, (out.get(m.muscleId) ?? 0) + ROLE_CREDIT[m.role]);
    }
  }
  return out;
}

export type MuscleLevel = 1 | 2 | 3;

/**
 * 근육맵 단계: 가장 많이 쓴 근육 대비 비율로 집중(3, ⅔ 이상)·주요(2, ⅓ 이상)·보조(1).
 * 한 세트라도 쓴 근육은 최소 보조로 표시한다.
 */
export function muscleLevels(credits: ReadonlyMap<string, number>): Map<string, MuscleLevel> {
  const max = Math.max(0, ...credits.values());
  const out = new Map<string, MuscleLevel>();
  if (max <= 0) return out;
  for (const [id, c] of credits) {
    if (c <= 0) continue;
    const r = c / max;
    out.set(id, r >= 2 / 3 ? 3 : r >= 1 / 3 ? 2 : 1);
  }
  return out;
}

export type PrEntry =
  | { exerciseId: string; kind: 'weight'; weight: number; reps: number; unit: WeightUnit }
  | { exerciseId: string; kind: 'e1rm'; e1rm: number; unit: WeightUnit };

/**
 * 종목별 PR 한 줄. 지난 기록(bests)이 있는 종목만, 최고 중량을 넘었으면 그 세트,
 * 아니고 e1RM만 넘었으면 추정 1RM(표시 단위)을 보여준다.
 */
export function sessionPrs(
  sets: readonly SummarySet[],
  bests: ReadonlyMap<string, Best>,
  unit: WeightUnit,
): PrEntry[] {
  const order: string[] = [];
  const byExercise = new Map<string, SummarySet[]>();
  for (const s of sets) {
    if (!counted(s) || s.weight === null || !s.reps) continue;
    if (!byExercise.has(s.exerciseId)) {
      byExercise.set(s.exerciseId, []);
      order.push(s.exerciseId);
    }
    byExercise.get(s.exerciseId)?.push(s);
  }
  const out: PrEntry[] = [];
  const eps = 1e-6;
  for (const id of order) {
    const best = bests.get(id);
    const list = byExercise.get(id) ?? [];
    if (!best) continue;
    // 지난 최고와 같은 정확한 kg 값으로 견준다(반올림하면 lb 기록이 같은 무게에서도 넘은 것처럼 보인다).
    const kgOf = (s: SummarySet) => toKg(s.weight ?? 0, s.unit);
    const heaviest = [...list].sort(
      (a, b) => kgOf(b) - kgOf(a) || (b.reps ?? 0) - (a.reps ?? 0),
    )[0];
    if (heaviest && kgOf(heaviest) > best.weightKg + eps) {
      out.push({
        exerciseId: id,
        kind: 'weight',
        weight: convertWeight(heaviest.weight ?? 0, heaviest.unit, unit),
        reps: heaviest.reps ?? 0,
        unit,
      });
      continue;
    }
    const topE1rm = Math.max(0, ...list.map((s) => epley1RM(kgOf(s), s.reps ?? 0) ?? 0));
    if (topE1rm > best.e1rmKg + eps) {
      const shown = unit === 'kg' ? topE1rm : topE1rm * 2.2046226218;
      out.push({ exerciseId: id, kind: 'e1rm', e1rm: Math.round(shown * 10) / 10, unit });
    }
  }
  return out;
}
