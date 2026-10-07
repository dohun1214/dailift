import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  type CardioPlan,
  type CardioTimer,
  DEFAULT_LIMIT_SEC,
  liveTimer,
  pauseTimer,
  startTimer,
  timerElapsed,
  timerEndsAt,
  timerExpired,
} from '@/domain/cardio';
import { formatClock, splitDuration } from '@/domain/rest-timer';
import i18n from '@/i18n';
import { hideCardioLive, showCardioLive } from '@/lib/cardio-live';
import { kvStorage } from '@/lib/kv-storage';
import {
  cancelScheduled,
  dismissCardioNotifications,
  scheduleCardioEnd,
} from '@/lib/notifications';

import { useSettings } from './settings';

type StartOptions = {
  /** 이미 쌓인 시간. 안 주면 지금 스톱워치에 쌓인 만큼(없으면 0) */
  baseSec?: number;
  /** 타이머로 잴 시간(초). 안 주면 지금 것을 그대로(처음이면 스톱워치) */
  limitSec?: number;
  /** 잠금 화면 · 알림에 보일 종목 이름 */
  name?: string;
  now?: number;
};

type CardioTimerState = {
  /** 유산소 세트 id → 스톱워치 · 타이머. 끝내면(기록하면) 지운다 */
  timers: Record<string, CardioTimer>;
  /** 시작하기 전에 고른 재는 방식(세트 id별). 안 골랐으면 없다 */
  plans: Record<string, CardioPlan>;
  /** 마지막에 쓴 타이머 시간(초) — 다음에 타이머를 고르면 채워져 있다 */
  lastLimitSec: number;
  /** 세트 id → 타이머가 끝날 때 울리도록 예약한 알림 */
  notifications: Record<string, string>;
  setPlan: (setId: string, plan: CardioPlan) => void;
  /** 재기 시작(또는 이어서) */
  start: (setId: string, options?: StartOptions) => void;
  pause: (setId: string, now?: number) => void;
  /** 스톱워치를 지우고 그때까지 쌓인 초를 돌려준다(없었으면 null) */
  take: (setId: string, now?: number) => number | null;
  /** 운동을 끝내거나 버릴 때 */
  clear: (setIds?: readonly string[]) => void;
  /** 지웠던 스톱워치 · 타이머를 그대로 되살린다(종목 빼기를 되돌릴 때) */
  restore: (timers: Record<string, CardioTimer>, plans: Record<string, CardioPlan>) => void;
};

/** "20분" · "1분 30초" · "45초" */
export function limitLabel(sec: number): string {
  const { m, s } = splitDuration(sec);
  if (m > 0 && s > 0) return i18n.t('duration.minSec', { m, s });
  return m > 0 ? i18n.t('duration.min', { m }) : i18n.t('duration.sec', { s });
}

/**
 * 유산소 스톱워치 · 타이머. 시작 시각을 저장해 두므로 앱을 껐다 켜도 이어진다.
 * 세트 표에는 끝냈을 때만 시간을 적는다(재는 동안에는 여기에만 있다).
 * 타이머는 끝나는 시각에 로컬 알림을 예약하고, 설정이 켜져 있으면 잠금 화면에도 시간을 띄운다.
 */
