import { calculatePlates, DEFAULT_PLATES, groupPlates } from '../plates';

describe('calculatePlates', () => {
  it('정확히 맞추는 조합 (시안: 62.5kg, 바 20kg → 20 + 1.25)', () => {
    expect(calculatePlates(62.5, 20, DEFAULT_PLATES.kg)).toEqual({
      perSide: [20, 1.25],
      total: 62.5,
      exact: true,
    });
  });

  it('원판 개수가 가장 적은 조합을 고른다', () => {
    // 30 = 25+5 (15+15보다 적거나 같은 개수)
    expect(calculatePlates(80, 20, DEFAULT_PLATES.kg)?.perSide).toEqual([25, 5]);
    // 보유 원판에 25가 없으면 20+10
    expect(calculatePlates(80, 20, [20, 10, 5])?.perSide).toEqual([20, 10]);
  });

  it('맞출 수 없으면 가장 가까운 무게 (같으면 가벼운 쪽)', () => {
    const r = calculatePlates(61, 20, DEFAULT_PLATES.kg);
    expect(r?.exact).toBe(false);
    expect(r?.total).toBe(60);
    // 한쪽 21.25 → 20과 22.5가 같은 거리 → 가벼운 60
    expect(calculatePlates(62.5, 20, [20, 2.5])?.total).toBe(60);
    // 더 가까운 쪽이 위면 위로
    expect(calculatePlates(64.5, 20, [20, 2.5])?.total).toBe(65);
  });

  it('lb', () => {
    expect(calculatePlates(225, 45, DEFAULT_PLATES.lb)).toEqual({
      perSide: [45, 45],
      total: 225,
      exact: true,
    });
    expect(calculatePlates(185, 45, DEFAULT_PLATES.lb)?.perSide).toEqual([45, 25]);
  });

  it('바 무게 이하·빈 원판·이상한 값', () => {
    expect(calculatePlates(20, 20, DEFAULT_PLATES.kg)).toEqual({
      perSide: [],
      total: 20,
      exact: true,
    });
    expect(calculatePlates(10, 20, DEFAULT_PLATES.kg)?.exact).toBe(false);
    expect(calculatePlates(60, 20, [])).toEqual({ perSide: [], total: 20, exact: false });
    expect(calculatePlates(Number.NaN, 20, DEFAULT_PLATES.kg)).toBeNull();
    expect(calculatePlates(5000, 20, DEFAULT_PLATES.kg)).toBeNull();
  });

  it('소수 원판도 정수 오차 없이', () => {
    expect(calculatePlates(22.5, 20, [0.25, 1.25])?.perSide).toEqual([1.25]);
    expect(calculatePlates(21, 20, [0.25])).toEqual({
      perSide: [0.25, 0.25],
      total: 21,
      exact: true,
    });
  });
});

describe('groupPlates', () => {
  it('같은 원판을 묶는다', () => {
    expect(groupPlates([20, 20, 5, 1.25])).toEqual([
      { plate: 20, count: 2 },
      { plate: 5, count: 1 },
      { plate: 1.25, count: 1 },
    ]);
  });
});
