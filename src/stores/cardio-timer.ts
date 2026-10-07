import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { type CardioTimer, pauseTimer, startTimer, timerElapsed } from '@/domain/cardio';
import { kvStorage } from '@/lib/kv-storage';

type CardioTimerState = {
  /** 유산소 세트 id → 스톱워치. 끝내면(기록하면) 지운다 */
  timers: Record<string, CardioTimer>;
  /** 재기 시작(또는 이어서). baseSec: 이미 쌓인 시간 */
  start: (setId: string, baseSec?: number, now?: number) => void;
  pause: (setId: string, now?: number) => void;
  /** 스톱워치를 지우고 그때까지 쌓인 초를 돌려준다(없었으면 null) */
  take: (setId: string, now?: number) => number | null;
  /** 운동을 끝내거나 버릴 때 */
  clear: (setIds?: readonly string[]) => void;
};

/**
 * 유산소 스톱워치. 시작 시각을 저장해 두므로 앱을 껐다 켜도 이어진다.
 * 세트 표에는 끝냈을 때만 시간을 적는다(재는 동안에는 여기에만 있다).
 */
export const useCardioTimer = create<CardioTimerState>()(
  persist(
    (set, get) => ({
      timers: {},
      start: (setId, baseSec, now = Date.now()) =>
        set((s) => {
          const cur = s.timers[setId];
          const base = baseSec ?? (cur ? timerElapsed(cur, now) : 0);
          return { timers: { ...s.timers, [setId]: startTimer(base, now) } };
        }),
      pause: (setId, now = Date.now()) =>
        set((s) => {
          const cur = s.timers[setId];
          return cur ? { timers: { ...s.timers, [setId]: pauseTimer(cur, now) } } : s;
        }),
      take: (setId, now = Date.now()) => {
        const cur = get().timers[setId];
        if (!cur) return null;
        set((s) => {
          const { [setId]: _gone, ...rest } = s.timers;
          return { timers: rest };
        });
        return timerElapsed(cur, now);
      },
      clear: (setIds) =>
        set((s) => {
          if (!setIds) return { timers: {} };
          const rest = { ...s.timers };
          for (const id of setIds) delete rest[id];
          return { timers: rest };
        }),
    }),
    { name: 'cardio-timer', version: 1, storage: createJSONStorage(() => kvStorage) },
  ),
);
