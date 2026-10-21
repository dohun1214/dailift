import { and, count, eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import * as schema from '@/db/schema';
import { shouldAskForReview } from '@/domain/review-prompt';
import { useSettings } from '@/stores/settings';

/** 지우지 않은, 끝낸 운동 수 */
function completedWorkoutCount(): number {
  const [row] = db
    .select({ n: count() })
    .from(schema.workouts)
    .where(and(eq(schema.workouts.status, 'completed'), isNull(schema.workouts.deletedAt)))
    .all();
  return row?.n ?? 0;
}

/**
 * 방금 운동을 끝내고 요약 화면을 닫을 때 부른다. 조건이 맞으면 스토어 별점 요청창(시스템 창)을 띄운다.
 * 창이 실제로 뜰지는 OS가 정한다(애플은 1년에 3번까지, TestFlight에서는 안 뜬다).
 */
export async function maybeAskForReview(): Promise<void> {
  try {
    const settings = useSettings.getState();
    const now = Date.now();
    const state = { lastAskedAt: settings.reviewAskedAt, askedCount: settings.reviewAskCount };
    if (!shouldAskForReview(state, completedWorkoutCount(), now)) return;
    // 이 모듈이 없는 예전 개발용 빌드에서도 앱이 멈추지 않게 여기서 불러온다.
    const StoreReview = await import('expo-store-review');
    if (!(await StoreReview.isAvailableAsync())) return;
    if (!(await StoreReview.hasAction())) return;
    settings.markReviewAsked(now);
    await StoreReview.requestReview();
  } catch (e) {
    console.warn('[review] request failed', e);
  }
}
