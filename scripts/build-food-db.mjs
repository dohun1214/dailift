#!/usr/bin/env node
/**
 * 앱에 넣는 음식 DB(`assets/food/foods.db`)를 만든다. 원본 파일은 저장소에 넣지 않고, 만든 결과만 커밋한다.
 *
 * 원본 받는 곳
 * - USDA FoodData Central (CC0) — https://fdc.nal.usda.gov/download-datasets 의 CSV 묶음 두 개를 풀어 둔 폴더
 *   · "Survey Foods (FNDDS)": 먹는 형태의 음식 + 가정 단위(1 cup …)
 *   · "SR Legacy": 식재료
 * - 식약처 전국통합식품영양성분정보 표준데이터 (공공데이터, 이용 제한 없음) — data.go.kr 15100070(음식), 15100065(원재료성식품).
 *   `scripts/fetch-mfds-foods.mjs`로 받아 둔 폴더(food-1.json …, material-1.json …). 가공식품은 넣지 않는다.
 *
 * 쓰는 법
 *   node scripts/build-food-db.mjs --usda <FNDDS 폴더> --usda <SR Legacy 폴더> --mfds <받아 둔 폴더>
 *
 * 만든 뒤 `src/food/food-db.ts`의 FOOD_DB_VERSION을 올려야 기기에 새 파일이 복사된다.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'food', 'foods.db');
/** 음식 하나에 넣는 가정 단위 수 */
const MAX_PORTIONS = 8;

// ---------- 공통

/** RFC 4180 CSV → 머리글을 키로 하는 객체 배열 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      cell = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  const [head, ...body] = rows;
  const keys = head.map((k) => k.replace(/^﻿/, '').trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ''])));
}

const num = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).replace(/,/g, '').trim();
  if (s === '' || s === '-') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const round1 = (n) => (n === null ? null : Math.round(n * 10) / 10);

const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
/** 한글 음절은 초성으로, 영문 · 숫자는 소문자로 남기고 나머지(공백 · 밑줄 · 쉼표 …)는 뺀다. 초성 검색용 */
export function chosung(text) {
  let out = '';
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code >= 0xac00 && code <= 0xd7a3) out += CHO[Math.floor((code - 0xac00) / 588)];
    else if (/[0-9a-zA-Z%]/.test(ch)) out += ch.toLowerCase();
  }
  return out;
}

// ---------- USDA

/** 영양소 번호: 새 묶음은 nutrient_nbr(208 …), 옛 묶음은 id(1008 …)를 쓴다 */
const USDA_NUTRIENTS = {
  kcal: ['1008', '208'],
  protein: ['1003', '203'],
  fat: ['1004', '204'],
  carb: ['1005', '205'],
};

function loadUsda(dir) {
  const read = (name) => parseCsv(readFileSync(join(dir, name), 'utf8'));
  const foods = read('food.csv');
  const wanted = new Map();
  for (const [key, ids] of Object.entries(USDA_NUTRIENTS))
    for (const id of ids) wanted.set(id, key);
  const nutrients = new Map();
  for (const r of read('food_nutrient.csv')) {
    const key = wanted.get(r.nutrient_id);
    if (!key) continue;
    const entry = nutrients.get(r.fdc_id) ?? {};
    entry[key] = num(r.amount);
    nutrients.set(r.fdc_id, entry);
  }
  const portions = new Map();
  for (const r of read('food_portion.csv')) {
    const grams = num(r.gram_weight);
    if (!grams || grams <= 0) continue;
    // FNDDS는 portion_description("1 cup"), SR Legacy는 amount + modifier("1" + "waffle, round")
    const name = (r.portion_description || `${r.amount} ${r.modifier}`).replace(/\s+/g, ' ').trim();
    const list = portions.get(r.fdc_id) ?? [];
    list.push({ seq: num(r.seq_num) ?? list.length, name, grams });
    portions.set(r.fdc_id, list);
  }
  const out = [];
  for (const f of foods) {
    const n = nutrients.get(f.fdc_id);
    if (!n || n.kcal == null) continue;
    const all = (portions.get(f.fdc_id) ?? []).sort((a, b) => a.seq - b.seq);
    // FNDDS의 "Quantity not specified"는 양을 말하지 않았을 때의 기본 양이다 → 기본 제공량으로만 쓴다.
    const fallback = all.find((p) => /^quantity not specified$/i.test(p.name));
    const named = all.filter((p) => p !== fallback && p.name !== '');
    const first = (fallback && named.find((p) => p.grams === fallback.grams)) ?? named[0];
    out.push({
      src: 'usda',
      sid: f.fdc_id,
      pri: f.data_type === 'survey_fndds_food' ? 0 : 1,
      name: f.description.replace(/\s+/g, ' ').trim(),
      cho: null,
      kcal: n.kcal,
      protein: n.protein ?? 0,
      carb: n.carb ?? 0,
      fat: n.fat ?? 0,
      basis: 'g',
      serving: first?.grams ?? fallback?.grams ?? null,
      servingName: first?.name ?? null,
      portions: named.slice(0, MAX_PORTIONS),
    });
  }
  return out;
}

