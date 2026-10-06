-- 영양제와 복용 기록(동기화) (MCP 마이그레이션 이름: supplements)
create table public.supplements (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  rev bigint not null default 0,
  name text not null,
  dose text,
  timing text not null default 'time',
  time_min integer not null default 540,
  after_min integer not null default 30,
  notify integer not null default 1,
  renotify integer not null default 1,
  active integer not null default 1,
  sort_order integer not null default 0
);
create index supplements_user_rev_idx on public.supplements (user_id, rev);
alter table public.supplements enable row level security;
create policy "own rows select" on public.supplements for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows insert" on public.supplements for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows update" on public.supplements for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create trigger supplements_sync_rev before insert or update on public.supplements for each row execute function public.sync_before_write();

create table public.supplement_logs (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  rev bigint not null default 0,
  supplement_id text not null,
  date text not null,
  taken_at bigint not null
);
create index supplement_logs_user_rev_idx on public.supplement_logs (user_id, rev);
alter table public.supplement_logs enable row level security;
create policy "own rows select" on public.supplement_logs for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows insert" on public.supplement_logs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows update" on public.supplement_logs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create trigger supplement_logs_sync_rev before insert or update on public.supplement_logs for each row execute function public.sync_before_write();
