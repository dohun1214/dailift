#!/usr/bin/env node
/**
 * 한국식품안전관리인증원 「HACCP 제품이미지 및 포장지표기정보」(공공데이터포털 15033307, 이용허락 제한 없음)를
 * 모두 받아 필요한 칸만 남긴다: 품목보고번호 · 제품명 · 제조원 · 판매원 · 용량 · 바코드.
 * 가공식품의 '판매원'(브랜드 주인)을 채우는 데 쓴다 — scripts/build-processed-foods.mjs가 품목보고번호로 잇는다.
 *
 * 준비: data.go.kr에서 15033307 활용신청 → 인증키(인코딩된 것)를 환경 변수 DATA_GO_KR_KEY에 넣는다.
 * 실행(저장소 루트에서): node scripts/fetch-haccp-labels.mjs  → .expo/fooddata/haccp.json (약 14,700개, 10분쯤)
 * 응답이 멈추는 쪽이 있어 시간 제한을 두고, 100개짜리가 안 오면 10개씩 나눠 받는다.
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const key = process.env.DATA_GO_KR_KEY;
if (!key) {
  console.error('DATA_GO_KR_KEY 환경 변수가 필요하다');
  process.exit(1);
}
const base = 'https://apis.data.go.kr/B553748/CertImgListServiceV3/getCertImgListServiceV3';
const clean = (s) =>
  String(s ?? '')
    .replace(/\s+/g, ' ')
    .trim();

/** 한 쪽 받기. 못 받으면 null */
async function getPage(page, rows, tries) {
  for (let attempt = 0; attempt < tries; attempt += 1) {
    try {
      const res = await fetch(
        `${base}?serviceKey=${key}&returnType=json&pageNo=${page}&numOfRows=${rows}`,
        { signal: AbortSignal.timeout(25000) },
      );
      const j = JSON.parse(await res.text());
      return {
        total: Number(j.body.totalCount),
        list: (j.body.items ?? []).map((x) => x.item ?? x),
      };
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  return null;
}

const items = [];
const skipped = [];
const keep = (it) =>
  items.push({
    no: clean(it.prdlstReportNo),
    name: clean(it.prdlstNm),
    maker: clean(it.manufacture),
    seller: clean(it.seller),
    capacity: clean(it.capacity),
    barcode: clean(it.barcode),
  });

const ROWS = 100;
let total = 1;
for (let page = 1; (page - 1) * ROWS < total; page += 1) {
  const got = await getPage(page, ROWS, 2);
  if (got) {
    total = got.total;
    got.list.forEach(keep);
  } else {
    for (let sub = (page - 1) * 10 + 1; sub <= page * 10; sub += 1) {
      const part = await getPage(sub, 10, 2);
      if (part) part.list.forEach(keep);
      else skipped.push(`${(sub - 1) * 10 + 1}-${sub * 10}`);
    }
  }
  if (page % 10 === 0) console.log(`${page} / ${Math.ceil(total / ROWS)}쪽, ${items.length}개`);
}
mkdirSync('.expo/fooddata', { recursive: true });
writeFileSync('.expo/fooddata/haccp.json', JSON.stringify(items), 'utf8');
console.log(`done ${items.length}개, 못 받은 줄: ${skipped.join(', ') || '없음'}`);
