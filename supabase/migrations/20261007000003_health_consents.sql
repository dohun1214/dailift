-- 건강 데이터 동의(식단 기록 백업): 계정마다 한 줄. (MCP 마이그레이션 이름: health_consents)
-- 동의가 있어야 식단 표에 쓸 수 있고, 동의를 거두면 그 계정의 식단 행을 서버에서 지운다.
-- 적용: 표 · 정책 · has_diet_consent는 MCP로, set_diet_consent 함수는 대시보드 SQL 편집기로 넣었다
--   (함수 안의 delete 때문에 MCP가 승인 창을 요구하는데 원격 작업에서는 그 창이 뜨지 않는다).
create table public.health_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  -- 식단 기록 보관에 동의한 시각(ms). null이면 동의 없음
  diet_accepted_at bigint,
  updated_at bigint not null
);
alter table public.health_consents enable row level security;
-- 읽기만 직접 한다. 쓰기는 아래 set_diet_consent 함수로만.
create policy "own row select" on public.health_consents for select to authenticated using ((select auth.uid()) = user_id);

create function public.has_diet_consent() returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.health_consents
    where user_id = (select auth.uid()) and diet_accepted_at is not null
  );
$$;
revoke execute on function public.has_diet_consent() from public, anon;
grant execute on function public.has_diet_consent() to authenticated;

-- 동의 없이는 식단 표에 넣거나 고칠 수 없다(앱이 잘못 보내도 서버가 막는다).
do $$
declare t text;
begin
  foreach t in array array['foods', 'food_logs', 'food_favorites', 'food_sets', 'food_set_items'] loop
    execute format('create policy "diet consent insert" on public.%I as restrictive for insert to authenticated with check ((select public.has_diet_consent()))', t);
    execute format('create policy "diet consent update" on public.%I as restrictive for update to authenticated with check ((select public.has_diet_consent()))', t);
  end loop;
end $$;

-- 동의하기 · 거두기. 거두면 식단 행을 바로 지운다(기기의 기록은 앱이 그대로 둔다). 지금의 동의 시각을 돌려준다.
create function public.set_diet_consent(accepted boolean) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  insert into public.health_consents as c (user_id, diet_accepted_at, updated_at)
  values (uid, case when accepted then now_ms end, now_ms)
  on conflict (user_id) do update set
    diet_accepted_at = case when accepted then coalesce(c.diet_accepted_at, excluded.diet_accepted_at) end,
    updated_at = excluded.updated_at;
  if not accepted then
    delete from public.food_set_items where user_id = uid;
    delete from public.food_sets where user_id = uid;
    delete from public.food_favorites where user_id = uid;
    delete from public.food_logs where user_id = uid;
    delete from public.foods where user_id = uid;
  end if;
  return (select diet_accepted_at from public.health_consents where user_id = uid);
end $$;
revoke execute on function public.set_diet_consent(boolean) from public, anon;
grant execute on function public.set_diet_consent(boolean) to authenticated;
