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
let cardio = false;

/**
 * `single`: 하나만 고른다(종목 바꾸기). 아니면 여러 개를 골라 추가한다.
 * `cardio`: 유산소만 보이게 연다('유산소 추가'). 칩을 눌러 다른 부위로 바꿀 수 있다.
 */
export function openExercisePicker(
  handler: PickHandler,
  options: { single?: boolean; cardio?: boolean } = {},
) {
  onPick = handler;
  single = options.single === true;
  cardio = options.cardio === true;
  router.push('/exercise-picker');
}

/** 지금 열린 종목 검색이 유산소만 보이게 열렸는지 */
export const pickerStartsCardio = () => cardio;

/** 지금 열린 종목 검색이 하나만 고르는 화면인지 */
export const pickerIsSingle = () => single;

export function deliverPickedExercises(ids: string[]) {
  const handler = onPick;
  onPick = null;
  handler?.(ids);
}

/** `name`: 이름 칸에 미리 채울 글자(검색어로 만들 때) */
export function openExerciseCreator(handler: CreateHandler, name: string | null = null) {
  onCreate = handler;
  router.push(name ? { pathname: '/exercise-new', params: { name } } : '/exercise-new');
}

export function deliverCreatedExercise(id: string) {
  const handler = onCreate;
  onCreate = null;
  handler?.(id);
}
