/* Cloud sync endpoint for Motorcycle Log (Google-account-keyed, one blob per account).
   GET  /api/state  -> returns this account's stored JSON (or "{}")
   PUT  /api/state  -> overwrites it with the request body

   Identity comes from the session cookie set by /api/auth/google; requests
   without a valid session get 401 and the app prompts for sign-in. Every
   authenticated request re-issues the cookie, restarting its 30-day clock,
   so a device in regular use never sees a login screen. */
import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';
import { readSession, sessionCookie } from '../lib/session.mjs';

const MAX_BYTES = 2_000_000; // generous ceiling for one bike's history

export default async (req) => {
  try{
    const session = readSession(req);
    if (!session) return new Response('not signed in', { status: 401 });

    if (req.method !== 'GET' && req.method !== 'PUT' && req.method !== 'POST')
      return new Response('method not allowed', { status: 405 });

    const refresh = { 'set-cookie': sessionCookie(session.email, new URL(req.url).protocol === 'https:') };
    const id = createHash('sha256').update('google:' + session.email).digest('hex');
    const store = getStore('odo');

    if (req.method === 'GET') {
      const data = await store.get(id);
      return new Response(data ?? '{}', {
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...refresh },
      });
    }

    const body = await req.text();
    if (body.length > MAX_BYTES) return new Response('too large', { status: 413 });
    try { JSON.parse(body); } catch { return new Response('bad json', { status: 400 }); }
    await store.set(id, body);
    return new Response('ok', { headers: refresh });
  }catch(err){
    return new Response('server error: ' + err.message, { status: 500 });
  }
};

export const config = { path: '/api/state' };
