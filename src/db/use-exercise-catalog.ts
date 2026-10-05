import { eq } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import type { AppLanguage } from '@/i18n/resolve-language';

import { db } from './client';
import { exerciseName } from './names';
import * as schema from './schema';

export type CatalogExercise = {
  id: string;
  name: string;
  /** 검색용 이름들 (한·영·커스텀) */
  searchNames: (string | null)[];
  isCustom: boolean;
  /** 사용자가 지운 직접 만든 종목. 목록에는 없고, 지난 기록의 이름을 보여 줄 때만 쓴다 */
  deleted: boolean;
  type: schema.ExerciseType;
  equipment: schema.Equipment;
  primaryGroups: schema.MuscleGroup[];
  sortOrder: number;
  createdAt: number;
};

/**
 * 기본 + 커스텀 종목 목록과 id 조회 맵. 커스텀 종목을 만들면 자동으로 갱신된다.
 * 지운 종목은 목록(`base` · `custom`)에서 빠지지만 `byId`에는 남는다(지난 기록에 이름이 계속 보이게).
 */
export function useExerciseCatalog(lang: AppLanguage) {
  const { data: exercises } = useLiveQuery(db.select().from(schema.exercises));
  const { data: primaries } = useLiveQuery(
    db
      .select({
        exerciseId: schema.exerciseMuscles.exerciseId,
        group: schema.muscles.group,
      })
      .from(schema.exerciseMuscles)
      .innerJoin(schema.muscles, eq(schema.muscles.id, schema.exerciseMuscles.muscleId))
      .where(eq(schema.exerciseMuscles.role, 'primary')),
  );

  return useMemo(() => {
    const groups = new Map<string, schema.MuscleGroup[]>();
    for (const p of primaries) {
      const list = groups.get(p.exerciseId);
      if (!list) groups.set(p.exerciseId, [p.group]);
      else if (!list.includes(p.group)) list.push(p.group);
    }
    const list: CatalogExercise[] = exercises.map((e) => ({
      id: e.id,
      name: exerciseName(e, lang),
      searchNames: [e.name, e.nameKo, e.nameEn],
      isCustom: e.isCustom === 1,
      deleted: e.deletedAt !== null,
      type: e.type,
      equipment: e.equipment,
      primaryGroups: groups.get(e.id) ?? [],
      sortOrder: e.sortOrder,
      createdAt: e.createdAt,
    }));
    const live = list.filter((e) => !e.deleted);
    const base = live.filter((e) => !e.isCustom).sort((a, b) => a.sortOrder - b.sortOrder);
    const custom = live.filter((e) => e.isCustom).sort((a, b) => b.createdAt - a.createdAt);
    return { base, custom, byId: new Map(list.map((e) => [e.id, e])) };
  }, [exercises, primaries, lang]);
}
