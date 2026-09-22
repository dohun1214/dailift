import Database from 'better-sqlite3';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import * as schema from '@/db/schema';
import { seedReferenceData } from '@/db/seed';
import { addWorkoutPhoto, deleteWorkoutPhoto } from '@/db/summary';

import { type PhotoFiles, type PhotoStore, photoKey, syncPhotoFiles } from '../photos';

function createDevice() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: 'drizzle' });
  seedReferenceData(db);
  return db;
}

/** 기기 파일 시스템 흉내 */
class FakeFiles implements PhotoFiles {
  constructor(public files = new Set<string>()) {}
  exists = (p: string) => this.files.has(p);
  remove = (p: string) => {
    this.files.delete(p);
  };
}

/** 서버 저장소 흉내: 내려받으면 그 기기 파일 시스템에 파일이 생긴다 */
class FakeStore implements PhotoStore {
  objects = new Set<string>();
  deviceFiles: FakeFiles | null = null;
  async upload(key: string) {
    this.objects.add(key);
  }
  async download(key: string, localPath: string) {
    if (!this.objects.has(key)) throw new Error('not found');
    this.deviceFiles?.files.add(localPath);
  }
  async remove(keys: string[]) {
    for (const k of keys) this.objects.delete(k);
  }
}

let n = 0;
const makeId = () => `p-${++n}`;
const USER = 'user-1';

describe('syncPhotoFiles', () => {
  it('기기에 있는 새 사진은 올리고 다시 올리지 않는다', async () => {
    const db = createDevice();
    const files = new FakeFiles(new Set(['photos/a.jpg']));
    const store = new FakeStore();
    const id = addWorkoutPhoto(db, 'w1', 'photos/a.jpg', makeId);

    expect(await syncPhotoFiles(db, USER, store, files)).toMatchObject({ uploaded: 1, failed: 0 });
    expect(store.objects.has(photoKey(USER, id))).toBe(true);
    expect((await syncPhotoFiles(db, USER, store, files)).uploaded).toBe(0);
    // 업로드 표시는 동기화 대상 변경(dirty)을 만들지 않는다
    const row = db.select().from(schema.workoutPhotos).where(eq(schema.workoutPhotos.id, id)).get();
    expect(row?.uploadedAt).not.toBeNull();
  });

  it('다른 기기에서 온 사진은 내려받고, 서버에 아직 없으면 다음에 다시 시도한다', async () => {
    const db = createDevice();
    const files = new FakeFiles();
    const store = new FakeStore();
    store.deviceFiles = files;
    const id = addWorkoutPhoto(db, 'w1', 'photos/b.jpg', makeId);

    expect((await syncPhotoFiles(db, USER, store, files)).failed).toBe(1);
    store.objects.add(photoKey(USER, id));
    expect((await syncPhotoFiles(db, USER, store, files)).downloaded).toBe(1);
    expect(files.exists('photos/b.jpg')).toBe(true);
  });

  it('지운 사진은 기기·서버 파일을 한 번만 지운다', async () => {
    const db = createDevice();
    const files = new FakeFiles(new Set(['photos/c.jpg']));
    const store = new FakeStore();
    const id = addWorkoutPhoto(db, 'w1', 'photos/c.jpg', makeId);
    await syncPhotoFiles(db, USER, store, files);
    deleteWorkoutPhoto(db, id);

    expect((await syncPhotoFiles(db, USER, store, files)).removed).toBe(1);
    expect(store.objects.size).toBe(0);
    expect(files.exists('photos/c.jpg')).toBe(false);
    expect((await syncPhotoFiles(db, USER, store, files)).removed).toBe(0);
  });
});
