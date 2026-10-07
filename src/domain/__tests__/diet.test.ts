import {
  amountText,
  type CustomFoodInput,
  type DietGoals,
  dayView,
  defaultAmount,
  dietTargets,
  type FoodLog,
  macroKcal,
  nutrientsFor,
  parseAmount,
  pressKey,
  progress,
  recentFoods,
  toPer100,
  unitCount,
  unitNoun,
  withUnit,
} from '../diet';

const log = (over: Partial<FoodLog>): FoodLog => ({
  id: 'a',
  date: '2026-10-07',
  meal: 'lunch',
  position: 0,
  src: 'mfds',
  sid: 'D1',
  name: '현미밥',
  basis: 'g',
  grams: 210,
  unit: null,
  kcal: 153,
  protein: 3,
  carb: 33,
  fat: 1,
  createdAt: 0,
  ...over,
});

describe('영양값', () => {
  it('100 g당 값에 양을 곱한다', () => {
    expect(nutrientsFor({ kcal: 165, protein: 31, carb: 0, fat: 3.6 }, 150)).toEqual({
      kcal: 247.5,
      protein: 46.5,
      carb: 0,
      fat: 5.4,
    });
  });
  it('끼니 순서는 고정이고, 끼니 안은 넣은 순서다', () => {
    const view = dayView([
      log({ id: 'd', meal: 'snack', grams: 100 }),
      log({ id: 'b', meal: 'lunch', position: 1, grams: 100 }),
      log({ id: 'a', meal: 'lunch', position: 0, grams: 200 }),
    ]);
    expect(view.meals.map((m) => m.meal)).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
    expect(view.meals[1]?.logs.map((l) => l.id)).toEqual(['a', 'b']);
    expect(view.meals[1]?.total.kcal).toBeCloseTo(459);
    expect(view.meals[0]?.total.kcal).toBe(0);
    expect(view.total.kcal).toBeCloseTo(612);
    expect(view.total.protein).toBeCloseTo(12);
  });
});

describe('목표', () => {
  const goals: DietGoals = {
    proteinMode: 'perKg',
    proteinPerKg: null,
    proteinDirect: null,
    kcal: null,
    carb: null,
    fat: null,
  };
  const body = { weight: 72.5, weightUnit: 'kg', goal: 'muscle' } as const;

  it('따로 고르지 않으면 운동 목표에 맞춘 1 kg당 값을 쓴다', () => {
    expect(dietTargets(goals, body)).toEqual({ kcal: null, protein: 115, carb: null, fat: null });
  });
  it('1 kg당 값을 고르면 그 값으로 계산한다', () => {
    expect(dietTargets({ ...goals, proteinPerKg: 2.2 }, body).protein).toBe(160);
  });
  it('몸무게가 없으면 단백질 목표가 없다', () => {
    expect(dietTargets({ ...goals, proteinPerKg: 2.2 }, { ...body, weight: null }).protein).toBe(
      null,
    );
  });
  it('직접 넣으면 몸무게와 상관없이 그 숫자다', () => {
    const direct = { ...goals, proteinMode: 'direct', proteinDirect: 150 } as const;
    expect(dietTargets(direct, { ...body, weight: null }).protein).toBe(150);
    expect(dietTargets({ ...direct, proteinDirect: null }, body).protein).toBe(null);
  });
  it('칼로리 · 탄수화물 · 지방은 넣은 그대로', () => {
    expect(dietTargets({ ...goals, kcal: 2200, carb: 250, fat: 60 }, body)).toEqual({
      kcal: 2200,
      protein: 115,
      carb: 250,
      fat: 60,
    });
  });
  it('세 영양소 목표를 칼로리로 더한다', () => {
    expect(macroKcal(160, 250, 60)).toBe(2180);
    expect(macroKcal(160, null, 60)).toBe(null);
  });
  it('진행: 보이는 숫자로 남은 양 · 넘은 양을 낸다', () => {
    expect(progress(90.6, 160)).toEqual({
      value: 91,
      target: 160,
      ratio: 91 / 160,
      left: 69,
      over: 0,
    });
    expect(progress(2310, 2200)).toMatchObject({ ratio: 1, left: 0, over: 110 });
  });
});

