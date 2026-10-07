#!/usr/bin/env node
/**
 * 식약처 가공식품 원본(.expo/fooddata/process-*.json — 공공데이터포털 표준데이터 API
 * `tn_pubr_public_nutri_process_info_api`를 1,000개씩 받은 것)을 정리해 서버에 올릴 TSV를 만든다.
 *
 * - 이름 + 제조사가 같은 것은 하나만 남긴다(데이터 기준일이 새 것).
 * - 영양값은 100 g(ml)당으로 맞춘다. 식품중량 · 1회 섭취참고량은 숫자 하나로 읽히는 것만 쓴다.
 * - 칸: 식품코드, 이름, 보일 회사(유통사가 있으면 유통사, 없으면 제조사 · 수입사 — 법인 표시와 공장 이름은 뗀다), 분류, 기준(g|ml), kcal, 단백질, 탄수화물, 지방, 식품중량, 1회 섭취참고량
 *
 * 포장지 표기정보(.expo/fooddata/haccp.json — scripts/fetch-haccp-labels.mjs)가 있으면 품목보고번호로 이어 판매원을 쓴다.
 *
 * 실행(저장소 루트에서): node scripts/build-processed-foods.mjs
 *   → .expo/fooddata/process.tsv (서버에 올리기: scripts/load-processed-foods.mjs)
 *   → .expo/fooddata/process-changed.tsv (앞서 만든 TSV와 달라진 줄만 — 다시 올릴 때 이것만 올린다)
 *   → .expo/proc-report.txt (개수 · 분류 · 유통사 · 낱말별 개수)
 * 원본과 결과는 저장소에 넣지 않는다(.expo는 git 제외).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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
/** 회사 이름 앞뒤에 붙는 법인 표시 */
const LEGAL =
  /\(주\)|㈜|주식회사|\(유\)|㈲|유한회사|유한책임회사|\(합\)|합자회사|\(사\)|사단법인|\(재\)|재단법인|농업회사법인|어업회사법인|영농조합법인|영어조합법인/g;
/** 이름 끝의 공장 · 지점 표시 ("… 제2공장", "… 김해공장", "… 본사") */
const PLANT =
  /(\s+(제?\s*\d*\s*[가-힣A-Za-z]*\s?공장|본사|본점|[가-힣]{1,6}지점|[가-힣]{1,6}사업장)|\s*\(제?\s*\d*\s*[가-힣]*공장\))$/;
/** 유통사 칸에 적힌 법인 이름 → 사람들이 아는 이름 */
const KNOWN = [
  [/지에스리테일|GS리테일/i, 'GS리테일(GS25)'],
  [/비지에프리테일|BGF리테일/i, 'BGF리테일(CU)'],
  [/코리아세븐/, '코리아세븐(세븐일레븐)'],
  [/이마트\s?24/, '이마트24'],
];

/**
 * 회사 이름을 화면에 보일 모양으로: 법인 표시를 떼고, 법인 표시 뒤에 붙은 공장 이름을 버린다.
 * "씨제이제일제당(주)진천BLOSSOM CAMPUS" → "씨제이제일제당", "주식회사 플라잉닥터 제2공장" → "플라잉닥터",
 * "농업회사법인(주)반디" → "반디". 여러 회사가 "/"로 이어져 있으면 첫 회사만 쓴다. 다듬다가 이름이 없어지면 원래 것을 쓴다.
 */
function companyName(raw) {
  // 한글 이름이 "/"로 이어져 있으면 여러 회사다("A(주)/B(주)"). 외국 이름의 "A/S"는 그대로 둔다.
  const text = clean(raw);
  const parts = text.split('/').map(clean);
  const first = parts.length > 1 && parts.every((x) => /[가-힣]/.test(x)) ? parts[0] : text;
  if (!first) return '';
  // 앞에 붙은 법인 표시를 모두 뗀다.
  let s = first;
  for (;;) {
    const m = new RegExp(`^(?:${LEGAL.source})\\s*`).exec(s);
    if (!m) break;
    s = s.slice(m[0].length);
  }
  // 이름 뒤(또는 가운데)의 법인 표시부터는 버린다 — 그 뒤는 공장 이름이다.
  const at = s.search(new RegExp(LEGAL.source));
  if (at >= 2) s = s.slice(0, at);
  else if (at >= 0) s = s.replace(new RegExp(LEGAL.source, 'g'), ' ');
  s = clean(s);
  for (;;) {
    const cut = s.replace(PLANT, '');
    if (cut === s || cut.length < 2) break;
    s = cut;
  }
  return s.length >= 2 ? s : first;
}

/** 주소가 시작되는 곳 ("… 서울특별시 …", "… 충북 음성군 …") */
const ADDRESS =
  /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|충북|충남|전라|전북|전남|경상|경북|경남|제주)(특별시|광역시|특별자치|도|시)?[\s]/;

/**
 * 포장지의 '판매원' 칸에서 회사 이름만 꺼낸다. 이 칸은 사람이 옮겨 적은 것이라 주소 · 누리집이 붙어 있거나
 * "알수없음"인 것이 많다("풀무원식품㈜/충북 음성군 …", "주식회사 오뚜기 경기도 안양시 … www.ottogi.co.kr").
 * 이름으로 볼 수 없으면 빈 글자.
 */
