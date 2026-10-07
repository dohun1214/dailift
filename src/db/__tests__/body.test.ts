import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import {
  createBodyEntry,
  deleteBodyEntry,
  getBodyEntry,
  listBodyEntries,
  updateBodyEntry,
} from '../body';
import * as schema from '../schema';

function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: 'drizzle' });
  return db;
}
let counter = 0;
const makeId = () => `b-${++counter}`;
const input = { weight: 68.5, skeletalMuscle: 32.1, bodyFatPct: 16.8, extras: {} };

describe('체성분 기록', () => {
  it('적은 값과 골라 적은 값을 그대로 남기고, 잰 날 오래된 순으로 읽는다', () => {
    const db = createTestDb();
    const late = createBodyEntry(
      db,
      { ...input, extras: { bmi: 22.4, bmr: 1602 } },
      'kg',
      2000,
      makeId,
    );
    const early = createBodyEntry(
      db,
      { weight: 70, skeletalMuscle: null, bodyFatPct: null, extras: {} },
      'kg',
      1000,
      makeId,
    );
    const list = listBodyEntries(db);
    expect(list.map((e) => e.id)).toEqual([early, late]);
    expect(list[0]).toMatchObject({
      weight: 70,
      skeletalMuscle: null,
      bodyFatPct: null,
      extras: {},
    });
    expect(list[1]).toMatchObject({
      weight: 68.5,
      weightUnit: 'kg',
      skeletalMuscle: 32.1,
      bodyFatPct: 16.8,
      extras: { bmi: 22.4, bmr: 1602 },
      source: 'manual',
      measuredAt: 2000,
    });
  });

  it('고치면 값 · 단위 · 잰 시각이 바뀌고 서버로 보낼 표시가 남는다', () => {
    const db = createTestDb();
    const id = createBodyEntry(db, input, 'kg', 1000, makeId);
    db.update(schema.bodyMetrics).set({ dirty: 0 }).run();
    updateBodyEntry(db, id, { ...input, weight: 150.6, extras: { whr: 0.85 } }, 'lb', 3000);
    expect(getBodyEntry(db, id)).toMatchObject({
      weight: 150.6,
      weightUnit: 'lb',
      measuredAt: 3000,
      extras: { whr: 0.85 },
    });
    expect(db.select().from(schema.bodyMetrics).get()?.dirty).toBe(1);
  });

  it('지우면 목록에서 빠지고 줄은 지운 것으로 남는다', () => {
    const db = createTestDb();
    const id = createBodyEntry(db, input, 'kg', 1000, makeId);
    deleteBodyEntry(db, id, 5000);
    expect(listBodyEntries(db)).toEqual([]);
    expect(getBodyEntry(db, id)).toBeNull();
    expect(db.select().from(schema.bodyMetrics).get()?.deletedAt).toBe(5000);
  });
});
