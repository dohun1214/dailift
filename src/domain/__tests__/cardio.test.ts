import {
  CARDIO_LIMITS,
  cardioExtras,
  clampExtra,
  clockToSec,
  distanceUnitFor,
  pauseTimer,
  startTimer,
  timerElapsed,
} from '../cardio';

describe('유산소 스톱워치', () => {
  it('시작한 시각부터 지난 초를 센다(앱을 나갔다 와도 같다)', () => {
    const timer = startTimer(0, 1_000);
    expect(timerElapsed(timer, 1_000)).toBe(0);
    expect(timerElapsed(timer, 61_900)).toBe(60);
  });

  it('일시정지하면 멈추고, 이어서 재면 쌓인 시간부터 간다', () => {
    const paused = pauseTimer(startTimer(0, 0), 90_000);
    expect(paused).toEqual({ baseSec: 90, startedAt: null });
    expect(timerElapsed(paused, 500_000)).toBe(90);
    const again = startTimer(paused.baseSec, 600_000);
    expect(timerElapsed(again, 630_000)).toBe(120);
  });

  it('시계가 뒤로 가도 음수가 되지 않고, 하루를 넘지 않는다', () => {
    expect(timerElapsed(startTimer(10, 5_000), 1_000)).toBe(10);
    expect(timerElapsed(startTimer(0, 0), 3 * 24 * 3600 * 1000)).toBe(CARDIO_LIMITS.durationSec);
  });
});

describe('clockToSec', () => {
  it('분 · 초를 초로', () => {
    expect(clockToSec(25, null)).toBe(1500);
    expect(clockToSec(null, 45)).toBe(45);
    expect(clockToSec(1, 30)).toBe(90);
  });

  it('비었거나 0이거나 범위를 벗어나면 null', () => {
    expect(clockToSec(null, null)).toBeNull();
    expect(clockToSec(0, 0)).toBeNull();
    expect(clockToSec(1, 60)).toBeNull();
    expect(clockToSec(24 * 60 + 1, 0)).toBeNull();
    expect(clockToSec(1.5, 0)).toBeNull();
  });
});

describe('골라 적는 정보', () => {
  const incline = (v: string) => `경사 ${v}%`;

  it('적은 것만 순서대로', () => {
    expect(
      cardioExtras({ distance: 3.2, distanceUnit: 'km', speed: 8, incline: 2 }, incline),
    ).toEqual(['3.2 km', '8 km/h', '경사 2%']);
    expect(
      cardioExtras({ distance: null, distanceUnit: 'mi', speed: 6.5, incline: 0 }, incline),
    ).toEqual(['6.5 mi/h']);
    expect(
      cardioExtras({ distance: null, distanceUnit: 'km', speed: null, incline: null }, incline),
    ).toEqual([]);
  });

  it('단위는 무게 단위를 따라간다', () => {
    expect(distanceUnitFor('kg')).toBe('km');
    expect(distanceUnitFor('lb')).toBe('mi');
  });

  it('범위를 벗어난 값은 버린다', () => {
    expect(clampExtra('distance', 5)).toBe(5);
    expect(clampExtra('distance', 1000)).toBeNull();
    expect(clampExtra('incline', 41)).toBeNull();
    expect(clampExtra('speed', null)).toBeNull();
  });
});
