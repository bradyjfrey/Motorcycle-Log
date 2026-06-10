/* Google sign-in for Motorcycle Log.
   POST /api/auth/google  body {credential: <Google ID token from GIS>}
                          -> verifies the token, checks the allowlist, and
                             sets the session cookie; returns {email}
   POST /api/auth/logout  -> clears the session cookie

   Verification uses Google's tokeninfo endpoint, which checks the token's
   signature and expiry for us; we then check the claims that bind it to this
   app (issuer, audience, verified email). That network hop is fine here
   because sign-in happens about once a month, not per request. */
import { sessionCookie, clearedSessionCookie } from '../lib/session.mjs';

const CLIENT_ID = '694449188997-karfjnpcsjp1oph29fblho5bqt8kncvu.apps.googleusercontent.com';
const ALLOWED = (process.env.ALLOWED_EMAILS || 'brady@bradyjfrey.com')
  .toLowerCase().split(',').map(s => s.trim()).filter(Boolean);

export default async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });

  try{
    if (new URL(req.url).pathname.endsWith('/logout'))
      return new Response('ok', { headers: { 'set-cookie': clearedSessionCookie() } });

    let credential;
    try{ ({ credential } = await req.json()); }catch{}
    if (!credential) return new Response('missing credential', { status: 400 });

    const check = await fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + encodeURIComponent(credential));
    if (!check.ok) return new Response('invalid token', { status: 401 });
    const info = await check.json();

    const issOk = info.iss === 'https://accounts.google.com' || info.iss === 'accounts.google.com';
    if (!issOk || info.aud !== CLIENT_ID || info.email_verified !== 'true')
      return new Response('invalid token', { status: 401 });

    const email = (info.email || '').toLowerCase();
    if (!ALLOWED.includes(email)) return new Response('account not allowed', { status: 403 });

    return new Response(JSON.stringify({ email }), {
      headers: { 'content-type': 'application/json', 'set-cookie': sessionCookie(email) },
    });
  }catch(err){
    return new Response('server error: ' + err.message, { status: 500 });
  }
};

export const config = { path: ['/api/auth/google', '/api/auth/logout'] };
