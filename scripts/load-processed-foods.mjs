#!/usr/bin/env node
/**
 * 가공식품(.expo/fooddata/process.tsv — scripts/build-processed-foods.mjs가 만든다)을 서버 표 `processed_foods`에 올린다.
 *
 * 서버 표는 누구나 읽기만 한다. 올릴 때만 넣기 · 고치기 정책을 잠깐 연다(SQL 편집기나 MCP로):
 *   alter policy "temp load" on public.processed_foods
 *     with check ((current_setting('request.headers', true)::json ->> 'x-load-token') = '<한 번 쓰고 버릴 긴 글자>');
 *   alter policy "temp load update" on public.processed_foods
 *     using ((current_setting('request.headers', true)::json ->> 'x-load-token') = '<같은 글자>')
 *     with check ((current_setting('request.headers', true)::json ->> 'x-load-token') = '<같은 글자>');
 *   grant insert, update on public.processed_foods to anon;
 * 다 올리면 닫는다:
 *   alter policy "temp load" on public.processed_foods with check (false);
 *   alter policy "temp load update" on public.processed_foods using (false) with check (false);
 *   revoke insert, update on public.processed_foods from anon;
 *
 * 실행(저장소 루트에서): LOAD_TOKEN=<그 글자> node scripts/load-processed-foods.mjs [process.tsv 경로]
 * 환경 변수 BATCH(한 번에 보낼 줄 수, 기본 1000) · START(몇 번째 줄부터, 기본 0).
 * 이미 있는 식품코드는 새 값으로 바뀐다(다시 돌려도 된다). 자료에서 빠진 식품코드는 서버에 그대로 남는다.
 *
 * 해외 포장 제품(scripts/build-branded-foods.mjs가 만든 TSV)은 같은 모양이라 표 이름만 바꿔 올린다:
 *   TABLE=branded_foods LOAD_TOKEN=<그 글자> node scripts/load-processed-foods.mjs .expo/fooddata/branded.tsv
 * 처음 올릴 때는 ONLY_NEW=1을 주면 넣기 정책만 열어도 된다(이미 있는 줄은 건너뛴다 — 고치지 않는다).
 */
import { readFileSync } from 'node:fs';

const file = process.argv[2] ?? '.expo/fooddata/process.tsv';
const token = process.env.LOAD_TOKEN;
if (!token) {
  console.error('LOAD_TOKEN 환경 변수가 필요하다');
  process.exit(1);
}
const table = process.env.TABLE ?? 'processed_foods';
if (table !== 'processed_foods' && table !== 'branded_foods') {
  console.error('TABLE은 processed_foods 또는 branded_foods');
  process.exit(1);
}
const onlyNew = process.env.ONLY_NEW === '1';
const config = readFileSync('src/config.ts', 'utf8');
const pick = (name) => new RegExp(`${name} = '([^']+)'`).exec(config)?.[1];
const url = pick('SUPABASE_URL');
const key = pick('SUPABASE_PUBLISHABLE_KEY');
if (!url || !key) {
  console.error('src/config.ts에서 서버 주소 · 키를 못 읽었다');
  process.exit(1);
}

const num = (v) => (v === '' || v === undefined ? null : Number(v));
const rows = readFileSync(file, 'utf8')
  .split('\n')
  .filter(Boolean)
  .map((line) => {
    // sid, name, maker, 분류(안 올림), basis, kcal, protein, carb, fat, size, serv
    const c = line.split('\t');
    return {
      sid: c[0],
      name: c[1],
      maker: c[2] ?? '',
      basis: c[4] === 'ml' ? 'ml' : 'g',
      kcal: Number(c[5]),
      protein: Number(c[6]),
      carb: Number(c[7]),
      fat: Number(c[8]),
      size: num(c[9]),
      serv: num(c[10]),
    };
  });

// 고칠 때는 한 번에 너무 많이 보내면 서버의 시간 제한(익명 3초)에 걸린다 → BATCH를 줄이고, 멈춘 곳부터는 START로 잇는다.
const BATCH = Number(process.env.BATCH) || 1000;
const START = Number(process.env.START) || 0;
let sent = START;
for (let i = START; i < rows.length; i += BATCH) {
  const batch = rows.slice(i, i + BATCH);
  let ok = false;
  for (let attempt = 0; attempt < 4 && !ok; attempt += 1) {
    try {
      const res = await fetch(`${url}/rest/v1/${table}?on_conflict=sid`, {
        method: 'POST',
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          // 이미 있는 식품코드는 새 값으로 바꾼다(넣기 · 고치기 정책이 둘 다 열려 있어야 한다). ONLY_NEW면 건너뛴다.
          Prefer: `resolution=${onlyNew ? 'ignore' : 'merge'}-duplicates,return=minimal`,
          'x-load-token': token,
        },
        body: JSON.stringify(batch),
      });
      if (res.ok) ok = true;
      else {
        console.error(`batch ${i}: ${res.status} ${(await res.text()).slice(0, 200)}`);
        if (res.status === 401 || res.status === 403) process.exit(1);
      }
    } catch (e) {
      console.error(`batch ${i}: ${e.message}`);
    }
    if (!ok) await new Promise((r) => setTimeout(r, 3000));
  }
  if (!ok) {
    console.error(`batch ${i} 실패 — 멈춘다`);
    process.exit(1);
  }
  sent += batch.length;
  if (((i - START) / BATCH) % 10 === 0) console.log(`${sent} / ${rows.length}`);
}
console.log(`done ${sent}`);
