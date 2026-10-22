/**
 * 포장지의 영양성분표(한국 '영양정보' · 미국 'Nutrition Facts' · 유럽식 'per 100 g')에서 읽은 글자로
 * 음식 만들기 칸(기준 · 1회 제공량 · 칼로리 · 단백질 · 탄수화물 · 지방)을 채운다. 순수 함수.
 *
 * 글자 인식 엔진마다 줄을 나누는 방식이 달라서(이름과 값이 따로 한 줄씩 오기도 한다),
 * 같은 높이에 있는 줄을 한 '행'으로 다시 묶은 뒤 행의 글자에서 찾는다.
 * 확실하지 않으면 비워 둔다 — 틀린 값을 채우는 것보다 빈 칸이 낫다.
 */
import type { OcrLine } from './inbody';

export const LABEL_NUTRIENTS = ['kcal', 'protein', 'carb', 'fat'] as const;
export type LabelNutrient = (typeof LABEL_NUTRIENTS)[number];

/**
 * 성분표의 기준.
 * - serving: '1회 제공량 45 g' · 'Serving size 1 bar (60g)' · '1개(30 g)당'
 * - total: '총 내용량 105 g'만 있다 → 1회 제공량 = 총 내용량, 부르는 이름 '1개'
 * - 100g: '100 g당' · 'per 100g'
 */
export type LabelBasis = 'serving' | 'total' | '100g';

export type LabelResult = {
  basis: LabelBasis | null;
  /** 1회 제공량(g). 100 g당이면 null */
  serving: number | null;
  /** 성분표에 적힌 1회 제공량의 이름(1개 · 1 bar). 없으면 null */
  servingName: string | null;
  /** 양이 mL로 적혀 있었다(g으로 본다) */
  ml: boolean;
  values: Partial<Record<LabelNutrient, number>>;
};

/** 읽은 칸의 수: 기준 · 1회 제공량 · 영양소 */
export function labelCount(r: LabelResult): number {
  return (r.basis ? 1 : 0) + (r.serving !== null ? 1 : 0) + Object.keys(r.values).length;
}

const MAX = { kcal: 9999, protein: 999, carb: 999, fat: 999 } as const;

/** 같은 높이의 줄을 묶어 위에서 아래 순서의 행 글자로 만든다 */
export function rowsOf(lines: readonly OcrLine[]): string[] {
  const sorted = lines
    .filter((l) => l.text.trim() !== '')
    .map((l) => ({ l, cy: l.y + l.h / 2 }))
    .sort((a, b) => a.cy - b.cy);
  const rows: { cy: number; h: number; items: OcrLine[] }[] = [];
  for (const { l, cy } of sorted) {
    const row = rows.at(-1);
    if (row && Math.abs(cy - row.cy) <= Math.min(row.h, l.h) * 0.5) {
      row.items.push(l);
    } else {
      rows.push({ cy, h: l.h, items: [l] });
    }
  }
  return rows.map((r) =>
    normalize(
      [...r.items]
        .sort((a, b) => a.x - b.x)
        .map((l) => l.text)
        .join(' '),
    ),
  );
}

/** 인식 엔진이 헷갈리는 글자를 맞춘다: 전각 · ㎖ · 'O g'(0 g) */
function normalize(s: string): string {
  return s
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/㎖/g, 'ml')
    .replace(/㎉/g, 'kcal')
    .replace(/(^|[\s:])[Oo](?=\s?(?:g|mg)\b)/g, '$10')
    .replace(/\s+/g, ' ')
    .trim();
}

const NUM = '(\\d+(?:[.,]\\d+)?)';
const AMOUNT_UNIT = '(g|ml|mL)\\b';

function toNumber(raw: string, thousands = false): number {
  // 1,200 kcal은 천 단위, 1,5 g은 소수점
  if (/^\d{1,3},\d{3}$/.test(raw) && thousands) return Number(raw.replace(',', ''));
  return Number(raw.replace(',', '.'));
}

const SERVING_NAME_MAX = 20;

