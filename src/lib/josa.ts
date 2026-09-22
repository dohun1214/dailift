/** 한국어 조사 고르기. 마지막 글자에 받침이 있으면 첫째, 없으면 둘째 (예: 은/는). */
const DIGIT_HAS_BATCHIM = [true, true, false, true, false, false, true, true, true, false]; // 영 일 이 삼 사 오 육 칠 팔 구

export function hasBatchim(word: string): boolean {
  const last = word.trim().slice(-1);
  if (!last) return false;
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/[0-9]/.test(last)) return DIGIT_HAS_BATCHIM[Number(last)] ?? false;
  // 영문 끝자리: 자음으로 끝나면 대개 받침 소리(l, m, n, ng 등)
  return /[lmnrLMNR]$/.test(last);
}

/** 은/는 */
export function topic(word: string): string {
  return `${word}${hasBatchim(word) ? '은' : '는'}`;
}

/** 은/는만 (단어는 따로 꾸밀 때) */
export function topicParticle(word: string): string {
  return hasBatchim(word) ? '은' : '는';
}
