import Database from 'better-sqlite3';
import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { type CustomFoodInput, dayView, type FoodItem, recentFoods } from '@/domain/diet';

import {
  addFoodLog,
  createCustomFood,
  customItem,
  deleteCustomFood,
  deleteFoodLog,
  getCustomFood,
  isFavorite,
  latestFoodLogs,
  listCustomFoods,
  listFavorites,
  loggedDates,
  logsOn,
  restoreFoodLog,
  setFavorite,
  updateCustomFood,
  updateFoodLogAmount,
} from '../diet';
import * as schema from '../schema';
import { seedReferenceData } from '../seed';

function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: 'drizzle' });
  seedReferenceData(db);
  return db;
}
let counter = 0;
const makeId = () => `f-${String(++counter).padStart(5, '0')}`;

const rice: FoodItem = {
  src: 'mfds',
  sid: 'D000123',
  name: '현미밥',
  basis: 'g',
  kcal: 153,
  protein: 3,
  carb: 33,
  fat: 1,
  units: [{ name: null, grams: 210 }],
};
const chicken: FoodItem = {
  ...rice,
  sid: 'R000456',
  name: '닭고기, 가슴, 삶은것',
  kcal: 165,
  protein: 31,
  carb: 0,
  fat: 3.6,
  units: [],
};
const bar: CustomFoodInput = {
  name: ' 프로틴바 초코 ',
  per: 'serving',
  serving: 50,
  servingName: ' 1개 ',
  kcal: 190,
  protein: 20,
  carb: 18,
  fat: 6,
};

describe('먹은 기록', () => {
  it('끼니의 맨 뒤에 넣고, 음식의 이름과 영양값을 복사해 둔다', () => {
    const db = createTestDb();
    const unit = rice.units[0] ?? null;
    addFoodLog(
      db,
      { date: '2026-10-07', meal: 'lunch', item: rice, amount: { grams: 210, unit } },
      makeId,
    );
    addFoodLog(
      db,
      { date: '2026-10-07', meal: 'lunch', item: chicken, amount: { grams: 150, unit: null } },
      makeId,
    );
    addFoodLog(
      db,
      { date: '2026-10-07', meal: 'breakfast', item: rice, amount: { grams: 100, unit: null } },
      makeId,
    );
    addFoodLog(
      db,
      { date: '2026-10-06', meal: 'lunch', item: rice, amount: { grams: 100, unit: null } },
      makeId,
    );

    const view = dayView(logsOn(db, '2026-10-07'));
    const lunch = view.meals.find((m) => m.meal === 'lunch');
    expect(lunch?.logs.map((l) => [l.name, l.position, l.grams])).toEqual([
      ['현미밥', 0, 210],
      ['닭고기, 가슴, 삶은것', 1, 150],
    ]);
    expect(lunch?.logs[0]?.unit).toEqual({ name: null, grams: 210 });
    expect(lunch?.logs[1]?.unit).toBe(null);
    expect(Math.round(view.total.kcal)).toBe(Math.round(153 * 2.1 + 165 * 1.5 + 153));
    expect(loggedDates(db, '2026-10-01', '2026-10-31')).toEqual(
      new Set(['2026-10-06', '2026-10-07']),
    );
    expect(loggedDates(db, '2026-10-07', '2026-10-07')).toEqual(new Set(['2026-10-07']));
  });

  it('양을 고치고 지운다(지운 것은 서버로 보낼 흔적으로 남는다)', () => {
    const db = createTestDb();
    const id = addFoodLog(
      db,
      {
        date: '2026-10-07',
        meal: 'dinner',
        item: rice,
        amount: { grams: 210, unit: rice.units[0] ?? null },
      },
      makeId,
    );
    updateFoodLogAmount(db, id, { grams: 120, unit: null });
    expect(logsOn(db, '2026-10-07')[0]).toMatchObject({ grams: 120, unit: null });

    deleteFoodLog(db, id, 5);
    expect(logsOn(db, '2026-10-07')).toEqual([]);
    expect(loggedDates(db, '2026-10-01', '2026-10-31').size).toBe(0);
    const row = db.select().from(schema.foodLogs).where(eq(schema.foodLogs.id, id)).get();
    expect(row).toMatchObject({ deletedAt: 5, dirty: 1 });

    // 취소: 지운 표시만 걷어 내고, 서버에도 다시 올리게 표시한다
    db.run(sql`UPDATE food_logs SET dirty = 0`);
    restoreFoodLog(db, id);
    expect(logsOn(db, '2026-10-07')).toMatchObject([{ id, grams: 120, unit: null }]);
    expect(db.select().from(schema.foodLogs).where(eq(schema.foodLogs.id, id)).get()).toMatchObject(
      { deletedAt: null, dirty: 1 },
    );
    deleteFoodLog(db, id, 5);
    // 지운 뒤에 넣으면 다시 처음 자리부터
    const next = addFoodLog(
      db,
      { date: '2026-10-07', meal: 'dinner', item: chicken, amount: { grams: 100, unit: null } },
      makeId,
    );
    expect(logsOn(db, '2026-10-07').find((l) => l.id === next)?.position).toBe(0);
  });

  it('최근 먹은 음식은 지운 기록을 빼고 뽑는다', () => {
    const db = createTestDb();
    const a = addFoodLog(
      db,
      { date: '2026-10-06', meal: 'lunch', item: rice, amount: { grams: 100, unit: null } },
      makeId,
    );
    addFoodLog(
      db,
      { date: '2026-10-07', meal: 'lunch', item: chicken, amount: { grams: 150, unit: null } },
      makeId,
    );
    expect(
      recentFoods(latestFoodLogs(db))
        .map((r) => r.item.name)
        .sort(),
    ).toEqual(['닭고기, 가슴, 삶은것', '현미밥']);
    deleteFoodLog(db, a);
    expect(recentFoods(latestFoodLogs(db)).map((r) => r.item.name)).toEqual([
      '닭고기, 가슴, 삶은것',
    ]);
  });
});

