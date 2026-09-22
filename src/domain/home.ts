/** 홈 화면 계산: 주간 스트립, 오늘 루틴, 주 단위 연속 기록, 최근 PR. 모두 순수 함수. */
import type { WeightUnit } from '@/db/schema';
import { hasDay, weekdayIndex } from '@/lib/weekdays';

import { type PrEntry, type SummarySet, sessionPrs } from './session-summary';
import { type Best, bestOf } from './strength';

export type DayState = 'today' | 'done' | 'plan' | 'rest';

export type StripDay = { date: Date; weekday: number; state: DayState };

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

/**
 * 이번 주(월–일) 7칸. 오늘은 항상 today, 운동을 마친 날은 done,
 * 앞으로 루틴이 잡힌 날은 plan, 나머지는 rest.
 */
export function weekStrip(
  now: Date,
  routineMasks: readonly number[],
  workoutStarts: readonly number[],
): StripDay[] {
  const start = startOfWeek(now);
  const allMask = routineMasks.reduce((m, x) => m | x, 0);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    let state: DayState = 'rest';
    if (sameDay(date, now)) state = 'today';
    else if (workoutStarts.some((t) => sameDay(new Date(t), date))) state = 'done';
    else if (date > now && hasDay(allMask, i)) state = 'plan';
    return { date, weekday: i, state };
  });
}

/** 오늘 요일에 잡힌 첫 루틴 (목록 순서대로) */
export function todaysRoutine<T extends { weekdays: number }>(
  routines: readonly T[],
  now: Date,
): T | undefined {
  const i = weekdayIndex(now);
  return routines.find((r) => hasDay(r.weekdays, i));
}

/** 최근 7일(지금 포함) 운동 횟수 */
export function workoutsInLast7Days(workoutStarts: readonly number[], now: number): number {
  return workoutStarts.filter((t) => t > now - 7 * 86_400_000 && t <= now).length;
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
