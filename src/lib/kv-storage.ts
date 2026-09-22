import Storage from 'expo-sqlite/kv-store';
import type { StateStorage } from 'zustand/middleware';

/**
 * zustand persist용 저장소. 동기 API를 써서 첫 렌더 전에 값이 채워지게 한다
 * (테마·온보딩 상태가 잠깐 기본값으로 보였다가 바뀌는 깜빡임 방지).
 */
export const kvStorage: StateStorage = {
  getItem: (name) => Storage.getItemSync(name),
  setItem: (name, value) => Storage.setItemSync(name, value),
  removeItem: (name) => {
    Storage.removeItemSync(name);
  },
};
