/** 휴식 타이머 계산. 타임스탬프 기준이라 앱이 백그라운드에 있어도 어긋나지 않는다. */

export const REST_STEP_SEC = 15;
export const REST_MIN_SEC = 0;
export const REST_MAX_SEC = 60 * 15;

/** 남은 초 (올림, 0 이상) */
export function remainingSec(endsAt: number, now: number): number {
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

/** 진행률 0–1 (지난 비율) */
export function elapsedRatio(endsAt: number, totalSec: number, now: number): number {
  if (totalSec <= 0) return 1;
  return Math.min(1, Math.max(0, 1 - (endsAt - now) / (totalSec * 1000)));
}

/** ±15초 조정. 남은 시간이 0 아래로 내려가면 now로 */
export function adjustEnd(endsAt: number, totalSec: number, deltaSec: number, now: number) {
  const nextEnd = Math.max(now, endsAt + deltaSec * 1000);
  const nextTotal = Math.min(REST_MAX_SEC, Math.max(REST_MIN_SEC, totalSec + deltaSec));
  return { endsAt: nextEnd, totalSec: nextTotal };
}

/** m:ss 또는 h:mm:ss */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
