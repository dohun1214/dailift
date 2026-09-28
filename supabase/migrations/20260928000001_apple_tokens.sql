-- Apple 로그인 refresh token 보관 (계정 삭제 때 Apple에 revoke하기 위함, App Store 심사 기준 5.1.1(v)).
-- 서비스 롤(Edge Function)만 읽고 쓴다. 계정이 지워지면 함께 지워진다.
create table public.apple_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);
alter table public.apple_tokens enable row level security;
revoke all on public.apple_tokens from anon, authenticated;

-- Sign in with Apple 키(teamId·keyId·clientId·privateKey JSON)는 Vault의 'apple_siwa'에 둔다.
-- Edge Function이 서비스 롤로만 읽을 수 있다.
create or replace function public.apple_siwa_config()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret::jsonb from vault.decrypted_secrets where name = 'apple_siwa' limit 1;
$$;
revoke execute on function public.apple_siwa_config() from public, anon, authenticated;
grant execute on function public.apple_siwa_config() to service_role;
