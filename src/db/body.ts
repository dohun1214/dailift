import { asc, eq, isNull } from 'drizzle-orm';

import { type BodyEntry, type BodyInput, parseExtras, serializeExtras } from '@/domain/body';
import { newId } from '@/lib/id';

import type { WeightUnit } from './schema';
import * as schema from './schema';
import type { AppDatabase } from './seed';

type Row = typeof schema.bodyMetrics.$inferSelect;

export const toBodyEntry = (r: Row): BodyEntry => ({
  id: r.id,
  measuredAt: r.measuredAt,
  weight: r.weight,
  weightUnit: r.weightUnit,
  skeletalMuscle: r.skeletalMuscle,
  bodyFatPct: r.bodyFatPct,
  extras: parseExtras(r.extras),
  source: r.source,
});

const values = (input: BodyInput, unit: WeightUnit, measuredAt: number) => ({
  measuredAt,
  weight: input.weight,
  weightUnit: unit,
  skeletalMuscle: input.skeletalMuscle,
  bodyFatPct: input.bodyFatPct,
  extras: serializeExtras(input.extras),
});

/** 지우지 않은 기록 전부(잰 날 오래된 순) */
export function listBodyEntries(db: AppDatabase): BodyEntry[] {
  return db
    .select()
    .from(schema.bodyMetrics)
    .where(isNull(schema.bodyMetrics.deletedAt))
    .orderBy(asc(schema.bodyMetrics.measuredAt))
    .all()
    .map(toBodyEntry);
}

export function getBodyEntry(db: AppDatabase, id: string): BodyEntry | null {
  const row = db.select().from(schema.bodyMetrics).where(eq(schema.bodyMetrics.id, id)).get();
  return row && row.deletedAt === null ? toBodyEntry(row) : null;
}

export function createBodyEntry(
  db: AppDatabase,
  input: BodyInput,
  unit: WeightUnit,
  measuredAt: number,
  makeId: () => string = newId,
  /** 결과지 사진에서 읽어 채운 기록이면 'ocr' */
  source: 'manual' | 'ocr' = 'manual',
): string {
  const id = makeId();
  db.insert(schema.bodyMetrics)
    .values({ id, source, ...values(input, unit, measuredAt) })
    .run();
  return id;
}

/** 고치면 그 줄의 무게 단위도 지금 단위로 바뀐다(화면에 보인 단위로 적었으므로). */
export function updateBodyEntry(
  db: AppDatabase,
  id: string,
  input: BodyInput,
  unit: WeightUnit,
  measuredAt: number,
) {
  db.update(schema.bodyMetrics)
    .set(values(input, unit, measuredAt))
    .where(eq(schema.bodyMetrics.id, id))
    .run();
}

/** 지운 것으로 표시한다(다른 기기에도 전해진다). */
export function deleteBodyEntry(db: AppDatabase, id: string, now = Date.now()) {
  db.update(schema.bodyMetrics).set({ deletedAt: now }).where(eq(schema.bodyMetrics.id, id)).run();
}
