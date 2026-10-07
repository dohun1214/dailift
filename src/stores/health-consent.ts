import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { BODY_CONSENT_TABLES, CONSENT_TABLES } from '@/db/schema';
import { kvStorage } from '@/lib/kv-storage';

type HealthConsentState = {
  /**
   * 식단 기록을 서버에 보관하는 데 동의한 시각. null이면 식단은 이 기기에만 둔다.
   * 동의는 계정에 적혀 있고(서버 `health_consents`), 여기는 그것을 받아 둔 사본이다.
   */
  dietAcceptedAt: number | null;
  /**
   * 체성분 기록을 서버에 보관하는 데 동의한 시각. 동의 화면이 아직 없어 늘 null이다
   * (체성분 표는 기기에만 둔다).
   */
  bodyAcceptedAt: number | null;
  /** 지금 계정의 동의 여부를 서버에서 확인했다. 확인하기 전에는 안내 카드를 띄우지 않는다 */
  known: boolean;
  /** 안내 카드를 접었다('기기에만 둘게요'를 골랐거나 백업을 그만했다) */
  dietAskDismissed: boolean;
  /** 서버에서 확인한 값을 적는다 */
  setDiet: (acceptedAt: number | null) => void;
  dismissDietAsk: () => void;
  /** 모든 데이터 삭제 · 계정이 바뀌었을 때 처음 상태로 */
  reset: () => void;
};

const INITIAL = {
  dietAcceptedAt: null,
  bodyAcceptedAt: null,
  known: false,
  dietAskDismissed: false,
};

/** 건강 데이터 동의. 기본은 동의 없음 — 식단 표는 서버로 올리지도 받지도 않는다. */
export const useHealthConsent = create<HealthConsentState>()(
  persist(
    (set) => ({
      ...INITIAL,
      setDiet: (acceptedAt) =>
        set((s) => ({
          dietAcceptedAt: acceptedAt,
          known: true,
          // 동의했다가 거둔 사람에게 다시 묻지 않는다.
          dietAskDismissed:
            s.dietAskDismissed || (acceptedAt === null && s.dietAcceptedAt !== null),
        })),
      dismissDietAsk: () => set({ dietAskDismissed: true }),
      reset: () => set(INITIAL),
    }),
    { name: 'health-consent', version: 1, storage: createJSONStorage(() => kvStorage) },
  ),
);

/** 식단 화면에 '백업할까요?' 카드를 보일지: 로그인했고, 동의하지 않았고, 아직 접지 않았을 때 */
export function shouldAskDietBackup(
  signedIn: boolean,
  s: Pick<HealthConsentState, 'dietAcceptedAt' | 'known' | 'dietAskDismissed'>,
): boolean {
  return signedIn && s.known && s.dietAcceptedAt === null && !s.dietAskDismissed;
}

/** 지금 동기화에서 건너뛸 표 */
export function consentSkippedTables(): readonly (
  | (typeof CONSENT_TABLES)[number]
  | (typeof BODY_CONSENT_TABLES)[number]
)[] {
  const s = useHealthConsent.getState();
  return [
    ...(s.dietAcceptedAt === null ? CONSENT_TABLES : []),
    ...(s.bodyAcceptedAt === null ? BODY_CONSENT_TABLES : []),
  ];
}
