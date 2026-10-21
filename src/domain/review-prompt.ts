/** 스토어 별점 요청창을 띄울지 정하는 규칙 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** 이만큼 운동을 끝낸 뒤부터 묻는다(앱을 몇 번 써 본 사람에게만) */
export const REVIEW_MIN_WORKOUTS = 3;
/** 한 번 띄우고 나면 이만큼 지나야 다시 띄운다 */
export const REVIEW_GAP_MS = 120 * DAY_MS;
/** 앱에서 띄우는 횟수의 상한. 애플도 1년에 3번까지만 보여 준다 */
export const REVIEW_MAX_ASKS = 3;

export type ReviewState = {
  /** 마지막으로 띄운 시각. 띄운 적이 없으면 null */
  lastAskedAt: number | null;
  /** 지금까지 띄운 횟수 */
  askedCount: number;
};

export function shouldAskForReview(
  state: ReviewState,
  completedWorkouts: number,
  now: number,
): boolean {
  if (completedWorkouts < REVIEW_MIN_WORKOUTS) return false;
  if (state.askedCount >= REVIEW_MAX_ASKS) return false;
  if (state.lastAskedAt !== null && now - state.lastAskedAt < REVIEW_GAP_MS) return false;
  return true;
}
