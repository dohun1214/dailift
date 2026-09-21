import { getRandomBytes } from 'expo-crypto';

import { uuidv7 } from './uuid';

/** 앱에서 새 행을 만들 때 쓰는 ID. */
export function newId(): string {
  return uuidv7(getRandomBytes);
}
