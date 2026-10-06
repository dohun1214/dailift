-- 식단: 직접 만든 음식, 먹은 기록, 즐겨찾기(동기화). 앱은 건강 데이터 동의가 있을 때만 올린다 (MCP 마이그레이션 이름: diet)
create table public.foods (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  rev bigint not null default 0,
  name text not null,
  serving double precision,
  serving_name text,
  kcal double precision not null default 0,
  protein double precision not null default 0,
  carb double precision not null default 0,
  fat double precision not null default 0
);
create index foods_user_rev_idx on public.foods (user_id, rev);
alter table public.foods enable row level security;
create policy "own rows select" on public.foods for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows insert" on public.foods for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows update" on public.foods for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create trigger foods_sync_rev before insert or update on public.foods for each row execute function public.sync_before_write();

create table public.food_logs (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  rev bigint not null default 0,
  date text not null,
  meal text not null,
  position integer not null default 0,
  src text not null,
  sid text not null,
  name text not null,
  grams double precision not null,
  unit_grams double precision,
  unit_name text,
  basis text not null default 'g',
  kcal double precision not null default 0,
  protein double precision not null default 0,
  carb double precision not null default 0,
  fat double precision not null default 0
);
create index food_logs_user_rev_idx on public.food_logs (user_id, rev);
alter table public.food_logs enable row level security;
create policy "own rows select" on public.food_logs for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows insert" on public.food_logs for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows update" on public.food_logs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create trigger food_logs_sync_rev before insert or update on public.food_logs for each row execute function public.sync_before_write();

create table public.food_favorites (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  rev bigint not null default 0,
  src text not null,
  sid text not null
);
create index food_favorites_user_rev_idx on public.food_favorites (user_id, rev);
alter table public.food_favorites enable row level security;
create policy "own rows select" on public.food_favorites for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows insert" on public.food_favorites for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows update" on public.food_favorites for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create trigger food_favorites_sync_rev before insert or update on public.food_favorites for each row execute function public.sync_before_write();
