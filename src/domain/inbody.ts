/**
 * 인바디 결과지에서 읽은 글자(낱말과 위치)에서 체성분 값을 찾는다. 순수 함수.
 *
 * 글자 인식 엔진(iOS Vision · 안드로이드 ML Kit)마다 줄을 나누는 방식이 달라서 줄 묶음에 기대지 않는다.
 * 항목 이름(체중 · 골격근량 …)을 찾고, 그 오른쪽 같은 높이에 있는 숫자 가운데
 * 눈금 · 표준범위 · 자릿수가 안 맞는 것을 걸러 내고 고른다.
 * 확실하지 않으면 비워 둔다 — 틀린 값을 채우는 것보다 빈 칸이 낫다.
 */

/** 읽은 글자 한 덩이. 위치는 사진 크기에 대한 비율(0~1), 왼쪽 위가 (0, 0) */
export type OcrWord = { text: string; x: number; y: number; w: number; h: number };
export type OcrLine = OcrWord & { words: OcrWord[] };

export const SHEET_FIELDS = [
  'weight',
  'muscle',
  'fat',
  'bmi',
  'bmr',
  'visceralFat',
  'whr',
  'water',
  'protein',
  'mineral',
] as const;
export type SheetField = (typeof SHEET_FIELDS)[number];
/** 결과지에서 읽은 값. 무게는 kg(결과지 단위) */
export type SheetResult = {
  /** 검사일(YYYY-MM-DD). 못 읽었으면 null */
  date: string | null;
  values: Partial<Record<SheetField, number>>;
};

type Num = {
  value: number;
  /** 소수 자릿수 */
  decimals: number;
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
  /** 표준범위(39.2~47.9)의 한쪽이다 */
  range: boolean;
  /** 앞에 + · −가 붙었다(체중조절 +5.6 kg). 잰 값은 부호가 없다 */
  signed: boolean;
  /** 그래프의 눈금이다 */
  tick: boolean;
};
type Anchor = { x1: number; y: number; h: number; cy: number };

type Spec = {
  /** 낱말 경계에서 시작하고 뒤에 한글이 이어지지 않는 이름 */
  label: RegExp;
  decimals: readonly number[];
  min: number;
  max: number;
};

// 인식 엔진이 비슷한 글자로 읽기도 한다(량 → 랑, 률 → 율).
const AFTER = '(?![가-힣])';
const BEFORE = '(?<![가-힣A-Za-z])';
const SPECS: Record<SheetField | 'fatMass', Spec> = {
  weight: { label: re('체\\s?중'), decimals: [1], min: 20, max: 300 },
  muscle: { label: re('골\\s?격\\s?근\\s?[량랑]'), decimals: [1], min: 5, max: 100 },
  fat: { label: re('체\\s?지\\s?방\\s?[률율]'), decimals: [1], min: 1, max: 75 },
  bmi: { label: re('B\\s?M\\s?I'), decimals: [1], min: 10, max: 60 },
  bmr: { label: re('기\\s?초\\s?대\\s?사\\s?[량랑]'), decimals: [0], min: 500, max: 5000 },
  visceralFat: { label: re('내\\s?장\\s?지\\s?방\\s?레\\s?벨'), decimals: [0], min: 1, max: 30 },
  whr: { label: re('복\\s?부\\s?지\\s?방\\s?[률율]'), decimals: [2], min: 0.5, max: 1.5 },
  water: { label: re('체\\s?수\\s?분'), decimals: [1], min: 10, max: 120 },
  protein: { label: re('단\\s?백\\s?질'), decimals: [1], min: 1, max: 50 },
  mineral: { label: re('무\\s?기\\s?질'), decimals: [2, 1], min: 0.3, max: 15 },
  // 저장하지 않고, 체지방률이 맞는지 견줘 보는 데만 쓴다.
  fatMass: { label: re('체\\s?지\\s?방\\s?[량랑]?'), decimals: [1], min: 0.5, max: 200 },
};

function re(name: string): RegExp {
  return new RegExp(`${BEFORE}${name}${AFTER}`, 'gi');
}

/** 줄의 글자와, 글자 위치 → 낱말을 찾는 표 */
type Flat = { text: string; spans: { start: number; end: number; word: OcrWord }[]; line: OcrLine };

function flatten(line: OcrLine): Flat {
  const words = line.words.length > 0 ? line.words : [line];
  let text = '';
  const spans: Flat['spans'] = [];
  for (const word of words) {
    if (text) text += ' ';
    spans.push({ start: text.length, end: text.length + word.text.length, word });
    text += word.text;
  }
  return { text, spans, line };
}

