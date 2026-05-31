import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from '../../../api/events/index.js';
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

describe('POST /api/events', () => {
  beforeEach(() => {
    vi.mocked(googleFetchForSession).mockReset();
  });

  it('有効なイベント作成リクエストを指定カレンダーへの作成依頼に変換する', async () => {
    const event = { summary: 'テスト予定' };
    const req = {
      method: 'POST',
      headers: { host: 'localhost:3000' },
      url: '/api/events',
      body: {
        calendarId: 'primary',
        event,
      },
      async *[Symbol.asyncIterator]() {
        yield Buffer.from(JSON.stringify(this.body));
      },
    };
    const res = createMockResponse();
    vi.mocked(googleFetchForSession).mockResolvedValue({ id: 'created-event' });

    await handler(req, res);

    expect(googleFetchForSession).toHaveBeenCalledWith(
      req,
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      {
        method: 'POST',
        body: JSON.stringify(event),
      },
    );
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ id: 'created-event' });
  });
});
