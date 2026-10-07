/** 부위별 주간 목표 세트: 추천값, 직접 정한 값, 막대에 쓸 단계. 모두 순수 함수. */
import type { Experience } from './profile';

/** 목표를 두는 부위 (부위 밸런스에 보여 주는 순서) */
export const TARGET_GROUPS = ['chest', 'back', 'shoulders', 'legs', 'arms'] as const;
export type TargetGroup = (typeof TARGET_GROUPS)[number];
export type SetTargets = Record<TargetGroup, number>;

export const MIN_SET_TARGET = 1;
export const MAX_SET_TARGET = 40;

/**
 * 경력별 기준 세트. 숙련자 근거는 주 10세트 이상(Schoenfeld 2017, Baz-Valle 2022)이고,
 * 경험이 적을수록 적은 볼륨으로도 충분해서 낮춘다.
 */
function baseSets(experience: Experience | null): number {
  if (experience === 'new') return 6;
  if (experience === 'under6m') return 8;
  return 10;
}

/**
 * 부위별 배수. 어깨·팔은 작은 근육이고 누르기·당기기 종목에서도 함께 쓰이므로 낮게
 * ('협응근도 세기'를 켜면 그 종목들에서 0.5세트씩 쌓인다 — 켜든 끄든 추천값은 같다),
 * 하체는 대퇴사두·햄스트링·둔근·종아리를 한 부위로 세므로 높게 잡는다.
 */
const GROUP_FACTOR: SetTargets = { chest: 1, back: 1, shoulders: 0.8, legs: 1.2, arms: 0.8 };

/** 운동 경력에 맞춘 추천 목표 */
export function recommendedSetTargets(experience: Experience | null): SetTargets {
  const base = baseSets(experience);
  const out = {} as SetTargets;
  for (const g of TARGET_GROUPS) out[g] = Math.round(base * GROUP_FACTOR[g]);
  return out;
}

export function clampSetTarget(value: number): number {
  return Math.min(MAX_SET_TARGET, Math.max(MIN_SET_TARGET, Math.round(value)));
}

/** 직접 정한 값이 있으면 그 값, 없으면 추천값 */
export function resolveSetTargets(
  experience: Experience | null,
  custom: Partial<SetTargets> | null | undefined,
): SetTargets {
  const out = recommendedSetTargets(experience);
  for (const g of TARGET_GROUPS) {
    const v = custom?.[g];
    if (typeof v === 'number' && Number.isFinite(v)) out[g] = clampSetTarget(v);
  }
  return out;
}

/** 추천값과 다르게 정한 부위가 하나라도 있는지 (값을 추천값으로 되돌려 놓았으면 아니다) */
export function hasCustomTargets(
  experience: Experience | null,
  custom: Partial<SetTargets> | null | undefined,
): boolean {
  const recommended = recommendedSetTargets(experience);
  const resolved = resolveSetTargets(experience, custom);
  return TARGET_GROUPS.some((g) => resolved[g] !== recommended[g]);
}

/**
 * 막대에 쓰는 단계.
 * none: 아직 0세트 · low: 목표의 절반 미만(많이 부족) · mid: 절반 이상(하는 중) · done: 목표를 채움.
 * 목표를 넘겨도 done 그대로다(많이 한 것을 따로 표시하지 않는다).
 */
export type TargetLevel = 'none' | 'low' | 'mid' | 'done';

export function targetLevel(value: number, target: number): TargetLevel {
  if (value <= 0) return 'none';
  if (value >= target) return 'done';
  return value >= target / 2 ? 'mid' : 'low';
}

/** 막대 길이(0–1). 목표를 채우면 꽉 찬다 */
export function targetProgress(value: number, target: number): number {
  if (target <= 0) return value > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, value / target));
}
