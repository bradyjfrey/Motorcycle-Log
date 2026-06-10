/* Session cookie helpers shared by the auth and state functions.

   A session is a compact signed token: base64url(JSON payload) + "." +
   HMAC-SHA256 of that payload, keyed by the SESSION_SECRET env var. It lives
   in an httpOnly cookie with a 30-day expiry that every authenticated request
   renews (rolling), so in normal use sign-in happens about once a month per
   device, and only after a full month away. */
import { createHmac, timingSafeEqual } from 'node:crypto';

const COOKIE = 'odo_session';
export const SESSION_DAYS = 30;

function secret(){
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET environment variable is not set');
  return s;
}

const sign = (data) => createHmac('sha256', secret()).update(data).digest('base64url');

export function sessionCookie(email){
  const payload = Buffer.from(JSON.stringify({
    email,
    exp: Date.now() + SESSION_DAYS * 86_400_000,
  })).toString('base64url');
  const token = payload + '.' + sign(payload);
  return `${COOKIE}=${token}; Max-Age=${SESSION_DAYS * 86_400}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

export function clearedSessionCookie(){
  return `${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

/* Returns {email} for a valid, unexpired session; null otherwise. */
export function readSession(req){
  const match = (req.headers.get('cookie') || '').match(/(?:^|;\s*)odo_session=([^;]+)/);
  if (!match) return null;
  const [payload, mac] = match[1].split('.');
  if (!payload || !mac) return null;
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(mac);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try{
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!session.email || typeof session.exp !== 'number' || session.exp < Date.now()) return null;
    return session;
  }catch{
    return null;
  }
}