// ---------- 식약처 (표준데이터 API로 받은 JSON — scripts/fetch-mfds-foods.mjs)

/** "100g" · "100 ml" · "250g" 같은 글자에서 양과 단위를 읽는다 */
function amountOf(text) {
  const m = /([\d.,]+)\s*(g|ml)/i.exec(String(text ?? ''));
  if (!m) return null;
  const value = num(m[1]);
  return value ? { value, unit: m[2].toLowerCase() } : null;
}

/** 이름 끝의 "<지역>_<월 또는 평균>" (수산물 성분표: "…_생것_포항_6월", "…_대표_평균") */
const isSample = (parts) => parts.length > 2 && /^(평균|\d+월)$/.test(parts[parts.length - 1]);
/** 같은 수산물의 여러 표본 가운데 하나를 고를 때: 대표 평균 → 대표 → 평균 → 그 밖 */
const sampleRank = (where, when) => (where === '대표' ? 0 : 2) + (when === '평균' ? 0 : 1);

/** 같은 이름의 음식이 여러 조사에서 나올 때 고르는 순서 (앞의 것을 쓴다) */
const ORIGIN_ORDER = [
  '가정식',
  '외식(분석',
  '외식(재료량',
  '산업체급식',
  '중고등학교급식',
  '초등학교급식',
];
const originRank = (origin) => {
  const i = ORIGIN_ORDER.findIndex((o) => String(origin ?? '').startsWith(o));
  return i < 0 ? ORIGIN_ORDER.length : i;
};