/** 글자 범위가 걸친 낱말들의 상자. 낱말 안의 일부면 글자 수에 맞춰 가로를 나눈다 */
function boxOf(flat: Flat, start: number, end: number) {
  let x0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const s of flat.spans) {
    if (s.end <= start || s.start >= end) continue;
    const len = Math.max(1, s.end - s.start);
    const a = Math.max(start, s.start) - s.start;
    const b = Math.min(end, s.end) - s.start;
    x0 = Math.min(x0, s.word.x + (s.word.w * a) / len);
    x1 = Math.max(x1, s.word.x + (s.word.w * b) / len);
    y0 = Math.min(y0, s.word.y);
    y1 = Math.max(y1, s.word.y + s.word.h);
  }
  if (!Number.isFinite(x0)) {
    const l = flat.line;
    return { x: l.x, y: l.y, w: l.w, h: l.h };
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// 63.3 · 63. 3 · 63,3 · 1737 — 인식 엔진이 소수점 뒤를 띄우거나 쉼표로 읽기도 한다.
const NUMBER = /\d+(?:\s?[.,]\s?\d+)?/g;

function numbersOf(flat: Flat): Num[] {
  const out: Num[] = [];
  for (const m of flat.text.matchAll(NUMBER)) {
    const start = m.index;
    const end = start + m[0].length;
    const raw = m[0].replace(/\s/g, '').replace(',', '.');
    const value = Number(raw);
    if (!Number.isFinite(value)) continue;
    const before = flat.text.slice(0, start).trimEnd().slice(-1);
    const after = flat.text.slice(end).trimStart().slice(0, 1);
    // 날짜 · 시각 · 더 긴 숫자의 일부(2026.01.26. 15:06)는 값이 아니다.
    if (after === ':' || before === ':' || before === '.' || before === '/') continue;
    if (after === '.' && /^\s?\.\s?\d/.test(flat.text.slice(end))) continue;
    const box = boxOf(flat, start, end);
    out.push({
      value,
      decimals: raw.includes('.') ? raw.length - raw.indexOf('.') - 1 : 0,
      ...box,
      cx: box.x + box.w / 2,
      cy: box.y + box.h / 2,
      signed: /[+＋−-]/.test(before),
      // 39.2~47.9 · 59.2-80.2 · ( 1~9 )
      range:
        /[~∼〜-]/.test(before) ||
        /[~∼〜]/.test(after) ||
        /^\s?-\s?~?\s?\d/.test(flat.text.slice(end)),
      tick: false,
    });
  }
  return out;
}

/**
 * 그래프 눈금을 표시한다: 같은 높이에 촘촘히 늘어선 숫자 넷 이상,
 * 또는 그 안에서 왼쪽에서 오른쪽으로 커지는 숫자 셋 이상.
 */
function markTicks(nums: Num[]) {
  const sorted = [...nums].filter((n) => !n.range).sort((a, b) => a.cy - b.cy);
  /** 눈금 사이보다 훨씬 넓게 떨어진 숫자는 다른 칸의 것이다 */
  const GAP = 0.12;
  const mark = (group: Num[]) => {
    if (group.length >= 4) for (const n of group) n.tick = true;
    let run: Num[] = [];
    const close = () => {
      if (run.length >= 3) for (const n of run) n.tick = true;
      run = [];
    };
    for (const n of group) {
      const last = run.at(-1);
      if (last && n.value <= last.value) close();
      run.push(n);
    }
    close();
  };
  let row: Num[] = [];
  const flush = () => {
    const byX = [...row].sort((a, b) => a.cx - b.cx);
    let group: Num[] = [];
    for (const n of byX) {
      const last = group.at(-1);
      if (last && n.x - (last.x + last.w) > GAP) {
        mark(group);
        group = [];
      }
      group.push(n);
    }
    mark(group);
    row = [];
  };
  for (const n of sorted) {
    const first = row[0];
    if (first && Math.abs(n.cy - first.cy) > Math.max(first.h, n.h) * 0.6) flush();
    row.push(n);
  }
  flush();
}

function anchorsOf(flats: Flat[], spec: Spec, below: number): Anchor[] {
  const out: Anchor[] = [];
  for (const flat of flats) {
    for (const m of flat.text.matchAll(spec.label)) {
      const box = boxOf(flat, m.index, m.index + m[0].length);
      if (box.y >= below) continue;
      out.push({ x1: box.x + box.w, y: box.y, h: box.h, cy: box.y + box.h / 2 });
    }
  }
  return out.sort((a, b) => a.cy - b.cy);
}

type Page = {
  nums: Num[];
  flats: Flat[];
  words: readonly OcrWord[];
  /** 이 높이부터는 지난 기록 표라 보지 않는다 */
  below: number;
  /** 값으로 찍힌 숫자의 글자 높이(표준범위 숫자들의 가운데값). 눈금은 이보다 훨씬 작다 */
  valueHeight: number;
};

/**
 * 이름 오른쪽, 같은 줄(그래프는 값이 이름보다 조금 아래에 찍힌다)에 있는 쓸 만한 숫자.
 * 이름과 숫자 사이에 다른 글(옆 칸의 이름)이 끼어 있으면 그 숫자는 옆 칸의 값이다.
 */
function candidates(page: Page, nums: Num[], anchor: Anchor, spec: Spec): Num[] {
  const blocked = (n: Num) =>
    page.words.some(
      (w) =>
        /[가-힣]/.test(w.text) &&
        w.x > anchor.x1 &&
        w.x + w.w < n.x &&
        Math.abs(w.y + w.h / 2 - n.cy) < Math.max(w.h, n.h) * 0.7,
    ) ||
    // 값은 표준범위보다 앞에 찍힌다. 범위를 지나서 나오는 숫자는 옆 칸의 것이다.
    page.nums.some(
      (r) =>
        r.range &&
        r.x > anchor.x1 &&
        r.x + r.w < n.x &&
        Math.abs(r.cy - n.cy) < Math.max(r.h, n.h) * 0.7,
    );
  // 바로 옆에 다른 숫자가 나란히 있으면 눈금이나 지난 기록처럼 늘어놓은 숫자다.
  const listed = (n: Num) =>
    page.nums.some(
      (o) =>
        o !== n &&
        (o.x !== n.x || o.y !== n.y) &&
        !o.range &&
        Math.abs(o.cy - n.cy) < Math.min(o.h, n.h) * 0.5 &&
        Math.max(o.x, n.x) - Math.min(o.x + o.w, n.x + n.w) < 0.05,
    );
  return nums.filter(
    (n) =>
      !n.range &&
      !n.tick &&
      !n.signed &&
      n.x >= anchor.x1 - anchor.h * 0.5 &&
      n.cy >= anchor.y - anchor.h * 0.6 &&
      n.cy <= anchor.y + anchor.h * 2 &&
      spec.decimals.includes(n.decimals) &&
      n.value >= spec.min &&
      n.value <= spec.max &&
      !blocked(n) &&
      !listed(n),
  );
}

/** 소수점을 놓치고 읽은 숫자(16.2 → 162)를 되살린 값들. 계산과 맞는지 확인될 때만 쓴다 */
function dotless(page: Page, anchor: Anchor, spec: Spec): number[] {
  const places = spec.decimals[0] ?? 0;
  if (places === 0) return [];
  const shifted = page.nums
    .filter((n) => n.decimals === 0 && n.value >= 10)
    .map((n) => ({ ...n, value: n.value / 10 ** places, decimals: places }));
  return candidates(page, shifted, anchor, spec).map((n) => n.value);
}

/**
 * 이름 하나에서 고른 값. 계산해 둔 값(`expect`)이 있으면 그것과 맞는 숫자만 쓴다.
 * 없으면 값 크기로 찍힌 숫자가 하나일 때만 쓴다 — 둘 이상이면(눈금 · 지난 기록) 고르지 않는다.
 */
function pick(
  page: Page,
  anchor: Anchor,
  spec: Spec,
  expect?: (value: number) => boolean,
): number | undefined {
  const list = candidates(page, page.nums, anchor, spec);
  if (expect) {
    return list.find((n) => expect(n.value))?.value ?? dotless(page, anchor, spec).find(expect);
  }
  const sized = list.filter((n) => n.h >= page.valueHeight * 0.72);
  const values = new Set(sized.map((n) => n.value));
  return values.size === 1 ? sized[0]?.value : undefined;
}

/** 위에 있는 이름부터 차례로, 이름마다 고른 값(못 고른 이름은 빠진다) */
function picks(page: Page, key: keyof typeof SPECS, expect?: (value: number) => boolean): number[] {
  const spec = SPECS[key];
  const out: number[] = [];
  for (const anchor of anchorsOf(page.flats, spec, page.below)) {
    const value = pick(page, anchor, spec, expect);
    if (value !== undefined) out.push(value);
  }
  return out;
}

/** 키(178cm) — BMI가 맞는지 견줘 보는 데만 쓴다 */
function heightOf(flats: Flat[]): number | null {
  for (const flat of flats) {
    const m = /(\d{3}(?:\.\d)?)\s?cm/i.exec(flat.text);
    const cm = m ? Number(m[1]) : Number.NaN;
    if (cm >= 100 && cm <= 230) return cm;
  }
  return null;
}

const DATE = /(20\d{2})\s?[.\-/년]\s?(\d{1,2})\s?[.\-/월]\s?(\d{1,2})/;

function dateOf(flats: Flat[], today: string): string | null {
  const sorted = [...flats].sort((a, b) => a.line.y - b.line.y);
  for (const flat of sorted) {
    const m = DATE.exec(flat.text);
    if (!m) continue;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const date = new Date(y, mo - 1, d);
    // 없는 날짜(13월 · 32일)와 앞날은 잘못 읽은 것이다.
    if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) continue;
    const key = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    if (key > today) continue;
    return key;
  }
  return null;
}

