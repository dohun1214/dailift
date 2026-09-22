import { topic } from '../josa';

describe('topic', () => {
  it('받침에 따라 은/는', () => {
    expect(topic('스쿼트')).toBe('스쿼트는');
    expect(topic('벤치프레스')).toBe('벤치프레스는');
    expect(topic('바벨 컬')).toBe('바벨 컬은');
    expect(topic('데드리프트')).toBe('데드리프트는');
    expect(topic('풀업')).toBe('풀업은');
  });
});
