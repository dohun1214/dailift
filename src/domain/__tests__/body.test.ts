import {
  type BodyEntry,
  bodyIssues,
  bodyMass,
  bodyPoints,
  bodyRange,
  defaultBodyPeriod,
  fatMass,
  latestBody,
  metricValue,
  parseExtras,
  proteinChange,
  serializeExtras,
} from '../body';

const DAY = 86_400_000;
const NOW = new Date(2026, 9, 7, 12).getTime();
const entry = (daysAgo: number, patch: Partial<BodyEntry> = {}): BodyEntry => ({
  id: `e${daysAgo}`,
  measuredAt: NOW - daysAgo * DAY,
  weight: 70,
  weightUnit: 'kg',
  skeletalMuscle: 32,
  bodyFatPct: 18,
  extras: {},
  source: 'manual',
  ...patch,
});

describe('체성분 값', () => {
  it('체지방량은 체중 × 체지방률, 하나라도 없으면 없다', () => {
    expect(fatMass(68.5, 16.8)).toBe(11.5);
    expect(fatMass(null, 16.8)).toBeNull();
    expect(fatMass(68.5, null)).toBeNull();
  });

  it('무게는 보여 줄 단위로 바꾸고 0.1 단위로 둔다(0.5로 깎지 않는다)', () => {
    expect(bodyMass(68.3, 'kg', 'kg')).toBe(68.3);
    expect(bodyMass(68.3, 'kg', 'lb')).toBe(150.6);
    expect(bodyMass(150.6, 'lb', 'kg')).toBe(68.3);
    expect(metricValue(entry(0, { weight: 150.6, weightUnit: 'lb' }), 'weight', 'kg')).toBe(68.3);
    expect(metricValue(entry(0), 'fat', 'lb')).toBe(18);
    expect(metricValue(entry(0, { skeletalMuscle: null }), 'muscle', 'kg')).toBeNull();
  });

  it('골라 적는 값은 아는 칸의 숫자만 남긴다', () => {
    expect(parseExtras('{"bmi":22.4,"bmr":1602,"score":80,"water":"x"}')).toEqual({
      bmi: 22.4,
      bmr: 1602,
    });
    expect(parseExtras('not json')).toEqual({});
    expect(parseExtras(null)).toEqual({});
    expect(serializeExtras({})).toBeNull();
    expect(serializeExtras({ bmi: 22.4 })).toBe('{"bmi":22.4}');
  });
});

describe('그래프 점 · 최근 값', () => {
  const entries = [
    entry(120, { weight: 72 }),
    entry(60, { weight: 71, skeletalMuscle: null, bodyFatPct: null }),
    entry(0, { weight: 68.5, skeletalMuscle: 32.1, bodyFatPct: 16.8 }),
    entry(30, { weight: 69.4, skeletalMuscle: 31.8, bodyFatPct: 17.9 }),
  ];

  it('그 항목을 적은 기록만 오래된 순으로, 기간 안의 것만', () => {
    expect(bodyPoints(entries, 'weight', 'kg', 'all', NOW).map((p) => p.value)).toEqual([
      72, 71, 69.4, 68.5,
    ]);
    expect(bodyPoints(entries, 'weight', 'kg', '3m', NOW).map((p) => p.value)).toEqual([
      71, 69.4, 68.5,
    ]);
    expect(bodyPoints(entries, 'fat', 'kg', 'all', NOW).map((p) => p.value)).toEqual([
      18, 17.9, 16.8,
    ]);
  });

  it('위 세 칸은 항목마다 가장 최근에 적은 값', () => {
    const only = [
      entry(10, { weight: 70, skeletalMuscle: 31, bodyFatPct: 19 }),
      entry(0, { weight: 69, skeletalMuscle: null, bodyFatPct: null }),
    ];
    expect(latestBody(only, 'kg')).toEqual({
      at: NOW,
      values: { weight: 69, muscle: 31, fat: 19 },
    });
    expect(latestBody([], 'kg')).toEqual({
      at: null,
      values: { weight: null, muscle: null, fat: null },
    });
  });

  it('처음 기간: 최근 3개월에 점이 둘 이상이면 3개월, 아니면 전체', () => {
    expect(defaultBodyPeriod(bodyPoints(entries, 'weight', 'kg', 'all', NOW), NOW)).toBe('3m');
    expect(
      defaultBodyPeriod(bodyPoints([entry(200), entry(0)], 'weight', 'kg', 'all', NOW), NOW),
    ).toBe('all');
  });
});

describe('입력 검사', () => {
  const ok = { weight: 68.5, skeletalMuscle: 32.1, bodyFatPct: 16.8, extras: {} };

  it('세 가지 가운데 하나만 적어도 되고, 하나도 없으면 안 된다', () => {
    expect(bodyIssues(ok, 'kg')).toEqual([]);
    expect(bodyIssues({ ...ok, skeletalMuscle: null, bodyFatPct: null }, 'kg')).toEqual([]);
    expect(
      bodyIssues(
        { weight: null, skeletalMuscle: null, bodyFatPct: null, extras: { bmi: 22 } },
        'kg',
      ),
    ).toBe('empty');
  });

  it('범위를 벗어난 칸을 알려 준다', () => {
    expect(bodyIssues({ ...ok, weight: 5 }, 'kg')).toEqual(['weight']);
    expect(bodyIssues({ ...ok, bodyFatPct: 90 }, 'kg')).toEqual(['fat']);
    expect(bodyIssues({ ...ok, extras: { bmi: 200, bmr: 1602.5, visceralFat: 5 } }, 'kg')).toEqual([
      'bmi',
      'bmr',
    ]);
  });

  it('골격근량이 체중보다 크면 안 된다', () => {
    expect(bodyIssues({ ...ok, skeletalMuscle: 70 }, 'kg')).toEqual(['muscle']);
  });

  it('무게인 값의 범위는 단위를 따른다', () => {
    expect(bodyRange('muscle', 'kg')).toEqual({ min: 5, max: 100 });
    expect(bodyRange('muscle', 'lb')).toEqual({ min: 11, max: 220.5 });
    expect(bodyRange('bmi', 'lb')).toEqual({ min: 5, max: 80 });
  });
});

describe('단백질 목표 묻기', () => {
  const perKg = { proteinMode: 'perKg' as const, proteinPerKg: 2 };

  it('목표가 달라지면 얼마에서 얼마로 바뀌는지 알려 준다', () => {
    expect(
      proteinChange({ weight: 70.2, unit: 'kg' }, { weight: 68.5, unit: 'kg' }, 'muscle', perKg),
    ).toEqual({ from: 140, to: 135 });
  });

  it('몸무게를 처음 적는 것이면 from이 없다', () => {
    expect(
      proteinChange({ weight: null, unit: 'kg' }, { weight: 68.5, unit: 'kg' }, 'muscle', perKg),
    ).toEqual({ from: null, to: 135 });
  });

  it('목표가 그대로이거나 직접 숫자로 정했으면 묻지 않는다', () => {
    expect(
      proteinChange({ weight: 70.2, unit: 'kg' }, { weight: 70.4, unit: 'kg' }, 'muscle', perKg),
    ).toBeNull();
    expect(
      proteinChange({ weight: 70.2, unit: 'kg' }, { weight: 60, unit: 'kg' }, 'muscle', {
        proteinMode: 'direct',
        proteinPerKg: null,
      }),
    ).toBeNull();
  });
});
