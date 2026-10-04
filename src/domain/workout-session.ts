/** 진행 중인 운동에 쓰는 순수 계산: 오래 열려 있던 운동 판정, 세트 값 따라 채우기. */
import type { SetKind } from '@/db/schema';

/** 마지막 기록(없으면 시작)에서 이만큼 지나면 '아직 운동 중인가요?'를 묻는다. */
export const STALE_WORKOUT_MS = 3 * 60 * 60 * 1000;

export function isStaleWorkout(lastActivityAt: number, now: number): boolean {
  return now - lastActivityAt > STALE_WORKOUT_MS;
}

export type FillField = 'weight' | 'reps' | 'durationSec';

type FillSet = {
  id: string;
  kind: SetKind;
  completedAt: number | null;
  weight: number | null;
  reps: number | null;
  durationSec: number | null;
};

const isEmpty = (v: number | null) => v === null || v === 0;

/**
 * 한 세트의 값을 고칠 때 같은 값을 따라 받을 세트 id (sets는 화면 순서).
 * 고친 세트보다 아래에 있는 미완료 본 세트 중, 그 칸이 비어 있거나 고치기 전 값과 같은 것만.
 * 완료한 세트·워밍업·따로 다르게 적어 둔 세트는 건드리지 않는다.
 */
export function followerSetIds(
  sets: readonly FillSet[],
  setId: string,
  field: FillField,
): string[] {
  const at = sets.findIndex((s) => s.id === setId);
  const source = sets[at];
  if (source?.kind !== 'working') return [];
  const before = source[field];
  return sets
    .slice(at + 1)
    .filter(
      (s) =>
        s.kind === 'working' &&
        s.completedAt === null &&
        (isEmpty(s[field]) || s[field] === before),
    )
    .map((s) => s.id);
}

/** 숫자 목록이 끊김 없이 이어지면 [처음, 끝], 아니면 null */
export function contiguousRange(numbers: readonly number[]): [number, number] | null {
  const first = numbers[0];
  const last = numbers[numbers.length - 1];
  if (first === undefined || last === undefined) return null;
  return numbers.every((n, i) => n === first + i) ? [first, last] : null;
}
