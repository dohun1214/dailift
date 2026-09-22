/**
 * 동기화 엔진: 기기 SQLite ↔ 서버(Supabase) 테이블.
 * - 보내기: dirty = 1인 행을 부모 → 자식 순서로 upsert, 보낸 그대로면 dirty = 0.
 * - 받기: 서버가 매긴 rev가 커서보다 큰 행을 받아 반영(LWW: updated_at이 더 새 것이 이긴다).
 * - 삭제는 deleted_at 툼스톤으로 오간다. 서버는 오래된 쓰기를 트리거로 무시한다.
 * 원격 저장소는 SyncRemote로 추상화해서 테스트에서는 메모리 구현을 쓴다.
 */
import { getTableColumns, type SQL, sql } from 'drizzle-orm';
import type { SQLiteTable } from 'drizzle-orm/sqlite-core';

import * as schema from '@/db/schema';
import type { AppDatabase } from '@/db/seed';

export type SyncedTableName = (typeof schema.SYNCED_TABLES)[number];
/** 서버 행: 컬럼 이름은 SQL 이름(snake_case) 그대로 */
export type RemoteRow = { id: string; updated_at: number; rev?: number } & Record<string, unknown>;

export interface SyncRemote {
  push(table: SyncedTableName, rows: RemoteRow[]): Promise<void>;
  pull(table: SyncedTableName, afterRev: number, limit: number): Promise<RemoteRow[]>;
}

const TABLES: Record<SyncedTableName, SQLiteTable> = {
  exercises: schema.exercises,
  exercise_muscles: schema.exerciseMuscles,
  routine_groups: schema.routineGroups,
  routines: schema.routines,
  routine_exercises: schema.routineExercises,
  workouts: schema.workouts,
  workout_exercises: schema.workoutExercises,
  sets: schema.sets,
  workout_photos: schema.workoutPhotos,
  body_metrics: schema.bodyMetrics,
};

/** 기기에만 있는 컬럼(서버로 보내지 않고, 받을 때 덮지 않음) */
const LOCAL_ONLY = new Set(['dirty', 'uploaded_at']);

/** 기본 종목과 그 근육 매핑은 앱이 시드하는 참조 데이터라 보내지 않는다. */
const PUSH_FILTER: Partial<Record<SyncedTableName, string>> = {
  exercises: 'is_custom = 1',
  exercise_muscles: "exercise_id NOT LIKE 'base:%'",
};

/** 서버와 주고받는 컬럼(SQL 이름) */
const columnsCache = new Map<SyncedTableName, string[]>();
export function syncColumns(table: SyncedTableName): string[] {
  let cols = columnsCache.get(table);
  if (!cols) {
    cols = Object.values(getTableColumns(TABLES[table]))
      .map((c) => c.name)
      .filter((n) => !LOCAL_ONLY.has(n));
    columnsCache.set(table, cols);
  }
  return cols;
}

const ident = (name: string) => sql.identifier(name);
const where = (table: SyncedTableName, base: string) => {
  const extra = PUSH_FILTER[table];
  return sql.raw(extra ? `${base} AND ${extra}` : base);
};

export function collectDirty(db: AppDatabase, table: SyncedTableName, limit: number): RemoteRow[] {
  const cols = sql.join(syncColumns(table).map(ident), sql`, `);
  return db.all<RemoteRow>(
    sql`SELECT ${cols} FROM ${ident(table)} WHERE ${where(table, 'dirty = 1')} ORDER BY updated_at LIMIT ${limit}`,
  );
}

/** 보내는 사이에 다시 바뀌지 않은 행만 정리한다. */
export function markClean(db: AppDatabase, table: SyncedTableName, rows: readonly RemoteRow[]) {
  db.transaction((tx) => {
    for (const r of rows) {
      tx.run(
        sql`UPDATE ${ident(table)} SET dirty = 0 WHERE id = ${r.id} AND updated_at = ${r.updated_at}`,
      );
    }
  });
}

