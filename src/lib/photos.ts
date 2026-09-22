import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { newId } from './id';

const PHOTO_DIR = 'photos';

/** 저장된 상대 경로 → 표시용 file:// uri */
export function photoUri(path: string): string {
  return new File(Paths.document, path).uri;
}

export type PhotoSource = 'camera' | 'library';

/**
 * 사진을 고르거나 찍어서 앱 폴더(documentDirectory/photos)에 복사하고 상대 경로를 돌려준다.
 * 취소하거나 권한이 없으면 null. 원본 사진은 건드리지 않는다.
 */
export async function pickPhoto(source: PhotoSource): Promise<string | null> {
  const permission =
    source === 'camera'
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 0.8,
    exif: false,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  const asset = result.canceled ? undefined : result.assets[0];
  if (!asset) return null;

  const dir = new Directory(Paths.document, PHOTO_DIR);
  dir.create({ idempotent: true, intermediates: true });
  const ext =
    (asset.uri.split('.').pop() ?? 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const relative = `${PHOTO_DIR}/${newId()}.${ext}`;
  new File(asset.uri).copy(new File(Paths.document, relative));
  return relative;
}

/** 앱 폴더의 사진 파일 삭제 (없으면 무시) */
export function removePhotoFile(path: string) {
  try {
    const f = new File(Paths.document, path);
    if (f.exists) f.delete();
  } catch {
    // 이미 지워짐
  }
}
