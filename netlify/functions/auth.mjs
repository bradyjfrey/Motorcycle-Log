/* Google sign-in for Motorcycle Log (OAuth redirect flow, custom button).
   GET  /api/auth/google    -> redirects to Google's sign-in screen
   GET  /api/auth/callback  -> exchanges the code for an ID token, checks the
                               allowlist, sets the session cookie, returns to /
   GET  /api/auth/me        -> {email} when the session is valid, else 401
   POST /api/auth/logout    -> clears the session cookie

   The redirect flow exists so the page can use its own designed button
   instead of Google's iframe widget. The ID token arrives straight from
   Google's token endpoint over TLS, so decoding its claims without
   re-verifying the signature is sound; we still check issuer, audience, and
   verified email, then bind access to the allowlist. A short-lived state
   cookie guards the round trip against CSRF. Sign-in failures bounce back to
   /?autherror=<code> for the gate to display. */
import { randomBytes } from 'node:crypto';
import { sessionCookie, clearedSessionCookie, readSession } from '../lib/session.mjs';

const CLIENT_ID = '694449188997-karfjnpcsjp1oph29fblho5bqt8kncvu.apps.googleusercontent.com';
const ALLOWED = (process.env.ALLOWED_EMAILS || 'brady@bradyjfrey.com')
  .toLowerCase().split(',').map(s => s.trim()).filter(Boolean);

const STATE_COOKIE = 'odo_oauth_state';
const stateCookie = (v, maxAge) =>
  `${STATE_COOKIE}=${v}; Max-Age=${maxAge}; Path=/; HttpOnly; Secure; SameSite=Lax`;
const back = (origin, code) => new Response(null, {
  status: 302, headers: { location: origin + '/?autherror=' + code },
});

export default async (req) => {
  const url = new URL(req.url);
  const route = url.pathname.split('/').pop();
  const redirectUri = url.origin + '/api/auth/callback';

  try{
    if (route === 'logout'){
      if (req.method !== 'POST') return new Response('method not allowed', { status: 405 });
      return new Response('ok', { headers: { 'set-cookie': clearedSessionCookie() } });
    }

    if (route === 'me'){
      const session = readSession(req);
      if (!session) return new Response('not signed in', { status: 401 });
      return new Response(JSON.stringify({ email: session.email }), {
        headers: { 'content-type': 'application/json', 'set-cookie': sessionCookie(session.email) },
      });
    }

    if (route === 'google'){
      const state = randomBytes(16).toString('hex');
      const auth = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      auth.search = new URLSearchParams({
        client_id: CLIENT_ID,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email',
        state,
      });
      return new Response(null, {
        status: 302,
        headers: { location: auth.href, 'set-cookie': stateCookie(state, 600) },
      });
    }

    if (route === 'callback'){
      if (url.searchParams.get('error')) return back(url.origin, 'access_denied');
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const sent = (req.headers.get('cookie') || '').match(/(?:^|;\s*)odo_oauth_state=([^;]+)/)?.[1];
      if (!code || !state || state !== sent) return back(url.origin, 'state_mismatch');

      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      if (!clientSecret) throw new Error('GOOGLE_CLIENT_SECRET environment variable is not set');

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: CLIENT_ID,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      if (!tokenRes.ok) return back(url.origin, 'token_exchange_failed');
      const { id_token } = await tokenRes.json();
      if (!id_token) return back(url.origin, 'no_id_token');

      let claims;
      try{ claims = JSON.parse(Buffer.from(id_token.split('.')[1], 'base64url').toString()); }
      catch{ return back(url.origin, 'invalid_id_token'); }

      const issOk = claims.iss === 'https://accounts.google.com' || claims.iss === 'accounts.google.com';
      if (!issOk || claims.aud !== CLIENT_ID) return back(url.origin, 'invalid_id_token');
      if (claims.email_verified !== true) return back(url.origin, 'email_not_verified');
      const email = (claims.email || '').toLowerCase();
      if (!ALLOWED.includes(email)) return back(url.origin, 'not_allowed');

      const headers = new Headers({ location: url.origin + '/' });
      headers.append('set-cookie', sessionCookie(email));
      headers.append('set-cookie', stateCookie('', 0));
      return new Response(null, { status: 302, headers });
    }

    return new Response('not found', { status: 404 });
  }catch(err){
    return new Response('server error: ' + err.message, { status: 500 });
  }
};

export const config = {
  path: ['/api/auth/google', '/api/auth/callback', '/api/auth/me', '/api/auth/logout'],
};
