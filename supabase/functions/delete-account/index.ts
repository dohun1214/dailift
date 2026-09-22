// 계정 삭제: 요청한 사용자 본인의 auth 계정을 지운다.
// 사용자 데이터 테이블은 auth.users를 참조(on delete cascade)하므로 함께 지워진다(#15).
import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'unauthorized' }, 401);

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json({ error: 'unauthorized' }, 401);

  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
  if (deleteError) {
    console.error('delete failed', deleteError.message);
    return json({ error: 'delete_failed' }, 500);
  }
  return json({ ok: true });
});
