import type { WeightUnit } from '@/db/schema';

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
  restSec: { min: 0, max: 900 },
  increment: { min: 0.25, max: 50 },
  nameMax: 40,
} as const;

export type DraftError = 'nameRequired' | 'noExercises' | 'itemInvalid';

export function validateDraft(draft: RoutineDraft): DraftError | null {
  if (!draft.name.trim()) return 'nameRequired';
  if (draft.items.length === 0) return 'noExercises';
  if (draft.items.some((i) => itemIssue(i) !== null)) return 'itemInvalid';
  return null;
}

export type ItemIssue = 'sets' | 'reps' | 'rest' | 'increment';

export function itemIssue(i: DraftItem): ItemIssue | null {
  const inRange = (v: number, r: { min: number; max: number }) =>
    Number.isFinite(v) && v >= r.min && v <= r.max;
  if (!Number.isInteger(i.targetSets) || !inRange(i.targetSets, LIMITS.sets)) return 'sets';
  if (
    !Number.isInteger(i.repMin) ||
    !Number.isInteger(i.repMax) ||
    !inRange(i.repMin, LIMITS.reps) ||
    !inRange(i.repMax, LIMITS.reps) ||
    i.repMin > i.repMax
  )
    return 'reps';
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
): DraftItem {
  return {
    key,
    rowId: null,
    exerciseId,
    targetSets: 3,
    repMin: 8,
    repMax: 12,
    restSec,
    increment: unit === 'lb' ? 5 : 2.5,
    incrementUnit: unit,
    note: null,
  };
}
