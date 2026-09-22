import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { AppState, Vibration } from 'react-native';

import { useRestTimer } from './rest-timer';

/** 이 시간 넘게 늦게 알아챘으면(앱이 백그라운드였음) 진동하지 않는다 — 알림이 이미 울렸다. */
const LATE_MS = 3000;

/**
 * 휴식 종료 시 진동. 루트에서 한 번 쓴다(운동 화면을 접어도 동작).
 * 백그라운드일 때는 예약해 둔 로컬 알림이 대신 울린다.
 */
export function useRestTimerAlarm() {
  const endsAt = useRestTimer((s) => s.endsAt);
  const stop = useRestTimer((s) => s.stop);

  useEffect(() => {
    if (endsAt === null) return;
    const fire = () => {
      const late = Date.now() - endsAt;
      if (late < LATE_MS && AppState.currentState === 'active') {
        Vibration.vibrate([0, 300, 150, 300]);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      stop();
    };
    const delay = endsAt - Date.now();
    if (delay <= 0) {
      fire();
      return;
    }
    const id = setTimeout(fire, delay);
    return () => clearTimeout(id);
  }, [endsAt, stop]);
}
