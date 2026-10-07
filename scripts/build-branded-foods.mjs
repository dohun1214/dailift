#!/usr/bin/env node
/**
 * USDA FoodData Central의 포장 제품(Branded Foods, CC0)을 정리해 서버 표 `branded_foods`에 올릴 TSV를 만든다.
 *
 * 원본: https://fdc.nal.usda.gov/download-datasets 의 "Branded" JSON 묶음을 푼 파일
 * (FoodData_Central_branded_food_json_YYYY-MM-DD.json — 약 3 GB, 한 줄에 제품 하나).
 *
 * - 열량 · 단백질 · 탄수화물 · 지방이 모두 있고, 1회 제공량이 g 또는 ml인 것만 쓴다(알약류의 mg · IU는 뺀다).
 * - 단종 표시가 있는 것, 100 g당 열량이 900 kcal를 넘거나 세 영양소 합이 100 g을 크게 넘는 것(잘못 적힌 값)은 뺀다.
 * - 이름 + 브랜드 주인 + 브랜드가 같은 것은 하나만 남긴다(새로 올라온 것).
 * - 이름이 모두 대문자면 읽기 쉽게 낱말 첫 글자만 대문자로 바꾼다. 쉼표로 되풀이된 낱말("…, CINNAMON, RAISIN, CINNAMON, RAISIN")은 한 번만.
 * - 식별자는 바코드(GTIN)다 — USDA의 번호(fdcId)는 제품 정보가 고쳐질 때마다 새로 매겨진다.
 * - 영양값은 원본이 이미 100 g(ml)당이다.
 * - 칸: 바코드, 이름, 브랜드(없으면 브랜드 주인), 분류, 기준(g|ml), kcal, 단백질, 탄수화물, 지방, (빈칸 — 포장 무게는 쓰지 않는다), 1회 제공량
 *   → scripts/load-processed-foods.mjs가 읽는 모양과 같다.
 *
 * 실행(저장소 루트에서): node scripts/build-branded-foods.mjs <원본 JSON> [결과 TSV]
 *   → .expo/fooddata/branded.tsv (기본), .expo/branded-report.txt
 * 원본과 결과는 저장소에 넣지 않는다(.expo는 git 제외).
 */
