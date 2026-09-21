/**
 * UUIDv7 (RFC 9562): 앞 48비트가 밀리초 타임스탬프라 생성 순서대로 정렬된다.
 * 기기에서 만든 행을 서버와 동기화할 때 충돌 없는 기본 키로 쓴다.
 */
export type RandomBytes = (length: number) => Uint8Array;

export function uuidv7(randomBytes: RandomBytes, now: number = Date.now()): string {
  const bytes = new Uint8Array(16);
  const rand = randomBytes(10);

  // 48비트 타임스탬프 (big-endian). 비트 연산은 32비트라 나눗셈으로 상위 비트를 구한다.
  let ts = Math.floor(now);
  for (let i = 5; i >= 0; i--) {
    bytes[i] = ts % 256;
    ts = Math.floor(ts / 256);
  }
  bytes.set(rand, 6);
  bytes[6] = 0x70 | ((bytes[6] ?? 0) & 0x0f); // version 7
  bytes[8] = 0x80 | ((bytes[8] ?? 0) & 0x3f); // variant 10

  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** UUIDv7에 담긴 생성 시각(ms)을 꺼낸다. */
export function uuidv7Timestamp(id: string): number {
  return Number.parseInt(id.replace(/-/g, '').slice(0, 12), 16);
}
