import Database from 'better-sqlite3';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { baseExerciseId } from '@/data/exercises';
import { newDraftItem } from '@/domain/routine-draft';

import {
  createCustomExercise,
  deleteRoutine,
  emptyRoutineDraft,
  loadRoutineDraft,
  saveRoutineDraft,
} from '../routine-editor';
import { copyTemplate } from '../routines';
import * as schema from '../schema';
import { seedReferenceData } from '../seed';

function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: 'drizzle' });
  seedReferenceData(db);
  return db;
}

let counter = 0;
const makeId = () => `id-${++counter}`;

const liveItems = (db: ReturnType<typeof createTestDb>, routineId: string) =>
  db
    .select()
    .from(schema.routineExercises)
    .where(
      and(
        eq(schema.routineExercises.routineId, routineId),
        isNull(schema.routineExercises.deletedAt),
      ),
    )
    .orderBy(asc(schema.routineExercises.position))
    .all();

describe('saveRoutineDraft', () => {
  it('새 루틴을 단독 루틴으로 만든다', () => {
    const db = createTestDb();
    const draft = {
      ...emptyRoutineDraft(),
      name: '  홈트  ',
      weekdays: 0b1000000,
      items: [newDraftItem('k1', baseExerciseId('push_up'), 'kg', 60)],
    };
    const id = saveRoutineDraft(db, draft, makeId);
    const routine = db.select().from(schema.routines).where(eq(schema.routines.id, id)).get();
    expect(routine).toMatchObject({ name: '홈트', groupId: null, weekdays: 64, dirty: 1 });
    expect(liveItems(db, id).map((i) => [i.exerciseId, i.restSec])).toEqual([
      [baseExerciseId('push_up'), 60],
    ]);
  });

  it('순서 변경·삭제·추가를 반영하고 빠진 종목은 툼스톤 처리한다', () => {
    const db = createTestDb();
    const groupId = copyTemplate(db, 'upper_lower', { lang: 'ko', weightUnit: 'kg' }, makeId);
    const routine = db
      .select()
      .from(schema.routines)
      .where(eq(schema.routines.groupId, groupId))
      .orderBy(asc(schema.routines.sortOrder))
      .get();
    if (!routine) throw new Error('no routine');
    const draft = loadRoutineDraft(db, routine.id);
    if (!draft) throw new Error('no draft');
    expect(draft.items).toHaveLength(4);

    const [bench, row, ohp] = draft.items;
    if (!bench || !row || !ohp) throw new Error('items');
    const next = {
      ...draft,
      name: '상체 A+',
      items: [ohp, { ...bench, targetSets: 5 }, newDraftItem('new', baseExerciseId('dips'), 'kg')],
    };
    saveRoutineDraft(db, next, makeId);

    const items = liveItems(db, routine.id);
    expect(items.map((i) => [i.exerciseId, i.position])).toEqual([
      [baseExerciseId('overhead_press'), 0],
      [baseExerciseId('bench_press'), 1],
      [baseExerciseId('dips'), 2],
    ]);
    expect(items[1]?.targetSets).toBe(5);
    const all = db
      .select()
      .from(schema.routineExercises)
      .where(eq(schema.routineExercises.routineId, routine.id))
      .all();
    expect(all.filter((i) => i.deletedAt !== null)).toHaveLength(2);
    expect(loadRoutineDraft(db, routine.id)?.name).toBe('상체 A+');
  });
});

describe('deleteRoutine', () => {
  it('루틴과 종목을 툼스톤 처리하고 더는 읽히지 않는다', () => {
    const db = createTestDb();
    const id = saveRoutineDraft(
      db,
      {
        ...emptyRoutineDraft(),
        name: 'x',
        items: [newDraftItem('a', baseExerciseId('squat'), 'kg')],
      },
      makeId,
    );
    deleteRoutine(db, id);
    expect(loadRoutineDraft(db, id)).toBeNull();
    expect(liveItems(db, id)).toHaveLength(0);
  });
});

describe('createCustomExercise', () => {
  it('주동근·협응근을 저장하고 겹친 협응근은 버린다', () => {
    const db = createTestDb();
    const id = createCustomExercise(
      db,
      {
        name: '케이블 크로스오버',
        type: 'weight_reps',
        equipment: 'cable',
        primary: ['chest'],
        secondary: ['chest', 'shoulders'],
      },
      makeId,
    );
    const ex = db.select().from(schema.exercises).where(eq(schema.exercises.id, id)).get();
    expect(ex).toMatchObject({ isCustom: 1, name: '케이블 크로스오버', dirty: 1 });
    const muscles = db
      .select()
      .from(schema.exerciseMuscles)
      .where(eq(schema.exerciseMuscles.exerciseId, id))
      .all();
    expect(muscles.map((m) => `${m.muscleId}:${m.role}`).sort()).toEqual([
      'chest:primary',
      'shoulders:secondary',
    ]);
  });

  it('이름이나 주동근이 없으면 오류', () => {
    const db = createTestDb();
    const base = { type: 'time' as const, equipment: 'bodyweight' as const, secondary: [] };
    expect(() =>
      createCustomExercise(db, { ...base, name: ' ', primary: ['abs'] }, makeId),
    ).toThrow();
    expect(() =>
      createCustomExercise(db, { ...base, name: '플랭크2', primary: [] }, makeId),
    ).toThrow();
  });
});
