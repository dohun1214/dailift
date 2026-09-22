/** 원판 계산: 목표 무게를 만들려면 바 한쪽에 어떤 원판을 끼워야 하는지. 순수 함수. */
import type { WeightUnit } from '@/db/schema';

/** 처음 설치했을 때 가지고 있다고 보는 원판 */
export const DEFAULT_PLATES: Record<WeightUnit, readonly number[]> = {
  kg: [25, 20, 15, 10, 5, 2.5, 1.25],
  lb: [45, 35, 25, 10, 5, 2.5],
};

/** 보유 원판 설정에서 고를 수 있는 원판 */
export const PLATE_OPTIONS: Record<WeightUnit, readonly number[]> = {
  kg: [50, 25, 20, 15, 10, 5, 2.5, 2, 1.5, 1.25, 1, 0.5, 0.25],
  lb: [55, 45, 35, 25, 15, 10, 5, 2.5, 1.25],
};

/** 바 무게 선택지 */
export const BAR_OPTIONS: Record<WeightUnit, readonly number[]> = {
  kg: [20, 15, 10, 7],
  lb: [45, 35, 25, 15],
};

export type PlateResult = {
  /** 한쪽에 끼울 원판, 무거운 것부터 */
  perSide: number[];
  /** 바 + 양쪽 원판 = 실제로 만들어지는 무게 */
  total: number;
  /** 목표 무게와 정확히 같은지 */
  exact: boolean;
};

const SCALE = 100; // 0.25 kg까지 정수로 다루기 위해 1/100 단위
const MAX_TARGET = 1000;

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

/**
 * 한쪽 원판 조합. 정확히 맞출 수 있으면 원판 개수가 가장 적은 조합,
 * 없으면 가장 가까운 무게(같으면 가벼운 쪽)를 만든다.
 * 목표가 바 무게 이하이거나 값이 이상하면 원판 없이 바만.
 */
export function calculatePlates(
  target: number,
  bar: number,
  owned: readonly number[],
): PlateResult | null {
  if (!Number.isFinite(target) || !Number.isFinite(bar) || target < 0 || bar < 0) return null;
  if (target > MAX_TARGET) return null;
  const t = Math.round(target * SCALE);
  const b = Math.round(bar * SCALE);
  const sizes = [...new Set(owned.map((p) => Math.round(p * SCALE)))]
    .filter((p) => p > 0)
    .sort((x, y) => y - x);
  const side = (t - b) / 2;
  if (side <= 0 || sizes.length === 0) return { perSide: [], total: bar, exact: t === b };

  const g = sizes.reduce(gcd);
  const units = sizes.map((s) => s / g);
  const limit = Math.ceil(side / g) + (units[0] ?? 0);
  // count[a] = a*g를 만드는 최소 원판 수, pick[a] = 마지막으로 더한 원판 (단위 수)
  const count = new Int32Array(limit + 1).fill(-1);
  const pick = new Int32Array(limit + 1);
  count[0] = 0;
  for (let a = 1; a <= limit; a++) {
    for (const u of units) {
      if (u > a) continue;
      const prev = count[a - u] ?? -1;
      if (prev < 0) continue;
      const cur = count[a] ?? -1;
      if (cur < 0 || prev + 1 < cur) {
        count[a] = prev + 1;
        pick[a] = u;
      }
    }
  }

  let best = 0;
  let bestDist = side;
  for (let a = 1; a <= limit; a++) {
    if ((count[a] ?? -1) < 0) continue;
    const dist = Math.abs(a * g - side);
    if (dist < bestDist) {
      best = a;
      bestDist = dist;
    }
  }

  const perSide: number[] = [];
  for (let a = best; a > 0; a -= pick[a] ?? a) perSide.push(((pick[a] ?? 0) * g) / SCALE);
  perSide.sort((x, y) => y - x);
  const sideSum = best * g;
  return { perSide, total: (b + sideSum * 2) / SCALE, exact: sideSum * 2 === t - b };
}

/** [20, 20, 5] → [{ plate: 20, count: 2 }, { plate: 5, count: 1 }] */
export function groupPlates(perSide: readonly number[]): { plate: number; count: number }[] {
  const out: { plate: number; count: number }[] = [];
  for (const p of perSide) {
    const last = out[out.length - 1];
    if (last && last.plate === p) last.count += 1;
    else out.push({ plate: p, count: 1 });
  }
  return out;
}
