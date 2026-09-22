/**
 * 언제 동기화할지: 로그인 직후, 앱이 앞으로 올 때, 기록이 바뀌고 잠시 뒤, 설정에서 직접.
 * 한 번에 하나만 돌고, 도는 중에 요청이 오면 끝난 뒤 한 번 더 돈다.
 */

import { addDatabaseChangeListener } from 'expo-sqlite';
import Storage from 'expo-sqlite/kv-store';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { db } from '@/db/client';
import { SYNCED_TABLES } from '@/db/schema';
import { kvStorage } from '@/lib/kv-storage';
import { useAuth } from '@/stores/auth';

import { pendingCount, resetForAccount, syncOnce } from './engine';
import { supabaseRemote } from './supabase-remote';

type SyncStatus = 'idle' | 'syncing' | 'error';

type SyncState = {
  status: SyncStatus;
  lastSyncedAt: number | null;
  setStatus: (status: SyncStatus) => void;
  done: (at: number) => void;
  reset: () => void;
};

export const useSync = create<SyncState>()(
  persist(
    (set) => ({
      status: 'idle',
      lastSyncedAt: null,
      setStatus: (status) => set({ status }),
      done: (at) => set({ status: 'idle', lastSyncedAt: at }),
      reset: () => set({ status: 'idle', lastSyncedAt: null }),
    }),
    {
      name: 'sync',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: (s) => ({ lastSyncedAt: s.lastSyncedAt }),
    },
  ),
);

/** 마지막으로 동기화한 계정. 다른 계정으로 로그인하면 기기 기록을 전부 새 계정에 올린다. */
const ACCOUNT_KEY = 'sync-account';
const CHANGE_DELAY_MS = 8_000;

let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | null = null;

async function run(userId: string) {
  if (Storage.getItemSync(ACCOUNT_KEY) !== userId) {
    resetForAccount(db);
    Storage.setItemSync(ACCOUNT_KEY, userId);
  }
  useSync.getState().setStatus('syncing');
  try {
    await syncOnce(db, supabaseRemote);
    useSync.getState().done(Date.now());
  } catch (e) {
    console.warn('[sync] failed', e);
    useSync.getState().setStatus('error');
  }
}

/** 지금 동기화(로그인 안 했으면 아무것도 안 함). 끝나면 resolve. */
export function syncNow(): Promise<void> {
  const userId = useAuth.getState().session?.user.id;
  if (!userId) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await run(userId);
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

/** 아직 서버에 안 보낸 행 수 */
export const unsyncedCount = () => pendingCount(db);

/** 기기 데이터를 지울 때(모든 데이터 삭제·계정 삭제) 동기화 기록도 지운다. */
export function forgetSyncAccount() {
  Storage.removeItemSync(ACCOUNT_KEY);
  useSync.getState().reset();
}

function schedule() {
  if (!useAuth.getState().session) return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    void syncNow();
  }, CHANGE_DELAY_MS);
}

let started = false;

/** 앱 시작 때 한 번 */
export function startSync() {
  if (started) return;
  started = true;
  let lastUser = useAuth.getState().session?.user.id ?? null;
  useAuth.subscribe((s) => {
    const user = s.session?.user.id ?? null;
    if (user && user !== lastUser) void syncNow();
    lastUser = user;
  });
  AppState.addEventListener('change', (state) => {
    if (state === 'active') void syncNow();
  });
  const tables = new Set<string>(SYNCED_TABLES);
  addDatabaseChangeListener((e) => {
    // 받기로 생긴 변경은 다시 부르지 않는다
    if (!running && tables.has(e.tableName)) schedule();
  });
}
