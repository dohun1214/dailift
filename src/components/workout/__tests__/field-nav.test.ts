import { nextFieldKey } from '../field-nav';

const order = ['a:weight', 'a:reps', 'b:weight', 'b:reps'];
const all = () => true;

describe('nextFieldKey', () => {
  it('순서대로 다음 칸', () => {
    expect(nextFieldKey(order, 'a:weight', all)).toBe('a:reps');
    expect(nextFieldKey(order, 'a:reps', all)).toBe('b:weight');
  });

  it('마지막 칸이거나 지금 칸을 모르면 null', () => {
    expect(nextFieldKey(order, 'b:reps', all)).toBeNull();
    expect(nextFieldKey(order, null, all)).toBeNull();
    expect(nextFieldKey(order, 'zzz', all)).toBeNull();
  });

  it('화면에 없는 칸은 건너뛴다', () => {
    expect(nextFieldKey(order, 'a:weight', (k) => k !== 'a:reps')).toBe('b:weight');
  });
});
