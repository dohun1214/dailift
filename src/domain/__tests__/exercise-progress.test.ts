import {
  bestSession,
  defaultPeriod,
  exerciseSessions,
  hasEarlier,
  metricsFor,
  monthMarks,
  type ProgressSet,
  progressAxis,
  progressPoints,
} from '../exercise-progress';

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date(2026, 9, 5, 12).getTime();

function set(
  workoutId: string,
  daysAgo: number,
  weight: number | null,
  reps: number | null,
  durationSec: number | null = null,
): ProgressSet {
  return { workoutId, startedAt: NOW - daysAgo * DAY, weight, reps, durationSec, unit: 'kg' };
}

describe('metricsFor', () => {
  it('무게 종목만 추정 1RM을 고를 수 있다', () => {
    expect(metricsFor('weight_reps')).toEqual(['max', 'e1rm', 'volume']);
    expect(metricsFor('bodyweight_reps')).toEqual(['max', 'volume']);
    expect(metricsFor('time')).toEqual(['max', 'volume']);
  });
});

describe('exerciseSessions', () => {
  it('무게 종목: 그날 최고 무게, 추정 1RM, 볼륨', () => {
    const sessions = exerciseSessions(
      [set('a', 7, 60, 10), set('a', 7, 62.5, 8), set('a', 7, 62.5, 7), set('b', 0, 62.5, 10)],
      'weight_reps',
      'kg',
    );
    expect(sessions.map((s) => s.workoutId)).toEqual(['a', 'b']);
    expect(sessions[0]?.max).toBe(62.5);
    expect(sessions[0]?.maxReps).toBe(8);
    expect(sessions[0]?.e1rm).toBeCloseTo(80, 5);
    expect(sessions[0]?.volume).toBe(60 * 10 + 62.5 * 15);
    expect(sessions[0]?.sets).toHaveLength(3);
    expect(sessions[1]?.e1rm).toBeCloseTo(62.5 * (1 + 10 / 30), 5);
  });

  it('무게나 횟수가 없는 세트는 빼고, 남는 세트가 없는 날은 없다', () => {
    const sessions = exerciseSessions(
      [set('a', 3, null, 10), set('a', 3, 50, null), set('b', 1, 50, 5)],
      'weight_reps',
      'kg',
    );
    expect(sessions.map((s) => s.workoutId)).toEqual(['b']);
  });

  it('13회 이상은 추정 1RM이 없다', () => {
    const [s] = exerciseSessions([set('a', 1, 40, 15)], 'weight_reps', 'kg');
    expect(s?.e1rm).toBeNull();
    expect(s?.max).toBe(40);
  });

  it('표시 단위로 바꾼다', () => {
    const [s] = exerciseSessions([{ ...set('a', 1, 100, 5), unit: 'lb' }], 'weight_reps', 'kg');
    expect(s?.max).toBe(45.5);
  });

  it('맨몸 종목: 최고 횟수와 총 횟수', () => {
    const [s] = exerciseSessions(
      [set('a', 1, null, 10), set('a', 1, null, 9), set('a', 1, 10, 8)],
      'bodyweight_reps',
      'kg',
    );
    expect(s?.max).toBe(10);
    expect(s?.volume).toBe(27);
    expect(s?.e1rm).toBeNull();
  });

  it('시간 종목: 최장 시간과 총 시간', () => {
    const [s] = exerciseSessions(
      [set('a', 1, null, null, 130), set('a', 1, null, null, 100), set('a', 1, null, null, 0)],
      'time',
      'kg',
    );
    expect(s?.max).toBe(130);
    expect(s?.volume).toBe(230);
    expect(s?.sets).toHaveLength(2);
  });
});

describe('기간', () => {
  const sessions = exerciseSessions(
    [set('old', 200, 50, 10), set('mid', 60, 55, 10), set('new', 5, 60, 13)],
    'weight_reps',
    'kg',
  );

  it('기간 안의 날만 고른다', () => {
    expect(progressPoints(sessions, 'max', '1m', NOW).map((p) => p.value)).toEqual([60]);
    expect(progressPoints(sessions, 'max', '3m', NOW).map((p) => p.value)).toEqual([55, 60]);
    expect(progressPoints(sessions, 'max', 'all', NOW).map((p) => p.value)).toEqual([50, 55, 60]);
  });

  it('값이 없는 날은 그 값의 그래프에서 빠진다', () => {
    expect(progressPoints(sessions, 'e1rm', 'all', NOW)).toHaveLength(2);
  });

  it('3개월에 점이 둘 이상이면 3개월, 아니면 전체로 연다', () => {
    expect(defaultPeriod(sessions, NOW)).toBe('3m');
    expect(defaultPeriod(sessions.slice(0, 2), NOW)).toBe('all');
  });

  it('기간보다 앞선 기록이 있는지', () => {
    expect(hasEarlier(sessions, '3m', NOW)).toBe(true);
    expect(hasEarlier(sessions.slice(1), '3m', NOW)).toBe(false);
    expect(hasEarlier(sessions, 'all', NOW)).toBe(false);
  });
});

describe('bestSession', () => {
  it('무게가 같으면 횟수가 많은 날, 모두 같으면 먼저 세운 날', () => {
    const sessions = exerciseSessions(
      [set('a', 20, 62.5, 9), set('b', 10, 62.5, 10), set('c', 1, 62.5, 10)],
      'weight_reps',
      'kg',
    );
    expect(bestSession(sessions)?.workoutId).toBe('b');
    expect(bestSession([])).toBeNull();
  });
});

describe('progressAxis', () => {
  it('값을 모두 담는 눈금', () => {
    expect(progressAxis([55, 57.5, 62.5], 'decimal').ticks).toEqual([55, 57.5, 60, 62.5]);
    expect(progressAxis([73.3, 83.3], 'decimal').ticks).toEqual([70, 75, 80, 85]);
    expect(progressAxis([1375, 1813], 'decimal').ticks).toEqual([1250, 1500, 1750, 2000]);
  });

  it('횟수는 정수 눈금', () => {
    expect(progressAxis([6, 10], 'integer').ticks).toEqual([6, 8, 10]);
    expect(progressAxis([8, 9], 'integer').ticks).toEqual([8, 9]);
  });

  it('시간은 읽기 쉬운 간격', () => {
    expect(progressAxis([60, 130], 'time').ticks).toEqual([60, 90, 120, 150]);
  });

  it('값이 모두 같아도 눈금이 나온다', () => {
    const axis = progressAxis([60, 60], 'decimal');
    expect(axis.ticks).toEqual([59.5, 60, 60.5]);
    expect(axis.min).toBeLessThan(axis.max);
  });
});

describe('monthMarks', () => {
  it('달이 바뀌는 첫 점', () => {
    const at = (m: number, d: number) => new Date(2026, m, d).getTime();
    expect(monthMarks([at(6, 6), at(6, 13), at(7, 3), at(7, 10), at(8, 7)])).toEqual([0, 2, 4]);
  });

  it('많으면 넷까지만', () => {
    const ats = Array.from({ length: 12 }, (_, m) => new Date(2026, m, 1).getTime());
    expect(monthMarks(ats)).toEqual([0, 4, 7, 11]);
  });
});
