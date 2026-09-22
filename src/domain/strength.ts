/** 무게 계산: 추정 1RM, 증량 제안, 워밍업 세트, PR. 모두 순수 함수. */
import type { WeightUnit } from '@/db/schema';
import { LB_PER_KG, toKg } from '@/lib/number';

/** e1RM을 믿을 수 있는 반복 범위 (Epley는 고반복에서 과대추정) */
export const E1RM_MAX_REPS = 12;

/** Epley 추정 1RM. 1회면 무게 그대로, 범위 밖이면 null */
export function epley1RM(weight: number, reps: number): number | null {
  if (!(weight > 0) || !Number.isInteger(reps) || reps < 1 || reps > E1RM_MAX_REPS) return null;
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

/** 단위를 바꿔 원판 단위로 반올림 */
export function convertWeight(weight: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return weight;
  const kg = toKg(weight, from);
  return to === 'kg' ? roundTo(kg, 0.5) : roundTo(kg * LB_PER_KG, 1);
}

export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** 원판으로 만들 수 있는 무게 간격 (양쪽 최소 원판 합): kg 2.5, lb 5 */
export function plateStep(unit: WeightUnit): number {
  return unit === 'kg' ? 2.5 : 5;
}

export function defaultBarWeight(unit: WeightUnit): number {
  return unit === 'kg' ? 20 : 45;
}

export type PastSet = { weight: number | null; reps: number | null };

export type Suggestion =
  | { kind: 'increase'; weight: number; sets: number; reps: number }
  | { kind: 'decrease'; weight: number }
  | { kind: 'repeat'; weight: number };

/**
 * 더블 프로그레션.
 * - 지난 세션의 모든 본세트가 렙 상한에 도달 → 증량 단위만큼 올린다.
 * - 최근 두 세션 모두 하한 미달 세트가 있음 → 약 7.5% 내린다(증량 단위로 반올림).
 * - 그 밖에는 같은 무게.
 * sessions[0]이 가장 최근. 무게가 없으면 제안하지 않는다.
 */
export function suggestNext(
  sessions: readonly (readonly PastSet[])[],
  target: { repMin: number; repMax: number; increment: number },
): Suggestion | null {
  const last = sessions[0]?.filter((s) => s.weight !== null && s.weight > 0 && s.reps !== null);
  if (!last || last.length === 0) return null;
  const weight = Math.max(...last.map((s) => s.weight ?? 0));
  const top = last.filter((s) => s.weight === weight);

  if (top.every((s) => (s.reps ?? 0) >= target.repMax)) {
    return {
      kind: 'increase',
      weight: weight + target.increment,
      sets: top.length,
      reps: target.repMax,
    };
  }
  const missed = (list: readonly PastSet[] | undefined) =>
    !!list && list.some((s) => s.reps !== null && s.reps < target.repMin);
  if (missed(sessions[0]) && missed(sessions[1])) {
    const step = target.increment > 0 ? target.increment : 1;
    const lowered = Math.max(step, roundTo(weight * 0.925, step));
    if (lowered < weight) return { kind: 'decrease', weight: lowered };
  }
  return { kind: 'repeat', weight };
}

export type WarmupSet = { weight: number; reps: number };

/**
 * 워밍업 세트: 빈 바×10, 45%×5, 65%×3, 85%×2 (원판 간격으로 반올림).
 * 빈 바 이하·앞 단계와 같은 무게·본세트 이상인 단계는 뺀다.
 */
export function warmupSets(
  working: number,
  unit: WeightUnit,
  bar = defaultBarWeight(unit),
): WarmupSet[] {
  if (!(working > bar)) return [];
  const step = plateStep(unit);
  const plan: [number, number][] = [
    [0, 10],
    [0.45, 5],
    [0.65, 3],
    [0.85, 2],
  ];
  const out: WarmupSet[] = [];
  for (const [pct, reps] of plan) {
    const w = pct === 0 ? bar : roundTo(working * pct, step);
    if (w < bar || w >= working) continue;
    if (out.length > 0 && w <= (out[out.length - 1]?.weight ?? 0)) continue;
    out.push({ weight: w, reps });
  }
  return out;
}

export type Best = { weightKg: number; e1rmKg: number };

/**
 * 완료한 본세트가 PR인지. 지난 기록(best)이 없으면 첫 기록이라 PR로 치지 않는다.
 * 최고 중량 또는 추정 1RM 중 하나라도 넘으면 PR.
 */
export function isPersonalRecord(
  set: { weight: number | null; reps: number | null; unit: WeightUnit },
  best: Best | null,
): boolean {
  if (!best || set.weight === null || !(set.weight > 0) || !set.reps) return false;
  const kg = toKg(set.weight, set.unit);
  const e1rm = epley1RM(kg, set.reps);
  const eps = 1e-6;
  return kg > best.weightKg + eps || (e1rm !== null && e1rm > best.e1rmKg + eps);
}

/** 기록 목록에서 최고 중량·e1RM (kg) */
export function bestOf(
  sets: readonly { weight: number | null; reps: number | null; unit: WeightUnit }[],
): Best | null {
  let weightKg = 0;
  let e1rmKg = 0;
  for (const s of sets) {
    if (s.weight === null || !(s.weight > 0) || !s.reps) continue;
    const kg = toKg(s.weight, s.unit);
    weightKg = Math.max(weightKg, kg);
    e1rmKg = Math.max(e1rmKg, epley1RM(kg, s.reps) ?? 0);
  }
  return weightKg > 0 ? { weightKg, e1rmKg } : null;
}
