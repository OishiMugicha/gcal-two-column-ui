import { googleFetchForSession } from '../_lib/google.js';
import { readJson, sendError, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const requestUrl = new URL(req.url, `https://${req.headers.host}`);
      const calendarId = requestUrl.searchParams.get('calendarId');
      const timeMin = requestUrl.searchParams.get('timeMin');
      const timeMax = requestUrl.searchParams.get('timeMax');

      if (!calendarId || !timeMin || !timeMax) {
        sendError(res, 400, 'calendarId, timeMin, and timeMax are required');
        return;
      }

      const params = new URLSearchParams({
        singleEvents: 'true',
        orderBy: 'startTime',
        timeMin,
        timeMax,
      });
      const data = await googleFetchForSession(
        req,
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      );

      sendJson(res, 200, (data.items ?? []).filter((event) => event.status !== 'cancelled'));
      return;
    }

    if (req.method === 'POST') {
      const body = await readJson(req);
      if (!body.calendarId || !body.event) {
        sendError(res, 400, 'calendarId and event are required');
        return;
      }

      const data = await googleFetchForSession(
        req,
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(body.calendarId)}/events`,
        {
          method: 'POST',
          body: JSON.stringify(body.event),
        },
      );
      sendJson(res, 200, data);
      return;
    }

    res.statusCode = 405;
    res.setHeader('Allow', 'GET, POST');
    res.end('Method Not Allowed');
  } catch (err) {
    sendError(res, err.statusCode || 500, err instanceof Error ? err.message : 'Unknown error');
  }
}
