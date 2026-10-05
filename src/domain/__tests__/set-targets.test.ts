import {
  clampSetTarget,
  recommendedSetTargets,
  resolveSetTargets,
  targetLevel,
  targetProgress,
} from '../set-targets';

describe('recommendedSetTargets', () => {
  it('경력이 많을수록 높고, 부위마다 다르다', () => {
    expect(recommendedSetTargets('new')).toEqual({
      chest: 6,
      back: 6,
      shoulders: 5,
      legs: 7,
      arms: 5,
    });
    expect(recommendedSetTargets('under6m')).toEqual({
      chest: 8,
      back: 8,
      shoulders: 6,
      legs: 10,
      arms: 6,
    });
    expect(recommendedSetTargets('over1y')).toEqual({
      chest: 10,
      back: 10,
      shoulders: 8,
      legs: 12,
      arms: 8,
    });
  });

  it('답하지 않았으면 가장 높은 기준', () => {
    expect(recommendedSetTargets(null)).toEqual(recommendedSetTargets('over1y'));
  });
});

describe('resolveSetTargets', () => {
  it('직접 정한 부위만 바뀐다', () => {
    expect(resolveSetTargets('over1y', { shoulders: 10 })).toEqual({
      chest: 10,
      back: 10,
      shoulders: 10,
      legs: 12,
      arms: 8,
    });
  });

  it('정한 값이 없으면 추천값', () => {
    expect(resolveSetTargets('new', null)).toEqual(recommendedSetTargets('new'));
    expect(resolveSetTargets('new', {})).toEqual(recommendedSetTargets('new'));
  });

  it('범위를 벗어난 값은 1–40으로 맞춘다', () => {
    expect(resolveSetTargets('new', { chest: 0, back: 99 })).toMatchObject({ chest: 1, back: 40 });
    expect(clampSetTarget(7.6)).toBe(8);
  });
});

describe('targetLevel', () => {
  it('0세트 · 절반 미만 · 절반 이상 · 다 채움', () => {
    expect(targetLevel(0, 10)).toBe('none');
    expect(targetLevel(4.5, 10)).toBe('low');
    expect(targetLevel(5, 10)).toBe('mid');
    expect(targetLevel(9.5, 10)).toBe('mid');
    expect(targetLevel(10, 10)).toBe('done');
  });

  it('목표를 한참 넘겨도 다 채운 것으로 본다', () => {
    expect(targetLevel(26, 12)).toBe('done');
  });
});

describe('targetProgress', () => {
  it('목표를 채우면 꽉 찬다', () => {
    expect(targetProgress(0, 10)).toBe(0);
    expect(targetProgress(5, 10)).toBe(0.5);
    expect(targetProgress(14, 10)).toBe(1);
  });
});
