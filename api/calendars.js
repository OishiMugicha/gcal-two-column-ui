import { googleFetchForSession } from './_lib/google.js';
import { sendError, sendJson } from './_lib/http.js';

export default async function handler(req, res) {
  try {
    if (req.method !== 'GET') {
      res.statusCode = 405;
      res.setHeader('Allow', 'GET');
      res.end('Method Not Allowed');
      return;
    }

    const data = await googleFetchForSession(req, 'https://www.googleapis.com/calendar/v3/users/me/calendarList');
    const calendars = [...(data.items ?? [])].sort((a, b) => {
      if (a.primary) return -1;
      if (b.primary) return 1;
      return a.summary.localeCompare(b.summary, 'ja');
    });

    sendJson(res, 200, calendars);
  } catch (err) {
    sendError(res, err.statusCode || 500, err instanceof Error ? err.message : 'Unknown error');
  }
}
