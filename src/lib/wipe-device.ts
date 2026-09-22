import { db } from '@/db/client';
import { wipeUserData } from '@/db/wipe';
import { useProfile } from '@/stores/profile';
import { useRestTimer } from '@/stores/rest-timer';
import { useSettings } from '@/stores/settings';

import { removePhotoFile } from './photos';

/** 이 기기의 기록·사진·설정을 모두 지운다(모든 데이터 삭제, 계정 삭제 공용). */
export function wipeDevice() {
  useRestTimer.getState().stop();
  for (const path of wipeUserData(db)) removePhotoFile(path);
  useSettings.getState().reset();
  useProfile.getState().reset();
}
