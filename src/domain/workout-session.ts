/** 진행 중인 운동에 쓰는 순수 계산: 오래 열려 있던 운동 판정, 남은 세트에 값 적용, 진행 상황. */
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
 * '남은 세트에도 적용'을 누르면 값이 바뀔 세트 id (sets는 화면 순서).
 * 고른 세트보다 아래에 있는 미완료 본 세트 중, 그 칸의 값이 고른 세트와 다른 것만.
 * 고른 세트의 칸이 비어 있거나 본 세트가 아니면 없다. 완료한 세트·워밍업은 건드리지 않는다.
 */
export function applyTargetIds(
  sets: readonly FillSet[],
  setId: string,
  field: FillField,
): string[] {
  const at = sets.findIndex((s) => s.id === setId);
  const source = sets[at];
  if (source?.kind !== 'working') return [];
  const value = source[field];
  if (isEmpty(value)) return [];
  return sets
    .slice(at + 1)
    .filter((s) => s.kind === 'working' && s.completedAt === null && s[field] !== value)
    .map((s) => s.id);
}

/** 숫자 목록이 끊김 없이 이어지면 [처음, 끝], 아니면 null */
export function contiguousRange(numbers: readonly number[]): [number, number] | null {
  const first = numbers[0];
  const last = numbers[numbers.length - 1];
  if (first === undefined || last === undefined) return null;
  return numbers.every((n, i) => n === first + i) ? [first, last] : null;
}

type ProgressSet = { id: string; kind: SetKind; completedAt: number | null };
type ProgressExercise = { id: string; sets: readonly ProgressSet[] };

export type WorkoutProgress<E extends ProgressExercise> = {
  /** 완료한 세트 수 / 전체 세트 수 (워밍업 포함) */
  done: number;
  total: number;
  /** 지금 할 세트. number는 본 세트 중 몇 번째인지(본 세트가 아니면 null). 다 마쳤으면 null */
  current: { exercise: E; set: E['sets'][number]; number: number | null } | null;
  /** 지금 종목 다음으로 할, 세트가 남은 종목 */
  next: E | null;
};

/**
 * 운동 진행 상황 (exercises·sets는 화면 순서).
 * 지금 종목은 마지막으로 세트를 완료한 종목(세트가 남아 있을 때), 아니면 세트가 남은 첫 종목.
 */
export function workoutProgress<E extends ProgressExercise>(
  exercises: readonly E[],
): WorkoutProgress<E> {
  let done = 0;
  let total = 0;
  let lastAt = -1;
  let last: E | null = null;
  for (const e of exercises) {
    for (const s of e.sets) {
      total += 1;
      if (s.completedAt === null) continue;
      done += 1;
      if (s.completedAt > lastAt) {
        lastAt = s.completedAt;
        last = e;
      }
    }
  }
  const pending = (e: E) => e.sets.some((s) => s.completedAt === null);
  const exercise = last && pending(last) ? last : exercises.find(pending);
  const set = exercise?.sets.find((s) => s.completedAt === null);
  if (!exercise || !set) return { done, total, current: null, next: null };
  const at = exercise.sets.filter((s) => s.kind === 'working').indexOf(set);
  return {
    done,
    total,
    current: { exercise, set, number: at >= 0 ? at + 1 : null },
    next: exercises.find((e) => e.id !== exercise.id && pending(e)) ?? null,
  };
}
