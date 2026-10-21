import {
  REVIEW_GAP_MS,
  REVIEW_MAX_ASKS,
  REVIEW_MIN_WORKOUTS,
  shouldAskForReview,
} from '../review-prompt';

const now = 1_800_000_000_000;
const fresh = { lastAskedAt: null, askedCount: 0 };

describe('shouldAskForReview', () => {
  it('운동을 충분히 끝내기 전에는 묻지 않는다', () => {
    expect(shouldAskForReview(fresh, REVIEW_MIN_WORKOUTS - 1, now)).toBe(false);
    expect(shouldAskForReview(fresh, REVIEW_MIN_WORKOUTS, now)).toBe(true);
  });

  it('한 번 띄운 뒤에는 정해진 기간이 지나야 다시 묻는다', () => {
    const asked = { lastAskedAt: now - REVIEW_GAP_MS + 1, askedCount: 1 };
    expect(shouldAskForReview(asked, 10, now)).toBe(false);
    expect(shouldAskForReview({ ...asked, lastAskedAt: now - REVIEW_GAP_MS }, 10, now)).toBe(true);
  });

  it('상한만큼 띄웠으면 더 묻지 않는다', () => {
    expect(shouldAskForReview({ lastAskedAt: null, askedCount: REVIEW_MAX_ASKS }, 10, now)).toBe(
      false,
    );
  });
});
