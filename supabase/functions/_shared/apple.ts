// Sign in with Apple 토큰 교환·폐기 (계정 삭제 시 revoke — App Store 심사 기준 5.1.1(v)).
// 키는 Vault 'apple_siwa'(public.apple_siwa_config(), 서비스 롤 전용)에 있다.
import type { SupabaseClient } from 'npm:@supabase/supabase-js@2';

type SiwaConfig = { teamId: string; keyId: string; clientId: string; privateKey: string };

const APPLE = 'https://appleid.apple.com';

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const enc = (value: unknown) => b64url(new TextEncoder().encode(JSON.stringify(value)));

export async function loadAppleConfig(admin: SupabaseClient): Promise<SiwaConfig | null> {
  const { data, error } = await admin.rpc('apple_siwa_config');
  if (error) {
    console.error('apple config', error.message);
    return null;
  }
  return (data as SiwaConfig | null) ?? null;
}

/** Apple 토큰 엔드포인트용 client_secret (ES256 JWT, 5분) */
async function clientSecret(cfg: SiwaConfig) {
  const pem = cfg.privateKey.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const iat = Math.floor(Date.now() / 1000);
  const unsigned = `${enc({ alg: 'ES256', kid: cfg.keyId })}.${enc({
    iss: cfg.teamId,
    iat,
    exp: iat + 300,
    aud: APPLE,
    sub: cfg.clientId,
  })}`;
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${b64url(new Uint8Array(sig))}`;
}

async function post(cfg: SiwaConfig, path: string, params: Record<string, string>) {
  return await fetch(`${APPLE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: cfg.clientId,
      client_secret: await clientSecret(cfg),
      ...params,
    }),
  });
}

/** 앱에서 받은 authorizationCode(5분 유효)를 refresh token으로 바꾼다. */
export async function exchangeCode(cfg: SiwaConfig, code: string): Promise<string | null> {
  const res = await post(cfg, '/auth/token', { code, grant_type: 'authorization_code' });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('apple token', res.status, body.error);
    return null;
  }
  return typeof body.refresh_token === 'string' ? body.refresh_token : null;
}

/** 저장해 둔 refresh token을 폐기한다 → 사용자의 'Apple로 로그인' 연결이 끊긴다. */
export async function revokeToken(cfg: SiwaConfig, refreshToken: string): Promise<boolean> {
  const res = await post(cfg, '/auth/revoke', {
    token: refreshToken,
    token_type_hint: 'refresh_token',
  });
  if (!res.ok) console.error('apple revoke', res.status, await res.text());
  return res.ok;
}
