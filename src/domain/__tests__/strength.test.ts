import {
  bestOf,
  convertWeight,
  epley1RM,
  isPersonalRecord,
  suggestNext,
  warmupSets,
} from '../strength';

describe('epley1RM', () => {
  it('1회는 그대로, 범위 밖은 null', () => {
    expect(epley1RM(100, 1)).toBe(100);
    expect(epley1RM(100, 10)).toBeCloseTo(133.33, 1);
    expect(epley1RM(100, 13)).toBeNull();
    expect(epley1RM(0, 5)).toBeNull();
  });
});

describe('suggestNext', () => {
  const target = { repMin: 8, repMax: 10, increment: 2.5 };

  it('모든 세트가 상한이면 증량', () => {
    const s = suggestNext(
      [
        [
          { weight: 60, reps: 10 },
          { weight: 60, reps: 10 },
          { weight: 60, reps: 11 },
        ],
      ],
      target,
    );
    expect(s).toEqual({ kind: 'increase', weight: 62.5, sets: 3, reps: 10 });
  });

  it('상한에 못 미친 세트가 있으면 같은 무게', () => {
    expect(
      suggestNext(
        [
          [
            { weight: 60, reps: 10 },
            { weight: 60, reps: 9 },
          ],
        ],
        target,
      ),
    ).toEqual({
      kind: 'repeat',
      weight: 60,
    });
  });

  it('두 번 연속 하한 미달이면 감량', () => {
    const s = suggestNext([[{ weight: 60, reps: 7 }], [{ weight: 60, reps: 6 }]], target);
    expect(s).toEqual({ kind: 'decrease', weight: 55 });
  });

  it('한 번만 미달이면 유지, 기록 없으면 null', () => {
    expect(suggestNext([[{ weight: 60, reps: 7 }], [{ weight: 60, reps: 9 }]], target)?.kind).toBe(
      'repeat',
    );
    expect(suggestNext([], target)).toBeNull();
    expect(suggestNext([[{ weight: null, reps: 10 }]], target)).toBeNull();
  });
});

describe('warmupSets', () => {
  it('100kg 본세트', () => {
    expect(warmupSets(100, 'kg')).toEqual([
      { weight: 20, reps: 10 },
      { weight: 45, reps: 5 },
      { weight: 65, reps: 3 },
      { weight: 85, reps: 2 },
    ]);
  });

  it('가벼우면 단계를 줄인다', () => {
    expect(warmupSets(30, 'kg')).toEqual([
      { weight: 20, reps: 10 },
      { weight: 25, reps: 2 },
    ]);
    expect(warmupSets(22.5, 'kg')).toEqual([{ weight: 20, reps: 10 }]);
    expect(warmupSets(20, 'kg')).toEqual([]);
  });

  it('lb는 45 바, 5 간격', () => {
    expect(warmupSets(225, 'lb')).toEqual([
      { weight: 45, reps: 10 },
      { weight: 100, reps: 5 },
      { weight: 145, reps: 3 },
      { weight: 190, reps: 2 },
    ]);
  });
});

describe('PR', () => {
  it('지난 최고 중량이나 e1RM을 넘으면 PR', () => {
    const best = bestOf([
      { weight: 60, reps: 10, unit: 'kg' },
      { weight: 62.5, reps: 5, unit: 'kg' },
    ]);
    expect(best?.weightKg).toBe(62.5);
    expect(isPersonalRecord({ weight: 65, reps: 1, unit: 'kg' }, best)).toBe(true);
    expect(isPersonalRecord({ weight: 60, reps: 12, unit: 'kg' }, best)).toBe(true);
    expect(isPersonalRecord({ weight: 60, reps: 10, unit: 'kg' }, best)).toBe(false);
  });

  it('첫 기록은 PR이 아니다', () => {
    expect(isPersonalRecord({ weight: 100, reps: 5, unit: 'kg' }, null)).toBe(false);
  });

  it('단위가 달라도 kg으로 비교', () => {
    const best = bestOf([{ weight: 100, reps: 1, unit: 'kg' }]);
    expect(isPersonalRecord({ weight: 225, reps: 1, unit: 'lb' }, best)).toBe(true);
  });
});

describe('convertWeight', () => {
  it('kg ↔ lb를 원판 단위로 반올림', () => {
    expect(convertWeight(100, 'kg', 'lb')).toBe(220);
    expect(convertWeight(135, 'lb', 'kg')).toBe(61);
    expect(convertWeight(60, 'kg', 'kg')).toBe(60);
  });
});
