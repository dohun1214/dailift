/** 홈 화면 계산: 주간 스트립, 오늘 루틴, 주 단위 연속 기록, 최근 PR. 모두 순수 함수. */
import type { WeightUnit } from '@/db/schema';
import { hasDay, weekdayIndex } from '@/lib/weekdays';

import { type PrEntry, type SummarySet, sessionPrs } from './session-summary';
import { type Best, bestOf } from './strength';

export type DayState = 'today' | 'done' | 'plan' | 'rest';

/** done: 그날 마친 운동이 있음 (오늘 칸에 체크를 그릴 때 쓴다) */
export type StripDay = { date: Date; weekday: number; state: DayState; done: boolean };

/** 그 주 월요일 0시 */
export function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - weekdayIndex(x));
  return x;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 날짜 줄을 앞으로 넘길 수 있는 주 수 */
export const MAX_WEEKS_AHEAD = 4;

/**
 * 한 주(월–일) 7칸. weekOffset 0이 이번 주, -1이 지난주, 1이 다음 주.
 * 오늘은 항상 today, 운동을 마친 날은 done, 앞으로 루틴이 잡힌 날은 plan, 나머지는 rest.
 * (지난 날의 예정은 지금 루틴 요일로 거꾸로 짐작한 값이라 줄에는 표시하지 않는다.)
 */
export function weekStrip(
  now: Date,
  routineMasks: readonly number[],
  workoutStarts: readonly number[],
  weekOffset = 0,
): StripDay[] {
  const start = startOfWeek(now);
  start.setDate(start.getDate() + weekOffset * 7);
  const allMask = routineMasks.reduce((m, x) => m | x, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const done = workoutStarts.some((t) => sameDay(new Date(t), date));
    let state: DayState = 'rest';
    if (sameDay(date, now)) state = 'today';
    else if (done) state = 'done';
    else if (date > now && hasDay(allMask, i)) state = 'plan';
    return { date, weekday: i, state, done };
  });
}

/** 뒤로 넘길 수 있는 가장 먼 주(0 이하): 첫 운동 기록이 있는 주까지. 기록이 없으면 0 */
export function minWeekOffset(workoutStarts: readonly number[], now: Date): number {
  if (workoutStarts.length === 0) return 0;
  const first = startOfWeek(new Date(Math.min(...workoutStarts)));
  const current = startOfWeek(now);
  // 서머타임으로 하루 길이가 달라져도 주 수가 어긋나지 않게 반올림한다.
  return Math.min(0, Math.round((first.getTime() - current.getTime()) / (7 * 24 * 60 * 60 * 1000)));
}

export type DayWhen = 'past' | 'today' | 'future';

/** 그 날이 오늘보다 앞인지 뒤인지 (시각은 보지 않는다) */
export function dayWhen(date: Date, now: Date): DayWhen {
  if (sameDay(date, now)) return 'today';
  return date.getTime() < now.getTime() ? 'past' : 'future';
}

/** 그 요일에 잡힌 루틴들 (목록 순서대로) */
export function routinesOn<T extends { weekdays: number }>(
  routines: readonly T[],
  date: Date,
): T[] {
  const i = weekdayIndex(date);
  return routines.filter((r) => hasDay(r.weekdays, i));
}

/** 그 날 한 운동들 (시작한 순서대로) */
export function workoutsOn<T extends { startedAt: number }>(
  workouts: readonly T[],
  date: Date,
): T[] {
  return workouts
    .filter((w) => sameDay(new Date(w.startedAt), date))
    .sort((a, b) => a.startedAt - b.startedAt);
}

/** 지난 날에 기록을 추가할 때 쓰는 시작 시각: 그날 정오 */
export function pastWorkoutStart(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12).getTime();
}

/** 오늘 요일에 잡힌 첫 루틴 (목록 순서대로) */
export function todaysRoutine<T extends { weekdays: number }>(
  routines: readonly T[],
  now: Date,
): T | undefined {
  const i = weekdayIndex(now);
  return routines.find((r) => hasDay(r.weekdays, i));
}

/** 오늘 마친 운동 중 가장 최근 것 (목록은 최신 순이 아니어도 된다) */
export function todaysWorkout<T extends { startedAt: number }>(
  workouts: readonly T[],
  now: Date,
): T | undefined {
  return workouts
    .filter((w) => sameDay(new Date(w.startedAt), now))
    .sort((a, b) => b.startedAt - a.startedAt)[0];
}

/** 이번 주(월요일 0시부터 지금까지) 운동 횟수 */
export function workoutsThisWeek(workoutStarts: readonly number[], now: Date): number {
  const from = startOfWeek(now).getTime();
  const to = now.getTime();
  return workoutStarts.filter((t) => t >= from && t <= to).length;
}

/**
 * 주 목표(주 N회)를 채운 연속 주 수. 이번 주는 채웠으면 포함, 아직이면 지난주부터 센다.
 */
export function streakWeeks(workoutStarts: readonly number[], target: number, now: Date): number {
  if (target <= 0) return 0;
  const counts = new Map<number, number>();
  for (const t of workoutStarts) {
    const k = startOfWeek(new Date(t)).getTime();
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  const week = startOfWeek(now);
  const key = (d: Date) => d.getTime();
  let streak = 0;
  const cursor = new Date(week);
  if ((counts.get(key(cursor)) ?? 0) >= target) streak += 1;
  cursor.setDate(cursor.getDate() - 7);
  while ((counts.get(key(cursor)) ?? 0) >= target) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

export type LatestPr = { workoutId: string; startedAt: number; entry: PrEntry; count: number };

/**
 * 가장 최근에 PR이 나온 운동과 그 첫 PR. 오래된 운동부터 최고 기록을 쌓아 가며 판정한다
 * (요약·히스토리와 같은 기준). 없으면 null.
 */
export function latestPr(
  workouts: readonly { id: string; startedAt: number }[],
  setsByWorkout: ReadonlyMap<string, readonly SummarySet[]>,
  unit: WeightUnit,
): LatestPr | null {
  const bests = new Map<string, Best>();
  let latest: LatestPr | null = null;
  for (const w of [...workouts].sort((a, b) => a.startedAt - b.startedAt)) {
    const sets = setsByWorkout.get(w.id) ?? [];
    const prs = sessionPrs(sets, bests, unit);
    const first = prs[0];
    if (first)
      latest = { workoutId: w.id, startedAt: w.startedAt, entry: first, count: prs.length };
    const byExercise = new Map<string, SummarySet[]>();
    for (const s of sets) {
      if (!s.completed || s.kind === 'warmup') continue;
      const list = byExercise.get(s.exerciseId);
      if (list) list.push(s);
      else byExercise.set(s.exerciseId, [s]);
    }
    for (const [id, list] of byExercise) {
      const b = bestOf(list);
      if (!b) continue;
      const prev = bests.get(id);
      bests.set(
        id,
        prev
          ? {
              weightKg: Math.max(prev.weightKg, b.weightKg),
              e1rmKg: Math.max(prev.e1rmKg, b.e1rmKg),
            }
          : b,
      );
    }
  }
  return latest;
}

/** 오늘 기준 며칠 전인지 (자정 기준) */
export function daysAgo(t: number, now: Date): number {
  const a = new Date(t);
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((day(now) - day(a)) / 86_400_000);
}
