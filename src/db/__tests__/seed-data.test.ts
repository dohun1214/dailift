import { EXERCISE_GUIDES } from '@/data/exercise-guides';
import { BASE_EXERCISES } from '@/data/exercises';
import { MUSCLES } from '@/data/muscles';

describe('기본 종목 데이터', () => {
  it('34개다', () => {
    expect(BASE_EXERCISES).toHaveLength(34);
  });

  it('key와 이름이 겹치지 않는다', () => {
    for (const field of ['key', 'ko', 'en'] as const) {
      const values = BASE_EXERCISES.map((e) => e[field]);
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it('모든 종목에 주동근이 있고, 주동근과 협응근이 겹치지 않는다', () => {
    const known = new Set<string>(MUSCLES.map((m) => m.id));
    for (const e of BASE_EXERCISES) {
      expect(e.primary.length).toBeGreaterThan(0);
      for (const m of [...e.primary, ...e.secondary]) expect(known.has(m)).toBe(true);
      expect(e.primary.filter((m) => e.secondary.includes(m))).toEqual([]);
    }
  });

  it('모든 근육이 적어도 한 종목의 주동근이다', () => {
    const covered = new Set(BASE_EXERCISES.flatMap((e) => e.primary));
    const missing = MUSCLES.map((m) => m.id).filter((id) => !covered.has(id));
    // 옆구리·내전근은 협응근으로만 쓰인다.
    expect(missing.sort()).toEqual(['adductors', 'obliques']);
  });
});

describe('exercise guides', () => {
  it('기본 종목마다 한·영 5단계 설명이 있다', () => {
    for (const e of BASE_EXERCISES) {
      const g = EXERCISE_GUIDES[e.key];
      expect(g?.ko).toHaveLength(5);
      expect(g?.en).toHaveLength(5);
    }
    expect(Object.keys(EXERCISE_GUIDES).sort()).toEqual(BASE_EXERCISES.map((e) => e.key).sort());
  });
});
