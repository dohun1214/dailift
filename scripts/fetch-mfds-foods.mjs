#!/usr/bin/env node
/**
 * 식약처 전국통합식품영양성분정보 표준데이터를 공공데이터포털 API로 모두 받아 둔다(음식 DB를 만들 때 쓰는 원본).
 * 받은 파일은 저장소에 넣지 않는다.
 *
 * 준비: data.go.kr에서 15100070(음식) · 15100065(원재료성식품) 활용신청 → 인증키(인코딩된 것)를 환경 변수에 넣는다.
 * 쓰는 법: DATA_GO_KR_KEY=<인증키> node scripts/fetch-mfds-foods.mjs <저장할 폴더>
 * 한국 밖에서는 접속이 막혀 있을 수 있다.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROWS = 1000;
const KINDS = ['food', 'material'];

const key = process.env.DATA_GO_KR_KEY;
const out = process.argv[2];
if (!key || !out) {
  console.error('usage: DATA_GO_KR_KEY=<key> node scripts/fetch-mfds-foods.mjs <out dir>');
  process.exit(1);
}
mkdirSync(out, { recursive: true });

for (const kind of KINDS) {
  let total = 1;
  for (let page = 1; (page - 1) * ROWS < total; page++) {
    const url = `https://api.data.go.kr/openapi/tn_pubr_public_nutri_${kind}_info_api?serviceKey=${key}&pageNo=${page}&numOfRows=${ROWS}&type=json`;
    let text = '';
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        text = await res.text();
        total = Number(JSON.parse(text).body.totalCount);
        break;
      } catch (e) {
        if (attempt === 3) throw new Error(`${kind} page ${page}: ${e.message}`);
        await new Promise((r) => setTimeout(r, 3000));
      }
    }
    writeFileSync(join(out, `${kind}-${page}.json`), text);
    console.log(`${kind} ${Math.min(page * ROWS, total)} / ${total}`);
  }
}