import { createReadStream, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { createInterface } from 'node:readline';
import { pathToFileURL } from 'node:url';

const MAX_NAME = 120;
/** 낱말 첫 글자만 대문자로 바꿀 때 그대로 둘 줄임말 */
const KEEP_UPPER = new Set([
  'BBQ',
  'BLT',
  'USA',
  'US',
  'NY',
  'XL',
  'XXL',
  'IPA',
  'MCT',
  'BCAA',
  'DHA',
  'GMO',
  'UHT',
  'PB&J',
  'TV',
  'II',
  'III',
  'IV',
]);
/** 이름 가운데에서는 소문자로 두는 낱말 */
const SMALL = new Set(['and', 'or', 'of', 'in', 'with', 'the', 'a', 'an', 'for', 'to', 'on', 'n']);

export const clean = (s) =>
  String(s ?? '')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const capWord = (w, first) => {
  if (KEEP_UPPER.has(w)) return w;
  // 숫자가 든 낱말("100%", "12OZ", "B12")은 그대로
  if (/\d/.test(w)) return w;
  const low = w.toLowerCase();
  if (!first && SMALL.has(low)) return low;
  // 줄표 · 빗금 · & 뒤는 다시 대문자("HARD-BOILED" → "Hard-Boiled", "M&M'S" → "M&M's"), 작은따옴표 뒤는 소문자
  return low.replace(/(^|[-/&(.+])(\p{L})/gu, (_, a, b) => a + b.toUpperCase());
};

/** 모두 대문자인 글자를 낱말 첫 글자만 대문자로. 소문자가 섞여 있으면 그대로 둔다 */
export function titleCase(text) {
  const s = clean(text);
  if (s === '' || s !== s.toUpperCase() || s === s.toLowerCase()) return s;
  return s
    .split(' ')
    .map((w, i) => capWord(w, i === 0))
    .join(' ');
}

/** 쉼표로 나뉜 조각 가운데 되풀이된 것은 처음 것만 남긴다 */
export function dropRepeats(name) {
  const seen = new Set();
  const out = [];
  for (const part of name.split(',').map((p) => p.trim())) {
    const key = part.toLowerCase();
    if (part === '' || seen.has(key)) continue;
    seen.add(key);
    out.push(part);
  }
  return out.join(', ');
}

/** 너무 긴 이름은 낱말 사이에서 자른다 */
export function shorten(name, max = MAX_NAME) {
  if (name.length <= max) return name;
  const cut = name.slice(0, max + 1);
  const at = cut.lastIndexOf(' ');
  return (at > max * 0.6 ? cut.slice(0, at) : name.slice(0, max)).replace(/[\s,&-]+$/, '');
}

export const productName = (description) => shorten(titleCase(dropRepeats(clean(description))));

/** 보일 회사: 브랜드가 있으면 브랜드, 없으면 브랜드 주인 */
export const brandOf = (brandName, brandOwner) =>
  shorten(titleCase(clean(brandName)) || titleCase(clean(brandOwner)), 60);

/** 1회 제공량 단위 → 'g' | 'ml' | null(쓰지 않음) */
export function basisOf(unit) {
  const u = String(unit ?? '').toLowerCase();
  if (u === 'g' || u === 'grm' || u === 'gm') return 'g';
  if (u === 'ml' || u === 'mlt') return 'ml';
  return null;
}

/** 원본 한 줄(제품 하나) → 올릴 줄. 쓰지 않을 것은 null과 까닭 */
export function toRow(r) {
  const basis = basisOf(r.servingSizeUnit);
  if (!basis) return { skip: 'unit' };
  if (r.discontinuedDate) return { skip: 'discontinued' };
  const sid = clean(r.gtinUpc);
  if (!/^\d{6,14}$/.test(sid)) return { skip: 'barcode' };
  const nut = {};
  for (const x of r.foodNutrients ?? []) {
    const n = x?.nutrient?.number;
    if ((n === '208' || n === '203' || n === '204' || n === '205') && Number.isFinite(x.amount)) {
      nut[n] = x.amount;
    }
  }
  const kcal = nut['208'];
  const protein = nut['203'];
  const fat = nut['204'];
  const carb = nut['205'];
  if ([kcal, protein, fat, carb].some((v) => v === undefined || v < 0))
    return { skip: 'nutrients' };
  if (kcal > 900 || protein + fat + carb > 105) return { skip: 'range' };
  const name = productName(r.description);
  if (name === '') return { skip: 'name' };
  const serv = Number(r.servingSize);
  return {
    row: {
      sid,
      name,
      maker: brandOf(r.brandName, r.brandOwner),
      cat: clean(r.brandedFoodCategory),
      basis,
      kcal: +kcal.toFixed(1),
      protein: +protein.toFixed(2),
      carb: +carb.toFixed(2),
      fat: +fat.toFixed(2),
      serv: Number.isFinite(serv) && serv > 0 ? +serv.toFixed(1) : '',
    },
    key: `${clean(r.description).toUpperCase()}\u0001${clean(r.brandOwner).toUpperCase()}\u0001${clean(r.brandName).toUpperCase()}`,
    fdcId: Number(r.fdcId) || 0,
    country: clean(r.marketCountry),
  };
}

async function main() {
  const src = process.argv[2];
  const out = process.argv[3] ?? '.expo/fooddata/branded.tsv';
  if (!src) {
    console.error('쓰는 법: node scripts/build-branded-foods.mjs <원본 JSON> [결과 TSV]');
    process.exit(1);
  }
  const picked = new Map();
  const skipped = new Map();
  let total = 0;
  let bad = 0;
  const lines = createInterface({ input: createReadStream(src, 'utf8'), crlfDelay: Infinity });
  for await (const raw of lines) {
    if (!raw.startsWith('{"foodClass"')) continue;
    total += 1;
    let r;
    const line = raw.trim().replace(/,$/, '');
    try {
      r = JSON.parse(line);
    } catch {
      try {
        // 마지막 줄은 배열과 객체를 닫는 "]}"가 붙어 있다.
        r = JSON.parse(line.slice(0, -2));
      } catch {
        bad += 1;
        continue;
      }
    }
    const made = toRow(r);
    if (made.skip) {
      skipped.set(made.skip, (skipped.get(made.skip) ?? 0) + 1);
      continue;
    }
    const old = picked.get(made.key);
    if (old && old.fdcId >= made.fdcId) continue;
    picked.set(made.key, made);
  }

  // 같은 바코드가 두 번 남았으면(이름만 다른 경우) 새 것 하나만
  const bySid = new Map();
  for (const m of picked.values()) {
    const old = bySid.get(m.row.sid);
    if (!old || old.fdcId < m.fdcId) bySid.set(m.row.sid, m);
  }
  const rows = [...bySid.values()].map((m) => m.row).sort((a, b) => a.sid.localeCompare(b.sid));
  const tsv = rows
    .map((r) =>
      [r.sid, r.name, r.maker, r.cat, r.basis, r.kcal, r.protein, r.carb, r.fat, '', r.serv].join(
        '\t',
      ),
    )
    .join('\n');
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${tsv}\n`, 'utf8');

  const count = (map, k) => map.set(k, (map.get(k) ?? 0) + 1);
  const top = (map, n) =>
    [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, v]) => `   ${v}\t${k}`)
      .join('\n');
  const byCat = new Map();
  const byMaker = new Map();
  const byCountry = new Map();
  for (const r of rows) {
    count(byCat, r.cat || '(없음)');
    count(byMaker, r.maker || '(없음)');
  }
  for (const m of bySid.values()) count(byCountry, m.country);
  const report = `total=${total} bad=${bad}
kept=${rows.length} (이름 · 브랜드로 중복 정리 뒤)
skipped: ${[...skipped.entries()].map(([k, v]) => `${k}=${v}`).join(' ')}
noMaker=${rows.filter((r) => !r.maker).length} noServing=${rows.filter((r) => r.serv === '').length} ml=${rows.filter((r) => r.basis === 'ml').length}
tsvBytes=${Buffer.byteLength(tsv)}
-- 나라
${top(byCountry, 5)}
-- 분류(상위 20)
${top(byCat, 20)}
-- 브랜드(상위 30)
${top(byMaker, 30)}
`;
  writeFileSync('.expo/branded-report.txt', report, 'utf8');
  console.log(report);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) await main();
