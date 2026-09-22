/**
 * 로컬 SQLite 스키마. 기기 DB가 정본이고 서버는 복제본이다.
 *
 * 동기화 규칙
 * - 사용자가 만드는 행은 모두 `syncColumns`를 가진다: 클라이언트가 만든 UUIDv7 id,
 *   ms 단위 시각, 삭제는 `deletedAt`(툼스톤), 서버로 보낼 변경은 `dirty = 1`.
 * - 외래 키 제약은 걸지 않는다. 동기화로 자식 행이 부모보다 먼저 도착하거나
 *   부모가 툼스톤이 될 수 있어서, 참조 무결성은 앱 로직과 인덱스로 관리한다.
 * - 기본 종목(`isCustom = 0`)과 근육은 앱이 시드하는 참조 데이터라 동기화하지 않는다.
 *   기본 종목 id는 `base:<key>`로 고정해서 기기가 달라도 같은 id를 가리킨다.
 */
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const now = () => Date.now();

const syncColumns = {
  id: text('id').primaryKey(),
  createdAt: integer('created_at').notNull().$defaultFn(now),
  updatedAt: integer('updated_at').notNull().$defaultFn(now).$onUpdateFn(now),
  deletedAt: integer('deleted_at'),
  dirty: integer('dirty').notNull().default(1),
};

export type WeightUnit = 'kg' | 'lb';
export type ExerciseType = 'weight_reps' | 'bodyweight_reps' | 'time';
export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'band'
  | 'kettlebell'
  | 'other';
export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core';
export type MuscleRole = 'primary' | 'secondary';
export type SetKind = 'warmup' | 'working' | 'drop' | 'failure';
export type WorkoutStatus = 'in_progress' | 'completed' | 'discarded';

/** 근육 참조 데이터 (시드, 동기화 안 함) */
export const muscles = sqliteTable('muscles', {
  id: text('id').primaryKey(),
  group: text('group').$type<MuscleGroup>().notNull(),
  nameKo: text('name_ko').notNull(),
  nameEn: text('name_en').notNull(),
  sortOrder: integer('sort_order').notNull(),
});

export const exercises = sqliteTable(
  'exercises',
  {
    ...syncColumns,
    isCustom: integer('is_custom').notNull().default(1),
    /** 기본 종목 이름 (커스텀 종목은 name만 쓴다) */
    nameKo: text('name_ko'),
    nameEn: text('name_en'),
    /** 커스텀 종목 이름 */
    name: text('name'),
    type: text('type').$type<ExerciseType>().notNull(),
    equipment: text('equipment').$type<Equipment>().notNull(),
    /** 기본 종목 목록에서의 고정 순서 */
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('exercises_custom_idx').on(t.isCustom, t.sortOrder)],
);

export const exerciseMuscles = sqliteTable(
  'exercise_muscles',
  {
    ...syncColumns,
    exerciseId: text('exercise_id').notNull(),
    muscleId: text('muscle_id').notNull(),
    role: text('role').$type<MuscleRole>().notNull(),
  },
  (t) => [
    uniqueIndex('exercise_muscles_pair_idx').on(t.exerciseId, t.muscleId),
    index('exercise_muscles_muscle_idx').on(t.muscleId),
  ],
);

/** 루틴 묶음(프로그램). 예: 푸시풀레그 */
export const routineGroups = sqliteTable('routine_groups', {
  ...syncColumns,
  name: text('name').notNull(),
  /** 1이면 요일 대신 순서대로 "다음 루틴"을 돌린다 */
  rotationMode: integer('rotation_mode').notNull().default(0),
  rotationIndex: integer('rotation_index').notNull().default(0),
  /** 추천 루틴에서 복사했으면 템플릿 키 */
  templateKey: text('template_key'),
  sortOrder: integer('sort_order').notNull().default(0),
});

