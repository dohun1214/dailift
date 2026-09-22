/** 히스토리 목록 계산: 세션별 요약 줄과 PR 개수, 월별 묶음. */
import type { WeightUnit } from '@/db/schema';

import { type SummarySet, sessionPrs, sessionStats } from './session-summary';
import { type Best, bestOf } from './strength';

export type HistoryWorkout = {
  id: string;
  name: string;
  startedAt: number;
  endedAt: number | null;
};

export type HistoryItem = HistoryWorkout & {
  minutes: number;
  sets: number;
  volume: number;
  prCount: number;
};

/**
 * 세션별 통계와 PR 개수. 오래된 운동부터 차례로 최고 기록을 쌓아 가며
 * 그 시점 기준으로 PR을 센다(요약 화면과 같은 기준). 결과는 최신 순.
 */
export function buildHistory(
  workouts: readonly HistoryWorkout[],
  setsByWorkout: ReadonlyMap<string, readonly SummarySet[]>,
  unit: WeightUnit,
): HistoryItem[] {
  const bests = new Map<string, Best>();
  const items: HistoryItem[] = [];
  for (const w of [...workouts].sort((a, b) => a.startedAt - b.startedAt)) {
    const sets = setsByWorkout.get(w.id) ?? [];
    const stats = sessionStats(sets, w.startedAt, w.endedAt, unit);
    const prCount = sessionPrs(sets, bests, unit).length;
    items.push({ ...w, ...stats, prCount });
    // 이 세션 기록을 기준에 더한다.
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
  return items.reverse();
}

export type HistoryMonth = { key: string; year: number; month: number; items: HistoryItem[] };

/** 최신 순 목록을 월별로 묶는다 (month는 1–12, 기기 시간대 기준) */
export function groupByMonth(items: readonly HistoryItem[]): HistoryMonth[] {
  const out: HistoryMonth[] = [];
  for (const item of items) {
    const d = new Date(item.startedAt);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const key = `${year}-${month}`;
    const last = out[out.length - 1];
    if (last && last.key === key) last.items.push(item);
    else out.push({ key, year, month, items: [item] });
  }
  return out;
}
