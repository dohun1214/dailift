import { SYNCED_TABLES } from '@/db/schema';
import { supabase } from '@/lib/supabase';

const BUCKET = 'workout-photos';

/**
 * 로그인한 계정의 서버 기록을 모두 지운다(계정은 남긴다).
 * 행은 지워진 것으로 표시(툼스톤)해서 같은 계정의 다른 기기에도 전해지게 하고, 사진 파일은 바로 지운다.
 * 하나라도 실패하면 던진다 — 부르는 쪽은 그때 기기 기록을 지우지 않는다.
 */
export async function wipeServerData(userId: string, now = Date.now()) {
  // 자식 행부터
  for (const table of [...SYNCED_TABLES].reverse()) {
    const { error } = await supabase
      .from(table)
      .update({ deleted_at: now, updated_at: now })
      .eq('user_id', userId)
      .is('deleted_at', null);
    if (error) throw error;
  }
  const bucket = supabase.storage.from(BUCKET);
  for (;;) {
    const { data, error } = await bucket.list(userId, { limit: 1000 });
    if (error) throw error;
    if (!data || data.length === 0) break;
    const { error: removeError } = await bucket.remove(data.map((f) => `${userId}/${f.name}`));
    if (removeError) throw removeError;
    if (data.length < 1000) break;
  }
}
