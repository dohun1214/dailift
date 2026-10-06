import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { CONSENT_TABLES } from '@/db/schema';
import { kvStorage } from '@/lib/kv-storage';

type HealthConsentState = {
  /** 식단 기록을 서버에 보관하는 데 동의한 시각. null이면 식단은 이 기기에만 둔다 */
  dietAcceptedAt: number | null;
  setDiet: (accepted: boolean) => void;
  /** 모든 데이터 삭제 때 처음 상태로 */
  reset: () => void;
};

/** 건강 데이터 동의. 기본은 동의 없음 — 식단 표는 서버로 올리지도 받지도 않는다. */
export const useHealthConsent = create<HealthConsentState>()(
  persist(
    (set) => ({
      dietAcceptedAt: null,
      setDiet: (accepted) => set({ dietAcceptedAt: accepted ? Date.now() : null }),
      reset: () => set({ dietAcceptedAt: null }),
    }),
    { name: 'health-consent', version: 1, storage: createJSONStorage(() => kvStorage) },
  ),
);

/** 지금 동기화에서 건너뛸 표 */
export function consentSkippedTables(): readonly (typeof CONSENT_TABLES)[number][] {
  return useHealthConsent.getState().dietAcceptedAt === null ? CONSENT_TABLES : [];
}
