import { router } from 'expo-router';

/**
 * 화면 사이 콜백 전달. 루틴 편집 → 종목 검색 → (종목 만들기) 결과를 돌려받는다.
 * 콜백은 저장하지 않는 일회용이라 모듈 변수로 둔다.
 */
type PickHandler = (exerciseIds: string[]) => void;
type CreateHandler = (exerciseId: string) => void;

let onPick: PickHandler | null = null;
let onCreate: CreateHandler | null = null;

export function openExercisePicker(handler: PickHandler) {
  onPick = handler;
  router.push('/exercise-picker');
}

export function deliverPickedExercises(ids: string[]) {
  const handler = onPick;
  onPick = null;
  handler?.(ids);
}

export function openExerciseCreator(handler: CreateHandler) {
  onCreate = handler;
  router.push('/exercise-new');
}

export function deliverCreatedExercise(id: string) {
  const handler = onCreate;
  onCreate = null;
  handler?.(id);
}
