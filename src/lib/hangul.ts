/** 한글 초성 검색. "ㅂㅊ" → 벤치프레스, "벤ㅊ" → 벤치프레스처럼 초성과 완성 글자를 섞어도 된다. */

const CHOSUNG = [
  'ㄱ',
  'ㄲ',
  'ㄴ',
  'ㄷ',
  'ㄸ',
  'ㄹ',
  'ㅁ',
  'ㅂ',
  'ㅃ',
  'ㅅ',
  'ㅆ',
  'ㅇ',
  'ㅈ',
  'ㅉ',
  'ㅊ',
  'ㅋ',
  'ㅌ',
  'ㅍ',
  'ㅎ',
] as const;
const CHOSUNG_SET = new Set<string>(CHOSUNG);
const SYLLABLE_START = 0xac00;
const SYLLABLE_END = 0xd7a3;
/** 중성 21 × 종성 28 */
const PER_INITIAL = 588;

/** 완성형 음절의 초성. 음절이 아니면 undefined */
export function initialOf(char: string): string | undefined {
  const code = char.charCodeAt(0);
  if (code < SYLLABLE_START || code > SYLLABLE_END) return undefined;
  return CHOSUNG[Math.floor((code - SYLLABLE_START) / PER_INITIAL)];
}

export function isChosung(char: string): boolean {
  return CHOSUNG_SET.has(char);
}

/** 검색 비교용: 소문자, 공백·하이픈 제거 */
export function normalizeSearch(text: string): string {
  return text.toLowerCase().replace(/[\s\-·]/g, '');
}

function matchAt(text: string, query: string, start: number): boolean {
  for (let j = 0; j < query.length; j++) {
    const q = query.charAt(j);
    const c = text.charAt(start + j);
    if (q === c) continue;
    if (isChosung(q) && initialOf(c) === q) continue;
    return false;
  }
  return true;
}

/** 이름 중 하나라도 검색어를 포함하면 true. 검색어 안의 초성은 해당 초성의 아무 음절과 맞는다. */
export function matchesSearch(
  query: string,
  names: readonly (string | null | undefined)[],
): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  return names.some((name) => {
    if (!name) return false;
    const text = normalizeSearch(name);
    for (let s = 0; s + q.length <= text.length; s++) {
      if (matchAt(text, q, s)) return true;
    }
    return false;
  });
}
