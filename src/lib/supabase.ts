import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import Storage from 'expo-sqlite/kv-store';
import { AppState } from 'react-native';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from '@/config';

/** Supabase 클라이언트. 세션은 기기의 kv-store에 저장한다. */
export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: {
      getItem: (key: string) => Storage.getItemSync(key),
      setItem: (key: string, value: string) => Storage.setItemSync(key, value),
      removeItem: (key: string) => {
        Storage.removeItemSync(key);
      },
    },
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// 앱이 앞에 있을 때만 토큰을 자동 갱신한다.
AppState.addEventListener('change', (state) => {
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
