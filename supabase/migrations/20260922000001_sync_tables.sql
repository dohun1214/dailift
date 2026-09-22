-- 기기 SQLite를 복제하는 동기화 테이블 (MCP apply_migration으로 적용됨: sync_tables, sync_rev_seq_grant)
-- 행 id는 클라이언트가 만든 UUIDv7(text), 시각은 ms(bigint).
-- rev: 서버가 매기는 증가 번호(당겨오기 커서). updated_at이 더 오래된 쓰기는 무시한다(LWW).
create sequence if not exists public.sync_rev_seq;

create or replace function public.sync_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.updated_at < old.updated_at then
      return old;
    end if;
    new.user_id := old.user_id;
  end if;
  new.rev := nextval('public.sync_rev_seq');
  return new;
end;
$$;

do $$
declare
  t text;
begin
  for t in select unnest(array['exercises','exercise_muscles','routine_groups','routines','routine_exercises','workouts','workout_exercises','sets','body_metrics'])
  loop
    execute format($f$
      create table public.%1$I (
        id text primary key,
        user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
        created_at bigint not null,
        updated_at bigint not null,
        deleted_at bigint,
        rev bigint not null default 0
      )$f$, t);
    execute format('create index %1$I on public.%2$I (user_id, rev)', t || '_user_rev_idx', t);
    execute format('alter table public.%I enable row level security', t);
    execute format($f$create policy "own rows select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)$f$, t);
    execute format($f$create policy "own rows insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)$f$, t);
    execute format($f$create policy "own rows update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)$f$, t);
    execute format('create trigger %I before insert or update on public.%I for each row execute function public.sync_before_write()', t || '_sync_rev', t);
  end loop;
end;
$$;

alter table public.exercises
  add column is_custom integer not null default 1,
  add column name_ko text,
  add column name_en text,
  add column name text,
  add column type text not null,
  add column equipment text not null,
  add column sort_order integer not null default 0;

alter table public.exercise_muscles
  add column exercise_id text not null,
  add column muscle_id text not null,
  add column role text not null;

alter table public.routine_groups
  add column name text not null,
  add column rotation_mode integer not null default 0,
  add column rotation_index integer not null default 0,
  add column template_key text,
  add column sort_order integer not null default 0;

alter table public.routines
  add column group_id text,
  add column name text not null,
  add column weekdays integer not null default 0,
  add column reminder_time text,
  add column sort_order integer not null default 0;

alter table public.routine_exercises
  add column routine_id text not null,
  add column exercise_id text not null,
  add column position integer not null,
  add column target_sets integer not null default 3,
  add column rep_min integer not null default 8,
  add column rep_max integer not null default 12,
  add column rest_sec integer not null default 90,
  add column increment double precision not null default 2.5,
  add column increment_unit text not null default 'kg',
  add column note text;

alter table public.workouts
  add column routine_id text,
  add column name text not null,
  add column status text not null default 'in_progress',
  add column started_at bigint not null,
  add column ended_at bigint,
  add column note text;

alter table public.workout_exercises
  add column workout_id text not null,
  add column exercise_id text not null,
  add column position integer not null,
  add column rest_sec integer not null default 90,
  add column rep_min integer not null default 8,
  add column rep_max integer not null default 12,
  add column increment double precision not null default 2.5,
  add column increment_unit text not null default 'kg',
  add column note text;

alter table public.sets
  add column workout_exercise_id text not null,
  add column position integer not null,
  add column kind text not null default 'working',
  add column weight double precision,
  add column weight_unit text not null default 'kg',
  add column reps integer,
  add column duration_sec integer,
  add column rpe double precision,
  add column completed_at bigint;

alter table public.body_metrics
  add column measured_at bigint not null,
  add column weight double precision,
  add column weight_unit text not null default 'kg',
  add column skeletal_muscle double precision,
  add column body_fat_pct double precision,
  add column source text not null default 'manual';

grant usage on sequence public.sync_rev_seq to authenticated;
revoke all on sequence public.sync_rev_seq from anon;
revoke all on function public.sync_before_write() from public, anon;
