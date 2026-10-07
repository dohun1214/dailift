-- 지운 기록(툼스톤)은 내용을 비운다 (MCP apply_migration으로 적용됨: scrub_tombstones)
-- 삭제는 다른 기기에 알리려고 행을 남기고 지운 시각만 적는데, 그 행에 내용(이름 · 무게 · 음식 · 체성분 …)이 그대로 남아 있었다.
-- 이제 지운 시각이 적힌 행을 쓸 때 서버가 내용을 비운다. 남는 것: id, 부모를 가리키는 id, 시각(만든 · 고친 · 지운), 종류처럼 내용이 아닌 칸.
-- 직접 만든 종목(exercises)은 비우지 않는다: 종목을 지워도 지난 운동 기록이 그 이름을 계속 보여 줘야 한다('모든 데이터 삭제' 때는 앱이 이름까지 비워서 보낸다).
-- 지운 기기에는 영향이 없다(같은 버전은 다시 받지 않으므로 되돌리기가 그대로 된다). 사진 행의 path는 다른 기기가 파일을 치우는 데 써서 남긴다.
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
  if new.deleted_at is not null then
    case tg_table_name
      when 'routine_groups' then
        new.name := '';
      when 'routines' then
        new.name := ''; new.weekdays := 0; new.reminder_time := null;
      when 'routine_exercises' then
        new.note := null; new.set_plan := null;
      when 'workouts' then
        new.name := ''; new.note := null; new.started_at := 0; new.ended_at := null;
      when 'workout_exercises' then
        new.note := null;
      when 'sets' then
        new.weight := null; new.reps := null; new.duration_sec := null; new.rpe := null;
        new.completed_at := null; new.distance := null; new.speed := null; new.incline := null;
      when 'body_metrics' then
        new.measured_at := 0; new.weight := null; new.skeletal_muscle := null;
        new.body_fat_pct := null; new.extras := null;
      when 'supplements' then
        new.name := ''; new.dose := null;
      when 'supplement_logs' then
        new.date := ''; new.taken_at := 0;
      when 'foods' then
        new.name := ''; new.serving := null; new.serving_name := null;
        new.kcal := 0; new.protein := 0; new.carb := 0; new.fat := 0;
      when 'food_logs' then
        new.date := ''; new.sid := ''; new.name := ''; new.grams := 0;
        new.unit_grams := null; new.unit_name := null;
        new.kcal := 0; new.protein := 0; new.carb := 0; new.fat := 0;
      when 'food_favorites' then
        new.sid := '';
      when 'food_sets' then
        new.name := '';
      when 'food_set_items' then
        new.sid := ''; new.name := ''; new.grams := 0;
        new.unit_grams := null; new.unit_name := null;
        new.kcal := 0; new.protein := 0; new.carb := 0; new.fat := 0;
      else
        null;
    end case;
  end if;
  new.rev := nextval('public.sync_rev_seq');
  return new;
end;
$$;

-- 이미 남아 있는 지운 기록도 한 번 비운다(같은 시각으로 다시 써서 위 함수가 돌게 한다).
do $$
declare
  t text;
begin
  for t in select unnest(array['exercises','exercise_muscles','routine_groups','routines','routine_exercises','workouts','workout_exercises','sets','workout_photos','body_metrics','supplements','supplement_logs','foods','food_logs','food_favorites','food_sets','food_set_items'])
  loop
    execute format('update public.%I set updated_at = updated_at where deleted_at is not null', t);
  end loop;
end;
$$;
