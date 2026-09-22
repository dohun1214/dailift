import {
  balanceState,
  DAY_MS,
  groupBalance,
  isStagnant,
  mostFrequentExercise,
  type StatSet,
  sessionBestE1rm,
  weeklyE1rm,
  weeklyProgress,
} from '../stats';

const NOW = 100 * DAY_MS;
const s = (
  workoutId: string,
  daysAgo: number,
  exerciseId: string,
  weight: number,
  reps: number,
): StatSet => ({
  workoutId,
  startedAt: NOW - daysAgo * DAY_MS,
  exerciseId,
  weight,
  reps,
  unit: 'kg',
});

describe('weeklyProgress', () => {
  it('지난 7일과 그 전 7일을 나눈다', () => {
    const p = weeklyProgress(
      [s('a', 1, 'x', 100, 5), s('a', 1, 'x', 100, 5), s('b', 10, 'x', 50, 10)],
      NOW,
      'kg',
    );
    expect(p).toEqual({ current: { volume: 1000, sets: 2 }, previous: { volume: 500, sets: 1 } });
  });
});

describe('groupBalance', () => {
  it('주동 1 · 협응 0.5, 한 세트는 부위당 한 번', () => {
    const musclesOf = new Map([
      [
        'bench',
        [
          { group: 'chest' as const, role: 'primary' as const },
          { group: 'shoulders' as const, role: 'secondary' as const },
          { group: 'arms' as const, role: 'secondary' as const },
        ],
      ],
      [
        'row',
        [
          { group: 'back' as const, role: 'primary' as const },
          { group: 'back' as const, role: 'secondary' as const },
        ],
      ],
    ]);
    const b = groupBalance(
      [
        s('a', 1, 'bench', 60, 10),
        s('a', 1, 'bench', 60, 10),
        s('a', 1, 'row', 50, 10),
        s('z', 9, 'row', 50, 10),
      ],
      NOW,
      musclesOf,
    );
    expect(Object.fromEntries(b)).toEqual({ chest: 2, back: 1, shoulders: 1, legs: 0, arms: 1 });
    expect(balanceState(8, { min: 10, max: 20 })).toBe('low');
    expect(balanceState(22, { min: 10, max: 20 })).toBe('high');
    expect(balanceState(10, { min: 10, max: 20 })).toBe('ok');
  });
});

describe('e1RM', () => {
  it('세션별 최고값과 주별 최고값', () => {
    const sets = [
      s('a', 50, 'bench', 60, 10),
      s('a', 50, 'bench', 70, 1),
      s('b', 3, 'bench', 65, 10),
      s('c', 1, 'ohp', 40, 8),
    ];
    const sessions = sessionBestE1rm(sets, 'bench', 'kg');
    expect(sessions.map((x) => [x.workoutId, Math.round(x.e1rm * 10) / 10])).toEqual([
      ['a', 80],
      ['b', 86.7],
    ]);
    const weeks = weeklyE1rm(sessions, NOW, 8);
    expect(weeks).toHaveLength(8);
    expect(weeks[7]).toBeCloseTo(86.67, 1);
    expect(weeks[0]).toBeCloseTo(80, 1);
    expect(weeks.filter((w) => w === null)).toHaveLength(6);
  });

  it('정체: 4회 이상 · 3주 이상 · 기울기 0 이하', () => {
    const flat = [0, 7, 14, 22].map((d, i) => ({
      startedAt: d * DAY_MS,
      e1rm: [100, 101, 99, 100][i] ?? 0,
    }));
    expect(isStagnant(flat)).toBe(true);
    const up = flat.map((x, i) => ({ ...x, e1rm: 100 + i * 2 }));
    expect(isStagnant(up)).toBe(false);
    expect(isStagnant(flat.slice(0, 3))).toBe(false);
    const short = flat.map((x, i) => ({ ...x, startedAt: i * DAY_MS }));
    expect(isStagnant(short)).toBe(false);
  });

  it('가장 자주 한 종목', () => {
    expect(
      mostFrequentExercise(
        [
          s('a', 1, 'bench', 60, 10),
          s('a', 1, 'bench', 60, 10),
          s('b', 2, 'ohp', 40, 8),
          s('c', 3, 'ohp', 40, 8),
        ],
        NOW,
      ),
    ).toBe('ohp');
    expect(mostFrequentExercise([], NOW)).toBeNull();
  });
});
