-- 체성분 기록 백업 동의: 식단과 따로 받는다. (MCP 마이그레이션 이름: body_consent)
-- 동의가 있어야 body_metrics에 쓸 수 있고, 동의를 거두면 그 계정의 체성분 행을 서버에서 지운다.
-- 적용: 칸 · has_body_consent · 정책은 MCP로, set_body_consent 함수는 대시보드 SQL 편집기로 넣는다
--   (함수 안의 delete 때문에 MCP가 승인 창을 요구하는데 원격 작업에서는 그 창이 뜨지 않는다 — 식단 때와 같다).
alter table public.health_consents add column body_accepted_at bigint;

create function public.has_body_consent() returns boolean
language sql stable security invoker set search_path = '' as $$
  select exists (
    select 1 from public.health_consents
    where user_id = (select auth.uid()) and body_accepted_at is not null
  );
$$;
revoke execute on function public.has_body_consent() from public, anon;
grant execute on function public.has_body_consent() to authenticated;

-- 동의 없이는 체성분 표에 넣거나 고칠 수 없다(앱이 잘못 보내도 서버가 막는다).
create policy "body consent insert" on public.body_metrics as restrictive for insert to authenticated with check ((select public.has_body_consent()));
create policy "body consent update" on public.body_metrics as restrictive for update to authenticated with check ((select public.has_body_consent()));

-- 동의하기 · 거두기. 거두면 체성분 행을 바로 지운다(기기의 기록은 앱이 그대로 둔다). 지금의 동의 시각을 돌려준다.
create function public.set_body_consent(accepted boolean) returns bigint
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := (select auth.uid());
  now_ms bigint := (extract(epoch from clock_timestamp()) * 1000)::bigint;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  insert into public.health_consents as c (user_id, body_accepted_at, updated_at)
  values (uid, case when accepted then now_ms end, now_ms)
  on conflict (user_id) do update set
    body_accepted_at = case when accepted then coalesce(c.body_accepted_at, excluded.body_accepted_at) end,
    updated_at = excluded.updated_at;
  if not accepted then
    delete from public.body_metrics where user_id = uid;
  end if;
  return (select body_accepted_at from public.health_consents where user_id = uid);
end $$;
revoke execute on function public.set_body_consent(boolean) from public, anon;
grant execute on function public.set_body_consent(boolean) to authenticated;
