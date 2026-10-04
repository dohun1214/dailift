import { create } from 'zustand';

import type { PendingRoutineUpdate } from '@/db/routine-update';

type State = {
  /** 방금 끝낸 운동이 루틴과 달랐던 점. 기록 화면 맨 아래에서 '루틴 바꾸기'를 묻는 데 쓴다 */
  pending: PendingRoutineUpdate | null;
  /** '루틴 바꾸기'를 눌러 반영한 운동 */
  appliedWorkoutId: string | null;
  set: (pending: PendingRoutineUpdate | null) => void;
  markApplied: (workoutId: string) => void;
};

/**
 * 운동을 끝낸 직후에만 묻기 위해 저장하지 않는다(앱을 다시 켜면 사라진다).
 * 나중에 기록 탭에서 옛 기록을 열 때는 묻지 않는다.
 */
export const useRoutineUpdate = create<State>()((set) => ({
  pending: null,
  appliedWorkoutId: null,
  set: (pending) => set({ pending, appliedWorkoutId: null }),
  markApplied: (workoutId) => set({ appliedWorkoutId: workoutId }),
}));
