import raw from './licenses.json';

/** 앱에 들어간 직접 의존성의 라이선스. 원본은 scripts/gen-licenses.mjs가 만든다. */
export type LicenseEntry = {
  name: string;
  version: string;
  license: string;
  url: string;
  text: string;
};

export const LICENSES: readonly LicenseEntry[] = raw;

export const findLicense = (name: string) => LICENSES.find((l) => l.name === name);
