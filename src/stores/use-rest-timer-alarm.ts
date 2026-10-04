import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { AppState, Platform, Vibration } from 'react-native';

import { REST_DONE_LINGER_MS } from '@/domain/rest-timer';
import { presentRestEnd } from '@/lib/notifications';
import { hideRestLive } from '@/lib/rest-live';

import { notificationText, useRestTimer } from './rest-timer';

/** 이 시간 넘게 늦게 알아챘으면(앱이 백그라운드였음) 진동하지 않는다 — 알림이 이미 울렸다. */
const LATE_MS = 3000;

/**
 * 휴식 종료 처리. 루트에서 한 번 쓴다(운동 화면을 접어도 동작).
 * - 끝나는 순간 앱을 보고 있으면 진동한다. 소리·배너는 예약해 둔 로컬 알림이 내는데,
 *   안드로이드는 예약 알림이 늦을 수 있어 이때 직접 띄운다.
 * - 타이머는 바로 지우지 않는다: 화면에 '휴식 끝'을 잠시 남겼다가 저절로 치운다.
 */
export function useRestTimerAlarm() {
  const endsAt = useRestTimer((s) => s.endsAt);
  const stop = useRestTimer((s) => s.stop);

  useEffect(() => {
    if (endsAt === null) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const clearAfterLinger = () => {
      const left = endsAt + REST_DONE_LINGER_MS - Date.now();
      if (left <= 0) stop();
      else timers.push(setTimeout(stop, left));
    };
    const fire = () => {
      // 앱이 앞에 있으니 잠금 화면·알림창의 타이머는 치운다(뒤에 있었다면 돌아온 지금 치운다).
      hideRestLive();
      const late = Date.now() - endsAt;
      if (late < LATE_MS && AppState.currentState === 'active') {
        Vibration.vibrate([0, 400, 200, 400]);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (Platform.OS === 'android') {
          const { notificationId, message } = useRestTimer.getState();
          void presentRestEnd(notificationId, notificationText(message));
        }
      }
      clearAfterLinger();
    };
    const delay = endsAt - Date.now();
    if (delay <= 0) fire();
    else timers.push(setTimeout(fire, delay));
    return () => {
      for (const id of timers) clearTimeout(id);
    };
  }, [endsAt, stop]);
}
