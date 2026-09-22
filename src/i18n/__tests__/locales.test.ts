import en from '../locales/en.json';
import ko from '../locales/ko.json';
import { resolveLanguage } from '../resolve-language';

function keysOf(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keysOf(v, prefix ? `${prefix}.${k}` : k));
}

/** 복수형 접미사(_one, _other …)는 언어마다 필요한 형태가 달라서 떼고 비교한다. */
const PLURAL = /_(zero|one|two|few|many|other)$/;
const baseKeys = (value: unknown) =>
  [...new Set(keysOf(value).map((k) => k.replace(PLURAL, '')))].sort();

describe('locales', () => {
  it('한국어와 영어의 번역 키가 같다', () => {
    expect(baseKeys(ko)).toEqual(baseKeys(en));
  });

  it('복수형 키는 _other를 반드시 가진다', () => {
    for (const keys of [keysOf(ko), keysOf(en)]) {
      for (const k of keys.filter((key) => PLURAL.test(key))) {
        expect(keys).toContain(k.replace(PLURAL, '_other'));
      }
    }
  });
});

describe('resolveLanguage', () => {
  it('설정에서 고른 언어가 우선한다', () => {
    expect(resolveLanguage('ko', ['en'])).toBe('ko');
  });

  it('system이면 기기 언어 중 지원하는 첫 언어를 쓴다', () => {
    expect(resolveLanguage('system', ['ja', 'ko', 'en'])).toBe('ko');
  });

  it('지원하는 언어가 없으면 영어를 쓴다', () => {
    expect(resolveLanguage('system', ['ja', null])).toBe('en');
  });
});
