import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../../api/events/[eventId].js';
import { googleFetchForSession } from '../../../api/_lib/google.js';

vi.mock('../../../api/_lib/google.js', () => ({
  googleFetchForSession: vi.fn(),
}));

function createMockResponse() {
  return {
    statusCode: 200,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(body = '') {
      this.body = body;
    },
  };
}

describe('PATCH /api/events/[eventId]', () => {
  beforeEach(() => {
    vi.mocked(googleFetchForSession).mockReset();
  });

  it('有効なイベント更新リクエストを指定イベントへの更新依頼に変換する', async () => {
    const event = { summary: '更新後タイトル' };
    const req = {
      method: 'PATCH',
      headers: { host: 'localhost:3000' },
      url: '/api/events/event-1',
      query: { eventId: 'event-1' },
      body: {
        calendarId: 'primary',
        event,
      },
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify(this.body));
      },
    };
    const res = createMockResponse();
    vi.mocked(googleFetchForSession).mockResolvedValue({ id: 'event-1' });

    await handler(req, res);

    expect(googleFetchForSession).toHaveBeenCalledWith(
      req,
      'https://www.googleapis.com/calendar/v3/calendars/primary/events/event-1',
      {
        method: 'PATCH',
        body: JSON.stringify(event),
      },
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ id: 'event-1' });
  });
});
