import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

import * as schema from './schema';

export const DATABASE_NAME = 'dailift.db';

// enableChangeListener: useLiveQuery가 테이블 변경을 감지하는 데 필요하다.
export const expoDb = openDatabaseSync(DATABASE_NAME, { enableChangeListener: true });
expoDb.execSync('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL;');

export const db = drizzle(expoDb, { schema });
