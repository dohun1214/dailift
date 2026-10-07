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
  /** 수정하면 자동으로 1(서버로 보낼 변경). 동기화가 받은 값·보낸 뒤 정리할 때만 0으로 쓴다. */
  dirty: integer('dirty')
    .notNull()
    .default(1)
    .$onUpdateFn(() => 1),
};

export type WeightUnit = 'kg' | 'lb';
/**
 * 종목 종류. cardio(유산소)는 세트 대신 한 줄에 시간(스톱워치)과 골라 적는 거리 · 속도 · 경사를 남기고,
 * 세트 수 · 볼륨 · 부위별 세트에는 들어가지 않는다.
 */
export type ExerciseType = 'weight_reps' | 'bodyweight_reps' | 'time' | 'cardio';
export type DistanceUnit = 'km' | 'mi';
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
    /** 세트별로 정해 둔 계획(JSON, `domain/set-plan.ts`). null이면 세트 수 · 횟수 범위로 정한 종목 */
    setPlan: text('set_plan'),
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
    /** 유산소: 거리(입력한 단위 그대로) · 속도(시간당, 같은 단위) · 경사(%). 모두 골라 적는다 */
    distance: real('distance'),
    distanceUnit: text('distance_unit').$type<DistanceUnit>().notNull().default('km'),
    speed: real('speed'),
    incline: real('incline'),
    /** 완료 체크 시각. null이면 아직 안 한 세트(프리필 포함) */
    completedAt: integer('completed_at'),
  },
  (t) => [
    index('sets_workout_exercise_idx').on(t.workoutExerciseId, t.position),
    index('sets_completed_idx').on(t.completedAt),
  ],
);

/**
 * 운동 사진. 파일은 기기 앱 폴더(documentDirectory 기준 상대 경로 `path`)에 두고,
 * 로그인하면 Supabase Storage `workout-photos/<user>/<id>.jpg`에 줄인 사본을 올린다(src/sync/photos.ts).
 */
export const workoutPhotos = sqliteTable(
  'workout_photos',
  {
    ...syncColumns,
    workoutId: text('workout_id').notNull(),
    path: text('path').notNull(),
    /** 기기 전용: 서버 저장소에 파일이 있음을 확인한 시각(올렸거나 내려받음). 동기화 안 함 */
    uploadedAt: integer('uploaded_at'),
  },
  (t) => [index('workout_photos_workout_idx').on(t.workoutId)],
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
    /**
     * 골라 적는 나머지 값(JSON, `domain/body.ts`의 `BodyExtras`): BMI · 기초대사량 · 내장지방 레벨 ·
     * 복부지방률 · 체수분 · 단백질 · 무기질 · 부위별 근육량. 무게인 값은 이 줄의 `weightUnit`을 따른다
     */
    extras: text('extras'),
  },
  (t) => [index('body_metrics_measured_idx').on(t.measuredAt)],
);

export type SupplementTiming = 'time' | 'after_workout';

/** 영양제. 복용 시각이 정해진 것(`time`)과 운동을 마친 뒤 먹는 것(`after_workout`) 두 가지 */
export const supplements = sqliteTable('supplements', {
  ...syncColumns,
  name: text('name').notNull(),
  /** 사용자가 적은 그대로 ("1,000 mg", "2정"). 계산에 쓰지 않는다 */
  dose: text('dose'),
  timing: text('timing').$type<SupplementTiming>().notNull().default('time'),
  /** 정해진 시각: 자정부터 몇 분째인지 (오전 9:00 = 540) */
  timeMin: integer('time_min').notNull().default(540),
  /** 운동 후: 운동을 마치고 몇 분 뒤인지 */
  afterMin: integer('after_min').notNull().default(30),
  notify: integer('notify').notNull().default(1),
  /** 한 시간 뒤에도 체크가 없으면 한 번 더 알린다 */
  renotify: integer('renotify').notNull().default(1),
  /** 0이면 목록 · 알림에서 빠진다(기록은 남는다) */
  active: integer('active').notNull().default(1),
  sortOrder: integer('sort_order').notNull().default(0),
});

/**
 * 영양제를 먹은 기록. 하루에 영양제마다 한 줄(체크를 풀면 지운 것으로 표시).
 * 날짜는 기기 현지 날짜 글자(`YYYY-MM-DD`)로 둔다 — 시각만 두면 여행 · 자정에 다른 날로 넘어간다.
 * 유니크 인덱스는 걸지 않는다(두 기기에서 같은 날 체크하면 줄이 둘 생길 수 있어, 읽을 때 영양제 단위로 센다).
 */
export const supplementLogs = sqliteTable(
  'supplement_logs',
  {
    ...syncColumns,
    supplementId: text('supplement_id').notNull(),
    date: text('date').notNull(),
    takenAt: integer('taken_at').notNull(),
  },
  (t) => [index('supplement_logs_date_idx').on(t.date, t.supplementId)],
);

export type Meal = 'breakfast' | 'lunch' | 'dinner' | 'snack';
/**
 * 음식이 어디서 왔는지: 앱에 넣은 DB(usda · mfds), 서버에서 찾는 식약처 가공식품(mfdsp) · USDA 포장 제품(usdab),
 * 직접 만든 음식(custom)
 */
export type FoodSrc = 'usda' | 'mfds' | 'mfdsp' | 'usdab' | 'custom';

