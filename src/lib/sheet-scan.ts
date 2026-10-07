import { File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { parseSheet, type SheetResult } from '@/domain/inbody';

import TextRecognition, { type RecognizedText } from '../../modules/text-recognition';

/** 글자 읽기 모듈이 들어 있는 빌드에서만 결과지 읽기를 보여 준다(빌드 13까지는 없다) */
export const sheetScanAvailable = TextRecognition !== null;

export type SheetSource = 'camera' | 'library';

/**
 * 결과지 사진을 찍거나 고른다. 취소하면 null, 카메라 권한이 없으면 'denied'.
 * 사진은 앱의 임시 폴더에만 있고, 다 읽은 뒤 `discardSheet`로 지운다.
 */
export async function pickSheet(source: SheetSource): Promise<string | 'denied' | null> {
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return 'denied';
  }
  // 작은 글씨를 읽어야 해서 줄이지 않는다.
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    exif: false,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? null : (result.assets[0]?.uri ?? null);
}

export type SheetScan = { result: SheetResult; raw: RecognizedText };

/** 사진에서 글자를 읽고(기기 안에서만) 체성분 값을 찾는다. `today`는 YYYY-MM-DD */
export async function readSheet(uri: string, today: string): Promise<SheetScan> {
  if (!TextRecognition) throw new Error('text recognition is not available in this build');
  const raw = await TextRecognition.recognize(uri);
  if (__DEV__) dumpRaw(raw);
  // 세로 ÷ 가로: 기운 사진을 바로 세워 읽는 데 쓴다.
  const aspect = raw.width > 0 && raw.height > 0 ? raw.height / raw.width : undefined;
  return { result: parseSheet(raw.lines, today, aspect), raw };
}

/** 읽고 난 사진 파일을 지운다(없으면 무시). 결과지 사진은 보관하지 않는다 */
export function discardSheet(uri: string | null) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    // 이미 지워졌거나 앱 밖의 파일이다
  }
}

/** 개발 중에만: 읽은 글자를 임시 폴더에 적어 둔다(인식 결과를 꺼내 보는 용도) */
function dumpRaw(raw: RecognizedText) {
  try {
    const file = new File(Paths.cache, 'sheet-ocr.json');
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(raw));
  } catch (e) {
    console.warn('[sheet] dump failed', e);
  }
}
