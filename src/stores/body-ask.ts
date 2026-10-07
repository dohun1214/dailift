import { create } from 'zustand';

import type { WeightUnit } from '@/db/schema';

/** 체중을 저장한 뒤 체성분 화면에서 물어볼 것: 단백질 목표를 새 체중에 맞출지 */
export type ProteinAsk = {
  weight: number;
  unit: WeightUnit;
  /** 지금 목표(g). 몸무게를 처음 적는 것이면 null */
  from: number | null;
  to: number;
  /** 지금 프로필의 몸무게 글자("70.2 kg"). 없으면 null */
  fromWeight: string | null;
  toWeight: string;
};

type BodyAskState = {
  protein: ProteinAsk | null;
  askProtein: (ask: ProteinAsk) => void;
  clear: () => void;
};

/** 기록 화면 → 체성분 화면으로 넘기는 한 번짜리 물음(저장하지 않는다). */
export const useBodyAsk = create<BodyAskState>()((set) => ({
  protein: null,
  askProtein: (protein) => set({ protein }),
  clear: () => set({ protein: null }),
}));
