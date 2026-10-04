import {
  applyTargetIds,
  contiguousRange,
  isStaleWorkout,
  STALE_WORKOUT_MS,
  workoutProgress,
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

describe('applyTargetIds', () => {
  it('아래쪽 미완료 본 세트 중 값이 다른 칸', () => {
    const sets = [
      set('w', { kind: 'warmup', weight: 20 }),
      set('a', { weight: 60 }),
      set('b', { weight: 60 }),
      set('c', { weight: 0 }),
      set('d', { weight: 55 }),
      set('e', { weight: 50, completedAt: 1 }),
      set('f', { kind: 'drop', weight: 40 }),
      set('g'),
    ];
    expect(applyTargetIds(sets, 'a', 'weight')).toEqual(['c', 'd', 'g']);
    expect(applyTargetIds(sets, 'd', 'weight')).toEqual(['g']);
    // 위쪽 세트는 건드리지 않는다
    expect(applyTargetIds(sets, 'g', 'weight')).toEqual([]);
  });

  it('값이 비어 있거나 모두 같거나 본 세트가 아니면 없다', () => {
    const sets = [
      set('w', { kind: 'warmup', weight: 20 }),
      set('a', { weight: 60 }),
      set('b', { weight: 60 }),
    ];
    expect(applyTargetIds(sets, 'a', 'weight')).toEqual([]);
    expect(applyTargetIds(sets, 'a', 'reps')).toEqual([]);
    expect(applyTargetIds(sets, 'w', 'weight')).toEqual([]);
    expect(applyTargetIds(sets, 'x', 'weight')).toEqual([]);
  });
});

describe('workoutProgress', () => {
  const ex = (id: string, sets: ReturnType<typeof set>[]) => ({ id, sets });

  it('마지막으로 세트를 완료한 종목이 지금 종목이다', () => {
    const exercises = [
      ex('bench', [set('b1'), set('b2')]),
      ex('row', [
        set('rw', { kind: 'warmup', completedAt: 10 }),
        set('r1', { completedAt: 20 }),
        set('r2'),
      ]),
      ex('curl', [set('c1')]),
    ];
    const p = workoutProgress(exercises);
    expect([p.done, p.total]).toEqual([2, 6]);
    expect(p.current?.exercise.id).toBe('row');
    expect(p.current?.set.id).toBe('r2');
    expect(p.current?.number).toBe(2);
    expect(p.next?.id).toBe('bench');
  });

  it('그 종목을 다 마쳤으면 세트가 남은 첫 종목, 워밍업은 번호가 없다', () => {
    const exercises = [
      ex('bench', [set('b1', { completedAt: 5 })]),
      ex('row', [set('rw', { kind: 'warmup' }), set('r1')]),
    ];
    const p = workoutProgress(exercises);
    expect(p.current?.exercise.id).toBe('row');
    expect(p.current?.number).toBeNull();
    expect(p.next).toBeNull();
  });

  it('다 마쳤거나 세트가 없으면 지금 세트가 없다', () => {
    expect(workoutProgress([ex('bench', [set('b1', { completedAt: 5 })])])).toEqual({
      done: 1,
      total: 1,
      current: null,
      next: null,
    });
    expect(workoutProgress([]).total).toBe(0);
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
