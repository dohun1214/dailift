/** 사용자가 입력한 소수(쉼표 소수점 허용)를 숫자로 바꾼다. 빈 값·잘못된 값은 null. */
export function parseDecimal(input: string): number | null {
  const s = input.trim().replace(',', '.');
  if (s === '' || !/^\d+(\.\d+)?$|^\.\d+$|^\d+\.$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export const LB_PER_KG = 2.2046226218;

export function toKg(value: number, unit: 'kg' | 'lb'): number {
  return unit === 'kg' ? value : value / LB_PER_KG;
}
