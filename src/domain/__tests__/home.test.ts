import { toMask } from '@/lib/weekdays';

import {
  daysAgo,
  dayWhen,
  latestPr,
  minWeekOffset,
  pastWorkoutStart,
  routinesOn,
  streakWeeks,
  todaysRoutine,
  todaysWorkout,
  weekStrip,
  workoutsOn,
  workoutsThisWeek,
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

  it('오늘 칸은 운동을 마쳤는지도 알려 준다', () => {
    const before = weekStrip(NOW, [], [at(14)]);
    expect(before[4]).toMatchObject({ state: 'today', done: false });
    const after = weekStrip(NOW, [], [at(14), at(18, 7)]);
    expect(after[4]).toMatchObject({ state: 'today', done: true });
    expect(after[0]).toMatchObject({ state: 'done', done: true });
  });
});

describe('주 넘기기', () => {
  it('지난주: 운동한 날만 표시하고 예정은 표시하지 않는다', () => {
    const strip = weekStrip(NOW, [toMask(['mon', 'thu'])], [at(9), at(14)], -1);
    expect(strip.map((d) => [d.date.getDate(), d.state])).toEqual([
      [7, 'rest'],
      [8, 'rest'],
      [9, 'done'],
      [10, 'rest'],
      [11, 'rest'],
      [12, 'rest'],
      [13, 'rest'],
    ]);
  });

  it('다음 주: 루틴이 잡힌 요일은 예정', () => {
    const strip = weekStrip(NOW, [toMask(['mon', 'thu'])], [], 1);
    expect(strip.map((d) => [d.date.getDate(), d.state])).toEqual([
      [21, 'plan'],
      [22, 'rest'],
      [23, 'rest'],
      [24, 'plan'],
      [25, 'rest'],
      [26, 'rest'],
      [27, 'rest'],
    ]);
  });

  it('뒤로는 첫 기록이 있는 주까지', () => {
    expect(minWeekOffset([], NOW)).toBe(0);
    expect(minWeekOffset([at(16)], NOW)).toBe(0);
    expect(minWeekOffset([at(13), at(16)], NOW)).toBe(-1);
    expect(minWeekOffset([new Date(2026, 7, 3, 9).getTime()], NOW)).toBe(-6);
  });
});

describe('날짜 칸을 눌렀을 때', () => {
  it('지난 날 · 오늘 · 앞으로 올 날', () => {
    expect(dayWhen(new Date(2026, 8, 17), NOW)).toBe('past');
    expect(dayWhen(new Date(2026, 8, 18, 23), NOW)).toBe('today');
    expect(dayWhen(new Date(2026, 8, 19), NOW)).toBe('future');
  });

  it('그 요일에 잡힌 루틴들', () => {
    const routines = [
      { id: 'a', weekdays: toMask(['mon', 'sat']) },
      { id: 'b', weekdays: toMask(['tue']) },
      { id: 'c', weekdays: toMask(['sat']) },
    ];
    expect(routinesOn(routines, new Date(2026, 8, 19)).map((r) => r.id)).toEqual(['a', 'c']);
    expect(routinesOn(routines, new Date(2026, 8, 20))).toEqual([]);
  });

  it('그 날 한 운동들은 시작한 순서대로', () => {
    const list = [
      { id: 'late', startedAt: at(16, 19) },
      { id: 'other', startedAt: at(15) },
      { id: 'early', startedAt: at(16, 7) },
    ];
    expect(workoutsOn(list, new Date(2026, 8, 16)).map((w) => w.id)).toEqual(['early', 'late']);
  });

  it('지난 날 기록은 그날 정오에 시작한 것으로 둔다', () => {
    expect(pastWorkoutStart(new Date(2026, 8, 15, 22, 30))).toBe(at(15, 12));
  });
});

describe('todaysWorkout', () => {
  it('오늘 마친 운동 중 가장 최근 것', () => {
    const list = [
      { id: 'old', startedAt: at(17, 20) },
      { id: 'morning', startedAt: at(18, 7) },
      { id: 'evening', startedAt: at(18, 19) },
    ];
    expect(todaysWorkout(list, NOW)?.id).toBe('evening');
    expect(todaysWorkout(list.slice(0, 1), NOW)).toBeUndefined();
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
  it('이번 주 횟수와 연속 주', () => {
    const starts = [at(14), at(16), at(8), at(10), at(1), at(3)];
    expect(workoutsThisWeek(starts, NOW)).toBe(2);
    // 월요일 0시부터 센다: 일요일(13일)은 지난주, 아직 오지 않은 시각은 빼고
    expect(workoutsThisWeek([at(13, 23), at(14, 0), at(18, 9), at(18, 11)], NOW)).toBe(2);
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
