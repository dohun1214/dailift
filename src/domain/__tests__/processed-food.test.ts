import {
  PACK_UNIT,
  type ProcessedFood,
  processedDefaultAmount,
  processedItem,
  processedQuery,
  SERVING_UNIT,
} from '../processed-food';

const food = (over: Partial<ProcessedFood> = {}): ProcessedFood => ({
  sid: 'P1',
  name: '참치마요 삼각김밥',
  maker: '(주)후레쉬퍼스트',
  basis: 'g',
  kcal: 198,
  protein: 4.7,
  carb: 32.6,
  fat: 5.4,
  size: 110,
  serv: 210,
  ...over,
});

describe('processedItem', () => {
  it('포장 하나(1개)가 먼저, 그다음 1회 섭취참고량', () => {
    const item = processedItem(food());
    expect(item).toMatchObject({ src: 'mfdsp', sid: 'P1', maker: '(주)후레쉬퍼스트', basis: 'g' });
    expect(item.units).toEqual([
      { name: PACK_UNIT, grams: 110 },
      { name: SERVING_UNIT, grams: 210 },
    ]);
  });

  it('포장과 1회 양이 같으면 하나만, 없는 것은 뺀다', () => {
    expect(processedItem(food({ size: 30, serv: 30 })).units).toEqual([
      { name: PACK_UNIT, grams: 30 },
    ]);
    expect(processedItem(food({ size: null, serv: null })).units).toEqual([]);
    expect(processedItem(food({ size: 0, serv: 15 })).units).toEqual([
      { name: SERVING_UNIT, grams: 15 },
    ]);
  });

  it('만든 회사가 비어 있으면 null', () => {
    expect(processedItem(food({ maker: '' })).maker).toBeNull();
  });
});

describe('processedDefaultAmount', () => {
  it('포장 무게가 있으면 1개', () => {
    const item = processedItem(food());
    expect(processedDefaultAmount(item)).toEqual({
      grams: 110,
      unit: { name: PACK_UNIT, grams: 110 },
    });
  });

  it('포장 무게를 모르면 1회 양이 있어도 100 g', () => {
    expect(processedDefaultAmount(processedItem(food({ size: null })))).toEqual({
      grams: 100,
      unit: null,
    });
    expect(processedDefaultAmount(processedItem(food({ size: null, serv: null })))).toEqual({
      grams: 100,
      unit: null,
    });
  });
});

describe('processedQuery', () => {
  it('두 글자부터 찾는다(띄어쓰기는 세지 않는다)', () => {
    expect(processedQuery('')).toBeNull();
    expect(processedQuery('밥')).toBeNull();
    expect(processedQuery(' 밥 ')).toBeNull();
    expect(processedQuery('ㄱ ㅂ')).toBe('ㄱ ㅂ');
    expect(processedQuery('김밥')).toBe('김밥');
  });

  it('앞뒤 · 겹친 띄어쓰기를 정리하고 길이를 자른다', () => {
    expect(processedQuery('  참치마요   삼각김밥 ')).toBe('참치마요 삼각김밥');
    expect(processedQuery('가'.repeat(60))).toHaveLength(40);
  });
});
