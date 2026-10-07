-- 유산소 기록: 세트에 거리 · 속도 · 경사 칸을 더한다(기기의 drizzle/0009_cardio.sql과 같은 칸). (MCP 마이그레이션 이름: cardio)
-- 시간은 있던 duration_sec을 쓴다. 종목 종류 'cardio'는 exercises.type의 글자 값이라 표를 바꾸지 않는다.
-- 서버에 먼저 넣고 앱을 내보낸다 — 앱이 새 칸을 보내는데 서버에 없으면 세트 보내기가 실패한다.
alter table public.sets
  add column distance double precision,
  add column distance_unit text not null default 'km',
  add column speed double precision,
  add column incline double precision;
