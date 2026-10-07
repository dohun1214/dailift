import { supabase } from '@/lib/supabase';

/**
 * 건강 데이터 동의(식단 기록 백업 · 체성분 기록 백업)는 계정에 적는다 — 서버 `health_consents` 표.
 * 서버는 동의가 없는 계정의 그 표 행을 받지 않고, 동의를 거두면 그 계정의 행을 지운다
 * (`supabase/migrations/20261007000003_health_consents.sql`, `…000008_body_consent.sql`).
 */

export type Consents = { diet: number | null; body: number | null };
const at = (v: unknown) => (typeof v === 'number' ? v : null);

/** 지금 계정이 동의한 시각들. 동의한 적이 없거나 거뒀으면 null */
export async function fetchConsents(): Promise<Consents> {
  const { data, error } = await supabase
    .from('health_consents')
    .select('diet_accepted_at, body_accepted_at')
    .maybeSingle();
  if (error) throw error;
  const row = data as { diet_accepted_at: unknown; body_accepted_at: unknown } | null;
  return { diet: at(row?.diet_accepted_at), body: at(row?.body_accepted_at) };
}

/** 식단: 동의하거나 거둔다. 거두면 서버가 식단 행을 지운다. 바뀐 뒤의 동의 시각을 돌려준다 */
export async function saveDietConsent(accepted: boolean): Promise<number | null> {
  const { data, error } = await supabase.rpc('set_diet_consent', { accepted });
  if (error) throw error;
  return at(data);
}

/** 체성분: 동의하거나 거둔다. 거두면 서버가 체성분 행을 지운다. 바뀐 뒤의 동의 시각을 돌려준다 */
export async function saveBodyConsent(accepted: boolean): Promise<number | null> {
  const { data, error } = await supabase.rpc('set_body_consent', { accepted });
  if (error) throw error;
  return at(data);
}
