import en from '../locales/en.json';
import ko from '../locales/ko.json';
import { resolveLanguage } from '../resolve-language';

function keysOf(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keysOf(v, prefix ? `${prefix}.${k}` : k));
}

describe('locales', () => {
  it('한국어와 영어의 번역 키가 같다', () => {
    expect(keysOf(ko).sort()).toEqual(keysOf(en).sort());
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
