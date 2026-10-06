import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { DietGoals } from '@/domain/diet';
import { kvStorage } from '@/lib/kv-storage';

type DietGoalsState = DietGoals & {
  save: (goals: DietGoals) => void;
  /** 모든 데이터 삭제 때 처음 상태로 */
  reset: () => void;
};

const INITIAL: DietGoals = {
  proteinMode: 'perKg',
  proteinPerKg: null,
  proteinDirect: null,
  kcal: null,
  carb: null,
  fat: null,
};

/** 식단 목표(이 기기에만 둔다). 몸무게는 프로필 저장소에 있다. */
export const useDietGoals = create<DietGoalsState>()(
  persist(
    (set) => ({
      ...INITIAL,
      save: (goals) => set({ ...goals }),
      reset: () => set({ ...INITIAL }),
    }),
    { name: 'diet-goals', version: 1, storage: createJSONStorage(() => kvStorage) },
  ),
);
