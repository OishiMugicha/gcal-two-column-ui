import { sendJson } from '../_lib/http.js';
import { getSession } from '../_lib/session.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    res.end('Method Not Allowed');
    return;
  }

  const session = await getSession(req);
  sendJson(res, 200, { authenticated: Boolean(session) });
}
