import Database from 'better-sqlite3';

import { foodSourcesForRegion } from '@/domain/food-search';

import { type FoodDb, findFood, foodCounts, foodPortions, searchFoods } from '../catalog';

const wrap = (sqlite: Database.Database): FoodDb => ({
  all: <T>(sql: string, params: (string | number)[]) => sqlite.prepare(sql).all(...params) as T[],
});

/** 앱에 넣는 실제 파일 */
const real = wrap(new Database('assets/food/foods.db', { readonly: true }));

/** 규칙을 보기 위한 작은 DB (실제 파일과 같은 구조) */
function sample(): FoodDb {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE foods (id INTEGER PRIMARY KEY, src TEXT, sid TEXT, pri INTEGER, name TEXT, cho TEXT,
      kcal REAL, protein REAL, carb REAL, fat REAL, basis TEXT, serving REAL, serving_name TEXT);
    CREATE TABLE portions (food_id INTEGER, seq INTEGER, name TEXT, grams REAL);
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT);
  `);
  const add = sqlite.prepare(
    "INSERT INTO foods (src, sid, pri, name, cho, kcal, protein, carb, fat, basis) VALUES (?, ?, ?, ?, ?, 100, 10, 10, 1, 'g')",
  );
  const rows: [string, string, number, string, string | null][] = [
    ['mfds', 'k1', 0, '김치찌개', 'ㄱㅊㅉㄱ'],
    ['mfds', 'k2', 0, '김치찌개, 돼지고기', 'ㄱㅊㅉㄱㄷㅈㄱㄱ'],
    ['mfds', 'k3', 0, '돼지고기 김치볶음', 'ㄷㅈㄱㄱㄱㅊㅂㅇ'],
    ['mfds', 'k4', 1, '닭고기, 가슴살, 생것', 'ㄷㄱㄱㄱㅅㅅㅅㄱ'],
    ['mfds', 'k5', 0, '밥', 'ㅂ'],
    ['mfds', 'k6', 0, '볶음밥', 'ㅂㅇㅂ'],
    ['mfds', 'k7', 0, '100% 사과주스', '100%ㅅㄱㅈㅅ'],
    ['usda', 'u1', 0, 'Kimchi', null],
    ['usda', 'u2', 1, 'Rice, white, cooked', null],
    ['usda', 'u3', 0, 'Rice pudding', null],
    ['usda', 'u4', 0, 'Fried rice', null],
    ['usda', 'u5', 0, 'Licorice', null],
  ];
  for (const r of rows) add.run(...r);
  return wrap(sqlite);
}

const names = (rows: { name: string }[]) => rows.map((r) => r.name);

describe('보일 출처', () => {
  it('한국이면 식약처 먼저 + USDA, 그 밖에는 USDA만', () => {
    expect(foodSourcesForRegion('KR')).toEqual(['mfds', 'usda']);
    expect(foodSourcesForRegion('kr')).toEqual(['mfds', 'usda']);
    expect(foodSourcesForRegion('US')).toEqual(['usda']);
    expect(foodSourcesForRegion(null)).toEqual(['usda']);
  });
});

describe('검색 규칙', () => {
  const db = sample();
  const KR = foodSourcesForRegion('KR');
  const US = foodSourcesForRegion('US');

  it('빈 검색어는 아무것도 찾지 않는다', () => {
    expect(searchFoods(db, '  ', KR)).toEqual([]);
  });

  it('한국 밖에서는 식약처 음식이 나오지 않는다', () => {
    expect(searchFoods(db, '김치', US)).toEqual([]);
    expect(names(searchFoods(db, 'kimchi', US))).toEqual(['Kimchi']);
    expect(searchFoods(db, 'ㄱㅊ', US)).toEqual([]);
  });

  it('같은 이름 → 검색어로 시작하고 끊김 → 검색어로 시작 → 그 밖 순서', () => {
    expect(names(searchFoods(db, '김치', KR))).toEqual([
      '김치찌개',
      '김치찌개, 돼지고기',
      '돼지고기 김치볶음',
    ]);
    expect(names(searchFoods(db, '김치찌개', KR))).toEqual(['김치찌개', '김치찌개, 돼지고기']);
    expect(names(searchFoods(db, 'rice', US))).toEqual([
      'Rice pudding',
      'Rice, white, cooked',
      'Fried rice',
      'Licorice',
    ]);
  });

  it('한 글자도 찾는다', () => {
    expect(names(searchFoods(db, '밥', KR))).toEqual(['밥', '볶음밥']);
  });

  it('한글은 띄어쓰기 · 쉼표가 달라도 찾는다', () => {
    expect(names(searchFoods(db, '닭고기가슴살', KR))).toEqual(['닭고기, 가슴살, 생것']);
    expect(names(searchFoods(db, '돼지고기김치', KR))).toEqual(['돼지고기 김치볶음']);
    // 이름을 쉼표째 넣어도 찾는다
    expect(names(searchFoods(db, '닭고기, 가슴살', KR))).toEqual(['닭고기, 가슴살, 생것']);
    expect(names(searchFoods(db, '닭고기,가슴살', KR))).toEqual(['닭고기, 가슴살, 생것']);
  });

  it('띄어 쓴 낱말은 순서와 상관없이 모두 들어 있어야 한다', () => {
    expect(names(searchFoods(db, '돼지고기 김치', KR))).toEqual([
      '돼지고기 김치볶음',
      '김치찌개, 돼지고기',
    ]);
    expect(names(searchFoods(db, 'cooked rice', US))).toEqual(['Rice, white, cooked']);
  });

  it('한국에서는 식약처 결과가 먼저, USDA가 뒤', () => {
    const KRrows = [...searchFoods(db, 'kimchi', KR), ...searchFoods(db, '김치', KR).slice(0, 1)];
    expect(KRrows.map((r) => r.src)).toEqual(['usda', 'mfds']);
  });

  it('초성으로 찾는다 (섞어 써도 된다)', () => {
    expect(names(searchFoods(db, 'ㄱㅊㅉㄱ', KR))).toEqual(['김치찌개', '김치찌개, 돼지고기']);
    expect(names(searchFoods(db, '김ㅊ찌', KR))).toEqual(['김치찌개', '김치찌개, 돼지고기']);
    expect(names(searchFoods(db, 'ㄷㄱㄱ ㄱㅅㅅ', KR))).toEqual(['닭고기, 가슴살, 생것']);
    expect(searchFoods(db, '감ㅊ', KR)).toEqual([]);
  });

  it('%와 _는 글자 그대로 찾는다', () => {
    expect(names(searchFoods(db, '100%', KR))).toEqual(['100% 사과주스']);
    expect(searchFoods(db, '%', US)).toEqual([]);
    expect(searchFoods(db, '_', US)).toEqual([]);
  });

  it('개수를 제한한다', () => {
    expect(searchFoods(db, 'ri', US, 2)).toHaveLength(2);
  });
});

describe('앱에 넣는 음식 DB', () => {
  const US = foodSourcesForRegion('US');

  const KR = foodSourcesForRegion('KR');

  it('출처별 음식 수가 적혀 있다', () => {
    const counts = foodCounts(real);
    expect(counts.usda).toBeGreaterThan(13000);
    expect(counts.mfds).toBeGreaterThan(6500);
  });

  it('한국 음식과 재료를 찾는다', () => {
    const [stew] = searchFoods(real, '김치찌개', KR);
    expect(stew).toMatchObject({ src: 'mfds', name: '김치찌개', basis: 'g', serving: 400 });
    expect(names(searchFoods(real, '달걀', KR))).toContain('달걀, 생것');
    // 업체 음식은 이름 뒤에 업체가 붙고, 일반 음식 뒤에 나온다
    const latte = names(searchFoods(real, '라떼', KR));
    expect(latte[0]).toBe('라떼');
    expect(latte.some((x) => x.includes(' · '))).toBe(true);
    expect(searchFoods(real, '아메리카노', KR)[0]).toMatchObject({ basis: 'ml' });
    expect(
      names(searchFoods(real, '닭고기 가슴', KR, 3)).every((x) => x.startsWith('닭고기')),
    ).toBe(true);
    expect(names(searchFoods(real, 'ㅂㄴㄴ', KR))).toContain('바나나, 생것');
    // 지역 · 월별 표본은 하나로 줄이고 이름에서 뺀다
    expect(names(searchFoods(real, '참다랑어', KR)).some((x) => /월$|평균$/.test(x))).toBe(false);
    expect(searchFoods(real, '달걀', foodSourcesForRegion('US'))).toEqual([]);
  });

  it('영어 음식을 찾는다', () => {
    const [first] = searchFoods(real, 'banana', US);
    expect(first).toMatchObject({ src: 'usda', name: 'Banana, raw', basis: 'g' });
    expect(first?.kcal).toBeGreaterThan(80);
    expect(first?.serving).toBeGreaterThan(0);
    expect(searchFoods(real, 'chicken breast', US).length).toBeGreaterThan(10);
    expect(names(searchFoods(real, 'egg', US, 5)).every((n) => /^egg/i.test(n))).toBe(true);
  });

  it('가정 단위가 있다', () => {
    const [banana] = searchFoods(real, 'banana', US);
    const portions = foodPortions(real, banana?.id ?? 0);
    expect(portions[0]).toEqual({ name: '1 banana', grams: 126 });
    expect(portions.length).toBeGreaterThan(1);
  });

  it('출처 + id로 다시 찾는다', () => {
    const [banana] = searchFoods(real, 'banana', US);
    expect(findFood(real, 'usda', banana?.sid ?? '')).toEqual(banana);
    expect(findFood(real, 'usda', 'nope')).toBeNull();
  });

  it('값이 비정상인 음식이 없다', () => {
    const [bad] = real.all<{ n: number }>(
      'SELECT COUNT(*) AS n FROM foods WHERE kcal < 0 OR kcal > 950 OR protein < 0 OR protein > 100 OR carb < 0 OR carb > 100.5 OR fat < 0 OR fat > 100 OR name = ?',
      [''],
    );
    expect(bad?.n).toBe(0);
  });
});