const median = (list: number[]) => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)];
const near = (target: number, tolerance: number) => (v: number) =>
  Math.abs(v - target) <= tolerance;

/** 지난 기록 표가 시작하는 높이: '신체변화' 제목, 없으면 날짜 줄(25.08.25. …)에서 거슬러 올라간다 */
function historyTop(flats: Flat[]): number {
  const titles = flats
    .filter((f) => /신\s?체\s?변\s?화|composition\s?h.?istory/i.test(f.text))
    .map((f) => f.line.y);
  if (titles.length > 0) return Math.min(...titles);
  const dates = flats
    .filter((f) => /(?<!\d)\d{2}\.\d{2}\.\d{2}(?!\d)/.test(f.text))
    .map((f) => f.line.y);
  return dates.length >= 2 ? Math.min(...dates) - 0.13 : Number.POSITIVE_INFINITY;
}

/**
 * 결과지에서 읽은 줄들 → 검사일과 값. `today`(YYYY-MM-DD)보다 뒤의 날짜는 버린다.
 * 못 찾은 값은 넣지 않는다.
 */
export function parseSheet(lines: readonly OcrLine[], today: string): SheetResult {
  const flats = lines.map(flatten);
  const nums = flats.flatMap(numbersOf);
  markTicks(nums);
  const ranges = nums.filter((n) => n.range && n.decimals > 0).map((n) => n.h);
  const page: Page = {
    nums,
    flats,
    words: flats.flatMap((f) => f.spans.map((sp) => sp.word)),
    below: historyTop(flats),
    valueHeight: median(ranges) ?? 0,
  };

  const values: SheetResult['values'] = {};
  const put = (key: SheetField, value: number | undefined) => {
    if (value !== undefined) values[key] = value;
  };

  for (const key of ['bmr', 'visceralFat', 'whr', 'water', 'protein', 'mineral'] as const) {
    put(key, picks(page, key)[0]);
  }
  const fatMass = picks(page, 'fatMass')[0];

  // 체중은 표와 그래프에 두 번 찍힌다. 체수분 + 단백질 + 무기질 + 체지방량과 맞는 것을 먼저 쓰고,
  // 견줄 수 없으면 읽은 값들이 서로 같을 때만 쓴다.
  const { water, protein, mineral } = values;
  const parts =
    water !== undefined && protein !== undefined && mineral !== undefined && fatMass !== undefined
      ? water + protein + mineral + fatMass
      : null;
  const weights = picks(page, 'weight');
  const weight =
    (parts === null ? undefined : weights.find(near(parts, 0.35))) ??
    (new Set(weights).size === 1 ? weights[0] : undefined);
  put('weight', weight);

  // 골격근량은 체중보다 작다. 아니면 잘못 읽은 것이다.
  const muscle = picks(page, 'muscle')[0];
  if (muscle !== undefined && (weight === undefined || muscle < weight)) put('muscle', muscle);

  // 체지방률 ≈ 체지방량 ÷ 체중, BMI ≈ 체중 ÷ 키² — 계산할 수 있으면 그 값과 맞는 숫자만 쓴다.
  const height = heightOf(flats);
  put(
    'fat',
    picks(page, 'fat', weight && fatMass ? near((fatMass / weight) * 100, 0.25) : undefined)[0],
  );
  put(
    'bmi',
    picks(page, 'bmi', weight && height ? near(weight / (height / 100) ** 2, 0.3) : undefined)[0],
  );

  return { date: dateOf(flats, today), values };
}
