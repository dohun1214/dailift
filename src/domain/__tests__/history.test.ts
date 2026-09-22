import { buildHistory, groupByMonth } from '../history';
import type { SummarySet } from '../session-summary';

const s = (exerciseId: string, weight: number, reps: number): SummarySet => ({
  exerciseId,
  kind: 'working',
  weight,
  reps,
  unit: 'kg',
  completed: true,
});

describe('buildHistory', () => {
  it('시간 순으로 기준을 쌓아 PR을 세고 최신 순으로 돌려준다', () => {
    const workouts = [
      { id: 'w2', name: 'B', startedAt: 2_000_000, endedAt: 2_000_000 + 30 * 60000 },
      { id: 'w1', name: 'A', startedAt: 1_000_000, endedAt: 1_000_000 + 60 * 60000 },
      { id: 'w3', name: 'C', startedAt: 3_000_000, endedAt: null },
    ];
    const sets = new Map([
      ['w1', [s('bench', 60, 10), s('squat', 100, 5)]],
      ['w2', [s('bench', 62.5, 8), s('squat', 100, 5)]],
      ['w3', [s('bench', 62.5, 8)]],
    ]);
    const items = buildHistory(workouts, sets, 'kg');
    expect(items.map((i) => [i.id, i.prCount, i.sets, i.minutes])).toEqual([
      ['w3', 0, 1, 0],
      ['w2', 1, 2, 30],
      ['w1', 0, 2, 60],
    ]);
    expect(items[2]?.volume).toBe(1100);
  });
});

describe('groupByMonth', () => {
  it('같은 달끼리 묶는다', () => {
    const base = { name: 'x', endedAt: null, minutes: 0, sets: 0, volume: 0, prCount: 0 };
    const groups = groupByMonth([
      { ...base, id: 'a', startedAt: new Date(2026, 8, 18).getTime() },
      { ...base, id: 'b', startedAt: new Date(2026, 8, 2).getTime() },
      { ...base, id: 'c', startedAt: new Date(2026, 7, 30).getTime() },
    ]);
    expect(groups.map((g) => [g.year, g.month, g.items.map((i) => i.id)])).toEqual([
      [2026, 9, ['a', 'b']],
      [2026, 8, ['c']],
    ]);
  });
});
