/* Cloud sync endpoint for Odo (passphrase-keyed, single shared blob).
   GET  /api/state  -> returns this passphrase's stored JSON (or "{}")
   PUT  /api/state  -> overwrites it with the request body

   The passphrase arrives in the X-Odo-Key header. We store each passphrase's
   data under a SHA-256 of it, so the raw phrase is never a blob name and
   knowing the phrase is what grants access. This is a deliberately simple,
   accountless model — it's slated to be replaced by Google auth.  */
import { getStore } from '@netlify/blobs';
import { createHash } from 'node:crypto';

const MAX_BYTES = 2_000_000; // generous ceiling for one bike's history

export default async (req) => {
  const key = req.headers.get('x-odo-key');
  if (!key) return new Response('missing key', { status: 401 });

  const id = createHash('sha256').update(key).digest('hex');
  const store = getStore('odo');

  if (req.method === 'GET') {
    const data = await store.get(id);
    return new Response(data ?? '{}', {
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const body = await req.text();
    if (body.length > MAX_BYTES) return new Response('too large', { status: 413 });
    try { JSON.parse(body); } catch { return new Response('bad json', { status: 400 }); }
    await store.set(id, body);
    return new Response('ok');
  }

  return new Response('method not allowed', { status: 405 });
};

export const config = { path: '/api/state' };
