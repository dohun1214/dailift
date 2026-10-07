import type { WeightUnit } from '@/db/schema';

import { CARDIO_LIMITS } from './cardio';
import { planIssue, type SetPlan } from './set-plan';

/** 편집 중인 루틴 종목. rowId가 null이면 아직 저장 안 된 새 종목 */
export type DraftItem = {
  /** 화면 key (저장된 행은 rowId와 같다) */
  key: string;
  rowId: string | null;
  exerciseId: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  increment: number;
  incrementUnit: WeightUnit;
  note: string | null;
  /** 세트별로 정한 계획. null이면 세트 수 · 횟수 범위로 정한 종목 */
  plan: SetPlan | null;
};

export type RoutineDraft = {
  /** null이면 새 루틴 */
  id: string | null;
  groupId: string | null;
  name: string;
  weekdays: number;
  items: DraftItem[];
};

export const LIMITS = {
  sets: { min: 1, max: 20 },
  reps: { min: 1, max: 100 },
  /** 시간으로 재는 종목(플랭크 등)의 초 범위 */
  time: { min: 5, max: 600 },
  restSec: { min: 0, max: 900 },
  increment: { min: 0.25, max: 50 },
  nameMax: 40,
  /** 한 사람이 가질 수 있는 루틴 수 */
  routines: 20,
} as const;

export type DraftError = 'nameRequired' | 'noExercises' | 'itemInvalid';

/**
 * `isTime`: 그 종목이 시간으로 재는 종목인지 (없으면 모두 횟수 종목으로 본다).
 * `isCardio`: 유산소인지 — 세트 · 횟수 대신 목표 시간 하나만 본다.
 */
export function validateDraft(
  draft: RoutineDraft,
  isTime: (exerciseId: string) => boolean = () => false,
  isCardio: (exerciseId: string) => boolean = () => false,
): DraftError | null {
  if (!draft.name.trim()) return 'nameRequired';
  if (draft.items.length === 0) return 'noExercises';
  if (draft.items.some((i) => itemIssue(i, isTime(i.exerciseId), isCardio(i.exerciseId)) !== null))
    return 'itemInvalid';
  return null;
}

export type ItemIssue = 'sets' | 'reps' | 'time' | 'rest' | 'increment' | 'plan' | 'cardio';

/** 유산소의 목표 시간(초)을 루틴 종목 칸에 담는 모양: 세트 1, 횟수 범위 칸 둘에 같은 초(0 = 목표 없음), 휴식 0 */
export const cardioTarget = (minutes: number) => ({
  targetSets: 1,
  repMin: minutes * 60,
  repMax: minutes * 60,
});

export function itemIssue(i: DraftItem, isTime = false, isCardio = false): ItemIssue | null {
  const inRange = (v: number, r: { min: number; max: number }) =>
    Number.isFinite(v) && v >= r.min && v <= r.max;
  if (isCardio) {
    const minutes = i.repMax / 60;
    return Number.isInteger(minutes) && minutes >= 0 && minutes <= CARDIO_LIMITS.targetMin
      ? null
      : 'cardio';
  }
  if (i.plan) {
    // 세트별로 정한 종목은 세트 줄과 휴식만 본다(세트 수 · 범위는 쓰지 않는다).
    if (planIssue(i.plan) !== null) return 'plan';
    if (!Number.isInteger(i.restSec) || !inRange(i.restSec, LIMITS.restSec)) return 'rest';
    return null;
  }
  if (!Number.isInteger(i.targetSets) || !inRange(i.targetSets, LIMITS.sets)) return 'sets';
  const range = isTime ? LIMITS.time : LIMITS.reps;
  if (
    !Number.isInteger(i.repMin) ||
    !Number.isInteger(i.repMax) ||
    !inRange(i.repMin, range) ||
    !inRange(i.repMax, range) ||
    i.repMin > i.repMax
  )
    return isTime ? 'time' : 'reps';
  if (!Number.isInteger(i.restSec) || !inRange(i.restSec, LIMITS.restSec)) return 'rest';
  if (!inRange(i.increment, LIMITS.increment)) return 'increment';
  return null;
}

/** 저장할 변경이 있는지 (이탈 확인용) */
export function isDraftChanged(initial: RoutineDraft, current: RoutineDraft): boolean {
  return JSON.stringify(initial) !== JSON.stringify(current);
}

/** 배열에서 한 항목을 옮긴다 (불변) */
export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return [...list];
  const next = [...list];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return [...list];
  next.splice(Math.max(0, Math.min(to, next.length)), 0, moved);
  return next;
}

/** 새로 추가한 종목의 기본값 */
export function newDraftItem(
  key: string,
  exerciseId: string,
  unit: WeightUnit,
  restSec = 90,
  /** 시간으로 재는 종목이면 30–60초로 시작한다 */
  isTime = false,
  /** 유산소면 한 줄, 목표 시간 없음, 휴식 없음 */
  isCardio = false,
): DraftItem {
  if (isCardio)
    return {
      key,
      rowId: null,
      exerciseId,
      ...cardioTarget(0),
      restSec: 0,
      increment: unit === 'lb' ? 5 : 2.5,
      incrementUnit: unit,
      note: null,
      plan: null,
    };
  return {
    key,
    rowId: null,
    exerciseId,
    targetSets: 3,
    repMin: isTime ? 30 : 8,
    repMax: isTime ? 60 : 12,
    restSec,
    increment: unit === 'lb' ? 5 : 2.5,
    incrementUnit: unit,
    note: null,
    plan: null,
  };
}
