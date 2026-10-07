/** 루틴 목록·요약에 쓰는 순수 계산. */

/** cardioSec: 유산소 종목이면 목표 시간(초, 0 = 목표 없음). 근력 종목이면 없다(null). */
type ExerciseLoad = { targetSets: number; restSec: number; cardioSec?: number | null };

const isCardioLoad = (e: ExerciseLoad) => e.cardioSec != null;

/** 한 세트 수행 시간(초)과 종목 전환 시간(초) 가정값 */
const WORK_SEC_PER_SET = 45;
const TRANSITION_SEC = 180;

/**
 * 예상 소요 시간(분, 5분 단위 반올림). 세트 수행 + 세트 사이 휴식 + 종목 전환.
 * 유산소는 세트 대신 목표 시간을 더한다(목표가 없으면 전환 시간만). 종목이 없으면 0.
 */
export function estimateMinutes(exercises: readonly ExerciseLoad[]): number {
  if (exercises.length === 0) return 0;
  const sec = exercises.reduce(
    (sum, e) =>
      sum +
      (isCardioLoad(e)
        ? (e.cardioSec ?? 0)
        : e.targetSets * WORK_SEC_PER_SET + Math.max(0, e.targetSets - 1) * e.restSec) +
      TRANSITION_SEC,
    0,
  );
  return Math.max(5, Math.round(sec / 60 / 5) * 5);
}

type GroupRow = {
  id: string;
  name: string;
  rotationMode: number;
  sortOrder: number;
  createdAt: number;
};
type RoutineRow = {
  id: string;
  groupId: string | null;
  name: string;
  weekdays: number;
  sortOrder: number;
  createdAt: number;
};

export type RoutineSummary = RoutineRow & {
  exerciseCount: number;
  setCount: number;
  minutes: number;
};
export type RoutineSection = {
  group: GroupRow | null;
  routines: RoutineSummary[];
};

const byOrder = (
  a: { sortOrder: number; createdAt: number },
  b: { sortOrder: number; createdAt: number },
) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt;

/**
 * 묶음별 섹션을 만든다. 묶음 순서대로, 루틴이 하나도 없는 묶음은 뺀다.
 * 묶음이 없거나(단독 루틴) 묶음이 지워진 루틴은 마지막 "단독" 섹션(group = null)으로 모은다.
 */
export function buildRoutineSections(
  groups: readonly GroupRow[],
  routines: readonly RoutineRow[],
  exercises: readonly (ExerciseLoad & { routineId: string })[],
): RoutineSection[] {
  const loads = new Map<string, ExerciseLoad[]>();
  for (const e of exercises) {
    const list = loads.get(e.routineId);
    if (list) list.push(e);
    else loads.set(e.routineId, [e]);
  }
  const summarize = (r: RoutineRow): RoutineSummary => {
    const list = loads.get(r.id) ?? [];
    return {
      ...r,
      exerciseCount: list.length,
      // 유산소는 세트로 세지 않는다.
      setCount: list.reduce((n, e) => n + (isCardioLoad(e) ? 0 : e.targetSets), 0),
      minutes: estimateMinutes(list),
    };
  };

  const groupIds = new Set(groups.map((g) => g.id));
  const sorted = [...routines].sort(byOrder);
  const sections: RoutineSection[] = [...groups]
    .sort(byOrder)
    .map((g) => ({ group: g, routines: sorted.filter((r) => r.groupId === g.id).map(summarize) }))
    .filter((s) => s.routines.length > 0);
  const standalone = sorted
    .filter((r) => r.groupId === null || !groupIds.has(r.groupId))
    .map(summarize);
  if (standalone.length > 0) sections.push({ group: null, routines: standalone });
  return sections;
}
