import { router } from 'expo-router';

/**
 * 화면 사이 콜백 전달. 루틴 편집 → 종목 검색 → (종목 만들기) 결과를 돌려받는다.
 * 콜백은 저장하지 않는 일회용이라 모듈 변수로 둔다.
 */
type PickHandler = (exerciseIds: string[]) => void;
type CreateHandler = (exerciseId: string) => void;

let onPick: PickHandler | null = null;
let onCreate: CreateHandler | null = null;
let single = false;

/** `single`: 하나만 고른다(종목 바꾸기). 아니면 여러 개를 골라 추가한다. */
export function openExercisePicker(handler: PickHandler, options: { single?: boolean } = {}) {
  onPick = handler;
  single = options.single === true;
  router.push('/exercise-picker');
}

/** 지금 열린 종목 검색이 하나만 고르는 화면인지 */
export const pickerIsSingle = () => single;

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