describe('양', () => {
  const cup = { name: '1 cup', grams: 240 };
  it('처음 양은 1회 양 하나, 없으면 100 g', () => {
    expect(defaultAmount({ units: [cup] })).toEqual({ grams: 240, unit: cup });
    expect(defaultAmount({ units: [] })).toEqual({ grams: 100, unit: null });
  });
  it('글자를 양으로 바꾼다', () => {
    expect(parseAmount('150', null)).toEqual({ grams: 150, unit: null });
    expect(parseAmount('1.5', cup)).toEqual({ grams: 360, unit: cup });
    expect(parseAmount('', null)).toBe(null);
    expect(parseAmount('0', null)).toBe(null);
    expect(parseAmount('.', null)).toBe(null);
    expect(parseAmount('5001', null)).toBe(null);
    expect(parseAmount('100', cup)).toBe(null);
  });
  it('양을 다시 글자와 개수로', () => {
    expect(amountText({ grams: 360, unit: cup })).toBe('1.5');
    expect(amountText({ grams: 150, unit: null })).toBe('150');
    expect(amountText({ grams: 12.5, unit: null })).toBe('12.5');
    expect(unitCount({ grams: 80, unit: cup })).toBe(0.33);
  });
  it('숫자판: 자릿수를 넘기지 않는다', () => {
    const type = (keys: string, decimals = 1) =>
      keys.split('').reduce((t, k) => pressKey(t, k === '<' ? 'back' : k, decimals), '');
    expect(type('150')).toBe('150');
    expect(type('12345')).toBe('1234');
    expect(type('1.25')).toBe('1.2');
    expect(type('1.25', 2)).toBe('1.25');
    expect(type('.5')).toBe('0.5');
    expect(type('1..5')).toBe('1.5');
    expect(type('05')).toBe('5');
    expect(type('15<')).toBe('1');
    expect(type('<')).toBe('');
  });
  it("단위 이름에서 '1'을 뗀다", () => {
    expect(unitNoun('1 cup')).toBe('cup');
    expect(unitNoun('1개')).toBe('개');
    expect(unitNoun('1 cup, cooked')).toBe('cup, cooked');
    expect(unitNoun('3 oz')).toBe(null);
    expect(unitNoun('10 pieces')).toBe(null);
    expect(unitNoun('1.5 cup')).toBe(null);
    expect(unitNoun('한 줌')).toBe(null);
  });
  it('지금 쓰는 단위가 목록에 없으면 앞에 넣는다', () => {
    const old = { name: null, grams: 200 };
    expect(withUnit([cup], old)).toEqual([old, cup]);
    expect(withUnit([cup], { name: '1 cup', grams: 240 })).toEqual([cup]);
    expect(withUnit([cup], null)).toEqual([cup]);
  });
});

describe('최근 먹은 음식', () => {
  it('음식마다 가장 최근 기록 하나, 최근 순', () => {
    const cup = { name: '1 cup', grams: 240 };
    const list = recentFoods([
      log({ id: '1', sid: 'A', createdAt: 1, grams: 100 }),
      log({ id: '2', sid: 'B', createdAt: 2 }),
      log({ id: '3', sid: 'A', createdAt: 3, grams: 240, unit: cup }),
      log({ id: '4', src: 'custom', sid: 'A', createdAt: 0 }),
    ]);
    expect(list.map((r) => `${r.item.src}:${r.item.sid}`)).toEqual([
      'mfds:A',
      'mfds:B',
      'custom:A',
    ]);
    expect(list[0]?.amount).toEqual({ grams: 240, unit: cup });
    expect(list[0]?.item.units).toEqual([cup]);
  });
});

describe('직접 만든 음식', () => {
  const input: CustomFoodInput = {
    name: '프로틴바',
    per: 'serving',
    serving: 50,
    servingName: '1개',
    kcal: 190,
    protein: 20,
    carb: 18,
    fat: 6,
  };
  it('1회 제공량 기준으로 넣은 값을 100 g당으로 바꾼다', () => {
    expect(toPer100(input)).toEqual({
      ok: true,
      per100: { kcal: 380, protein: 40, carb: 36, fat: 12 },
    });
  });
  it('100 g당으로 넣으면 그대로', () => {
    expect(toPer100({ ...input, per: '100g', serving: null })).toEqual({
      ok: true,
      per100: { kcal: 190, protein: 20, carb: 18, fat: 6 },
    });
  });
  it('1회 제공량 기준인데 양이 없으면 안 된다', () => {
    expect(toPer100({ ...input, serving: null })).toEqual({ ok: false, error: 'serving' });
    expect(toPer100({ ...input, serving: 0 })).toEqual({ ok: false, error: 'serving' });
  });
  it('1회 양이 작으면 반올림한 값만큼은 봐준다(5 g에 지방 5 g · 46 kcal)', () => {
    const tiny = { ...input, serving: 5, kcal: 46, protein: 0, carb: 0, fat: 5.4 };
    expect(toPer100(tiny).ok).toBe(true);
    // 반올림으로 설명되지 않는 값은 여전히 안 된다.
    expect(toPer100({ ...tiny, fat: 7 })).toEqual({ ok: false, error: 'range' });
    expect(toPer100({ ...tiny, kcal: 60 })).toEqual({ ok: false, error: 'range' });
  });
  it('1회 양이 한 번에 넣을 수 있는 양보다 크면 안 된다', () => {
    expect(toPer100({ ...input, serving: 5001 })).toEqual({ ok: false, error: 'serving' });
  });
  it('100 g에 들어갈 수 없는 값은 안 된다', () => {
    expect(toPer100({ ...input, serving: 10 })).toEqual({ ok: false, error: 'range' });
    expect(toPer100({ ...input, per: '100g', protein: 60, carb: 50 })).toEqual({
      ok: false,
      error: 'range',
    });
  });
});
