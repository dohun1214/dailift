import {
  differsFromPlan,
  parseSetPlan,
  planAchieved,
  planFromRange,
  planIssue,
  planSummary,
  rangeFromPlan,
  routineChanges,
  type SetPlan,
  serializeSetPlan,
} from '../set-plan';

const w = (weight: number | null, reps: number | null) => ({
  kind: 'working' as const,
  weight,
  reps,
  durationSec: null,
});
const warm = (weight: number | null, reps: number | null) => ({
  ...w(weight, reps),
  kind: 'warmup' as const,
});
const plan: SetPlan = { unit: 'kg', sets: [warm(40, 5), w(60, 10), w(62.5, 8), w(65, 6)] };

describe('parseSetPlan', () => {
  it('저장한 그대로 읽고, 깨졌거나 본 세트가 없으면 null', () => {
    expect(parseSetPlan(serializeSetPlan(plan))).toEqual(plan);
    expect(parseSetPlan(null)).toBeNull();
    expect(parseSetPlan('')).toBeNull();
    expect(parseSetPlan('{oops')).toBeNull();
    expect(parseSetPlan(JSON.stringify({ unit: 'kg', sets: [warm(20, 5)] }))).toBeNull();
    expect(parseSetPlan(JSON.stringify({ unit: 'stone', sets: [w(1, 1)] }))).toBeNull();
    expect(serializeSetPlan(null)).toBeNull();
  });
});

describe('planIssue', () => {
  it('본 세트가 있어야 하고 값은 범위 안', () => {
    expect(planIssue(plan)).toBeNull();
    expect(planIssue({ unit: 'kg', sets: [w(null, null)] })).toBeNull();
    expect(planIssue({ unit: 'kg', sets: [warm(20, 5)] })).toBe('noWorking');
    expect(planIssue({ unit: 'kg', sets: [w(60, 2.5)] })).toBe('value');
    expect(planIssue({ unit: 'kg', sets: [w(-1, 5)] })).toBe('value');
    expect(planIssue({ unit: 'kg', sets: Array.from({ length: 21 }, () => w(60, 5)) })).toBe(
      'tooMany',
    );
  });
});

describe('범위 ↔ 세트별', () => {
  it('세트 수만큼 줄을 만들고, 돌아갈 때는 본 세트 수와 횟수 범위', () => {
    expect(planFromRange({ targetSets: 3, repMin: 8 }, 'lb', false)).toEqual({
      unit: 'lb',
      sets: [w(null, 8), w(null, 8), w(null, 8)],
    });
    expect(planFromRange({ targetSets: 2, repMin: 30 }, 'kg', true).sets[0]).toEqual({
      kind: 'working',
      weight: null,
      reps: null,
      durationSec: 30,
    });
    expect(rangeFromPlan(plan, false)).toEqual({ targetSets: 3, range: { min: 6, max: 10 } });
    expect(rangeFromPlan({ unit: 'kg', sets: [w(60, null)] }, false).range).toBeNull();
  });

  it('요약: 워밍업 수 · 본 세트 수 · 무게 범위', () => {
    expect(planSummary(plan)).toEqual({ warmups: 1, working: 3, weight: { min: 60, max: 65 } });
    expect(planSummary({ unit: 'kg', sets: [w(null, 10)] }).weight).toBeNull();
  });
});

describe('differsFromPlan · planAchieved', () => {
  const done = (kind: 'warmup' | 'working' | 'drop', weight: number, reps: number) => ({
    kind,
    weight,
    reps,
    durationSec: null,
  });

  it('세트 수 · 무게 · 횟수가 같으면 같은 것', () => {
    const same = [
      done('warmup', 40, 5),
      done('working', 60, 10),
      done('working', 62.5, 8),
      done('working', 65, 6),
    ];
    expect(differsFromPlan(plan, same, 'kg')).toBe(false);
    expect(differsFromPlan(plan, same.slice(0, 3), 'kg')).toBe(true);
    expect(
      differsFromPlan(
        plan,
        [same[0], done('working', 62.5, 10), same[2], same[3]].filter(Boolean) as typeof same,
        'kg',
      ),
    ).toBe(true);
    // 빈 칸과 0은 같은 값으로 본다
    expect(
      differsFromPlan({ unit: 'kg', sets: [w(null, 10)] }, [done('working', 0, 10)], 'kg'),
    ).toBe(false);
  });

  it('지난번에 본 세트를 모두 채웠을 때만 안내', () => {
    const last = [
      { weight: 60, reps: 10, durationSec: null },
      { weight: 62.5, reps: 8, durationSec: null },
      { weight: 65, reps: 7, durationSec: null },
    ];
    expect(planAchieved(plan, last, 'kg')).toBe(true);
    expect(planAchieved(plan, last.slice(0, 2), 'kg')).toBe(false);
    expect(
      planAchieved(
        plan,
        [last[0], last[1], { weight: 65, reps: 5, durationSec: null }].filter(
          Boolean,
        ) as typeof last,
        'kg',
      ),
    ).toBe(false);
    expect(planAchieved(plan, [], 'kg')).toBe(false);
  });
});

