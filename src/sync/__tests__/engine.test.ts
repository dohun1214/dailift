import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { copyTemplate } from '@/db/routines';
import * as schema from '@/db/schema';
import { seedReferenceData } from '@/db/seed';
import { finishWorkout, setCompleted, startWorkout, updateSet } from '@/db/workout';

import {
  applyRemote,
  pendingCount,
  type RemoteRow,
  resetForAccount,
  type SyncedTableName,
  type SyncRemote,
  syncOnce,
} from '../engine';

function createDevice() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: 'drizzle' });
  seedReferenceData(db);
  return db;
}
type Db = ReturnType<typeof createDevice>;

/** 서버 흉내: rev를 매기고, updated_at이 더 오래된 쓰기는 무시한다. */
class FakeRemote implements SyncRemote {
  rev = 0;
  tables = new Map<SyncedTableName, Map<string, RemoteRow>>();
  pushes: { table: SyncedTableName; ids: string[] }[] = [];

  table(name: SyncedTableName) {
    let t = this.tables.get(name);
    if (!t) {
      t = new Map();
      this.tables.set(name, t);
    }
    return t;
  }

  async push(table: SyncedTableName, rows: RemoteRow[]) {
    this.pushes.push({ table, ids: rows.map((r) => r.id) });
    const t = this.table(table);
    for (const r of rows) {
      const old = t.get(r.id);
      if (old && r.updated_at < old.updated_at) continue;
      this.rev += 1;
      t.set(r.id, { ...r, rev: this.rev });
    }
  }

  async pull(table: SyncedTableName, afterRev: number, limit: number) {
    return [...this.table(table).values()]
      .filter((r) => (r.rev ?? 0) > afterRev)
      .sort((a, b) => (a.rev ?? 0) - (b.rev ?? 0))
      .slice(0, limit);
  }
}

/** 템플릿 복사 시각(지금)보다 뒤의 수정 시각 */
const FUTURE = Date.now() + 60_000;

let counter = 0;
const makeId = () => `s-${String(++counter).padStart(6, '0')}`;

function doWorkout(db: Db, now: number) {
  const routine = db.select().from(schema.routines).get();
  const id = startWorkout(
    db,
    { routineId: routine?.id ?? null, name: routine?.name ?? 'x', weightUnit: 'kg', now },
    makeId,
  );
  const set = db.select().from(schema.sets).get();
  if (set) {
    updateSet(db, set.id, { weight: 60, reps: 8 });
    setCompleted(db, set.id, true, now + 1000);
  }
  finishWorkout(db, id, now + 60_000);
  return id;
}