function sellerName(raw) {
  let s = clean(raw);
  if (!s || /알\s*수\s*없음|해당\s*없음|^[\s_\-.]*$/.test(s)) return '';
  // 구분 글자 · 누리집 · '본사' 앞까지만
  s = s.split(/[/_:·]|\(?(?:https?|www)|\s본사|본사\s*[:-]|\s본조합/i)[0];
  const at = s.search(ADDRESS);
  if (at === 0) return '';
  if (at > 0) s = s.slice(0, at);
  s = companyName(s.replace(/[\s(,.-]+$/, ''));
  if (s.length < 2 || s.length > 20 || !/[가-힣A-Za-z]/.test(s) || /\d{2,}/.test(s)) return '';
  return s;
}

/** 유통사 이름을 사람들이 아는 이름으로(편의점), 아니면 다듬은 이름으로 */
function brandName(company) {
  for (const [re, name] of KNOWN) if (re.test(company)) return name;
  return companyName(company);
}

/**
 * 화면에 보일 회사: ① 원본의 유통업체 ② 포장지 표기의 판매원(HACCP 자료와 품목보고번호가 같을 때) ③ 제조사.
 * ① · ②가 브랜드 주인 · 판매원이다. 둘 다 없는 것이 대부분(약 97%)이라 그때는 제조사를 다듬어 보여 준다.
 */
function shownCompany(mfr, dist, seller = '') {
  if (dist) return brandName(dist);
  if (seller) return brandName(seller);
  return companyName(mfr);
}

const count = (map, key) => map.set(key, (map.get(key) ?? 0) + 1);
const top = (map, n) =>
  [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `   ${v}\t${k}`)
    .join('\n');

// 포장지 표기정보(scripts/fetch-haccp-labels.mjs가 받은 것): 품목보고번호 → 판매원. 없으면 건너뛴다.
const haccpFile = join(dir, 'haccp.json');
const sellerByNo = new Map();
if (existsSync(haccpFile)) {
  for (const h of JSON.parse(readFileSync(haccpFile, 'utf8'))) {
    const name = sellerName(h.seller);
    if (h.no && name) sellerByNo.set(h.no, name);
  }
}

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
      seller: sellerByNo.get(clean(r.itemMnftrRptNo)) ?? '',
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
    [
      r.sid,
      r.name,
      shownCompany(r.mfr, r.dist, r.seller),
      r.cat,
      r.basis,
      r.kcal,
      r.p,
      r.c,
      r.f,
      r.size,
      r.serv,
    ].join('\t'),
  )
  .join('\n');
// 앞서 만든 TSV가 있으면 달라진 줄만 따로 적는다(서버에는 그것만 다시 올리면 된다).
const tsvFile = join(dir, 'process.tsv');
let changedLines = null;
if (existsSync(tsvFile)) {
  const before = new Set(readFileSync(tsvFile, 'utf8').split('\n'));
  changedLines = tsv.split('\n').filter((line) => !before.has(line));
  writeFileSync(join(dir, 'process-changed.tsv'), `${changedLines.join('\n')}\n`, 'utf8');
}
writeFileSync(tsvFile, `${tsv}\n`, 'utf8');

const byShown = new Map();
const changed = [];
for (const r of rows) {
  const shown = shownCompany(r.mfr, r.dist, r.seller);
  count(byShown, shown || '(없음)');
  if (
    shown !== r.mfr &&
    changed.length < 70 &&
    (r.dist ? Math.random() < 0.01 : Math.random() < 0.0004)
  ) {
    changed.push(`   ${r.mfr}${r.dist ? ` / 유통 ${r.dist}` : ''}  →  ${shown}`);
  }
}

const usedDist = rows.filter((r) => r.dist).length;
const usedSeller = rows.filter((r) => !r.dist && r.seller).length;
const sellerSample = rows
  .filter((r) => !r.dist && r.seller && r.seller !== companyName(r.mfr))
  .filter(() => Math.random() < 0.03)
  .slice(0, 40)
  .map((r) => `   ${r.name} | 제조 ${r.mfr}  →  ${shownCompany(r.mfr, r.dist, r.seller)}`)
  .join('\n');
const sellerNew = rows.filter(
  (r) => !r.dist && r.seller && brandName(r.seller) !== companyName(r.mfr),
).length;

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
changedLines=${changedLines === null ? '(앞의 TSV 없음)' : changedLines.length}
보일 회사: 유통업체 ${usedDist} / 판매원(HACCP) ${usedSeller} (그중 제조사와 다른 이름 ${sellerNew}) / 제조사 ${rows.length - usedDist - usedSeller}
-- 판매원으로 바뀐 예
${sellerSample}
-- 영양성분 기준량
${top(byBase, 8)}
-- 분류(상위 25)
${top(byCat, 25)}
-- 제조사(상위 25)
${top(byMfr, 25)}
-- 보일 회사(상위 40, 전체 ${byShown.size}가지)
${top(byShown, 40)}
-- 다듬은 예
${changed.join('\n')}
-- 유통 · 편의점 (제조사 · 유통사 · 이름에 들어 있는 것)
${storeLines}
-- 낱말
${wordLines}
`;
writeFileSync('.expo/proc-report.txt', report, 'utf8');
console.log('done', rows.length);
