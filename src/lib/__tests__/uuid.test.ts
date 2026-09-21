import { randomBytes } from 'node:crypto';

import { uuidv7, uuidv7Timestamp } from '../uuid';

const rand = (n: number) => new Uint8Array(randomBytes(n));

describe('uuidv7', () => {
  it('RFC 9562 형식(버전 7, variant 10)을 따른다', () => {
    const id = uuidv7(rand);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('생성 시각을 앞 48비트에 담는다', () => {
    const now = 1_790_000_000_123;
    expect(uuidv7Timestamp(uuidv7(rand, now))).toBe(now);
  });

  it('시각이 뒤인 ID가 문자열 정렬에서도 뒤에 온다', () => {
    const a = uuidv7(rand, 1_000);
    const b = uuidv7(rand, 1_001);
    expect([b, a].sort()).toEqual([a, b]);
  });

  it('같은 밀리초에도 충돌하지 않는다', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => uuidv7(rand, 5)));
    expect(ids.size).toBe(1000);
  });
});