describe('syncOnce', () => {
  it('기기 A의 기록이 서버를 거쳐 기기 B로 온다', async () => {
    const remote = new FakeRemote();
    const a = createDevice();
    const b = createDevice();
    copyTemplate(a, 'push_pull_legs', { lang: 'ko', weightUnit: 'kg' }, makeId);
    const workoutId = doWorkout(a, 1_000_000);

    const first = await syncOnce(a, remote);
    expect(first.pushed).toBeGreaterThan(0);
    expect(pendingCount(a)).toBe(0);
    // 기본 종목·근육 매핑은 보내지 않는다
    expect(remote.table('exercises').size).toBe(0);
    expect([...remote.table('exercise_muscles').keys()].some((k) => k.startsWith('base:'))).toBe(
      false,
    );

    const second = await syncOnce(b, remote);
    expect(second.pulled).toBe(first.pushed);
    expect(b.select().from(schema.routines).all()).toHaveLength(3);
    const w = b.select().from(schema.workouts).where(eq(schema.workouts.id, workoutId)).get();
    expect(w?.status).toBe('completed');
    expect(pendingCount(b)).toBe(0);

    // 다시 동기화해도 아무것도 오가지 않는다
    expect(await syncOnce(a, remote)).toEqual({ pushed: 0, pulled: 0 });
    expect(await syncOnce(b, remote)).toEqual({ pushed: 0, pulled: 0 });
  });

  it('툼스톤(삭제)이 다른 기기에 반영된다', async () => {
    const remote = new FakeRemote();
    const a = createDevice();
    const b = createDevice();
    copyTemplate(a, 'full_body', { lang: 'ko', weightUnit: 'kg' }, makeId);
    await syncOnce(a, remote);
    await syncOnce(b, remote);

    const r = a.select().from(schema.routines).get();
    if (!r) throw new Error('no routine');
    a.update(schema.routines).set({ deletedAt: 5 }).where(eq(schema.routines.id, r.id)).run();
    await syncOnce(a, remote);
    await syncOnce(b, remote);
    expect(
      b.select().from(schema.routines).where(eq(schema.routines.id, r.id)).get()?.deletedAt,
    ).toBe(5);
  });

  it('충돌은 updated_at이 더 새 쪽이 이긴다(LWW)', async () => {
    const remote = new FakeRemote();
    const a = createDevice();
    const b = createDevice();
    copyTemplate(a, 'full_body', { lang: 'ko', weightUnit: 'kg' }, makeId);
    await syncOnce(a, remote);
    await syncOnce(b, remote);
    const r = a.select().from(schema.routines).get();
    if (!r) throw new Error('no routine');

    // A가 먼저, B가 나중에 같은 루틴 이름을 바꾼다(둘 다 아직 안 보냄)
    a.update(schema.routines)
      .set({ name: 'A', updatedAt: FUTURE + 2_000 })
      .where(eq(schema.routines.id, r.id))
      .run();
    b.update(schema.routines)
      .set({ name: 'B', updatedAt: FUTURE + 3_000 })
      .where(eq(schema.routines.id, r.id))
      .run();

    await syncOnce(b, remote); // 새 쪽이 먼저 올라감
    await syncOnce(a, remote); // 오래된 A는 서버에서 무시되고 B를 받는다
    const nameOn = (db: Db) =>
      db.select().from(schema.routines).where(eq(schema.routines.id, r.id)).get()?.name;
    expect(nameOn(a)).toBe('B');
    await syncOnce(b, remote);
    expect(nameOn(b)).toBe('B');
  });

  it('안 보낸 기기 변경이 더 새로우면 받은 값으로 덮지 않는다', async () => {
    const remote = new FakeRemote();
    const a = createDevice();
    const b = createDevice();
    copyTemplate(a, 'full_body', { lang: 'ko', weightUnit: 'kg' }, makeId);
    await syncOnce(a, remote);
    await syncOnce(b, remote);
    const r = a.select().from(schema.routines).get();
    if (!r) throw new Error('no routine');
    a.update(schema.routines)
      .set({ name: 'old', updatedAt: FUTURE + 2_000 })
      .where(eq(schema.routines.id, r.id))
      .run();
    await syncOnce(a, remote);
    b.update(schema.routines)
      .set({ name: 'new', updatedAt: FUTURE + 9_000 })
      .where(eq(schema.routines.id, r.id))
      .run();
    // B는 보내기 전에 받기를 하면 안 되지만, 순서가 뒤집혀도 기기 값이 이긴다
    const pulled = await remote.pull('routines', 0, 100);
    applyRemote(b, 'routines', pulled);
    expect(b.select().from(schema.routines).where(eq(schema.routines.id, r.id)).get()?.name).toBe(
      'new',
    );
  });

  it('여러 번에 나눠 보내고 받는다(batch)', async () => {
    const remote = new FakeRemote();
    const a = createDevice();
    const b = createDevice();
    copyTemplate(a, 'push_pull_legs', { lang: 'ko', weightUnit: 'kg' }, makeId);
    const total = pendingCount(a);
    const res = await syncOnce(a, remote, { batch: 3 });
    expect(res.pushed).toBe(total);
    expect((await syncOnce(b, remote, { batch: 2 })).pulled).toBe(total);
  });

  it('계정이 바뀌면 전부 다시 보낸다', async () => {
    const remote = new FakeRemote();
    const a = createDevice();
    copyTemplate(a, 'full_body', { lang: 'ko', weightUnit: 'kg' }, makeId);
    const total = pendingCount(a);
    await syncOnce(a, remote);
    expect(pendingCount(a)).toBe(0);
    resetForAccount(a);
    expect(pendingCount(a)).toBe(total);
    const other = new FakeRemote();
    expect((await syncOnce(a, other)).pushed).toBe(total);
  });

  it('수정하면 dirty가 자동으로 1이 된다', async () => {
    const remote = new FakeRemote();
    const a = createDevice();
    copyTemplate(a, 'full_body', { lang: 'ko', weightUnit: 'kg' }, makeId);
    await syncOnce(a, remote);
    const r = a.select().from(schema.routines).get();
    if (!r) throw new Error('no routine');
    a.update(schema.routines).set({ name: 'x' }).where(eq(schema.routines.id, r.id)).run();
    expect(pendingCount(a)).toBe(1);
  });
});
