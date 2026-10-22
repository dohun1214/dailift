import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { AppState, Platform, Vibration } from 'react-native';

import { timerEndsAt } from '@/domain/cardio';
import { REST_DONE_LINGER_MS } from '@/domain/rest-timer';
import i18n from '@/i18n';
import { presentCardioEnd } from '@/lib/notifications';

import { FREE_TIMER_ID, limitLabel, useCardioTimer } from './cardio-timer';

/** 이 시간 넘게 늦게 알아챘으면(앱이 백그라운드였음) 진동하지 않는다 — 알림이 이미 울렸다. */
const LATE_MS = 3000;

/**
 * 운동 중 타이머(위쪽 타이머 버튼)의 끝 처리. 루트에서 한 번 쓴다(운동 화면을 접어도 동작).
 * - 끝나는 순간 앱을 보고 있으면 진동한다(소리 · 배너는 예약해 둔 알림이 낸다. 안드로이드는 늦을 수 있어 직접 띄운다).
 * - 화면에 '타이머 끝'을 잠시 남겼다가 저절로 치운다(휴식 끝과 같다).
 */
export function useWorkoutTimerAlarm() {
  const timer = useCardioTimer((s) => s.timers[FREE_TIMER_ID]);
  const endsAt = timer ? timerEndsAt(timer) : null;
  const limitSec = timer?.limitSec ?? 0;

  useEffect(() => {
    if (endsAt === null) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const clear = () => {
      const cur = useCardioTimer.getState().timers[FREE_TIMER_ID];
      // 그 사이 새로 시작했으면 건드리지 않는다.
      if (cur && timerEndsAt(cur) === endsAt) useCardioTimer.getState().take(FREE_TIMER_ID);
    };
    const fire = () => {
      const late = Date.now() - endsAt;
      if (late < LATE_MS && AppState.currentState === 'active') {
        Vibration.vibrate([0, 400, 200, 400]);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (Platform.OS === 'android') {
          const id = useCardioTimer.getState().notifications[FREE_TIMER_ID] ?? null;
          void presentCardioEnd(id, {
            channel: i18n.t('cardio.notify.channel'),
            title: i18n.t('cardio.notify.title', {
              name: i18n.t('workout.timer.tabTimer'),
              total: limitLabel(limitSec),
            }),
            body: i18n.t('workout.timer.notifyBody'),
          });
        }
      }
      const left = endsAt + REST_DONE_LINGER_MS - Date.now();
      if (left <= 0) clear();
      else timers.push(setTimeout(clear, left));
    };
    const delay = endsAt - Date.now();
    if (delay <= 0) fire();
    else timers.push(setTimeout(fire, delay));
    return () => {
      for (const id of timers) clearTimeout(id);
    };
  }, [endsAt, limitSec]);
}
