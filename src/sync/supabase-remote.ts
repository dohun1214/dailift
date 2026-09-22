import { supabase } from '@/lib/supabase';

import type { RemoteRow, SyncRemote } from './engine';

/** 서버 테이블 = 기기 테이블과 같은 컬럼 + user_id(기본값 auth.uid()) + rev. RLS로 본인 행만. */
export const supabaseRemote: SyncRemote = {
  async push(table, rows) {
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  },
  async pull(table, afterRev, limit) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .gt('rev', afterRev)
      .order('rev', { ascending: true })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as RemoteRow[];
  },
};
