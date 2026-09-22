import { isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { buildRoutineSections } from '@/domain/routine';

import { db } from './client';
import * as schema from './schema';

/** 내 루틴 목록(묶음별 섹션). DB가 바뀌면 자동으로 다시 계산된다. */
export function useRoutineSections() {
  const { data: groups } = useLiveQuery(
    db
      .select({
        id: schema.routineGroups.id,
        name: schema.routineGroups.name,
        rotationMode: schema.routineGroups.rotationMode,
        sortOrder: schema.routineGroups.sortOrder,
        createdAt: schema.routineGroups.createdAt,
      })
      .from(schema.routineGroups)
      .where(isNull(schema.routineGroups.deletedAt)),
  );
  const { data: routines } = useLiveQuery(
    db
      .select({
        id: schema.routines.id,
        groupId: schema.routines.groupId,
        name: schema.routines.name,
        weekdays: schema.routines.weekdays,
        sortOrder: schema.routines.sortOrder,
        createdAt: schema.routines.createdAt,
      })
      .from(schema.routines)
      .where(isNull(schema.routines.deletedAt)),
  );
  const { data: exercises } = useLiveQuery(
    db
      .select({
        routineId: schema.routineExercises.routineId,
        targetSets: schema.routineExercises.targetSets,
        restSec: schema.routineExercises.restSec,
      })
      .from(schema.routineExercises)
      .where(isNull(schema.routineExercises.deletedAt)),
  );
  return useMemo(
    () => buildRoutineSections(groups, routines, exercises),
    [groups, routines, exercises],
  );
}
