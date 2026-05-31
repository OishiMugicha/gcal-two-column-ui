import { beforeEach, describe, expect, it, vi } from 'vitest';
import handler from './session.js';
import { getSession } from '../_lib/session.js';

vi.mock('../_lib/session.js', () => ({
  getSession: vi.fn(),
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

describe('GET /api/auth/session', () => {
  beforeEach(() => {
    vi.mocked(getSession).mockReset();
  });

  it('セッション確認で例外が発生しても未ログインとして返す', async () => {
    const req = { method: 'GET' };
    const res = createMockResponse();
    vi.mocked(getSession).mockRejectedValue(new Error('SESSION_SECRET is not configured'));

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ authenticated: false });
  });
});