/** 루틴 = 하루치 운동 */
export const routines = sqliteTable(
  'routines',
  {
    ...syncColumns,
    groupId: text('group_id'),
    name: text('name').notNull(),
    /** 요일 비트마스크 (월=bit0 … 일=bit6), src/lib/weekdays.ts */
    weekdays: integer('weekdays').notNull().default(0),
    /** 'HH:mm', 알림 없으면 null */
    reminderTime: text('reminder_time'),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [index('routines_group_idx').on(t.groupId, t.sortOrder)],
);

export const routineExercises = sqliteTable(
  'routine_exercises',
  {
    ...syncColumns,
    routineId: text('routine_id').notNull(),
    exerciseId: text('exercise_id').notNull(),
    position: integer('position').notNull(),
    targetSets: integer('target_sets').notNull().default(3),
    repMin: integer('rep_min').notNull().default(8),
    repMax: integer('rep_max').notNull().default(12),
    restSec: integer('rest_sec').notNull().default(90),
    /** 증량 제안 단위 */
    increment: real('increment').notNull().default(2.5),
    incrementUnit: text('increment_unit').$type<WeightUnit>().notNull().default('kg'),
    note: text('note'),
  },
  (t) => [index('routine_exercises_routine_idx').on(t.routineId, t.position)],
);

export const workouts = sqliteTable(
  'workouts',
  {
    ...syncColumns,
    routineId: text('routine_id'),
    /** 시작 당시 루틴 이름 스냅샷 (루틴이 바뀌거나 지워져도 기록은 유지) */
    name: text('name').notNull(),
    status: text('status').$type<WorkoutStatus>().notNull().default('in_progress'),
    startedAt: integer('started_at').notNull(),
    endedAt: integer('ended_at'),
    note: text('note'),
  },
  (t) => [index('workouts_started_idx').on(t.startedAt), index('workouts_status_idx').on(t.status)],
);

export const workoutExercises = sqliteTable(
  'workout_exercises',
  {
    ...syncColumns,
    workoutId: text('workout_id').notNull(),
    exerciseId: text('exercise_id').notNull(),
    position: integer('position').notNull(),
    restSec: integer('rest_sec').notNull().default(90),
    /** 시작 당시 목표 렙 범위·증량 단위 스냅샷 (증량 제안과 접힌 카드 요약에 쓴다) */
    repMin: integer('rep_min').notNull().default(8),
    repMax: integer('rep_max').notNull().default(12),
    increment: real('increment').notNull().default(2.5),
    incrementUnit: text('increment_unit').$type<WeightUnit>().notNull().default('kg'),
    note: text('note'),
  },
  (t) => [
    index('workout_exercises_workout_idx').on(t.workoutId, t.position),
    index('workout_exercises_exercise_idx').on(t.exerciseId),
  ],
);

export const sets = sqliteTable(
  'sets',
  {
    ...syncColumns,
    workoutExerciseId: text('workout_exercise_id').notNull(),
    position: integer('position').notNull(),
    kind: text('kind').$type<SetKind>().notNull().default('working'),
    /** 입력한 단위 그대로 저장한다 (환산은 계산할 때만) */
    weight: real('weight'),
    weightUnit: text('weight_unit').$type<WeightUnit>().notNull().default('kg'),
    reps: integer('reps'),
    durationSec: integer('duration_sec'),
    rpe: real('rpe'),
    /** 완료 체크 시각. null이면 아직 안 한 세트(프리필 포함) */
    completedAt: integer('completed_at'),
  },
  (t) => [
    index('sets_workout_exercise_idx').on(t.workoutExerciseId, t.position),
    index('sets_completed_idx').on(t.completedAt),
  ],
);

export const bodyMetrics = sqliteTable(
  'body_metrics',
  {
    ...syncColumns,
    measuredAt: integer('measured_at').notNull(),
    weight: real('weight'),
    weightUnit: text('weight_unit').$type<WeightUnit>().notNull().default('kg'),
    skeletalMuscle: real('skeletal_muscle'),
    bodyFatPct: real('body_fat_pct'),
    source: text('source').$type<'manual' | 'ocr' | 'health'>().notNull().default('manual'),
  },
  (t) => [index('body_metrics_measured_idx').on(t.measuredAt)],
);

/** 동기화 커서 (로컬 전용) */
export const syncState = sqliteTable('sync_state', {
  tableName: text('table_name').primaryKey(),
  cursorUpdatedAt: integer('cursor_updated_at').notNull().default(0),
  cursorId: text('cursor_id').notNull().default(''),
  lastSyncedAt: integer('last_synced_at'),
});

/** 동기화 대상 테이블 (push 순서 = 부모 → 자식) */
export const SYNCED_TABLES = [
  'exercises',
  'exercise_muscles',
  'routine_groups',
  'routines',
  'routine_exercises',
  'workouts',
  'workout_exercises',
  'sets',
  'body_metrics',
] as const;