/** 기준과 1회 제공량을 찾는다 */
function findBasis(rows: readonly string[]) {
  const all = rows.join('\n');
  const result = {
    basis: null as LabelBasis | null,
    serving: null as number | null,
    servingName: null as string | null,
    ml: false,
  };

  // 1회 제공량 1개(45 g) · 1회 제공량 45g · 1회 섭취참고량 30 g
  const ko = new RegExp(
    `1\\s?회\\s?(?:제공량|섭취\\s?참고량|분량)\\s*(?:당)?\\s*:?\\s*(\\d+(?:\\.\\d+)?\\s?[가-힣]{1,3})?\\s*\\(?\\s*${NUM}\\s?${AMOUNT_UNIT}`,
    'i',
  ).exec(all);
  // Serving size 1 bar (60g) · Serving Size 2/3 cup (55g) · Serving size 60g
  const en = new RegExp(
    `Serving\\s*size\\s*:?\\s*([^()\\n]*?)\\s*\\(?\\s*${NUM}\\s?${AMOUNT_UNIT}`,
    'i',
  ).exec(all);
  // 1개(30 g)당 · 1봉지(40 g) 당
  const unit = new RegExp(
    `(\\d+\\s?[가-힣]{1,3})\\s*\\(\\s*${NUM}\\s?${AMOUNT_UNIT}\\s*\\)\\s*당`,
    'i',
  ).exec(all);
  const per100 = /(?:100\s?(?:g|ml)\s?당|per\s*100\s?(?:g|ml)\b|\/\s?100\s?(?:g|ml)\b)/i.exec(all);
  const total = new RegExp(`총\\s?내용량\\s*:?\\s*${NUM}\\s?${AMOUNT_UNIT}`, 'i').exec(all);

  const serving = ko ?? unit ?? en;
  if (per100) {
    // '100 g당'이 있으면 표의 값은 100 g 기준이다(1회 제공량이 같이 적혀 있어도).
    result.basis = '100g';
    result.ml = /ml/i.test(per100[0]);
  } else if (serving) {
    const [, name, amount, u] = serving;
    result.basis = 'serving';
    result.serving = toNumber(amount ?? '');
    result.ml = /ml/i.test(u ?? '');
    const n = name?.trim();
    if (n && n.length <= SERVING_NAME_MAX && /\d|[가-힣A-Za-z]/.test(n)) result.servingName = n;
  } else if (total) {
    result.basis = 'total';
    result.serving = toNumber(total[1] ?? '');
    result.ml = /ml/i.test(total[2] ?? '');
  }
  if (result.serving !== null && !(result.serving > 0 && result.serving <= 5000)) {
    result.serving = null;
  }
  return result;
}

type Spec = { label: RegExp; key: Exclude<LabelNutrient, 'kcal'> };

// 한글 이름은 앞에 한글이 붙지 않은 것만(포화지방 · 트랜스지방은 '지방'이 아니다).
const KO_BEFORE = '(?<![가-힣])';
const SPECS: Spec[] = [
  {
    key: 'carb',
    label: new RegExp(
      `${KO_BEFORE}탄\\s?수\\s?화\\s?물|\\b(?:Total\\s+)?Carbo?hydrates?\\.?|\\bTotal\\s+Carbs?\\.?`,
      'i',
    ),
  },
  { key: 'protein', label: new RegExp(`${KO_BEFORE}단\\s?백\\s?질|\\bProteins?\\b`, 'i') },
  {
    key: 'fat',
    label: new RegExp(
      `${KO_BEFORE}지\\s?방(?![가-힣])|(?<!(?:Saturated|Trans|Sat\\.|Polyunsaturated|Monounsaturated|from)\\s{0,2})\\b(?:Total\\s+)?Fat\\b`,
      'i',
    ),
  },
];

/** 행에서 이름 바로 뒤의 값(g). % 값 · mg 값은 건너뛴다 */
function valueAfter(row: string, label: RegExp): number | null {
  const m = label.exec(row);
  if (!m) return null;
  const rest = row.slice(m.index + m[0].length);
  const num = new RegExp(`^[\\s:]*(?:${NUM})\\s?(mg|g|%)?`, 'i').exec(rest);
  if (!num) return null;
  const unit = num[2]?.toLowerCase();
  if (unit === 'mg' || unit === '%') return null;
  return toNumber(num[1] ?? '');
}

function findKcal(rows: readonly string[]): number | null {
  for (const row of rows) {
    // '1일 영양성분 기준치 … 2,000 kcal 기준' 같은 안내 문장은 값이 아니다.
    if (/기준치|기준이므로|기준으로|a day|daily/i.test(row)) continue;
    const kcal = new RegExp(`${NUM}\\s?k\\s?cal`, 'i').exec(row);
    if (kcal) return toNumber(kcal[1] ?? '', true);
    // Calories 200 (Calories from Fat은 아니다)
    const en = new RegExp(`\\bCalories\\b(?!\\s*from)\\s*:?\\s*${NUM}`, 'i').exec(row);
    if (en) return toNumber(en[1] ?? '', true);
    const ko = new RegExp(`${KO_BEFORE}열\\s?량\\s*:?\\s*${NUM}`).exec(row);
    if (ko) return toNumber(ko[1] ?? '', true);
  }
  return null;
}

export function parseLabel(lines: readonly OcrLine[]): LabelResult {
  const rows = rowsOf(lines);
  const values: LabelResult['values'] = {};
  const kcal = findKcal(rows);
  if (kcal !== null && kcal >= 0 && kcal <= MAX.kcal) values.kcal = kcal;
  for (const spec of SPECS) {
    for (const row of rows) {
      const v = valueAfter(row, spec.label);
      if (v === null) continue;
      if (v >= 0 && v <= MAX[spec.key]) values[spec.key] = v;
      break;
    }
  }
  return { ...findBasis(rows), values };
}
