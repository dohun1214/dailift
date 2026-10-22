import type { OcrLine } from '../inbody';
import { labelCount, parseLabel, rowsOf } from '../nutrition-label';

/** 한 줄씩 위에서 아래로 늘어놓는다. [글자, x(선택)] — 같은 y에 둘 줄은 배열로 묶는다 */
function layout(rows: (string | string[])[]): OcrLine[] {
  const out: OcrLine[] = [];
  rows.forEach((row, i) => {
    const parts = Array.isArray(row) ? row : [row];
    parts.forEach((text, j) => {
      const x = 0.08 + j * (0.84 / parts.length);
      const line = { text, x, y: 0.05 + i * 0.05, w: 0.84 / parts.length - 0.02, h: 0.03 };
      out.push({ ...line, words: [] });
    });
  });
  return out;
}

describe('영양성분표 읽기', () => {
  it('한국 새 표시: 총 내용량 기준(삼각김밥)', () => {
    const r = parseLabel(
      layout([
        '영양정보 총 내용량 105 g',
        '189 kcal',
        '총 내용량당 1일 영양성분 기준치에 대한 비율',
        '나트륨 520 mg 26%',
        '탄수화물 31 g 10%',
        '당류 4 g 4%',
        '지방 5 g 9%',
        '트랜스지방 0 g',
        '포화지방 1.5 g 10%',
        '콜레스테롤 15 mg 5%',
        '단백질 4 g 7%',
        '1일 영양성분 기준치에 대한 비율(%)은 2,000 kcal 기준이므로 개인의 필요 열량에 따라 다를 수 있습니다.',
      ]),
    );
    expect(r).toEqual({
      basis: 'total',
      serving: 105,
      servingName: null,
      ml: false,
      values: { kcal: 189, carb: 31, fat: 5, protein: 4 },
    });
    expect(labelCount(r)).toBe(6);
  });

  it('1회 제공량 기준: 이름과 값이 따로 읽혀도(같은 높이) 묶어서 찾는다', () => {
    const r = parseLabel(
      layout([
        '영양정보',
        '1회 제공량 1봉(45 g) 총 3회 제공량(135 g)',
        ['1회 제공량당', '190 kcal'],
        ['탄수화물', '31 g', '10%'],
        ['단백질', '8 g', '15%'],
        ['지방', '4 g', '7%'],
        ['포화지방', '2 g', '13%'],
      ]),
    );
    expect(r.basis).toBe('serving');
    expect(r.serving).toBe(45);
    expect(r.servingName).toBe('1봉');
    expect(r.values).toEqual({ kcal: 190, carb: 31, protein: 8, fat: 4 });
  });

  it('100 g당 기준은 1회 제공량이 같이 적혀 있어도 100 g당으로 채운다', () => {
    const r = parseLabel(
      layout([
        '영양정보 총 내용량 500 g',
        '100 g당 385 kcal',
        '나트륨 300 mg 15%',
        '탄수화물 68 g 21%',
        '당류 12 g 12%',
        '지방 7 g 13%',
        '트랜스지방 O g',
        '단백질 12 g 22%',
      ]),
    );
    expect(r).toEqual({
      basis: '100g',
      serving: null,
      servingName: null,
      ml: false,
      values: { kcal: 385, carb: 68, fat: 7, protein: 12 },
    });
    expect(labelCount(r)).toBe(5);
  });

  it('음료는 mL를 g으로 본다', () => {
    const r = parseLabel(
      layout([
        '영양정보 총 내용량 250 ml 120 kcal',
        '탄수화물 30 g 9%',
        '단백질 0 g 0%',
        '지방 0 g 0%',
      ]),
    );
    expect(r.basis).toBe('total');
    expect(r.serving).toBe(250);
    expect(r.ml).toBe(true);
    expect(r.values).toEqual({ kcal: 120, carb: 30, protein: 0, fat: 0 });
  });

  it('미국 Nutrition Facts', () => {
    const r = parseLabel(
      layout([
        'Nutrition Facts',
        '1 servings per container',
        ['Serving size', '1 bar (60g)'],
        'Amount per serving',
        ['Calories', '200'],
        '% Daily Value*',
        ['Total Fat 7g', '9%'],
        ['Saturated Fat 2.5g', '13%'],
        'Trans Fat 0g',
        ['Sodium 210mg', '9%'],
        ['Total Carbohydrate 22g', '8%'],
        ['Dietary Fiber 14g', '50%'],
        'Protein 20g',
        '* The % Daily Value tells you how much a nutrient contributes to a daily diet. 2,000 calories a day is used for general nutrition advice.',
      ]),
    );
    expect(r).toEqual({
      basis: 'serving',
      serving: 60,
      servingName: '1 bar',
      ml: false,
      values: { kcal: 200, fat: 7, carb: 22, protein: 20 },
    });
  });

  it('유럽식 per 100g · kJ와 kcal이 같이 있으면 kcal', () => {
    const r = parseLabel(
      layout([
        ['Nutrition', 'per 100g'],
        ['Energy', '1544kJ / 368kcal'],
        ['Fat', '6,5g'],
        ['of which saturates', '1,2g'],
        ['Carbohydrate', '60g'],
        ['Protein', '13g'],
      ]),
    );
    expect(r.basis).toBe('100g');
    expect(r.values).toEqual({ kcal: 368, fat: 6.5, carb: 60, protein: 13 });
  });

  it('성분표가 아니면 아무것도 채우지 않는다', () => {
    const r = parseLabel(
      layout([
        '원재료명 및 함량',
        '밀가루(밀:미국산), 설탕, 버터',
        '보관방법 직사광선을 피해 서늘한 곳',
      ]),
    );
    expect(r.values).toEqual({});
    expect(r.basis).toBeNull();
    expect(labelCount(r)).toBe(0);
  });

  it('행으로 묶기: 높이가 겹치는 줄만 한 행', () => {
    const lines = layout([['탄수화물', '31 g'], '단백질 4 g']);
    expect(rowsOf(lines)).toEqual(['탄수화물 31 g', '단백질 4 g']);
  });
});
