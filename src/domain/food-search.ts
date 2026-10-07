/** 음식 검색: 어느 출처를 보일지, 검색어를 어떤 SQL로 찾을지. 순수 함수(음식 DB를 열지 않는다). */
import { initialOf, isChosung } from '@/lib/hangul';

/** usda: USDA FoodData Central(영어), mfds: 식약처 식품영양성분 DB(한국어) */
export type FoodSource = 'usda' | 'mfds';

/**
 * 기기 지역에 따라 보일 출처(앞에 있는 것이 검색 결과에서 먼저 나온다).
 * 한국이면 식약처를 먼저, USDA를 뒤에. 그 밖의 지역에는 식약처 데이터를 보이지 않는다.
 */
export function foodSourcesForRegion(region: string | null | undefined): FoodSource[] {
  return region?.toUpperCase() === 'KR' ? ['mfds', 'usda'] : ['usda'];
}

export type FoodQuery = {
  sql: string;
  params: (string | number)[];
  /** 초성으로 넓게 찾은 뒤 이름으로 한 번 더 거를 때의 검색어 (없으면 거르지 않는다) */
  refine: string | null;
};

const COLUMNS =
  'id, src, sid, name, kcal, protein, carb, fat, basis, serving, serving_name AS servingName';
/** 한글 이름은 띄어쓰기가 제각각이고 쉼표로 나뉘어 있어("닭고기, 가슴, 삶은것") 둘을 빼고 견준다 */
const BARE = "replace(replace(name, ' ', ''), ',', '')";
/** 검색어 길이 제한 */
const MAX_QUERY = 40;
const MAX_TOKENS = 5;

/** LIKE에서 특별한 뜻을 가진 글자를 그대로 찾게 한다 */
const escapeLike = (text: string) => text.replace(/[\\%_]/g, (c) => `\\${c}`);
const hasHangul = (text: string) => /[ㄱ-ㆎ가-힣]/.test(text);

/** 음절은 초성으로 바꾸고 초성은 그대로 둔다 ("닭ㄱㅅ" → "ㄷㄱㅅ") */
function toChosung(text: string): string {
  let out = '';
  for (const ch of text) out += initialOf(ch) ?? ch;
  return out;
}

/**
 * 검색 SQL을 만든다. 검색어가 비었거나 보일 출처가 없으면 null.
 * - 띄어 쓴 낱말은 모두 들어 있어야 한다(순서 무관).
 * - 순서: 출처(sources 순) → 이름이 검색어와 같음 → 검색어로 시작하고 끊김 → 검색어로 시작 → 낱말의 처음 → 그 밖
 *   → 출처 안의 우선순위(pri) → 짧은 이름.
 * - 초성이 섞인 검색어("ㄷㄱㅅ", "닭ㄱㅅ")는 식약처 이름의 초성 칸에서 넓게 찾고, 결과를 `refine`으로 한 번 더 거른다.
 */
export function buildFoodQuery(
  query: string,
  sources: readonly FoodSource[],
  limit = 50,
): FoodQuery | null {
  // 쉼표는 띄어쓰기로 본다("닭고기, 가슴"처럼 이름을 그대로 넣어도 찾게).
  const q = query
    .replace(/[,，]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_QUERY)
    .toLowerCase();
  if (!q || sources.length === 0) return null;
  const params: (string | number)[] = [];
  const srcOrder = `CASE src ${sources.map((s, i) => `WHEN '${s}' THEN ${i}`).join(' ')} ELSE 9 END`;

  if ([...q].some(isChosung)) {
    if (!sources.includes('mfds')) return null;
    params.push(`%${escapeLike(toChosung(q.replace(/ /g, '')))}%`, limit * 4);
    return {
      sql: `SELECT ${COLUMNS} FROM foods WHERE src = 'mfds' AND cho LIKE ? ESCAPE '\\' ORDER BY pri, length(name), name LIMIT ?`,
      params,
      refine: q,
    };
  }

  const korean = hasHangul(q);
  const target = korean ? BARE : 'name';
  const tokens = q.split(' ').slice(0, MAX_TOKENS);
  const where = tokens.map(() => `${target} LIKE ? ESCAPE '\\'`).join(' AND ');
  for (const t of tokens) params.push(`%${escapeLike(t)}%`);

  const whole = escapeLike(korean ? q.replace(/ /g, '') : q);
  // 영어는 낱말의 처음에서 맞은 것("Fried rice")을 낱말 중간("Licorice")보다 앞에 둔다. 한글은 붙여 쓰는 말이 많아 가리지 않는다.
  const wordStart = korean ? '' : "WHEN name LIKE ? ESCAPE '\\' THEN 3";
  const tier = `CASE
    WHEN ${target} LIKE ? ESCAPE '\\' THEN 0
    WHEN name LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\' THEN 1
    WHEN ${target} LIKE ? ESCAPE '\\' THEN 2
    ${wordStart}
    ELSE 4 END`;
  params.push(whole, `${whole},%`, `${whole} %`, `${whole}%`);
  if (!korean) params.push(`% ${whole}%`);
  params.push(limit);

  return {
    sql: `SELECT ${COLUMNS} FROM foods WHERE src IN (${sources.map((s) => `'${s}'`).join(', ')}) AND ${where} ORDER BY ${srcOrder}, ${tier}, pri, length(name), name LIMIT ?`,
    params,
    refine: null,
  };
}
