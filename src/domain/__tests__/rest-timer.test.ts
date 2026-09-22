import { adjustEnd, elapsedRatio, formatClock, remainingSec } from '../rest-timer';

describe('rest timer', () => {
  it('남은 시간은 올림, 음수 없음', () => {
    expect(remainingSec(10_000, 0)).toBe(10);
    expect(remainingSec(10_000, 9_001)).toBe(1);
    expect(remainingSec(10_000, 12_000)).toBe(0);
  });

  it('진행률', () => {
    expect(elapsedRatio(90_000, 90, 0)).toBe(0);
    expect(elapsedRatio(90_000, 90, 45_000)).toBeCloseTo(0.5);
    expect(elapsedRatio(90_000, 90, 100_000)).toBe(1);
  });

  it('±15초 조정은 지금보다 앞당기지 않는다', () => {
    expect(adjustEnd(60_000, 90, 15, 0)).toEqual({ endsAt: 75_000, totalSec: 105 });
    expect(adjustEnd(10_000, 90, -15, 0)).toEqual({ endsAt: 0, totalSec: 75 });
  });

  it('시계 표기', () => {
    expect(formatClock(72)).toBe('1:12');
    expect(formatClock(5)).toBe('0:05');
    expect(formatClock(3725)).toBe('1:02:05');
  });
});
