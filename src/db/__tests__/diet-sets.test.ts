import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { dayView, type FoodItem, type SetItem, setTotal } from '@/domain/diet';

import { logsOn } from '../diet';
import {
  addItemsToMeal,
  canAddSet,
  createSet,
  deleteFoodLogs,
  deleteSet,
  getSet,
  listSets,
  updateSet,
} from '../diet-sets';
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
const makeId = () => `t-${String(++counter).padStart(5, '0')}`;

const cup = { name: null, grams: 210 };
const rice: FoodItem = {
  src: 'mfds',
  sid: 'D1',
  name: '현미밥',
  basis: 'g',
  kcal: 153,
  protein: 3,
  carb: 33,
  fat: 1,
  units: [cup],
};
const chicken: FoodItem = {
  ...rice,
  sid: 'R2',
  name: '닭고기, 가슴, 삶은것',
  kcal: 165,
  protein: 31,
  carb: 0,
  fat: 3.6,
  units: [],
};
const ITEMS: SetItem[] = [
  { item: rice, amount: { grams: 210, unit: cup } },
  { item: chicken, amount: { grams: 150, unit: null } },
];

describe('세트', () => {
  it('담은 순서와 양을 그대로 저장한다', () => {
    const db = createTestDb();
    const id = createSet(db, '  점심 도시락 ', ITEMS, makeId) as string;
    const set = getSet(db, id);
    expect(set?.name).toBe('점심 도시락');
    expect(set?.items.map((i) => [i.item.name, i.amount.grams, i.amount.unit])).toEqual([
      ['현미밥', 210, cup],
      ['닭고기, 가슴, 삶은것', 150, null],
    ]);
    // 단위로 담은 음식은 그 단위를 다시 고를 수 있게 들고 있다
    expect(set?.items[0]?.item.units).toEqual([cup]);
    expect(Math.round(setTotal(set?.items ?? []).kcal)).toBe(Math.round(153 * 2.1 + 165 * 1.5));
  });

  it('이름이 없거나 담은 음식이 없으면 만들지 않는다', () => {
    const db = createTestDb();
    expect(createSet(db, '   ', ITEMS, makeId)).toBe(null);
    expect(createSet(db, '빈 세트', [], makeId)).toBe(null);
    expect(listSets(db)).toEqual([]);
    expect(canAddSet(db)).toBe(true);
  });

  it('고치면 담은 음식을 통째로 바꾸고, 지우면 목록에서 사라진다', () => {
    const db = createTestDb();
    const id = createSet(db, '점심 도시락', ITEMS, makeId) as string;
    const other = createSet(db, '아침 세트', [ITEMS[0] as SetItem], makeId) as string;

    expect(
      updateSet(db, id, '저녁', [{ item: chicken, amount: { grams: 200, unit: null } }], 5, makeId),
    ).toBe(true);
    expect(getSet(db, id)).toMatchObject({ name: '저녁' });
    expect(getSet(db, id)?.items.map((i) => [i.item.name, i.amount.grams])).toEqual([
      ['닭고기, 가슴, 삶은것', 200],
    ]);
    expect(updateSet(db, id, '저녁', [], 6, makeId)).toBe(false);
    expect(getSet(db, other)?.items).toHaveLength(1);

    deleteSet(db, id, 7);
    expect(getSet(db, id)).toBe(null);
    expect(listSets(db).map((s) => s.name)).toEqual(['아침 세트']);
  });

  it('끼니에 넣으면 음식이 하나씩 들어가고, 되돌리면 그 음식들만 빠진다', () => {
    const db = createTestDb();
    const id = createSet(db, '점심 도시락', ITEMS, makeId) as string;
    const set = getSet(db, id);
    const first = addItemsToMeal(
      db,
      { date: '2026-10-07', meal: 'lunch', items: set?.items ?? [] },
      makeId,
    );
    const second = addItemsToMeal(
      db,
      { date: '2026-10-07', meal: 'lunch', items: set?.items ?? [] },
      makeId,
    );
    expect(first).toHaveLength(2);
    const lunch = () => dayView(logsOn(db, '2026-10-07')).meals.find((m) => m.meal === 'lunch');
    expect(lunch()?.logs.map((l) => [l.name, l.position, l.grams])).toEqual([
      ['현미밥', 0, 210],
      ['닭고기, 가슴, 삶은것', 1, 150],
      ['현미밥', 2, 210],
      ['닭고기, 가슴, 삶은것', 3, 150],
    ]);
    expect(lunch()?.logs[0]?.unit).toEqual(cup);

    deleteFoodLogs(db, second);
    expect(lunch()?.logs.map((l) => l.id)).toEqual(first);
    // 세트를 지워도 이미 적은 기록은 남는다
    deleteSet(db, id);
    expect(lunch()?.logs).toHaveLength(2);
  });
});
