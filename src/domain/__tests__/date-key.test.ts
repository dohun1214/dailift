import { dateKey, monthGrid, parseDateKey, shiftDateKey } from '../date-key';

describe('날짜 글자', () => {
  it('기기 현지 날짜로 만들고 다시 읽는다', () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(parseDateKey('2026-10-07')).toEqual(new Date(2026, 9, 7));
    expect(parseDateKey('2026-02-30')).toBe(null);
    expect(parseDateKey('오늘')).toBe(null);
  });
  it('하루씩 앞뒤로 (달 · 해를 넘는다)', () => {
    expect(shiftDateKey('2026-10-01', -1)).toBe('2026-09-30');
    expect(shiftDateKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftDateKey('2028-02-28', 1)).toBe('2028-02-29');
  });
  it('달력은 월요일부터 시작하고 그 달이 아닌 칸은 비운다', () => {
    // 2026년 10월 1일은 목요일
    const rows = monthGrid(2026, 9);
    expect(rows).toHaveLength(5);
    expect(rows[0]?.map((c) => c?.day ?? null)).toEqual([null, null, null, 1, 2, 3, 4]);
    expect(rows[1]?.[0]).toEqual({ key: '2026-10-05', day: 5 });
    expect(rows[4]?.map((c) => c?.day ?? null)).toEqual([26, 27, 28, 29, 30, 31, null]);
    // 2027년 2월은 월요일에 시작해 일요일에 끝난다(빈 칸 없음)
    expect(
      monthGrid(2027, 1)
        .flat()
        .filter((c) => c === null),
    ).toHaveLength(0);
  });
});
