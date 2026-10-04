import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { adjustEnd, remainingSec } from '@/domain/rest-timer';
import i18n from '@/i18n';
import { kvStorage } from '@/lib/kv-storage';
import {
  cancelScheduled,
  dismissRestNotifications,
  notificationsAllowed,
  scheduleRestEnd,
} from '@/lib/notifications';
import { hideRestLive, showRestLive } from '@/lib/rest-live';

import { useSettings } from './settings';

type RestTimerState = {
  /** 끝나는 시각(ms). null이면 쉬는 중이 아님 */
  endsAt: number | null;
  totalSec: number;
  notificationId: string | null;
  /** 알림에 보일 문장 (다음에 할 세트·종목). 없으면 기본 문장 */
  message: string | null;
  /** 잠금 화면·알림창에 보일 짧은 문장 (예: "다음 · 벤치프레스 3세트") */
  label: string | null;
  /** 알림 권한이 꺼져 있어 화면이 꺼지면 알려 줄 수 없음 */
  blocked: boolean;
  /** message: 휴식이 끝났을 때 알림에 보일 문장, label: 쉬는 동안 잠금 화면·알림창에 보일 문장 */
  start: (seconds: number, message?: string | null, label?: string | null, now?: number) => void;
  adjust: (deltaSec: number, now?: number) => void;
  stop: () => void;
};

export function notificationText(message: string | null) {
  return {
    channel: i18n.t('workout.rest.channel'),
    title: i18n.t('workout.rest.doneTitle'),
    body: message ?? i18n.t('workout.rest.doneBody'),
  };
}

/**
 * 휴식 타이머. 앱을 껐다 켜도 이어지도록 끝나는 시각을 저장하고,
 * 백그라운드에서도 알 수 있게 종료 시각에 로컬 알림을 예약한다.
 */
export const useRestTimer = create<RestTimerState>()(
  persist(
    (set, get) => {
      /** 설정이 켜져 있으면 잠금 화면·알림창에 남은 시간을 띄운다(이미 떠 있으면 갱신). */
      const showLive = (endsAt: number) => {
        if (!useSettings.getState().restOnLockScreen) return;
        showRestLive({
          startsAt: endsAt - get().totalSec * 1000,
          endsAt,
          title: i18n.t('workout.rest.resting'),
          doneTitle: i18n.t('workout.rest.doneTitle'),
          next: get().label ?? '',
          channel: i18n.t('workout.rest.liveChannel'),
        });
      };
      const reschedule = (endsAt: number, now: number) => {
        void cancelScheduled(get().notificationId);
        void dismissRestNotifications();
        set({ notificationId: null });
        const seconds = remainingSec(endsAt, now);
        showLive(endsAt);
        void scheduleRestEnd(seconds, notificationText(get().message)).then((id) => {
          // 그 사이 타이머가 바뀌었으면 방금 예약한 알림은 버린다.
          if (get().endsAt === endsAt) set({ notificationId: id });
          else void cancelScheduled(id);
          if (id === null) void notificationsAllowed().then((ok) => set({ blocked: !ok }));
          else set({ blocked: false });
        });
      };
      return {
        endsAt: null,
        totalSec: 0,
        notificationId: null,
        message: null,
        label: null,
        blocked: false,
        start: (seconds, message = null, label = null, now = Date.now()) => {
          if (seconds <= 0) {
            get().stop();
            return;
          }
          const endsAt = now + seconds * 1000;
          set({ endsAt, totalSec: seconds, message, label });
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
          void dismissRestNotifications();
          hideRestLive();
          set({ endsAt: null, totalSec: 0, notificationId: null, message: null, label: null });
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
        message: s.message,
        label: s.label,
      }),
    },
  ),
);