describe('직접 만든 음식', () => {
  it('100 g당으로 바꿔 저장하고, 음식으로 꺼내면 1회 양 단위가 붙는다', () => {
    const db = createTestDb();
    const id = createCustomFood(db, bar, makeId) as string;
    expect(getCustomFood(db, id)).toMatchObject({
      name: '프로틴바 초코',
      serving: 50,
      servingName: '1개',
      kcal: 380,
      protein: 40,
    });
    const [item] = listCustomFoods(db);
    expect(item).toMatchObject({ src: 'custom', sid: id, units: [{ name: '1개', grams: 50 }] });
  });

  it('넣을 수 없는 값은 저장하지 않는다', () => {
    const db = createTestDb();
    expect(createCustomFood(db, { ...bar, name: '  ' }, makeId)).toBe(null);
    expect(createCustomFood(db, { ...bar, serving: null }, makeId)).toBe(null);
    expect(createCustomFood(db, { ...bar, serving: 10 }, makeId)).toBe(null);
    expect(listCustomFoods(db)).toEqual([]);
  });

  it('100 g당으로 넣으면 1회 양 없이 저장한다', () => {
    const db = createTestDb();
    const id = createCustomFood(
      db,
      { ...bar, per: '100g', serving: null, servingName: '1개' },
      makeId,
    ) as string;
    const row = getCustomFood(db, id);
    expect(row).toMatchObject({ serving: null, servingName: null, kcal: 190 });
    expect(row && customItem(row).units).toEqual([]);
  });

  it('고쳐도 이미 적은 기록은 그대로이고, 지우면 즐겨찾기에서도 빠진다', () => {
    const db = createTestDb();
    const id = createCustomFood(db, bar, makeId) as string;
    const [item] = listCustomFoods(db) as [FoodItem];
    addFoodLog(
      db,
      {
        date: '2026-10-07',
        meal: 'snack',
        item,
        amount: { grams: 50, unit: item.units[0] ?? null },
      },
      makeId,
    );
    setFavorite(db, 'custom', id, true, 1, makeId);

    expect(updateCustomFood(db, id, { ...bar, name: '프로틴바 딸기', kcal: 200 })).toBe(true);
    expect(getCustomFood(db, id)).toMatchObject({ name: '프로틴바 딸기', kcal: 400 });
    expect(logsOn(db, '2026-10-07')[0]).toMatchObject({ name: '프로틴바 초코', kcal: 380 });
    expect(updateCustomFood(db, id, { ...bar, serving: 0 })).toBe(false);

    deleteCustomFood(db, id);
    expect(getCustomFood(db, id)).toBe(null);
    expect(listCustomFoods(db)).toEqual([]);
    expect(isFavorite(db, 'custom', id)).toBe(false);
    expect(logsOn(db, '2026-10-07')).toHaveLength(1);
  });
});

describe('즐겨찾기', () => {
  it('켜고 끄고 다시 켜도 줄은 하나다', () => {
    const db = createTestDb();
    setFavorite(db, 'mfds', 'D1', true, 1, makeId);
    setFavorite(db, 'mfds', 'D1', true, 2, makeId);
    setFavorite(db, 'usda', '99', true, 3, makeId);
    expect(listFavorites(db)).toEqual([
      { src: 'usda', sid: '99' },
      { src: 'mfds', sid: 'D1' },
    ]);
    setFavorite(db, 'mfds', 'D1', false, 4, makeId);
    expect(isFavorite(db, 'mfds', 'D1')).toBe(false);
    setFavorite(db, 'mfds', 'D1', true, 5, makeId);
    expect(listFavorites(db)[0]).toEqual({ src: 'mfds', sid: 'D1' });
    expect(db.select().from(schema.foodFavorites).all()).toHaveLength(2);
  });
});
