import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

type AuthState = {
  session: Session | null;
  /** 저장된 세션을 읽기 전에는 false */
  ready: boolean;
  setSession: (session: Session | null) => void;
};

/** 로그인 상태(메모리). 세션 자체는 Supabase가 kv-store에 저장한다. */
export const useAuth = create<AuthState>()((set) => ({
  session: null,
  ready: false,
  setSession: (session) => set({ session, ready: true }),
}));

export type AccountInfo = { name: string | null; email: string | null; provider: string | null };

/** 세션에서 화면에 보일 계정 정보 */
export function accountInfo(session: Session | null): AccountInfo | null {
  if (!session) return null;
  const { user } = session;
  const meta = user.user_metadata as Record<string, unknown>;
  const name =
    (typeof meta.full_name === 'string' && meta.full_name) ||
    (typeof meta.name === 'string' && meta.name) ||
    null;
  const provider =
    typeof user.app_metadata.provider === 'string' ? user.app_metadata.provider : null;
  return { name, email: user.email ?? null, provider };
}
