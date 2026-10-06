import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import * as schema from '../schema';
import { seedReferenceData } from '../seed';
import {
  canAddSupplement,
  createSupplement,
  deleteSupplement,
  getSupplement,
  lastWorkoutEndOn,
  listSupplements,
  type SupplementInput,
  setSupplementTaken,
  takenOn,
  updateSupplement,
} from '../supplements';
import { finishWorkout, startWorkout } from '../workout';

function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: 'drizzle' });
  seedReferenceData(db);
  return db;
}
let counter = 0;
const makeId = () => `s-${String(++counter).padStart(5, '0')}`;
const input: SupplementInput = {
  name: '  오메가3 ',
  dose: ' 1,000 mg ',
  timing: 'time',
  timeMin: 540,
  afterMin: 30,
  notify: true,
  renotify: true,
  active: true,
};

describe('영양제', () => {
  it('만들고 고치고 지운다', () => {
    const db = createTestDb();
    const id = createSupplement(db, input, makeId);
    expect(getSupplement(db, id)).toMatchObject({
      name: '오메가3',
      dose: '1,000 mg',
      notify: true,
    });

    updateSupplement(db, id, { ...input, dose: ' ', active: false, timing: 'after_workout' });
    expect(getSupplement(db, id)).toMatchObject({
      dose: null,
      active: false,
      timing: 'after_workout',
    });

    setSupplementTaken(db, id, '2026-10-06', true, 1, makeId);
    deleteSupplement(db, id, 2);
    expect(getSupplement(db, id)).toBeNull();
    expect(listSupplements(db)).toEqual([]);
    expect(takenOn(db, '2026-10-06').size).toBe(0);
    // 지운 흔적은 남아 다른 기기로 전해진다
    expect(db.select().from(schema.supplements).all()[0]).toMatchObject({ deletedAt: 2, dirty: 1 });
  });

  it('30개까지 만들 수 있다', () => {
    const db = createTestDb();
    for (let i = 0; i < 29; i++) createSupplement(db, input, makeId);
    expect(canAddSupplement(db)).toBe(true);
    createSupplement(db, input, makeId);
    expect(canAddSupplement(db)).toBe(false);
  });

  it('체크는 하루에 한 줄, 풀었다 다시 하면 그 줄을 되살린다', () => {
    const db = createTestDb();
    const id = createSupplement(db, input, makeId);
    setSupplementTaken(db, id, '2026-10-06', true, 10, makeId);
    setSupplementTaken(db, id, '2026-10-06', true, 11, makeId);
    expect(db.select().from(schema.supplementLogs).all()).toHaveLength(1);
    expect(takenOn(db, '2026-10-06')).toEqual(new Set([id]));
    expect(takenOn(db, '2026-10-05').size).toBe(0);

    setSupplementTaken(db, id, '2026-10-06', false, 12, makeId);
    expect(takenOn(db, '2026-10-06').size).toBe(0);
    setSupplementTaken(db, id, '2026-10-06', true, 13, makeId);
    const rows = db.select().from(schema.supplementLogs).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ deletedAt: null, takenAt: 13 });
  });

  it('다른 기기에서 생긴 줄까지 한꺼번에 푼다', () => {
    const db = createTestDb();
    const id = createSupplement(db, input, makeId);
    for (const logId of ['x1', 'x2']) {
      db.insert(schema.supplementLogs)
        .values({ id: logId, supplementId: id, date: '2026-10-06', takenAt: 1 })
        .run();
    }
    setSupplementTaken(db, id, '2026-10-06', false, 5, makeId);
    expect(takenOn(db, '2026-10-06').size).toBe(0);
  });

  it('오늘 마지막으로 마친 운동의 끝난 시각', () => {
    const db = createTestDb();
    const day = new Date(2026, 9, 6, 12);
    expect(lastWorkoutEndOn(db, day)).toBeNull();
    const finish = (endedAt: number) => {
      const id = startWorkout(db, { routineId: null, name: 'W', weightUnit: 'kg' }, makeId);
      finishWorkout(db, id, endedAt, endedAt);
    };
    finish(new Date(2026, 9, 5, 23).getTime());
    expect(lastWorkoutEndOn(db, day)).toBeNull();
    finish(new Date(2026, 9, 6, 7).getTime());
    finish(new Date(2026, 9, 6, 19).getTime());
    expect(lastWorkoutEndOn(db, day)).toBe(new Date(2026, 9, 6, 19).getTime());
  });
});
