import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEvent } from './googleCalendar';

describe('Google Calendar API クライアント', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('JSON形式のエラーレスポンスを保存エラーとして通知する', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ error: '作成できませんでした' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    await expect(
      createEvent('primary', {
        title: '予定',
        start: new Date(2026, 4, 31, 9, 0),
        end: new Date(2026, 4, 31, 9, 30),
        allDay: false,
        description: '',
      }),
    ).rejects.toThrow('作成できませんでした');
  });

  it('テキスト形式のエラーレスポンスでも本文を一度だけ読んで通知する', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('Google API error', { status: 500 }));

    await expect(
      createEvent('primary', {
        title: '予定',
        start: new Date(2026, 4, 31, 9, 0),
        end: new Date(2026, 4, 31, 9, 30),
        allDay: false,
        description: '',
      }),
    ).rejects.toThrow('Google API error');
  });
});
