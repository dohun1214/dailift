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
import { hasUserData, wipeUserData } from '@/db/wipe';
import { kvStorage } from '@/lib/kv-storage';
import { removePhotoFile } from '@/lib/photos';
import { useAuth } from '@/stores/auth';

import { pendingCount, resetForAccount, syncOnce } from './engine';
import { syncPhotoFiles } from './photos';
import { devicePhotoFiles, supabasePhotoStore } from './supabase-photos';
import { supabaseRemote } from './supabase-remote';

type SyncStatus = 'idle' | 'syncing' | 'error';

type SyncState = {
  status: SyncStatus;
  lastSyncedAt: number | null;
  /** 이 기기의 기록이 지금 로그인한 계정이 아닌 다른 계정의 것이다. 사용자가 정할 때까지 동기화를 멈춘다 */
  otherAccount: boolean;
  setStatus: (status: SyncStatus) => void;
  done: (at: number) => void;
  reset: () => void;
};

export const useSync = create<SyncState>()(
  persist(
    (set) => ({
      status: 'idle',
      lastSyncedAt: null,
      otherAccount: false,
      setStatus: (status) => set({ status }),
      done: (at) => set({ status: 'idle', lastSyncedAt: at }),
      reset: () => set({ status: 'idle', lastSyncedAt: null, otherAccount: false }),
    }),
    {
      name: 'sync',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: (s) => ({ lastSyncedAt: s.lastSyncedAt }),
    },
  ),
);

/**
 * 마지막으로 동기화한 계정. 아직 없으면(게스트로 쓰던 기기) 기기 기록을 전부 새 계정에 올린다.
 * 다른 계정이면 기기의 행이 그 계정 것이라 올릴 수 없다(행 id가 서버에서 그 계정 소유) → 사용자에게 묻는다.
 */
const ACCOUNT_KEY = 'sync-account';
const CHANGE_DELAY_MS = 8_000;

let running: Promise<void> | null = null;
let again = false;
let timer: ReturnType<typeof setTimeout> | null = null;
/** 기록을 통째로 지우는 동안에는 동기화를 멈춘다(지우는 사이에 다시 올리거나 받지 않게) */
let paused = false;

async function run(userId: string) {
  const last = Storage.getItemSync(ACCOUNT_KEY);
  if (last !== userId) {
    if (last && hasUserData(db)) {
      useSync.setState({ status: 'idle', otherAccount: true });
      return;
    }
    // 다른 계정이 남긴 것이 지운 흔적뿐이면(보이는 기록 없음) 묻지 않고 치운다.
    if (last) for (const path of wipeUserData(db)) removePhotoFile(path);
    resetForAccount(db);
    Storage.setItemSync(ACCOUNT_KEY, userId);
  }
  if (useSync.getState().otherAccount) useSync.setState({ otherAccount: false });
  useSync.getState().setStatus('syncing');
  try {
    // 새 사진 파일을 먼저 올리고 → 행 동기화 → 받은 사진 내려받기·지운 사진 정리
    await syncPhotoFiles(db, userId, supabasePhotoStore, devicePhotoFiles);
    await syncOnce(db, supabaseRemote);
    await syncPhotoFiles(db, userId, supabasePhotoStore, devicePhotoFiles);
    useSync.getState().done(Date.now());
  } catch (e) {
    console.warn('[sync] failed', e);
    useSync.getState().setStatus('error');
  }
}

/** 지금 동기화(로그인 안 했으면 아무것도 안 함). 끝나면 resolve. */
export function syncNow(): Promise<void> {
  const userId = useAuth.getState().session?.user.id;
  if (!userId || paused) return Promise.resolve();
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await run(userId);
    } while (again && !paused);
  })().finally(() => {
    running = null;
  });
  return running;
}

/**
 * 기록을 통째로 지우기 전에: 새 동기화를 막고, 돌고 있는 것이 끝날 때까지 기다린다.
 * 끝나면(성공이든 실패든) 반드시 `resumeSync()`를 부른다.
 */
export async function pauseSync(): Promise<void> {
  paused = true;
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  await (running ?? Promise.resolve());
}

export function resumeSync() {
  paused = false;
}

/** 다른 계정의 기록이 남은 기기에서: 기기 기록을 지우고 지금 계정의 기록을 받는다. */
export function replaceWithCurrentAccount(): Promise<void> {
  const userId = useAuth.getState().session?.user.id;
  if (!userId) return Promise.resolve();
  for (const path of wipeUserData(db)) removePhotoFile(path);
  Storage.setItemSync(ACCOUNT_KEY, userId);
  useSync.setState({ otherAccount: false, lastSyncedAt: null });
  return syncNow();
}

/** 아직 서버에 안 보낸 행 수 */
export const unsyncedCount = () => pendingCount(db);

/** 기기 데이터를 지울 때(모든 데이터 삭제·계정 삭제) 동기화 기록도 지운다. */
export function forgetSyncAccount() {
  Storage.removeItemSync(ACCOUNT_KEY);
  useSync.getState().reset();
}

function schedule() {
  if (paused || !useAuth.getState().session) return;
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
    if (!user && useSync.getState().otherAccount) useSync.setState({ otherAccount: false });
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
