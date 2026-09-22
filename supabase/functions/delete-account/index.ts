// 계정 삭제: 요청한 사용자 본인의 사진 파일과 auth 계정을 지운다.
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

  // 사진 파일은 cascade로 지워지지 않으므로 먼저 지운다(workout-photos/<user>/…).
  const bucket = admin.storage.from('workout-photos');
  for (;;) {
    const { data: files, error: listError } = await bucket.list(data.user.id, { limit: 1000 });
    if (listError) {
      console.error('list failed', listError.message);
      return json({ error: 'delete_failed' }, 500);
    }
    if (!files || files.length === 0) break;
    const { error: removeError } = await bucket.remove(
      files.map((f) => `${data.user.id}/${f.name}`),
    );
    if (removeError) {
      console.error('remove failed', removeError.message);
      return json({ error: 'delete_failed' }, 500);
    }
    if (files.length < 1000) break;
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
  if (deleteError) {
    console.error('delete failed', deleteError.message);
    return json({ error: 'delete_failed' }, 500);
  }
  return json({ ok: true });
});
