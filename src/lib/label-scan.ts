import { File, Paths } from 'expo-file-system';

import { type LabelResult, parseLabel } from '@/domain/nutrition-label';

import TextRecognition, { type RecognizedText } from '../../modules/text-recognition';

/** 글자 읽기 모듈이 들어 있는 빌드에서만 성분표 읽기를 보여 준다(빌드 13까지는 없다) */
export const labelScanAvailable = TextRecognition !== null;

export type LabelScan = { result: LabelResult; raw: RecognizedText };

/**
 * 영양성분표 사진에서 글자를 읽고(기기 안에서만) 칸에 넣을 값을 찾는다.
 * 사진 고르기 · 지우기는 결과지와 같다(`pickSheet` · `discardSheet`).
 */
export async function readLabel(uri: string): Promise<LabelScan> {
  if (!TextRecognition) throw new Error('text recognition is not available in this build');
  const raw = await TextRecognition.recognize(uri);
  if (__DEV__) dumpRaw(raw);
  return { result: parseLabel(raw.lines), raw };
}

/** 개발 중에만: 읽은 글자를 임시 폴더에 적어 둔다(인식 결과를 꺼내 보는 용도) */
function dumpRaw(raw: RecognizedText) {
  try {
    const file = new File(Paths.cache, 'label-ocr.json');
    if (file.exists) file.delete();
    file.create();
    file.write(JSON.stringify(raw));
  } catch (e) {
    console.warn('[label] dump failed', e);
  }
}
