import { deleteDatabaseAsync, importDatabaseFromAssetAsync, openDatabaseSync } from 'expo-sqlite';

import type { FoodDb } from './catalog';

/**
 * 앱에 넣은 음식 DB의 판 번호. `assets/food/foods.db`를 새로 만들면 올린다
 * (기기에는 판마다 다른 이름으로 복사하므로, 올리지 않으면 예전 파일을 계속 쓴다).
 */
export const FOOD_DB_VERSION = 1;

const fileName = (version: number) => `foods-v${version}.db`;

let opening: Promise<FoodDb> | null = null;

/**
 * 음식 DB를 연다. 처음 한 번은 앱에 든 파일을 기기의 DB 폴더로 복사한다(그다음부터는 바로 연다).
 * 사용자 기록(`dailift.db`)과 다른 파일이라 앱을 업데이트할 때 음식만 갈아 끼울 수 있고, 지워져도 다시 복사된다.
 * 실패하면 다음에 부를 때 다시 시도한다.
 */
export function openFoodDb(): Promise<FoodDb> {
  if (opening) return opening;
  const next = open().catch((e) => {
    opening = null;
    throw e;
  });
  opening = next;
  return next;
}

async function open(): Promise<FoodDb> {
  const name = fileName(FOOD_DB_VERSION);
  await importDatabaseFromAssetAsync(name, {
    assetId: require('../../assets/food/foods.db'),
  });
  const db = openDatabaseSync(name);
  // 예전 판의 파일은 지운다(없으면 그냥 넘어간다).
  for (let v = 1; v < FOOD_DB_VERSION; v++) {
    void deleteDatabaseAsync(fileName(v)).catch(() => {});
  }
  return { all: <T>(sql: string, params: (string | number)[]) => db.getAllSync<T>(sql, params) };
}
