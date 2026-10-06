import { eq } from 'drizzle-orm';

import type { ProcessedFood } from '@/domain/processed-food';

import * as schema from './schema';
import type { AppDatabase } from './seed';

type Row = typeof schema.foodCache.$inferSelect;

export const toProcessedFood = (r: Row): ProcessedFood => ({
  sid: r.sid,
  name: r.name,
  maker: r.maker,
  basis: r.basis,
  kcal: r.kcal,
  protein: r.protein,
  carb: r.carb,
  fat: r.fat,
  size: r.size,
  serv: r.serv,
});

/**
 * 서버에서 받은 가공식품을 기기에 적어 둔다(이미 있으면 새 값으로).
 * 즐겨찾기 목록과 양 창의 단위를 인터넷 없이 보여 주려고 쓴다 — 고르거나 넣은 것만 적는다.
 */
export function cacheProcessedFoods(
  db: AppDatabase,
  foods: readonly ProcessedFood[],
  now = Date.now(),
) {
  if (foods.length === 0) return;
  db.transaction((tx) => {
    for (const f of foods) {
      const values = { ...f, fetchedAt: now };
      tx.insert(schema.foodCache)
        .values(values)
        .onConflictDoUpdate({ target: schema.foodCache.sid, set: values })
        .run();
    }
  });
}

export function getCachedProcessed(db: AppDatabase, sid: string): ProcessedFood | null {
  const row = db.select().from(schema.foodCache).where(eq(schema.foodCache.sid, sid)).get();
  return row ? toProcessedFood(row) : null;
}
