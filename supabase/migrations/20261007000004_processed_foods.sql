-- 가공식품 검색: 식약처 전국통합식품영양성분정보(가공식품) 약 31만 개. 누구나 읽기만 한다(공개 자료). (MCP 마이그레이션 이름: processed_foods)
-- 자료 올리기: 저장소 scripts/load-processed-foods.mjs (잠깐 여는 넣기 정책 "temp load"를 쓴다 — 올린 뒤에는 닫아 둔다).
create extension if not exists pg_trgm with schema extensions;

create table public.processed_foods (
  sid text primary key,          -- 식품코드
  name text not null,
  maker text not null default '',-- 제조사(없으면 수입사)
  basis text not null default 'g', -- 'g' | 'ml'
  kcal real not null,            -- 아래 넷은 100 g(ml)당
  protein real not null,
  carb real not null,
  fat real not null,
  size real,                     -- 식품중량(포장 하나)
  serv real,                     -- 1회 섭취참고량
  -- 찾을 때 견주는 글자: "이름|제조사"에서 띄어쓰기 · 쉼표 · 가운뎃점을 빼고 소문자로
  skey text generated always as (lower(regexp_replace(name || '|' || maker, '[\s,·]+', '', 'g'))) stored
);
alter table public.processed_foods enable row level security;
create policy "anyone can read" on public.processed_foods for select to anon, authenticated using (true);

-- 낱말이 모두 들어 있는 것을 찾는다(이름 또는 제조사). 두 글자 이상부터. 순서: 이름이 똑같은 것 → 검색어로 시작 → 짧은 이름.
create function public.search_processed_foods(q text, lim integer default 30, off integer default 0)
returns table (sid text, name text, maker text, basis text, kcal real, protein real, carb real, fat real, size real, serv real)
language plpgsql stable security invoker set search_path = '' as $$
declare
  words text[];
  pats text[];
  main text;
  whole text;
begin
  select array_agg(w) into words from (
    select lower(regexp_replace(x, '[,·|]+', '', 'g')) as w
    from unnest(regexp_split_to_array(trim(coalesce(q, '')), '\s+')) as x
  ) s where w <> '';
  if words is null then return; end if;
  words := words[1:5];
  whole := array_to_string(words, '');
  if char_length(whole) < 2 or char_length(whole) > 40 then return; end if;
  select array_agg('%' || replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') || '%') into pats from unnest(words) as w;
  -- 색인은 가장 긴 낱말로 타고, 나머지 낱말은 거른다.
  select p into main from unnest(pats) as p order by char_length(p) desc limit 1;
  return query
    select f.sid, f.name, f.maker, f.basis, f.kcal, f.protein, f.carb, f.fat, f.size, f.serv
    from public.processed_foods f
    where f.skey like main
      and f.skey like all (pats)
    order by
      (split_part(f.skey, '|', 1) = whole) desc,
      (f.skey like substr(pats[1], 2)) desc,
      char_length(f.name), f.name, f.sid
    limit least(greatest(coalesce(lim, 30), 1), 50)
    offset greatest(coalesce(off, 0), 0);
end $$;
revoke execute on function public.search_processed_foods(text, integer, integer) from public;
grant execute on function public.search_processed_foods(text, integer, integer) to anon, authenticated;

-- 색인은 자료를 다 올린 뒤에 만든다(같은 파일 아래쪽 — 올리는 순서: 표 → 자료 → 색인).
-- create index processed_foods_key_trgm on public.processed_foods using gin (skey extensions.gin_trgm_ops);
