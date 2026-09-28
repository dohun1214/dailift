// Apple 로그인 직후 앱이 authorizationCode를 보내면 refresh token으로 바꿔 보관한다.
// 계정 삭제(delete-account) 때 이 토큰으로 Apple 연결을 끊는다.
import { createClient } from 'npm:@supabase/supabase-js@2';

import { exchangeCode, loadAppleConfig } from '../_shared/apple.ts';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);
  const { code } = await req.json().catch(() => ({ code: null }));
  if (typeof code !== 'string' || code.length === 0) return json({ error: 'bad_request' }, 400);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json({ error: 'unauthorized' }, 401);
  if (!data.user.identities?.some((i) => i.provider === 'apple')) {
    return json({ error: 'not_apple_user' }, 400);
  }

  const cfg = await loadAppleConfig(admin);
  if (!cfg) return json({ error: 'not_configured' }, 500);
  const refreshToken = await exchangeCode(cfg, code);
  if (!refreshToken) return json({ error: 'exchange_failed' }, 502);

  const { error: saveError } = await admin.from('apple_tokens').upsert({
    user_id: data.user.id,
    refresh_token: refreshToken,
    updated_at: new Date().toISOString(),
  });
  if (saveError) {
    console.error('save failed', saveError.message);
    return json({ error: 'save_failed' }, 500);
  }
  return json({ ok: true });
});
