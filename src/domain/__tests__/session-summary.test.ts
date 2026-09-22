import {
  muscleCredits,
  muscleLevels,
  type SummarySet,
  sessionPrs,
  sessionStats,
} from '../session-summary';

const set = (
  exerciseId: string,
  weight: number | null,
  reps: number | null,
  extra: Partial<SummarySet> = {},
): SummarySet => ({
  exerciseId,
  kind: 'working',
  weight,
  reps,
  unit: 'kg',
  completed: true,
  ...extra,
});

describe('sessionStats', () => {
  it('워밍업·미완료는 빼고 볼륨을 표시 단위로 더한다', () => {
    const sets = [
      set('a', 20, 10, { kind: 'warmup' }),
      set('a', 60, 10),
      set('a', 60, 8),
      set('a', 60, 8, { completed: false }),
      set('b', 45, 10, { unit: 'lb' }),
    ];
    const s = sessionStats(sets, 0, 58 * 60000, 'kg');
    // 45lb → 20.5kg(0.5 단위 반올림)
    expect(s).toEqual({ minutes: 58, sets: 3, volume: 60 * 18 + 205 });
  });
});

describe('muscle levels', () => {
  it('주동 1 · 협응 0.5로 세고 최대 대비 단계로 나눈다', () => {
    const musclesOf = new Map([
      [
        'bench',
        [
          { muscleId: 'chest', role: 'primary' as const },
          { muscleId: 'triceps', role: 'secondary' as const },
        ],
      ],
      ['fly', [{ muscleId: 'chest', role: 'primary' as const }]],
      ['raise', [{ muscleId: 'shoulders', role: 'primary' as const }]],
    ]);
    const credits = muscleCredits(
      [set('bench', 60, 10), set('bench', 60, 10), set('fly', 10, 12), set('raise', 8, 15)],
      musclesOf,
    );
    expect(Object.fromEntries(credits)).toEqual({ chest: 3, triceps: 1, shoulders: 1 });
    expect(Object.fromEntries(muscleLevels(credits))).toEqual({
      chest: 3,
      triceps: 2,
      shoulders: 2,
    });
    expect(muscleLevels(new Map()).size).toBe(0);
  });
});

describe('sessionPrs', () => {
  it('최고 중량 PR은 그 세트, e1RM만 넘으면 추정 1RM, 첫 기록은 제외', () => {
    const bests = new Map([
      ['bench', { weightKg: 60, e1rmKg: 80 }],
      ['ohp', { weightKg: 45, e1rmKg: 50 }],
      ['row', { weightKg: 100, e1rmKg: 120 }],
    ]);
    const prs = sessionPrs(
      [set('bench', 62.5, 10), set('ohp', 40, 12), set('row', 80, 5), set('squat', 100, 5)],
      bests,
      'kg',
    );
    expect(prs).toEqual([
      { exerciseId: 'bench', kind: 'weight', weight: 62.5, reps: 10, unit: 'kg' },
      { exerciseId: 'ohp', kind: 'e1rm', e1rm: 56, unit: 'kg' },
    ]);
  });
});