describe('routineChanges', () => {
  const row = (weight: number | null, reps: number | null) => ({
    kind: 'working' as const,
    weight,
    reps,
    durationSec: null,
  });
  /** 세트 줄과 그중 앞에서부터 완료한 수 */
  const item = (
    exerciseId: string,
    restSec: number,
    sets: ReturnType<typeof row>[],
    done: number,
  ) => ({
    exerciseId,
    restSec,
    sets,
    doneCount: done,
    doneWorking: done,
  });
  const routine = [
    {
      id: 'r1',
      exerciseId: 'bench',
      plan: { unit: 'kg' as const, sets: [w(60, 10), w(60, 10), w(60, 10)] },
    },
    { id: 'r2', exerciseId: 'row', plan: null },
    { id: 'r3', exerciseId: 'raise', plan: null },
  ];

  it('루틴대로 했으면 바뀐 것이 없다', () => {
    expect(
      routineChanges(
        routine,
        [
          item('bench', 90, [row(60, 10), row(60, 10), row(60, 10)], 3),
          item('row', 90, [row(50, 8)], 1),
          // 목록에 남겨 두고 하나도 안 한 종목은 뺀 것이 아니다
          item('raise', 60, [row(null, null)], 0),
        ],
        'kg',
      ),
    ).toEqual([]);
  });

  it('세트를 일부만 하고 끝낸 것은 다른 게 아니다', () => {
    expect(
      routineChanges(
        routine.slice(0, 1),
        [item('bench', 90, [row(60, 10), row(60, 10), row(60, 10)], 1)],
        'kg',
      ),
    ).toEqual([]);
  });

  it('세트 줄을 지우거나 더하면 바뀐 종목이다', () => {
    const removed = routineChanges(
      routine.slice(0, 1),
      [item('bench', 90, [row(60, 10), row(60, 10)], 2)],
      'kg',
    );
    expect(removed).toEqual([
      {
        type: 'sets',
        routineExerciseId: 'r1',
        exerciseId: 'bench',
        plan: { unit: 'kg', sets: [w(60, 10), w(60, 10)] },
      },
    ]);
    const added = routineChanges(
      routine.slice(0, 1),
      [item('bench', 90, [row(60, 10), row(60, 10), row(60, 10), row(60, 10)], 1)],
      'kg',
    );
    expect(added[0]?.type).toBe('sets');
  });

  it('무게를 고친 세트 · 추가한 종목 · 뺀 종목', () => {
    const changes = routineChanges(
      routine,
      [
        // 한 세트만 무게를 올려서 하고 끝냈다: 안 한 줄은 원래 값 그대로 루틴에 남는다
        item('bench', 90, [row(62.5, 10), row(60, 10), row(60, 10)], 1),
        item('fly', 60, [row(20, 12), row(20, 12), row(20, 12)], 2),
        item('row', 90, [row(50, 8)], 1),
        // 추가만 하고 안 한 종목은 넣지 않는다
        item('curl', 60, [row(null, null)], 0),
      ],
      'kg',
    );
    expect(changes).toEqual([
      {
        type: 'sets',
        routineExerciseId: 'r1',
        exerciseId: 'bench',
        plan: { unit: 'kg', sets: [w(62.5, 10), w(60, 10), w(60, 10)] },
      },
      { type: 'added', exerciseId: 'fly', afterExerciseId: 'bench', targetSets: 2, restSec: 60 },
      { type: 'removed', routineExerciseId: 'r3', exerciseId: 'raise' },
    ]);
  });

  it('세트별로 정한 종목을 하나도 안 했으면 계획을 그대로 둔다', () => {
    expect(
      routineChanges(routine.slice(0, 1), [item('bench', 90, [row(70, 10)], 0)], 'kg'),
    ).toEqual([]);
  });
});
