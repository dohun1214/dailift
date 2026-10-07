import {
  cardioTarget,
  isDraftChanged,
  itemIssue,
  moveItem,
  newDraftItem,
  validateDraft,
} from '../routine-draft';

const item = newDraftItem('k', 'base:squat', 'kg');
const draft = { id: null, groupId: null, name: 'A', weekdays: 0, items: [item] };

describe('routine draft', () => {
  it('이름·종목이 없으면 저장할 수 없다', () => {
    expect(validateDraft({ ...draft, name: '  ' })).toBe('nameRequired');
    expect(validateDraft({ ...draft, items: [] })).toBe('noExercises');
    expect(validateDraft(draft)).toBeNull();
  });

  it('종목 값의 범위를 검사한다', () => {
    expect(itemIssue(item)).toBeNull();
    expect(itemIssue({ ...item, targetSets: 0 })).toBe('sets');
    expect(itemIssue({ ...item, repMin: 12, repMax: 8 })).toBe('reps');
    expect(itemIssue({ ...item, restSec: 1000 })).toBe('rest');
    expect(itemIssue({ ...item, increment: 0 })).toBe('increment');
    expect(validateDraft({ ...draft, items: [{ ...item, repMin: Number.NaN }] })).toBe(
      'itemInvalid',
    );
  });

  it('lb 단위 기본 증량은 5', () => {
    expect(newDraftItem('k', 'e', 'lb').increment).toBe(5);
  });

  it('항목을 옮긴다', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    expect(moveItem(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });

  it('변경 여부', () => {
    expect(isDraftChanged(draft, { ...draft })).toBe(false);
    expect(isDraftChanged(draft, { ...draft, weekdays: 1 })).toBe(true);
  });
});

describe('유산소 종목', () => {
  const cardio = newDraftItem('k', 'base:treadmill', 'kg', 90, false, true);

  it('한 줄 · 목표 없음 · 휴식 없음으로 시작한다', () => {
    expect(cardio).toMatchObject({ targetSets: 1, repMin: 0, repMax: 0, restSec: 0, plan: null });
    expect(itemIssue(cardio, false, true)).toBeNull();
  });

  it('목표 시간은 0–600분의 정수 분', () => {
    expect(itemIssue({ ...cardio, ...cardioTarget(20) }, false, true)).toBeNull();
    expect(itemIssue({ ...cardio, ...cardioTarget(600) }, false, true)).toBeNull();
    expect(itemIssue({ ...cardio, ...cardioTarget(601) }, false, true)).toBe('cardio');
    expect(itemIssue({ ...cardio, ...cardioTarget(-1) }, false, true)).toBe('cardio');
    expect(itemIssue({ ...cardio, ...cardioTarget(Number.NaN) }, false, true)).toBe('cardio');
  });

  it('횟수 종목으로 보면 틀리지만 유산소로 보면 저장할 수 있다', () => {
    const draft = { id: null, groupId: null, name: 'R', weekdays: 0, items: [cardio] };
    expect(validateDraft(draft)).toBe('itemInvalid');
    expect(
      validateDraft(
        draft,
        () => false,
        () => true,
      ),
    ).toBeNull();
  });
});
