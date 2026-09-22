import { toMask } from '@/lib/weekdays';

import {
  daysAgo,
  latestPr,
  streakWeeks,
  todaysRoutine,
  weekStrip,
  workoutsInLast7Days,
} from '../home';
import type { SummarySet } from '../session-summary';

// 2026-09-18 금요일
const NOW = new Date(2026, 8, 18, 10, 0);
const at = (d: number, h = 9) => new Date(2026, 8, d, h).getTime();

describe('weekStrip', () => {
  it('오늘·완료·예정·휴식', () => {
    const strip = weekStrip(NOW, [toMask(['mon', 'thu']), toMask(['sat'])], [at(14), at(16)]);
    expect(strip.map((d) => [d.date.getDate(), d.state])).toEqual([
      [14, 'done'],
      [15, 'rest'],
      [16, 'done'],
      [17, 'rest'],
      [18, 'today'],
      [19, 'plan'],
      [20, 'rest'],
    ]);
  });
});

describe('todaysRoutine', () => {
  it('오늘 요일의 첫 루틴', () => {
    const rs = [
      { id: 'a', weekdays: toMask(['mon']) },
      { id: 'b', weekdays: toMask(['fri']) },
      { id: 'c', weekdays: toMask(['fri']) },
    ];
    expect(todaysRoutine(rs, NOW)?.id).toBe('b');
    expect(todaysRoutine([], NOW)).toBeUndefined();
  });
});

describe('counts', () => {
  it('지난 7일 횟수와 연속 주', () => {
    const starts = [at(14), at(16), at(8), at(10), at(1), at(3)];
    expect(workoutsInLast7Days(starts, NOW.getTime())).toBe(2);
    // 이번 주 2회(목표 2 달성) + 지난주 2회 + 그 전 주 2회 = 3주
    expect(streakWeeks(starts, 2, NOW)).toBe(3);
    // 목표 3이면 이번 주 미달 → 지난주부터: 지난주 2회 미달 → 0
    expect(streakWeeks(starts, 3, NOW)).toBe(0);
    expect(daysAgo(at(16), NOW)).toBe(2);
  });
});

describe('latestPr', () => {
  it('가장 최근 PR', () => {
    const s = (exerciseId: string, weight: number, reps: number): SummarySet => ({
      exerciseId,
      kind: 'working',
      weight,
      reps,
      unit: 'kg',
      completed: true,
    });
    const workouts = [
      { id: 'w1', startedAt: at(10) },
      { id: 'w2', startedAt: at(14) },
      { id: 'w3', startedAt: at(16) },
    ];
    const sets = new Map([
      ['w1', [s('bench', 60, 10)]],
      ['w2', [s('bench', 62.5, 10)]],
      ['w3', [s('bench', 60, 8)]],
    ]);
    const pr = latestPr(workouts, sets, 'kg');
    expect(pr).toMatchObject({
      workoutId: 'w2',
      entry: { kind: 'weight', weight: 62.5, reps: 10 },
    });
    expect(latestPr([], new Map(), 'kg')).toBeNull();
  });
});
