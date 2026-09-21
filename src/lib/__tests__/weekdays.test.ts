import { fromMask, hasDay, isScheduledOn, toggleDay, toMask, weekdayIndex } from '../weekdays';

describe('weekdays', () => {
  it('월요일이 0, 일요일이 6이다', () => {
    expect(weekdayIndex(new Date(2026, 8, 21))).toBe(0); // 2026-09-21 월
    expect(weekdayIndex(new Date(2026, 8, 27))).toBe(6); // 2026-09-27 일
  });

  it('요일 목록과 비트마스크를 오간다', () => {
    const mask = toMask(['mon', 'thu']);
    expect(mask).toBe(0b0001001);
    expect(fromMask(mask)).toEqual(['mon', 'thu']);
  });

  it('요일을 켜고 끈다', () => {
    let mask = 0;
    mask = toggleDay(mask, 2);
    expect(hasDay(mask, 2)).toBe(true);
    mask = toggleDay(mask, 2);
    expect(mask).toBe(0);
  });

  it('날짜가 루틴 요일에 해당하는지 판단한다', () => {
    const monThu = toMask(['mon', 'thu']);
    expect(isScheduledOn(monThu, new Date(2026, 8, 24))).toBe(true); // 목
    expect(isScheduledOn(monThu, new Date(2026, 8, 25))).toBe(false); // 금
  });
});
