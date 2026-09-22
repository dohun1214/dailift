import { buildWorkoutCsv, CSV_HEADER, csvCell, fileDate } from '../export';

describe('csvCell', () => {
  it('따옴표·쉼표·줄바꿈을 감싸고 null은 빈 칸', () => {
    expect(csvCell('벤치프레스')).toBe('벤치프레스');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('x\ny')).toBe('"x\ny"');
    expect(csvCell(null)).toBe('');
    expect(csvCell(62.5)).toBe('62.5');
  });

  it('수식처럼 보이는 글자는 막는다', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell(-5)).toBe('-5');
  });
});

describe('buildWorkoutCsv', () => {
  it('BOM + 머리글 + 행, CRLF', () => {
    const at = new Date(2026, 8, 22, 7, 5).getTime();
    const csv = buildWorkoutCsv([
      {
        startedAt: at,
        workoutName: 'Push A',
        exercise: '벤치프레스',
        setNumber: 1,
        kind: 'working',
        weight: 60,
        unit: 'kg',
        reps: 8,
        durationSec: null,
        rpe: 8.5,
      },
    ]);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toBe(CSV_HEADER.join(','));
    expect(lines[1]).toBe('2026-09-22 07:05,Push A,벤치프레스,1,working,60,kg,8,,8.5');
    expect(lines[2]).toBe('');
  });
});

describe('fileDate', () => {
  it('YYYYMMDD', () => {
    expect(fileDate(new Date(2026, 0, 3).getTime())).toBe('20260103');
  });
});
