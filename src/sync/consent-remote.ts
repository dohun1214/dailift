import { supabase } from '@/lib/supabase';

/**
 * 건강 데이터 동의(식단 기록 백업)는 계정에 적는다 — 서버 `health_consents` 표.
 * 서버는 동의가 없는 계정의 식단 행을 받지 않고, 동의를 거두면 그 계정의 식단 행을 지운다
 * (`supabase/migrations/20261007000003_health_consents.sql`).
 */

/** 지금 계정이 식단 기록 보관에 동의한 시각. 동의한 적이 없거나 거뒀으면 null */
export async function fetchDietConsent(): Promise<number | null> {
  const { data, error } = await supabase
    .from('health_consents')
    .select('diet_accepted_at')
    .maybeSingle();
  if (error) throw error;
  const at = (data as { diet_accepted_at: number | null } | null)?.diet_accepted_at;
  return typeof at === 'number' ? at : null;
}

/** 동의하거나 거둔다. 거두면 서버가 식단 행을 지운다. 바뀐 뒤의 동의 시각을 돌려준다 */
export async function saveDietConsent(accepted: boolean): Promise<number | null> {
  const { data, error } = await supabase.rpc('set_diet_consent', { accepted });
  if (error) throw error;
  return typeof data === 'number' ? data : null;
}
