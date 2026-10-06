#!/usr/bin/env node
/**
 * 식약처 가공식품 원본(.expo/fooddata/process-*.json — 공공데이터포털 표준데이터 API
 * `tn_pubr_public_nutri_process_info_api`를 1,000개씩 받은 것)을 정리해 서버에 올릴 TSV를 만든다.
 *
 * - 이름 + 제조사가 같은 것은 하나만 남긴다(데이터 기준일이 새 것).
 * - 영양값은 100 g(ml)당으로 맞춘다. 식품중량 · 1회 섭취참고량은 숫자 하나로 읽히는 것만 쓴다.
 * - 칸: 식품코드, 이름, 제조사(없으면 수입사), 분류, 기준(g|ml), kcal, 단백질, 탄수화물, 지방, 식품중량, 1회 섭취참고량
 *
 * 실행(저장소 루트에서): node scripts/build-processed-foods.mjs
 *   → .expo/fooddata/process.tsv (서버에 올리기: scripts/load-processed-foods.mjs)
 *   → .expo/proc-report.txt (개수 · 분류 · 유통사 · 낱말별 개수)
 * 원본과 결과는 저장소에 넣지 않는다(.expo는 git 제외).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = '.expo/fooddata';
const files = readdirSync(dir)
  .filter((f) => /^process-\d+\.json$/.test(f))
  .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

const num = (v) => {
  const s = String(v ?? '')
    .replace(/,/g, '')
    .trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const amountOf = (text) => {
  const m = /([\d.,]+)\s*(g|ml)/i.exec(String(text ?? ''));
  if (!m) return null;
  const value = num(m[1]);
  return value ? { value, unit: m[2].toLowerCase() } : null;
};
const clean = (s) =>
  String(s ?? '')
    .replace(/[\t\r\n]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const none = (s) => !s || s === '해당없음';
const count = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
const top = (map, n) =>
  [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `   ${v}\t${k}`)
    .join('\n');

let total = 0;
let noKcal = 0;
let noMacro = 0;
let badFiles = 0;
const byCat = new Map();
const byMfr = new Map();
const byBase = new Map();
const picked = new Map();
let minDate = '9999';
let maxDate = '0000';
let withServ = 0;
let withSize = 0;
let imported = 0;

for (const f of files) {
  let items;
  try {
    items = JSON.parse(readFileSync(join(dir, f), 'utf8')).body.items.item ?? [];
  } catch {
    badFiles += 1;
    continue;
  }
  for (const r of items) {
    total += 1;
    const kcal = num(r.enerc);
    if (kcal === null) {
      noKcal += 1;
      continue;
    }
    const p = num(r.prot);
    const c = num(r.chocdf);
    const fat = num(r.fatce);
    if (p === null || c === null || fat === null) {
      noMacro += 1;
      continue;
    }
    const name = clean(r.foodNm).replace(/_/g, ', ');
    if (!name || !r.foodCd) continue;
    const mfr = none(clean(r.mfrNm))
      ? none(clean(r.imptNm))
        ? ''
        : clean(r.imptNm)
      : clean(r.mfrNm);
    const dist = none(clean(r.distNm)) ? '' : clean(r.distNm);
    const base = amountOf(r.nutConSrtrQua) ?? { value: 100, unit: 'g' };
    const k = 100 / base.value;
    const liquid = base.unit === 'ml';
    const size = amountOf(r.foodSize);
    const serv = amountOf(r.servSize);
    const date = clean(r.crtrYmd) || clean(r.crtYmd);
    const key = `${name}\u0001${mfr}`;
    const old = picked.get(key);
    if (old && old.date >= date) continue;
    picked.set(key, {
      sid: r.foodCd,
      name,
      mfr,
      dist,
      cat: clean(r.foodLv3Nm),
      basis: liquid ? 'ml' : 'g',
      kcal: +(kcal * k).toFixed(1),
      p: +(p * k).toFixed(2),
      c: +(c * k).toFixed(2),
      f: +(fat * k).toFixed(2),
      size: size?.value ?? '',
      serv: /,/.test(String(r.servSize ?? '')) ? '' : (serv?.value ?? ''),
      imp: r.imptYn === 'Y' ? 1 : 0,
      date,
      baseText: clean(r.nutConSrtrQua),
    });
  }
}

const rows = [...picked.values()];
for (const r of rows) {
  count(byCat, r.cat);
  count(byMfr, r.mfr || '(없음)');
  count(byBase, r.baseText);
  if (r.date && r.date < minDate) minDate = r.date;
  if (r.date && r.date > maxDate) maxDate = r.date;
  if (r.serv !== '') withServ += 1;
  if (r.size !== '') withSize += 1;
  if (r.imp) imported += 1;
}

const STORES = [
  ['CU(BGF)', /비지에프|BGF|씨유/i],
  ['GS25', /지에스리테일|GS리테일|GS25/i],
  ['세븐일레븐', /코리아세븐|세븐일레븐/i],
  ['이마트24', /이마트24|이마트 ?24/i],
  ['이마트/노브랜드', /이마트|노브랜드/i],
  ['홈플러스', /홈플러스/i],
  ['롯데마트/롯데쇼핑', /롯데쇼핑|롯데마트/i],
  ['쿠팡', /쿠팡|씨피엘비/i],
  ['컬리', /컬리/i],
];
const storeLines = STORES.map(([label, re]) => {
  const hit = rows.filter((r) => re.test(r.mfr) || re.test(r.dist) || re.test(r.name));
  const sample = hit
    .slice(0, 6)
    .map((r) => `${r.name} [${r.mfr}${r.dist ? ` / ${r.dist}` : ''}]`)
    .join(' ; ');
  return `   ${hit.length}\t${label}\t${sample}`;
}).join('\n');

const WORDS = [
  '삼각김밥',
  '김밥',
  '도시락',
  '샌드위치',
  '햄버거',
  '컵라면',
  '라면',
  '프로틴',
  '단백질',
  '닭가슴살',
  '요거트',
  '요구르트',
  '그릭',
  '두유',
  '우유',
  '시리얼',
  '그래놀라',
  '에너지바',
  '초코파이',
  '새우깡',
  '코카콜라',
  '제로',
  '핫바',
  '소시지',
  '만두',
  '햇반',
  '즉석밥',
  '비비고',
  '오뚜기',
  '곤약',
];
const wordLines = WORDS.map((w) => {
  const hit = rows.filter((r) => r.name.includes(w));
  const sample = hit
    .slice(0, 4)
    .map((r) => `${r.name} [${r.mfr}]`)
    .join(' ; ');
  return `   ${hit.length}\t${w}\t${sample}`;
}).join('\n');

const names = new Set(rows.map((r) => r.name));
const longest = rows.reduce((m, r) => Math.max(m, r.name.length), 0);
const avgName = rows.reduce((s, r) => s + r.name.length, 0) / rows.length;

const tsv = rows
  .sort((a, b) => a.sid.localeCompare(b.sid))
  .map((r) =>
    [r.sid, r.name, r.mfr, r.cat, r.basis, r.kcal, r.p, r.c, r.f, r.size, r.serv].join('\t'),
  )
  .join('\n');
writeFileSync(join(dir, 'process.tsv'), `${tsv}\n`, 'utf8');

const report = `files=${files.length} badFiles=${badFiles}
total=${total}
noKcal=${noKcal}
noMacro(P/C/F 중 빈 것)=${noMacro}
kept(이름+제조사로 중복 정리)=${rows.length}
distinctNames=${names.size}
imported=${imported}
withFoodSize=${withSize} withServSize=${withServ}
date ${minDate} ~ ${maxDate}
name length avg=${avgName.toFixed(1)} max=${longest}
tsvBytes=${Buffer.byteLength(tsv)}
-- 영양성분 기준량
${top(byBase, 8)}
-- 분류(상위 25)
${top(byCat, 25)}
-- 제조사(상위 25)
${top(byMfr, 25)}
-- 유통 · 편의점 (제조사 · 유통사 · 이름에 들어 있는 것)
${storeLines}
-- 낱말
${wordLines}
`;
writeFileSync('.expo/proc-report.txt', report, 'utf8');
console.log('done', rows.length);
