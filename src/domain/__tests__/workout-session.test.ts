import {
  contiguousRange,
  followerSetIds,
  isStaleWorkout,
  STALE_WORKOUT_MS,
} from '../workout-session';

const set = (
  id: string,
  over: Partial<{
    kind: 'working' | 'warmup' | 'drop' | 'failure';
    completedAt: number | null;
    weight: number | null;
    reps: number | null;
    durationSec: number | null;
  }> = {},
) => ({
  id,
  kind: 'working' as const,
  completedAt: null,
  weight: null,
  reps: null,
  durationSec: null,
  ...over,
});

describe('isStaleWorkout', () => {
  it('마지막 기록에서 3시간이 넘어야 오래된 운동이다', () => {
    expect(isStaleWorkout(0, STALE_WORKOUT_MS)).toBe(false);
    expect(isStaleWorkout(0, STALE_WORKOUT_MS + 1)).toBe(true);
  });
});

describe('followerSetIds', () => {
  it('아래쪽 미완료 본 세트 중 비어 있거나 고치기 전 값과 같은 칸', () => {
    const sets = [
      set('w', { kind: 'warmup', weight: 20 }),
      set('a', { weight: 60 }),
      set('b', { weight: 60 }),
      set('c', { weight: 0 }),
      set('d', { weight: 55 }),
      set('e', { weight: 60, completedAt: 1 }),
      set('f', { kind: 'drop', weight: 60 }),
      set('g'),
    ];
    expect(followerSetIds(sets, 'a', 'weight')).toEqual(['b', 'c', 'g']);
    expect(followerSetIds(sets, 'b', 'weight')).toEqual(['c', 'g']);
    // 횟수는 모두 비어 있어 미완료 본 세트가 다 따라온다
    expect(followerSetIds(sets, 'a', 'reps')).toEqual(['b', 'c', 'd', 'g']);
  });

  it('워밍업·드롭 세트나 없는 세트를 고칠 때는 없다', () => {
    const sets = [set('w', { kind: 'warmup' }), set('a'), set('f', { kind: 'drop' }), set('b')];
    expect(followerSetIds(sets, 'w', 'weight')).toEqual([]);
    expect(followerSetIds(sets, 'f', 'weight')).toEqual([]);
    expect(followerSetIds(sets, 'x', 'weight')).toEqual([]);
  });
});

describe('contiguousRange', () => {
  it('이어진 숫자면 처음과 끝, 아니면 null', () => {
    expect(contiguousRange([2, 3, 4])).toEqual([2, 4]);
    expect(contiguousRange([3])).toEqual([3, 3]);
    expect(contiguousRange([2, 4])).toBeNull();
    expect(contiguousRange([])).toBeNull();
  });
});
