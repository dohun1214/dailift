import type { AppDatabase } from '@/db/seed';
import { recordCardio } from '@/db/workout';
import { timerElapsed, timerEndsAt, timerExpired } from '@/domain/cardio';
import { useCardioTimer } from '@/stores/cardio-timer';

/**
 * 운동 화면 밖에서 운동을 끝낼 때(오래 둔 운동을 '마지막 기록 시각에 마치기') 유산소 스톱워치 · 타이머를 정리한다.
 * - 다 된 타이머: 정한 시간만큼, 끝난 그 시각으로 기록한다.
 * - 멈춰 둔 것: 그때까지 쌓인 시간을 기록한다.
 * - 아직 돌고 있는 것: 언제 끝냈는지 알 수 없어 기록하지 않는다.
 * 그리고 스톱워치 · 예약한 알림 · 잠금 화면 표시를 모두 지운다. 운동을 끝내기 전에 불러야 한다.
 */
export function settleCardioTimers(db: AppDatabase, at: number, now = Date.now()) {
  const store = useCardioTimer.getState();
  for (const [setId, timer] of Object.entries(store.timers)) {
    if (timerExpired(timer, now)) {
      recordCardio(db, setId, timer.limitSec ?? 0, Math.min(timerEndsAt(timer) ?? at, now));
    } else if (timer.startedAt === null) {
      recordCardio(db, setId, timerElapsed(timer, now), at);
    }
  }
  store.clear();
}
