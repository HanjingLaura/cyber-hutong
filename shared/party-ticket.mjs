// Short-lived join tickets for PartyKit. Uses Web Crypto (Node 22+ and Workers).
const text = new TextEncoder();
const decode = new TextDecoder();

export function b64url(bytes) {
  const view = bytes instanceof ArrayBuffer ? new Uint8Array(bytes) : bytes;
  let s = '';
  for (let i = 0; i < view.length; i++) s += String.fromCharCode(view[i]);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromB64url(value) {
  const pad = '='.repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + pad).replace(/-/g, '+').replace(/_/g, '/'));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', text.encode(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function issueTicket(secret, claims, ttlMs = 60_000) {
  if (!secret) throw Object.assign(new Error('未配置 PARTY_AUTH_SECRET'), { status: 503 });
  const payload = { ...claims, exp: Date.now() + ttlMs };
  const body = b64url(text.encode(JSON.stringify(payload)));
  const sig = b64url(await crypto.subtle.sign('HMAC', await hmacKey(secret), text.encode(body)));
  return { ticket: `${body}.${sig}`, expires: payload.exp };
}

export async function verifyTicket(secret, ticket) {
  if (!secret || typeof ticket !== 'string') return null;
  const i = ticket.indexOf('.');
  if (i <= 0 || i === ticket.length - 1) return null;
  const body = ticket.slice(0, i);
  const sig = ticket.slice(i + 1);
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(sig), text.encode(body));
    if (!ok) return null;
    const payload = JSON.parse(decode.decode(fromB64url(body)));
    if (!payload || typeof payload !== 'object' || !Number.isFinite(payload.exp) || payload.exp < Date.now()) return null;
    if (typeof payload.userId !== 'string' || typeof payload.role !== 'string' || typeof payload.client !== 'string') return null;
    return payload;
  } catch {
    return null;
  }
}
