/**
 * 운동 사진 파일 동기화. 행(workout_photos)은 일반 동기화로 오가고, 파일은 여기서 저장소와 맞춘다.
 * - 살아 있는 사진: 기기에 파일이 있고 아직 안 올렸으면 올린다, 기기에 없으면 내려받는다.
 * - 지운 사진: 기기 파일과 서버 파일을 지운다(uploaded_at = -1이면 정리 끝).
 * 파일·저장소 접근은 주입받아서 테스트에서는 가짜를 쓴다.
 */
import { sql } from 'drizzle-orm';

import type { AppDatabase } from '@/db/seed';

export interface PhotoStore {
  upload(key: string, localPath: string): Promise<void>;
  download(key: string, localPath: string): Promise<void>;
  remove(keys: string[]): Promise<void>;
}

export interface PhotoFiles {
  exists(localPath: string): boolean;
  remove(localPath: string): void;
}

/** 저장소 경로: 사용자별 폴더 (RLS가 첫 폴더 이름 = 사용자 id로 막는다) */
export const photoKey = (userId: string, photoId: string) => `${userId}/${photoId}.jpg`;

/** 서버 파일까지 정리한 툼스톤 표시 */
const CLEANED = -1;

type Row = { id: string; path: string; deleted_at: number | null; uploaded_at: number | null };

export type PhotoSyncResult = {
  uploaded: number;
  downloaded: number;
  removed: number;
  failed: number;
};

export async function syncPhotoFiles(
  db: AppDatabase,
  userId: string,
  store: PhotoStore,
  files: PhotoFiles,
  now = () => Date.now(),
): Promise<PhotoSyncResult> {
  const rows = db.all<Row>(sql`SELECT id, path, deleted_at, uploaded_at FROM workout_photos`);
  const mark = (id: string, value: number | null) =>
    db.run(sql`UPDATE workout_photos SET uploaded_at = ${value} WHERE id = ${id}`);
  const result: PhotoSyncResult = { uploaded: 0, downloaded: 0, removed: 0, failed: 0 };
  const toRemove: Row[] = [];

  for (const r of rows) {
    const key = photoKey(userId, r.id);
    try {
      if (r.deleted_at !== null) {
        if (files.exists(r.path)) files.remove(r.path);
        if (r.uploaded_at !== CLEANED) toRemove.push(r);
      } else if (files.exists(r.path)) {
        if (r.uploaded_at === null) {
          await store.upload(key, r.path);
          mark(r.id, now());
          result.uploaded += 1;
        }
      } else {
        // 다른 기기에서 온 사진(또는 지워진 파일): 서버에서 받는다. 아직 안 올라왔으면 다음에 다시.
        await store.download(key, r.path);
        mark(r.id, now());
        result.downloaded += 1;
      }
    } catch (e) {
      console.warn('[photos] sync failed', r.id, e);
      result.failed += 1;
    }
  }

  if (toRemove.length > 0) {
    try {
      await store.remove(toRemove.map((r) => photoKey(userId, r.id)));
      for (const r of toRemove) mark(r.id, CLEANED);
      result.removed = toRemove.length;
    } catch (e) {
      console.warn('[photos] remove failed', e);
      result.failed += toRemove.length;
    }
  }
  return result;
}
