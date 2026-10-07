-- 체성분 기록의 골라 적는 값(JSON 글자): 기기의 drizzle/0010_body_extras.sql과 같은 칸. (MCP 마이그레이션 이름: body_extras)
-- BMI · 기초대사량 · 내장지방 레벨 · 복부지방률 · 체수분 · 단백질 · 무기질 · 부위별 근육량.
-- 체성분 표는 백업 동의 화면을 만들기 전까지 앱이 올리지 않는다(칸만 먼저 맞춰 둔다).
alter table public.body_metrics add column extras text;