function loadMfds(dir, kind, pri) {
  const files = readdirSync(dir)
    .filter((f) => f.startsWith(`${kind}-`) && f.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  const items = files.flatMap(
    (f) => JSON.parse(readFileSync(join(dir, f), 'utf8')).body.items.item ?? [],
  );
  const picked = new Map();
  for (const r of items) {
    const parts = String(r.foodNm ?? '')
      .split('_')
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const kcal = num(r.enerc);
    if (parts.length === 0 || !r.foodCd || kcal === null) continue;
    // 프랜차이즈 음식의 대부분은 탄수화물 · 지방이 비어 있다(열량 · 단백질만 있음). 합계가 틀어지므로 넣지 않는다.
    if (num(r.prot) === null || num(r.fatce) === null || num(r.chocdf) === null) continue;
    const brand = r.restNm && r.restNm !== '해당없음' ? String(r.restNm).trim() : null;
    // 지역 · 월별 표본은 음식마다 하나만 남기고, 이름에서 지역 · 월을 뺀다.
    const sample = isSample(parts);
    const nameParts = sample ? parts.slice(0, -2) : parts;
    // 밑줄로 이어진 이름을 쉼표로 바꿔 읽기 쉽게 한다 ("닭고기_가슴_삶은것" → "닭고기, 가슴, 삶은것").
    // 업체 음식은 이름 뒤에 업체를 붙인다 ("커피, 카페라떼 (L) · 이디야").
    const name = nameParts.join(', ') + (brand ? ` · ${brand}` : '');
    const rank = sample
      ? sampleRank(parts[parts.length - 2], parts[parts.length - 1])
      : originRank(r.foodOriginNm);
    const old = picked.get(name);
    if (old && old.rank <= rank) continue;
    // 영양성분은 기준량(대개 100g 또는 100ml)당 값이다 → 100당으로 맞춘다.
    const base = amountOf(r.nutConSrtrQua) ?? { value: 100, unit: 'g' };
    // 원본에는 밥 · 반찬에도 ml로 적힌 것이 많다 → 마실 것만 ml로 둔다.
    const liquid = base.unit === 'ml' && (kind === 'material' || r.foodLv3Nm === '음료 및 차류');
    const k = 100 / base.value;
    // 1회 양: 음식은 식품중량(한 그릇), 없으면 1회 섭취참고량
    const serving = amountOf(r.foodSize) ?? amountOf(r.servSize);
    picked.set(name, {
      rank,
      food: {
        src: 'mfds',
        sid: r.foodCd,
        // 업체 음식은 일반 음식 · 재료 뒤에 보인다.
        pri: brand ? 2 : pri,
        name,
        cho: chosung(name),
        kcal: kcal * k,
        protein: (num(r.prot) ?? 0) * k,
        carb: (num(r.chocdf) ?? 0) * k,
        fat: (num(r.fatce) ?? 0) * k,
        basis: liquid ? 'ml' : 'g',
        serving: serving?.value ?? null,
        servingName: null,
        portions: [],
      },
    });
  }
  // 식품코드가 겹치는 것이 드물게 있다(같은 코드에 부위만 다른 것) → 이름 순으로 뒤의 것에 번호를 붙인다.
  const foods = [...picked.values()]
    .map((p) => p.food)
    .sort((a, b) => a.name.localeCompare(b.name));
  const used = new Map();
  for (const f of foods) {
    const n = (used.get(f.sid) ?? 0) + 1;
    used.set(f.sid, n);
    if (n > 1) f.sid = `${f.sid}#${n}`;
  }
  return foods;
}

// ---------- 만들기

function build(usdaDirs, mfdsDir) {
  const foods = [
    // 음식(요리)을 원재료보다 먼저 보인다.
    ...(mfdsDir ? [...loadMfds(mfdsDir, 'food', 0), ...loadMfds(mfdsDir, 'material', 1)] : []),
    ...usdaDirs.flatMap((d) => loadUsda(d)),
  ];
  // 같은 출처 · 같은 id가 두 번 나오면 먼저 나온 것을 쓴다.
  const seen = new Set();
  const unique = foods.filter((f) => {
    const key = `${f.src}:${f.sid}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  // 순서를 고정해 같은 원본이면 같은 파일이 나오게 한다.
  unique.sort((a, b) => a.src.localeCompare(b.src) || a.pri - b.pri || a.sid.localeCompare(b.sid));

  mkdirSync(dirname(OUT), { recursive: true });
  if (existsSync(OUT)) rmSync(OUT);
  const db = new Database(OUT);
  db.pragma('page_size = 4096');
  db.pragma('journal_mode = DELETE');
  db.exec(`
    CREATE TABLE foods (
      id INTEGER PRIMARY KEY,
      src TEXT NOT NULL,          -- 'usda' | 'mfds'
      sid TEXT NOT NULL,          -- 출처에서 쓰는 id (fdc_id, 식품코드)
      pri INTEGER NOT NULL,       -- 같은 출처 안에서 먼저 보일 순서 (0이 먼저)
      name TEXT NOT NULL,
      cho TEXT,                   -- 한글 이름의 초성 (식약처만)
      kcal REAL NOT NULL,         -- 아래 넷은 100g(또는 100ml)당
      protein REAL NOT NULL,
      carb REAL NOT NULL,
      fat REAL NOT NULL,
      basis TEXT NOT NULL,        -- 'g' | 'ml'
      serving REAL,               -- 기본 1회 양 (g 또는 ml)
      serving_name TEXT           -- 그 양의 이름 ("1 cup")
    );
    CREATE UNIQUE INDEX foods_src_sid ON foods (src, sid);
    CREATE TABLE portions (
      food_id INTEGER NOT NULL,
      seq INTEGER NOT NULL,
      name TEXT NOT NULL,
      grams REAL NOT NULL,
      PRIMARY KEY (food_id, seq)
    ) WITHOUT ROWID;
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
  `);
  const insertFood = db.prepare(
    'INSERT INTO foods (src, sid, pri, name, cho, kcal, protein, carb, fat, basis, serving, serving_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  );
  const insertPortion = db.prepare(
    'INSERT INTO portions (food_id, seq, name, grams) VALUES (?, ?, ?, ?)',
  );
  db.transaction(() => {
    for (const f of unique) {
      const { lastInsertRowid } = insertFood.run(
        f.src,
        f.sid,
        f.pri,
        f.name,
        f.cho,
        round1(f.kcal),
        round1(f.protein),
        round1(f.carb),
        round1(f.fat),
        f.basis,
        round1(f.serving),
        f.servingName,
      );
      f.portions.forEach((p, i) => {
        insertPortion.run(lastInsertRowid, i, p.name, round1(p.grams));
      });
    }
    const count = (src) => unique.filter((f) => f.src === src).length;
    const meta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
    meta.run('usda', String(count('usda')));
    meta.run('mfds', String(count('mfds')));
  })();
  db.exec('VACUUM');
  db.close();
  const size = statSync(OUT).size;
  console.log(
    `foods.db: ${unique.length} foods (usda ${unique.filter((f) => f.src === 'usda').length}, mfds ${unique.filter((f) => f.src === 'mfds').length}), ${(size / 1024 / 1024).toFixed(2)} MB`,
  );
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url);
if (isMain) {
  const usda = [];
  let mfds = null;
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 2) {
    if (args[i] === '--usda') usda.push(args[i + 1]);
    else if (args[i] === '--mfds') mfds = args[i + 1];
    else {
      console.error(`unknown option: ${args[i]}`);
      process.exit(1);
    }
  }
  if (usda.length === 0 && !mfds) {
    console.error('usage: node scripts/build-food-db.mjs --usda <dir> … --mfds <dir>');
    process.exit(1);
  }
  build(usda, mfds);
}
