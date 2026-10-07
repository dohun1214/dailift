import { EXERCISE_GUIDES } from '@/data/exercise-guides';
import { BASE_EXERCISES } from '@/data/exercises';
import { MUSCLES } from '@/data/muscles';

describe('기본 종목 데이터', () => {
  it('근력 154개 + 유산소 8개', () => {
    expect(BASE_EXERCISES).toHaveLength(162);
    expect(BASE_EXERCISES.filter((e) => e.type === 'cardio')).toHaveLength(8);
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
      // 유산소는 근육을 지정하지 않는다(부위별 세트에 들어가지 않는다).
      if (e.type === 'cardio') {
        expect([...e.primary, ...e.secondary]).toEqual([]);
        continue;
      }
      expect(e.primary.length).toBeGreaterThan(0);
      for (const m of [...e.primary, ...e.secondary]) expect(known.has(m)).toBe(true);
      expect(e.primary.filter((m) => e.secondary.includes(m))).toEqual([]);
    }
  });

  it('주동근은 한 부위 안에만 있다(두 부위에 걸친 종목이 없다)', () => {
    const groupOf = new Map<string, string>(MUSCLES.map((m) => [m.id, m.group]));
    const spread = BASE_EXERCISES.filter(
      (e) => new Set(e.primary.map((m) => groupOf.get(m))).size > 1,
    ).map((e) => e.key);
    expect(spread).toEqual([]);
  });

  it('무게를 적는 종목에 밴드 · 맨몸 기구는 없고, 시간 종목은 버티는 동작이다', () => {
    for (const e of BASE_EXERCISES) {
      if (e.type === 'weight_reps') {
        expect(['band', 'bodyweight']).not.toContain(e.equipment);
      }
    }
    expect(BASE_EXERCISES.filter((e) => e.type === 'time').map((e) => e.key)).toEqual([
      'wall_sit',
      'farmers_carry',
      'dead_hang',
      'plank',
      'side_plank',
      'hollow_hold',
    ]);
  });

  it('모든 근육이 적어도 한 종목의 주동근이다', () => {
    const covered = new Set(BASE_EXERCISES.flatMap((e) => e.primary));
    const missing = MUSCLES.map((m) => m.id).filter((id) => !covered.has(id));
    expect(missing).toEqual([]);
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
