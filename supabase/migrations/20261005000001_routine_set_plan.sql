-- 루틴 종목의 세트별 계획(JSON 문자열). null이면 세트 수 · 횟수 범위로 정한 종목.
alter table public.routine_exercises
  add column set_plan text;
