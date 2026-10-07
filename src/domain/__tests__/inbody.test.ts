import { type OcrLine, type OcrWord, parseSheet } from '../inbody';

import photo from './fixtures/inbody-photo.json';
import sheetA from './fixtures/inbody120-a.json';
import sheetB from './fixtures/inbody120-b.json';

/**
 * fixtures: 실제 결과지를 기기에서 읽은 결과(ML Kit)에서 개인 정보를 지우고 값을 다른 숫자로 바꾼 것.
 * 글자 위치와 잘못 읽은 모양(소수점이 빠진 162, 띄어 읽은 '64 9' · '43. 3', '기초대사랑')은 그대로다.
 * 한 줄 = [글자, x, y, w, h, 낱말들]
 */
type Packed = [string, number, number, number, number, [string, number, number, number, number][]];
const unpack = (rows: unknown): OcrLine[] =>
  (rows as Packed[]).map(([text, x, y, w, h, words]) => ({
    text,
    x,
    y,
    w,
    h,
    words: words.map(([t, wx, wy, ww, wh]): OcrWord => ({ text: t, x: wx, y: wy, w: ww, h: wh })),
  }));

const TODAY = '2026-10-07';
const A = unpack(sheetA);
const B = unpack(sheetB);
const PHOTO = unpack(photo);

describe('인바디 결과지 읽기', () => {
  it('InBody120 결과지: 검사일과 값 열 개를 읽는다', () => {
    expect(parseSheet(A, TODAY)).toEqual({
      date: '2025-03-14',
      values: {
        weight: 70,
        muscle: 32,
        // 소수점이 빠져 181로 읽혔지만 체지방량 ÷ 체중과 맞아서 되살린다.
        fat: 18.1,
        bmi: 22.9,
        // '기초대사랑'으로 읽힌 이름도 찾는다.
        bmr: 1601,
        visceralFat: 6,
        whr: 0.88,
        water: 42,
        protein: 11.4,
        mineral: 3.9,
      },
    });
  });

  it("표의 체중이 '61 0'으로 읽혀도 옆 칸의 적정체중을 가져오지 않고 그래프의 값을 쓴다", () => {
    expect(parseSheet(B, TODAY)).toEqual({
      date: '2025-11-20',
      values: {
        weight: 61,
        muscle: 31.2,
        fat: 10.3,
        bmi: 20.6,
        bmr: 1588,
        visceralFat: 2,
        whr: 0.84,
        water: 40.1,
        protein: 10.9,
        mineral: 3.71,
      },
    });
  });

  it('종이를 찍은 사진(예전 양식): 결과지에 없는 내장지방 레벨은 비운다', () => {
    expect(parseSheet(PHOTO, TODAY)).toEqual({
      date: '2023-05-08',
      values: {
        weight: 61.2,
        muscle: 31.9,
        fat: 8.3,
        bmi: 20.2,
        bmr: 1570,
        whr: 0.81,
        water: 41.2,
        protein: 11.1,
        mineral: 3.76,
      },
    });
  });

  it('줄을 길게 묶어 읽는 엔진이어도 같은 값을 읽는다', () => {
    // 같은 높이의 줄을 모두 한 줄로 합친다.
    const merged = (lines: OcrLine[]): OcrLine[] => {
      const rows: OcrLine[][] = [];
      for (const line of [...lines].sort((a, b) => a.y - b.y)) {
        const row = rows.find((r) => {
          const first = r[0];
          return (
            first !== undefined &&
            Math.abs(first.y + first.h / 2 - (line.y + line.h / 2)) < Math.min(first.h, line.h) / 2
          );
        });
        if (row) row.push(line);
        else rows.push([line]);
      }
      return rows.map((r) => {
        const sorted = [...r].sort((a, b) => a.x - b.x);
        const x = Math.min(...sorted.map((l) => l.x));
        const y = Math.min(...sorted.map((l) => l.y));
        return {
          text: sorted.map((l) => l.text).join(' '),
          x,
          y,
          w: Math.max(...sorted.map((l) => l.x + l.w)) - x,
          h: Math.max(...sorted.map((l) => l.y + l.h)) - y,
          words: sorted.flatMap((l) => l.words),
        };
      });
    };
    for (const sheet of [A, B, PHOTO]) {
      expect(parseSheet(merged(sheet), TODAY)).toEqual(parseSheet(sheet, TODAY));
    }
  });

  it('줄이 빠져도 틀린 값을 채우지 않는다(못 읽은 칸은 비운다)', () => {
    let seed = 7;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    for (const sheet of [A, B, PHOTO]) {
      const full = parseSheet(sheet, TODAY).values;
      let wrong = 0;
      for (let i = 0; i < 200; i++) {
        const part = parseSheet(
          sheet.filter(() => random() > 0.1),
          TODAY,
        ).values;
        for (const [key, value] of Object.entries(part)) {
          if (value !== full[key as keyof typeof full]) wrong += 1;
        }
      }
      // 열에 하나꼴로 줄을 지운 200번 가운데 틀린 값은 거의 없어야 한다.
      expect(wrong).toBeLessThanOrEqual(2);
    }
  });

  it('지난 기록 표(신체변화)의 값은 가져오지 않는다', () => {
    // 위쪽 표와 그래프의 줄을 지워도 아래 표의 예전 값으로 채우지 않는다.
    const history = A.find((l) => l.text.includes('신체변화'));
    expect(history).toBeDefined();
    const onlyHistory = A.filter((l) => l.y >= (history?.y ?? 0) || l.y < 0.1);
    expect(parseSheet(onlyHistory, TODAY).values).toEqual({});
  });

  it('앞날 · 없는 날짜는 검사일로 쓰지 않는다', () => {
    const line = (text: string): OcrLine => ({ text, x: 0.4, y: 0.08, w: 0.2, h: 0.01, words: [] });
    expect(parseSheet([line('2026.10.08. 09:00')], TODAY).date).toBeNull();
    expect(parseSheet([line('2026.13.01.')], TODAY).date).toBeNull();
    expect(parseSheet([line('날짜 2024. 9. 2')], TODAY).date).toBe('2024-09-02');
  });

  it('결과지가 아닌 사진에서는 아무것도 읽지 않는다', () => {
    const line = (text: string, y: number): OcrLine => ({
      text,
      x: 0.1,
      y,
      w: 0.5,
      h: 0.02,
      words: [],
    });
    expect(parseSheet([line('오늘의 점심 12,000원', 0.2), line('영수증 3.5', 0.3)], TODAY)).toEqual(
      {
        date: null,
        values: {},
      },
    );
    expect(parseSheet([], TODAY)).toEqual({ date: null, values: {} });
  });
});
