import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import type { ProcessedFood } from '@/domain/processed-food';

import { cacheProcessedFoods, getCachedProcessed } from '../food-cache';
import * as schema from '../schema';
import { wipeUserData } from '../wipe';

function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: 'drizzle' });
  return db;
}

const kimbap: ProcessedFood = {
  sid: 'P1',
  name: '참치마요 삼각김밥',
  maker: '(주)후레쉬퍼스트',
  basis: 'g',
  kcal: 198,
  protein: 4.7,
  carb: 32.6,
  fat: 5.4,
  size: 110,
  serv: null,
};

describe('가공식품 사본', () => {
  it('적어 두고 식품코드로 찾는다', () => {
    const db = createTestDb();
    expect(getCachedProcessed(db, 'P1')).toBeNull();
    cacheProcessedFoods(db, [kimbap], 1000);
    expect(getCachedProcessed(db, 'P1')).toEqual(kimbap);
  });

  it('다시 적으면 새 값으로 바뀐다', () => {
    const db = createTestDb();
    cacheProcessedFoods(db, [kimbap], 1000);
    cacheProcessedFoods(db, [{ ...kimbap, kcal: 205, size: 115 }], 2000);
    expect(getCachedProcessed(db, 'P1')).toMatchObject({ kcal: 205, size: 115 });
    expect(db.select().from(schema.foodCache).all()).toHaveLength(1);
  });

  it('모든 데이터 삭제 때 같이 지워진다', () => {
    const db = createTestDb();
    cacheProcessedFoods(db, [kimbap]);
    wipeUserData(db);
    expect(getCachedProcessed(db, 'P1')).toBeNull();
  });
});
