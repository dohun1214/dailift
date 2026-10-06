/**
 * 방금 만든 '내 음식'을 음식 찾기 화면에 넘긴다.
 * 음식 만들기 화면에서 저장하고 돌아오면, 찾기 화면이 그 음식의 양 창을 바로 연다.
 */
let created: string | null = null;

export function setCreatedFood(id: string) {
  created = id;
}

export const createdFood = () => created;

/** 양 창을 열었으면 비운다 */
export function clearCreatedFood() {
  created = null;
}

/** 세트를 만들거나 고치고 돌아오면 찾기 화면이 '세트' 칩을 보여 준다 */
let setSaved = false;

export function markSetSaved() {
  setSaved = true;
}

export function takeSetSaved(): boolean {
  const was = setSaved;
  setSaved = false;
  return was;
}
