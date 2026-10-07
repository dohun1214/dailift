import {
  isServerFood,
  LABEL_SERVING_UNIT,
  PACK_UNIT,
  type ProcessedFood,
  processedDefaultAmount,
  processedItem,
  processedQuery,
  SERVING_UNIT,
  wantsBranded,
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

describe('USDA 포장 제품', () => {
  const bar = food({
    sid: '0888849000012',
    name: 'Protein Bar',
    maker: 'Quest',
    size: null,
    serv: 60,
  });

  it('단위는 라벨의 1회 제공량 하나, 처음 양도 그것', () => {
    const item = processedItem(bar, 'usdab');
    expect(item).toMatchObject({ src: 'usdab', sid: '0888849000012', maker: 'Quest' });
    expect(item.units).toEqual([{ name: LABEL_SERVING_UNIT, grams: 60 }]);
    expect(processedDefaultAmount(item)).toEqual({
      grams: 60,
      unit: { name: LABEL_SERVING_UNIT, grams: 60 },
    });
  });

  it('1회 제공량이 없으면 100 g, 포장 무게는 쓰지 않는다', () => {
    const item = processedItem(food({ size: 200, serv: null }), 'usdab');
    expect(item.units).toEqual([]);
    expect(processedDefaultAmount(item)).toEqual({ grams: 100, unit: null });
  });

  it('서버에서 찾는 출처인지', () => {
    expect(isServerFood('mfdsp')).toBe(true);
    expect(isServerFood('usdab')).toBe(true);
    expect(isServerFood('usda')).toBe(false);
    expect(isServerFood('custom')).toBe(false);
  });
});

describe('wantsBranded', () => {
  it('한국 밖에서는 항상 찾는다', () => {
    expect(wantsBranded('quest', ['usda'])).toBe(true);
    expect(wantsBranded('김밥천국', ['usda'])).toBe(true);
  });

  it('세 글자 이상인 낱말이 있어야 한다', () => {
    expect(wantsBranded('ch', ['usda'])).toBe(false);
    expect(wantsBranded('a b cd', ['usda'])).toBe(false);
    expect(wantsBranded('go bar', ['usda'])).toBe(true);
    expect(wantsBranded('pb', ['mfds', 'usda'])).toBe(false);
  });

  it('한국에서는 영어로 찾을 때만', () => {
    expect(wantsBranded('quest bar', ['mfds', 'usda'])).toBe(true);
    expect(wantsBranded('Oreo', ['mfds', 'usda'])).toBe(true);
    expect(wantsBranded('김밥', ['mfds', 'usda'])).toBe(false);
    expect(wantsBranded('ㄱㅂ', ['mfds', 'usda'])).toBe(false);
    expect(wantsBranded('퀘스트 bar', ['mfds', 'usda'])).toBe(false);
    expect(wantsBranded('100', ['mfds', 'usda'])).toBe(false);
  });
});
