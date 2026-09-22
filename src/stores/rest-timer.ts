import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { adjustEnd, remainingSec } from '@/domain/rest-timer';
import i18n from '@/i18n';
import { kvStorage } from '@/lib/kv-storage';
import { cancelScheduled, scheduleRestEnd } from '@/lib/notifications';

type RestTimerState = {
  /** 끝나는 시각(ms). null이면 쉬는 중이 아님 */
  endsAt: number | null;
  totalSec: number;
  notificationId: string | null;
  start: (seconds: number, now?: number) => void;
  adjust: (deltaSec: number, now?: number) => void;
  stop: () => void;
};

function notificationText() {
  return {
    channel: i18n.t('workout.rest.channel'),
    title: i18n.t('workout.rest.doneTitle'),
    body: i18n.t('workout.rest.doneBody'),
  };
}

/**
 * 휴식 타이머. 앱을 껐다 켜도 이어지도록 끝나는 시각을 저장하고,
 * 백그라운드에서도 알 수 있게 종료 시각에 로컬 알림을 예약한다.
 */
export const useRestTimer = create<RestTimerState>()(
  persist(
    (set, get) => {
      const reschedule = (endsAt: number, now: number) => {
        void cancelScheduled(get().notificationId);
        set({ notificationId: null });
        const seconds = remainingSec(endsAt, now);
        void scheduleRestEnd(seconds, notificationText()).then((id) => {
          // 그 사이 타이머가 바뀌었으면 방금 예약한 알림은 버린다.
          if (get().endsAt === endsAt) set({ notificationId: id });
          else void cancelScheduled(id);
        });
      };
      return {
        endsAt: null,
        totalSec: 0,
        notificationId: null,
        start: (seconds, now = Date.now()) => {
          if (seconds <= 0) {
            get().stop();
            return;
          }
          const endsAt = now + seconds * 1000;
          set({ endsAt, totalSec: seconds });
          reschedule(endsAt, now);
        },
        adjust: (deltaSec, now = Date.now()) => {
          const { endsAt, totalSec } = get();
          if (endsAt === null) return;
          const next = adjustEnd(endsAt, totalSec, deltaSec, now);
          set(next);
          reschedule(next.endsAt, now);
        },
        stop: () => {
          void cancelScheduled(get().notificationId);
          set({ endsAt: null, totalSec: 0, notificationId: null });
        },
      };
    },
    {
      name: 'rest-timer',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: (s) => ({
        endsAt: s.endsAt,
        totalSec: s.totalSec,
        notificationId: s.notificationId,
      }),
    },
  ),
);
