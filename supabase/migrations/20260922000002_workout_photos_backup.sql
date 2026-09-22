-- 운동 사진 행(동기화) + 파일 저장소(비공개 버킷, 사용자별 폴더) (MCP 마이그레이션 이름: workout_photos_backup)
create table public.workout_photos (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null,
  deleted_at bigint,
  rev bigint not null default 0,
  workout_id text not null,
  path text not null
);
create index workout_photos_user_rev_idx on public.workout_photos (user_id, rev);
alter table public.workout_photos enable row level security;
create policy "own rows select" on public.workout_photos for select to authenticated using ((select auth.uid()) = user_id);
create policy "own rows insert" on public.workout_photos for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "own rows update" on public.workout_photos for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create trigger workout_photos_sync_rev before insert or update on public.workout_photos for each row execute function public.sync_before_write();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('workout-photos', 'workout-photos', false, 2097152, array['image/jpeg']);

create policy "workout photos select own" on storage.objects for select to authenticated
  using (bucket_id = 'workout-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "workout photos insert own" on storage.objects for insert to authenticated
  with check (bucket_id = 'workout-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "workout photos update own" on storage.objects for update to authenticated
  using (bucket_id = 'workout-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'workout-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "workout photos delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'workout-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