/** 받은 행을 반영하고 실제로 바꾼 행 수를 돌려준다. */
export function applyRemote(
  db: AppDatabase,
  table: SyncedTableName,
  rows: readonly RemoteRow[],
): number {
  const cols = syncColumns(table);
  let changed = 0;
  db.transaction((tx) => {
    for (const r of rows) {
      const local = tx.get<{ updated_at: number; dirty: number }>(
        sql`SELECT updated_at, dirty FROM ${ident(table)} WHERE id = ${r.id}`,
      );
      if (local) {
        // 아직 안 보낸 기기 쪽 변경이 같거나 더 새로우면 기기 것을 지킨다.
        if (local.dirty === 1 && local.updated_at >= r.updated_at) continue;
        // 이미 같은 버전이면 쓰지 않는다(쓸데없는 화면 갱신 방지).
        if (local.dirty === 0 && local.updated_at === r.updated_at) continue;
      }
      if (table === 'exercise_muscles') {
        tx.run(
          sql`DELETE FROM exercise_muscles WHERE exercise_id = ${r.exercise_id as string} AND muscle_id = ${r.muscle_id as string} AND id <> ${r.id}`,
        );
      }
      const values: SQL[] = cols.map((c) => sql`${(r[c] ?? null) as string | number | null}`);
      const updates = sql.join(
        cols.filter((c) => c !== 'id').map((c) => sql`${ident(c)} = excluded.${ident(c)}`),
        sql`, `,
      );
      tx.run(
        sql`INSERT INTO ${ident(table)} (${sql.join(cols.map(ident), sql`, `)}, dirty) VALUES (${sql.join(values, sql`, `)}, 0) ON CONFLICT(id) DO UPDATE SET ${updates}, dirty = 0`,
      );
      changed += 1;
    }
  });
  return changed;
}

function getCursor(db: AppDatabase, table: SyncedTableName): number {
  const row = db.get<{ c: number }>(
    sql`SELECT cursor_updated_at AS c FROM sync_state WHERE table_name = ${table}`,
  );
  return row?.c ?? 0;
}

function setCursor(db: AppDatabase, table: SyncedTableName, rev: number, now: number) {
  db.run(
    sql`INSERT INTO sync_state (table_name, cursor_updated_at, cursor_id, last_synced_at) VALUES (${table}, ${rev}, '', ${now}) ON CONFLICT(table_name) DO UPDATE SET cursor_updated_at = excluded.cursor_updated_at, last_synced_at = excluded.last_synced_at`,
  );
}

/** 계정이 바뀌었을 때: 기기의 모든 행을 새 계정으로 다시 보내고 처음부터 받는다. */
export function resetForAccount(db: AppDatabase) {
  db.transaction((tx) => {
    for (const table of schema.SYNCED_TABLES) {
      tx.run(sql`UPDATE ${ident(table)} SET dirty = 1 WHERE ${where(table, '1 = 1')}`);
    }
    // 사진 파일도 새 계정 저장소에 다시 올린다.
    tx.run(sql`UPDATE workout_photos SET uploaded_at = NULL`);
    tx.run(sql`DELETE FROM sync_state`);
  });
}

export function pendingCount(db: AppDatabase): number {
  let n = 0;
  for (const table of schema.SYNCED_TABLES) {
    n +=
      db.get<{ n: number }>(
        sql`SELECT COUNT(*) AS n FROM ${ident(table)} WHERE ${where(table, 'dirty = 1')}`,
      )?.n ?? 0;
  }
  return n;
}

export type SyncResult = { pushed: number; pulled: number };

/** 한 번 동기화: 모두 보낸 뒤 모두 받는다. */
export async function syncOnce(
  db: AppDatabase,
  remote: SyncRemote,
  { batch = 500, now = () => Date.now() }: { batch?: number; now?: () => number } = {},
): Promise<SyncResult> {
  let pushed = 0;
  for (const table of schema.SYNCED_TABLES) {
    for (;;) {
      const rows = collectDirty(db, table, batch);
      if (rows.length === 0) break;
      await remote.push(table, rows);
      markClean(db, table, rows);
      pushed += rows.length;
      if (rows.length < batch) break;
    }
  }
  let pulled = 0;
  for (const table of schema.SYNCED_TABLES) {
    let cursor = getCursor(db, table);
    for (;;) {
      const rows = await remote.pull(table, cursor, batch);
      if (rows.length === 0) break;
      pulled += applyRemote(db, table, rows);
      cursor = Math.max(cursor, ...rows.map((r) => r.rev ?? 0));
      setCursor(db, table, cursor, now());
      if (rows.length < batch) break;
    }
  }
  return { pushed, pulled };
}
