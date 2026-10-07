-- 해외 포장 제품 검색: USDA FoodData Central의 Branded Foods(CC0) 약 38만 개. 누구나 읽기만 한다(공개 자료). (MCP 마이그레이션 이름: branded_foods)
-- 자료 만들기: scripts/build-branded-foods.mjs, 올리기: TABLE=branded_foods node scripts/load-processed-foods.mjs <TSV>
-- (잠깐 여는 넣기 정책 "temp load" · "temp load update"를 쓴다 — 올린 뒤에는 닫아 둔다. processed_foods와 같은 방식.)
create table public.branded_foods (
  sid text primary key,          -- 바코드(GTIN)
  name text not null,
  maker text not null default '',-- 브랜드(없으면 브랜드 주인)
  basis text not null default 'g', -- 'g' | 'ml'
  kcal real not null,            -- 아래 넷은 100 g(ml)당
  protein real not null,
  carb real not null,
  fat real not null,
  size real,                     -- 쓰지 않는다(포장 무게는 원본이 글자라 믿기 어렵다). processed_foods와 모양을 맞추려고 둔다
  serv real,                     -- 라벨의 1회 제공량
  -- 찾을 때 견주는 글자: " 이름 | 브랜드"를 소문자로, 쉼표 · 가운뎃점은 띄어쓰기로. 낱말 사이 띄어쓰기는 남긴다(낱말의 처음인지 보려고).
  skey text generated always as (' ' || lower(btrim(regexp_replace(name || ' | ' || maker, '[\s,·]+', ' ', 'g')))) stored
);
alter table public.branded_foods enable row level security;
create policy "anyone can read" on public.branded_foods for select to anon, authenticated using (true);
create policy "temp load" on public.branded_foods for insert to anon with check (false);
create policy "temp load update" on public.branded_foods for update to anon using (false) with check (false);

-- 낱말이 모두 들어 있는 것을 찾는다(이름 또는 브랜드). 가장 긴 낱말이 세 글자 이상일 때만
-- (두 글자는 색인을 못 타 3초 제한에 걸린다 — "ch"는 수만 개).
-- 순서: 이름이 검색어와 같음 → 브랜드가 검색어로 시작 → 이름이 검색어로 시작 → 모든 낱말이 낱말의 처음에서 맞음 → 짧은 이름.
create function public.search_branded_foods(q text, lim integer default 30, off integer default 0)
returns table (sid text, name text, maker text, basis text, kcal real, protein real, carb real, fat real, size real, serv real)
language plpgsql stable security invoker set search_path = '' as $$
declare
  words text[];
  pats text[];
  starts text[];
  main text;
  whole text;
  brand text;
begin
  select array_agg(w) into words from (
    select lower(regexp_replace(x, '[,·|]+', '', 'g')) as w
    from unnest(regexp_split_to_array(trim(coalesce(q, '')), '\s+')) as x
  ) s where w <> '';
  if words is null then return; end if;
  words := words[1:5];
  whole := array_to_string(words, ' ');
  if char_length(whole) > 40 then return; end if;
  select array_agg('%' || e || '%'), array_agg('% ' || e || '%') into pats, starts from (
    select replace(replace(replace(w, '\', '\\'), '%', '\%'), '_', '\_') as e from unnest(words) as w
  ) s;
  -- 색인은 가장 긴 낱말로 타고, 나머지 낱말은 거른다.
  select p into main from unnest(pats) as p order by char_length(p) desc limit 1;
  if char_length(main) < 5 then return; end if; -- 앞뒤 % 두 개를 뺀 길이가 3
  brand := replace(replace(replace(whole, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  return query
    select f.sid, f.name, f.maker, f.basis, f.kcal, f.protein, f.carb, f.fat, f.size, f.serv
    from public.branded_foods f
    where f.skey like main
      and f.skey like all (pats)
    order by
      (btrim(split_part(f.skey, ' | ', 1)) = whole) desc,
      (split_part(f.skey, ' | ', 2) like brand) desc,
      (f.skey like ' ' || substr(pats[1], 2)) desc,
      (f.skey like all (starts)) desc,
      char_length(f.name), f.name, f.sid
    limit least(greatest(coalesce(lim, 30), 1), 50)
    offset greatest(coalesce(off, 0), 0);
end $$;
revoke execute on function public.search_branded_foods(text, integer, integer) from public;
grant execute on function public.search_branded_foods(text, integer, integer) to anon, authenticated;

-- 색인은 자료를 다 올린 뒤에 만든다(올리는 순서: 표 → 자료 → 색인). (MCP 마이그레이션 이름: branded_foods_index)
-- create index branded_foods_key_trgm on public.branded_foods using gin (skey extensions.gin_trgm_ops);
