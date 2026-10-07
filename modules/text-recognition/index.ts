import { requireOptionalNativeModule } from 'expo';

/** 사진에서 읽은 글자 한 덩이. 위치는 사진 크기에 대한 비율(0~1)이고 왼쪽 위가 (0, 0) */
export type RecognizedWord = { text: string; x: number; y: number; w: number; h: number };
/** 한 줄(엔진이 한 덩어리로 본 글자들)과 그 안의 낱말 */
export type RecognizedLine = RecognizedWord & { words: RecognizedWord[] };
export type RecognizedText = { width: number; height: number; lines: RecognizedLine[] };

type TextRecognitionModule = {
  /** 사진 파일(file:// 또는 content:// 주소)에서 글자를 읽는다. 기기 안에서만 처리한다 */
  recognize(uri: string): Promise<RecognizedText>;
};

/**
 * 기기 안에서 글자를 읽는다 — iOS는 Vision, 안드로이드는 ML Kit(한국어).
 * 이 모듈이 들어 있지 않은 빌드(빌드 13까지)에서는 null
 */
export default requireOptionalNativeModule<TextRecognitionModule>('TextRecognition');