/** 직접 만든 음식. 영양값은 100 g당으로 둔다(화면에서 1회 제공량 기준으로 넣어도 바꿔서 저장) */
export const foods = sqliteTable('foods', {
  ...syncColumns,
  name: text('name').notNull(),
  /** 1회 제공량(g). 없으면 g으로만 넣는다 */
  serving: real('serving'),
  /** 그 양을 부르는 이름 ("1개", "1스쿱") */
  servingName: text('serving_name'),
  kcal: real('kcal').notNull().default(0),
  protein: real('protein').notNull().default(0),
  carb: real('carb').notNull().default(0),
  fat: real('fat').notNull().default(0),
});

/**
 * 먹은 기록. 날짜는 기기 현지 날짜 글자(`YYYY-MM-DD`).
 * 음식은 출처 + 출처 id로 가리키고, 이름과 100 g당 영양값을 복사해 둔다(음식 DB를 새로 만들거나 내 음식을 고쳐도 기록은 그대로).
 */
export const foodLogs = sqliteTable(
  'food_logs',
  {
    ...syncColumns,
    date: text('date').notNull(),
    meal: text('meal').$type<Meal>().notNull(),
    position: integer('position').notNull().default(0),
    src: text('src').$type<FoodSrc>().notNull(),
    sid: text('sid').notNull(),
    name: text('name').notNull(),
    /** 먹은 양 (g, 음료는 ml) */
    grams: real('grams').notNull(),
    /** 1회 양 단위로 넣었으면 그 단위의 무게와 이름. g으로 넣었으면 둘 다 null. 이름만 null이면 '1인분' */
    unitGrams: real('unit_grams'),
    unitName: text('unit_name'),
    basis: text('basis').$type<'g' | 'ml'>().notNull().default('g'),
    /** 아래 넷은 100 g(ml)당 */
    kcal: real('kcal').notNull().default(0),
    protein: real('protein').notNull().default(0),
    carb: real('carb').notNull().default(0),
    fat: real('fat').notNull().default(0),
  },
  (t) => [index('food_logs_date_idx').on(t.date, t.meal, t.position)],
);

/** 즐겨찾기한 음식. 유니크 인덱스는 걸지 않고 앱에서 중복을 거른다 */
export const foodFavorites = sqliteTable(
  'food_favorites',
  {
    ...syncColumns,
    src: text('src').$type<FoodSrc>().notNull(),
    sid: text('sid').notNull(),
  },
  (t) => [index('food_favorites_food_idx').on(t.src, t.sid)],
);

/** 세트: 자주 같이 먹는 음식을 양까지 묶어 둔 것. 끼니에 넣으면 안의 음식이 하나씩 기록으로 들어간다 */
export const foodSets = sqliteTable('food_sets', {
  ...syncColumns,
  name: text('name').notNull(),
});

/** 세트에 담은 음식. 칸의 뜻은 `food_logs`와 같다(이름 · 100 g당 영양값 사본, 담은 양) */
export const foodSetItems = sqliteTable(
  'food_set_items',
  {
    ...syncColumns,
    setId: text('set_id').notNull(),
    position: integer('position').notNull().default(0),
    src: text('src').$type<FoodSrc>().notNull(),
    sid: text('sid').notNull(),
    name: text('name').notNull(),
    grams: real('grams').notNull(),
    unitGrams: real('unit_grams'),
    unitName: text('unit_name'),
    basis: text('basis').$type<'g' | 'ml'>().notNull().default('g'),
    kcal: real('kcal').notNull().default(0),
    protein: real('protein').notNull().default(0),
    carb: real('carb').notNull().default(0),
    fat: real('fat').notNull().default(0),
  },
  (t) => [index('food_set_items_set_idx').on(t.setId, t.position)],
);

/**
 * 서버에서 찾은 가공식품(식약처 · USDA 포장 제품) 가운데 이 기기에서 쓴 것의 사본 (로컬 전용, 동기화하지 않는다).
 * 두 출처의 식별자는 겹치지 않는다(식약처는 "P…" 식품코드, USDA는 숫자뿐인 바코드) — 그래서 출처 칸이 없다.
 * 즐겨찾기 목록과 양 창의 단위(1개 · 1회)를 인터넷 없이 보여 주는 데 쓴다. 없으면 서버에서 다시 받는다.
 */
export const foodCache = sqliteTable('food_cache', {
  sid: text('sid').primaryKey(),
  name: text('name').notNull(),
  maker: text('maker').notNull().default(''),
  basis: text('basis').$type<'g' | 'ml'>().notNull().default('g'),
  kcal: real('kcal').notNull().default(0),
  protein: real('protein').notNull().default(0),
  carb: real('carb').notNull().default(0),
  fat: real('fat').notNull().default(0),
  /** 식품중량(포장 하나) */
  size: real('size'),
  /** 1회 섭취참고량 */
  serv: real('serv'),
  fetchedAt: integer('fetched_at').notNull(),
});

/** 동기화 커서 (로컬 전용). cursorUpdatedAt에는 서버 rev(당겨온 마지막 번호)를 담는다. */
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
  'workout_photos',
  'body_metrics',
  'supplements',
  'supplement_logs',
  'foods',
  'food_logs',
  'food_favorites',
  'food_sets',
  'food_set_items',
] as const;

/**
 * 건강 데이터 동의가 있어야 서버와 주고받는 표(식단). 동의가 없으면 기기에만 둔다.
 * 동의 여부는 `stores/health-consent.ts`, 건너뛰는 곳은 `sync/manager.ts`.
 */
export const CONSENT_TABLES = [
  'foods',
  'food_logs',
  'food_favorites',
  'food_sets',
  'food_set_items',
] as const;

/**
 * 체성분 백업 동의가 있어야 서버와 주고받는 표. 동의가 없으면 기기에만 둔다
 * (`stores/health-consent.ts`의 `bodyAcceptedAt`).
 */
export const BODY_CONSENT_TABLES = ['body_metrics'] as const;