export const useCardioTimer = create<CardioTimerState>()(
  persist(
    (set, get) => {
      /** 잠금 화면 표시를 지금 상태에 맞춘다(가장 늦게 시작한 것 하나만). */
      const syncLive = (now: number) => {
        const live = liveTimer(get().timers);
        if (!live || !useSettings.getState().restOnLockScreen) {
          hideCardioLive();
          return;
        }
        const { timer } = live;
        const elapsed = timerElapsed(timer, now);
        const countdown = timer.limitSec !== undefined;
        const paused = timer.startedAt === null;
        const limit = timer.limitSec ?? 0;
        const name = timer.name ?? i18n.t('exercises.cardio');
        showCardioLive({
          countdown,
          startsAt: (timer.startedAt ?? now) - timer.baseSec * 1000,
          endsAt: timerEndsAt(timer),
          frozen: paused ? formatClock(countdown ? limit - elapsed : elapsed) : '',
          frozenProgress: countdown && limit > 0 ? (limit - elapsed) / limit : 0,
          title: i18n.t(
            paused
              ? 'cardio.live.paused'
              : countdown
                ? 'cardio.live.timer'
                : 'cardio.live.stopwatch',
          ),
          doneTitle: i18n.t('cardio.live.done'),
          name: countdown
            ? i18n.t('cardio.live.nameWithLimit', { name, total: limitLabel(limit) })
            : name,
        });
      };
      const unschedule = (setIds: readonly string[]) => {
        const rest = { ...get().notifications };
        for (const id of setIds) {
          void cancelScheduled(rest[id] ?? null);
          delete rest[id];
        }
        set({ notifications: rest });
      };
      /** 타이머가 끝나는 시각에 알림을 예약한다(스톱워치면 아무것도 안 한다). */
      const schedule = (setId: string, timer: CardioTimer, now: number) => {
        const endsAt = timerEndsAt(timer);
        if (endsAt === null) return;
        const name = timer.name ?? i18n.t('exercises.cardio');
        void scheduleCardioEnd((endsAt - now) / 1000, {
          channel: i18n.t('cardio.notify.channel'),
          title: i18n.t('cardio.notify.title', { name, total: limitLabel(timer.limitSec ?? 0) }),
          body: i18n.t('cardio.notify.body'),
        }).then((id) => {
          if (id === null) return;
          // 그 사이 멈췄거나 끝냈으면 방금 예약한 알림은 버린다.
          if (get().timers[setId] === timer) {
            set((s) => ({ notifications: { ...s.notifications, [setId]: id } }));
          } else void cancelScheduled(id);
        });
      };
      return {
        timers: {},
        plans: {},
        lastLimitSec: DEFAULT_LIMIT_SEC,
        notifications: {},
        setPlan: (setId, plan) =>
          set((s) => ({
            plans: { ...s.plans, [setId]: plan },
            lastLimitSec: plan.limitSec > 0 ? plan.limitSec : s.lastLimitSec,
          })),
        start: (setId, options = {}) => {
          const now = options.now ?? Date.now();
          const cur = get().timers[setId];
          const base = options.baseSec ?? (cur ? timerElapsed(cur, now) : 0);
          const limit = options.limitSec ?? cur?.limitSec;
          const timer = startTimer(base, now, limit, options.name ?? cur?.name);
          unschedule([setId]);
          void dismissCardioNotifications();
          set((s) => ({
            timers: { ...s.timers, [setId]: timer },
            lastLimitSec: timer.limitSec ?? s.lastLimitSec,
          }));
          schedule(setId, timer, now);
          syncLive(now);
        },
        pause: (setId, now = Date.now()) => {
          const cur = get().timers[setId];
          if (!cur) return;
          unschedule([setId]);
          set((s) => ({ timers: { ...s.timers, [setId]: pauseTimer(cur, now) } }));
          syncLive(now);
        },
        take: (setId, now = Date.now()) => {
          const cur = get().timers[setId];
          if (!cur) return null;
          if (timerExpired(cur, now)) {
            // 타이머가 다 된 것: 알림은 지금 울리는(또는 방금 울린) 것이라 지우지 않고 잊기만 한다.
            set((s) => {
              const { [setId]: _sent, ...rest } = s.notifications;
              return { notifications: rest };
            });
          } else unschedule([setId]);
          set((s) => {
            const { [setId]: _gone, ...rest } = s.timers;
            return { timers: rest };
          });
          syncLive(now);
          return timerElapsed(cur, now);
        },
        clear: (setIds) => {
          unschedule(setIds ?? Object.keys(get().notifications));
          set((s) => {
            if (!setIds) return { timers: {}, plans: {} };
            const timers = { ...s.timers };
            const plans = { ...s.plans };
            for (const id of setIds) {
              delete timers[id];
              delete plans[id];
            }
            return { timers, plans };
          });
          if (!setIds) void dismissCardioNotifications();
          syncLive(Date.now());
        },
        restore: (timers, plans) => {
          const now = Date.now();
          set((s) => ({ timers: { ...s.timers, ...timers }, plans: { ...s.plans, ...plans } }));
          // 돌아가던 타이머는 끝나는 시각의 알림도 다시 건다(이미 지났으면 화면이 바로 기록한다).
          for (const [setId, timer] of Object.entries(timers)) {
            if (timer.startedAt !== null && !timerExpired(timer, now)) schedule(setId, timer, now);
          }
          syncLive(now);
        },
      };
    },
    {
      name: 'cardio-timer',
      version: 2,
      storage: createJSONStorage(() => kvStorage),
      // 버전 1에는 timers만 있었다 — 나머지는 기본값으로 채운다.
      migrate: (persisted) => ({
        plans: {},
        lastLimitSec: DEFAULT_LIMIT_SEC,
        notifications: {},
        ...(persisted as Partial<CardioTimerState>),
      }),
    },
  ),
);
