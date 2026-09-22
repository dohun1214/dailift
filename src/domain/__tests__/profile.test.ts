import { parseDecimal } from '@/lib/number';

import { proteinTargetGrams, recommendTemplate, weeklySetRange } from '../profile';

describe('recommendTemplate', () => {
  it.each([
    [{ experience: null, daysPerWeek: null, goal: null }, 'full_body'],
    [{ experience: 'new', daysPerWeek: 3, goal: 'muscle' }, 'full_body'],
    [{ experience: 'new', daysPerWeek: 4, goal: 'muscle' }, 'full_body'],
    [{ experience: 'under6m', daysPerWeek: 4, goal: 'muscle' }, 'upper_lower'],
    [{ experience: 'over1y', daysPerWeek: 3, goal: 'strength' }, 'push_pull_legs'],
    [{ experience: 'under6m', daysPerWeek: 5, goal: null }, 'push_pull_legs'],
    [{ experience: 'under6m', daysPerWeek: 2, goal: null }, 'full_body'],
  ] as const)('%j → %s', (answers, expected) => {
    expect(recommendTemplate(answers)).toBe(expected);
  });
});

describe('weeklySetRange', () => {
  it('경험이 많을수록 범위가 넓고 높다', () => {
    expect(weeklySetRange('new')).toEqual({ min: 6, max: 12 });
    expect(weeklySetRange('under6m')).toEqual({ min: 8, max: 16 });
    expect(weeklySetRange('over1y')).toEqual({ min: 10, max: 20 });
  });

  it('답하지 않았으면 일반 권장 범위(10~20)', () => {
    expect(weeklySetRange(null)).toEqual({ min: 10, max: 20 });
  });
});

describe('proteinTargetGrams', () => {
  it('체중이 없으면 목표를 만들지 않는다', () => {
    expect(proteinTargetGrams(null, 'kg', 'muscle')).toBeNull();
  });

  it('체중 × 목표별 계수를 5g 단위로 반올림한다', () => {
    expect(proteinTargetGrams(68.5, 'kg', 'muscle')).toBe(110); // 109.6
    expect(proteinTargetGrams(68.5, 'kg', 'fat_loss')).toBe(135); // 137 → 135
  });

  it('lb로 입력한 체중도 kg로 환산해서 계산한다', () => {
    expect(proteinTargetGrams(150, 'lb', 'muscle')).toBe(110); // 68.04kg × 1.6 = 108.9
  });

  it('목표가 없으면 기본 계수(1.2)를 쓴다', () => {
    expect(proteinTargetGrams(70, 'kg', null)).toBe(85); // 84
  });
});

describe('parseDecimal', () => {
  it.each([
    ['68.5', 68.5],
    ['68,5', 68.5],
    [' 172 ', 172],
    ['', null],
    ['abc', null],
    ['1.2.3', null],
    ['-5', null],
  ])('%s → %s', (input, expected) => {
    expect(parseDecimal(input)).toBe(expected);
  });
});
