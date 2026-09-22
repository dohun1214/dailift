import { buildRoutineSections, estimateMinutes } from '../routine';

describe('estimateMinutes', () => {
  it('종목이 없으면 0', () => {
    expect(estimateMinutes([])).toBe(0);
  });

  it('세트·휴식·전환 시간을 더해 5분 단위로 반올림한다', () => {
    // 4세트×45초 + 3휴식×120초 + 전환 180초 = 720초 = 12분 → 10
    expect(estimateMinutes([{ targetSets: 4, restSec: 120 }])).toBe(10);
    // 5종목 × (4×45 + 3×90 + 180) = 3150초 = 52.5분 → 55
    expect(estimateMinutes(Array.from({ length: 5 }, () => ({ targetSets: 4, restSec: 90 })))).toBe(
      55,
    );
  });

  it('최소 5분', () => {
    expect(estimateMinutes([{ targetSets: 1, restSec: 0 }])).toBe(5);
  });
});

describe('buildRoutineSections', () => {
  const g = (id: string, sortOrder: number) => ({
    id,
    name: id,
    rotationMode: 0,
    sortOrder,
    createdAt: 0,
  });
  const r = (id: string, groupId: string | null, sortOrder: number, createdAt = 0) => ({
    id,
    groupId,
    name: id,
    weekdays: 0,
    sortOrder,
    createdAt,
  });

  it('묶음 순서대로, 빈 묶음은 빼고, 단독 루틴은 마지막', () => {
    const sections = buildRoutineSections(
      [g('g2', 1), g('g1', 0), g('empty', 2)],
      [
        r('solo', null, 0),
        r('b', 'g1', 1),
        r('a', 'g1', 0),
        r('c', 'g2', 0),
        r('orphan', 'gone', 0, 1),
      ],
      [
        { routineId: 'a', targetSets: 3, restSec: 90 },
        { routineId: 'a', targetSets: 3, restSec: 90 },
      ],
    );
    expect(sections.map((s) => [s.group?.id ?? null, s.routines.map((x) => x.id)])).toEqual([
      ['g1', ['a', 'b']],
      ['g2', ['c']],
      [null, ['solo', 'orphan']],
    ]);
    expect(sections[0]?.routines[0]).toMatchObject({ exerciseCount: 2 });
    expect(sections[0]?.routines[1]).toMatchObject({ exerciseCount: 0, minutes: 0 });
  });
});
