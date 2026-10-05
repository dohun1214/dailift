import Storage from 'expo-sqlite/kv-store';

import { cleanupRecordedWorkout, deleteWorkout } from '@/db/history';
import type { AppDatabase } from '@/db/seed';

import { removePhotoFile } from './photos';

const KEY = 'pending-added-workout';

/** 지난 날 기록을 추가하는 화면이 열려 있는 동안 그 기록의 id를 적어 둔다. */
export function markPendingAdd(workoutId: string) {
  Storage.setItemSync(KEY, workoutId);
}

export function clearPendingAdd() {
  Storage.removeItemSync(KEY);
}

/**
 * 앱을 켤 때: 추가하던 중에 앱이 꺼져 남은 기록을 정리한다.
 * 체크한 세트가 있으면 그 세트만 남기고, 없으면 기록을 지운다(빈 기록이 그날 운동한 것으로 잡히지 않게).
 */
export function settlePendingAdd(db: AppDatabase) {
  const workoutId = Storage.getItemSync(KEY);
  if (!workoutId) return;
  Storage.removeItemSync(KEY);
  if (cleanupRecordedWorkout(db, workoutId) > 0) return;
  for (const path of deleteWorkout(db, workoutId)) removePhotoFile(path);
}
