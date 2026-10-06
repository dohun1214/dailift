-- 식단 세트: 자주 같이 먹는 음식 묶음(동기화). 앱은 건강 데이터 동의가 있을 때만 올린다 (MCP 마이그레이션 이름: diet_sets)
create table public.food_sets (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  rev bigint not null default 0,
  name text not null
);
create index food_sets_user_rev_idx on public.food_sets (user_id, rev);
alter table public.food_sets enable row level security;
create policy "own rows select" on public.food_sets for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows insert" on public.food_sets for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows update" on public.food_sets for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create trigger food_sets_sync_rev before insert or update on public.food_sets for each row execute function public.sync_before_write();

create table public.food_set_items (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  rev bigint not null default 0,
  set_id text not null,
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
create index food_set_items_user_rev_idx on public.food_set_items (user_id, rev);
alter table public.food_set_items enable row level security;
create policy "own rows select" on public.food_set_items for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows insert" on public.food_set_items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows update" on public.food_set_items for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create trigger food_set_items_sync_rev before insert or update on public.food_set_items for each row execute function public.sync_before_write();
