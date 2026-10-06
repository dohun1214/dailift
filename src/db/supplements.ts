import { and, count, desc, eq, gte, isNull, lt } from 'drizzle-orm';

import { LIMITS, type Supplement } from '@/domain/supplements';
import { newId } from '@/lib/id';

import type { SupplementTiming } from './schema';
import * as schema from './schema';
import type { AppDatabase } from './seed';

type IdFn = () => string;

export type SupplementInput = {
  name: string;
  dose: string;
  timing: SupplementTiming;
  timeMin: number;
  afterMin: number;
  notify: boolean;
  renotify: boolean;
  active: boolean;
};

type Row = typeof schema.supplements.$inferSelect;

export const toSupplement = (r: Row): Supplement => ({
  id: r.id,
  name: r.name,
  dose: r.dose,
  timing: r.timing,
  timeMin: r.timeMin,
  afterMin: r.afterMin,
  notify: r.notify === 1,
  renotify: r.renotify === 1,
  active: r.active === 1,
  createdAt: r.createdAt,
});

const values = (input: SupplementInput) => ({
  name: input.name.trim().slice(0, LIMITS.name),
  dose: input.dose.trim().slice(0, LIMITS.dose) || null,
  timing: input.timing,
  timeMin: input.timeMin,
  afterMin: input.afterMin,
  notify: input.notify ? 1 : 0,
  renotify: input.renotify ? 1 : 0,
  active: input.active ? 1 : 0,
});

export function listSupplements(db: AppDatabase): Supplement[] {
  return db
    .select()
    .from(schema.supplements)
    .where(isNull(schema.supplements.deletedAt))
    .all()
    .map(toSupplement);
}

export function getSupplement(db: AppDatabase, id: string): Supplement | null {
  const row = db
    .select()
    .from(schema.supplements)
    .where(and(eq(schema.supplements.id, id), isNull(schema.supplements.deletedAt)))
    .get();
  return row ? toSupplement(row) : null;
}

export function supplementCount(db: AppDatabase): number {
  const row = db
    .select({ n: count() })
    .from(schema.supplements)
    .where(isNull(schema.supplements.deletedAt))
    .get();
  return row?.n ?? 0;
}

export const canAddSupplement = (db: AppDatabase): boolean =>
  supplementCount(db) < LIMITS.supplements;

export function createSupplement(
  db: AppDatabase,
  input: SupplementInput,
  makeId: IdFn = newId,
): string {
  const id = makeId();
  db.insert(schema.supplements)
    .values({ id, ...values(input) })
    .run();
  return id;
}

export function updateSupplement(db: AppDatabase, id: string, input: SupplementInput) {
  db.update(schema.supplements).set(values(input)).where(eq(schema.supplements.id, id)).run();
}

/** 영양제와 그 복용 기록을 지운다(지운 것으로 표시 — 다른 기기에도 전해진다). */
export function deleteSupplement(db: AppDatabase, id: string, now = Date.now()) {
  db.transaction((tx) => {
    tx.update(schema.supplementLogs)
      .set({ deletedAt: now })
      .where(
        and(eq(schema.supplementLogs.supplementId, id), isNull(schema.supplementLogs.deletedAt)),
      )
      .run();
    tx.update(schema.supplements)
      .set({ deletedAt: now })
      .where(eq(schema.supplements.id, id))
      .run();
  });
}

/**
 * 그날 먹었는지 바꾼다. 체크하면 한 줄을 만들고(전에 풀었던 줄이 있으면 되살린다),
 * 풀면 그날 그 영양제의 줄을 모두 지운 것으로 표시한다(다른 기기에서 생긴 줄 포함).
 */
export function setSupplementTaken(
  db: AppDatabase,
  supplementId: string,
  date: string,
  taken: boolean,
  now = Date.now(),
  makeId: IdFn = newId,
) {
  const same = and(
    eq(schema.supplementLogs.supplementId, supplementId),
    eq(schema.supplementLogs.date, date),
  );
  db.transaction((tx) => {
    if (!taken) {
      tx.update(schema.supplementLogs)
        .set({ deletedAt: now })
        .where(and(same, isNull(schema.supplementLogs.deletedAt)))
        .run();
      return;
    }
    const rows = tx
      .select({ id: schema.supplementLogs.id, deletedAt: schema.supplementLogs.deletedAt })
      .from(schema.supplementLogs)
      .where(same)
      .all();
    if (rows.some((r) => r.deletedAt === null)) return;
    const [old] = rows;
    if (old) {
      tx.update(schema.supplementLogs)
        .set({ deletedAt: null, takenAt: now })
        .where(eq(schema.supplementLogs.id, old.id))
        .run();
    } else {
      tx.insert(schema.supplementLogs)
        .values({ id: makeId(), supplementId, date, takenAt: now })
        .run();
    }
  });
}

/** 그날 먹은 영양제 id */
export function takenOn(db: AppDatabase, date: string): Set<string> {
  const rows = db
    .select({ supplementId: schema.supplementLogs.supplementId })
    .from(schema.supplementLogs)
    .where(and(eq(schema.supplementLogs.date, date), isNull(schema.supplementLogs.deletedAt)))
    .all();
  return new Set(rows.map((r) => r.supplementId));
}

/** 그날(현지) 마지막으로 마친 운동의 끝난 시각. 없으면 null */
export function lastWorkoutEndOn(db: AppDatabase, day: Date): number | null {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1).getTime();
  const row = db
    .select({ endedAt: schema.workouts.endedAt })
    .from(schema.workouts)
    .where(
      and(
        eq(schema.workouts.status, 'completed'),
        isNull(schema.workouts.deletedAt),
        gte(schema.workouts.endedAt, start),
        lt(schema.workouts.endedAt, end),
      ),
    )
    .orderBy(desc(schema.workouts.endedAt))
    .limit(1)
    .get();
  return row?.endedAt ?? null;
}
