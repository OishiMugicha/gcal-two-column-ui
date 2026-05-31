import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, useRef } from 'react';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './App';
import type { CalendarRole, GoogleEvent } from './types';
import {
  createEvent,
  deleteEvent,
  getSession,
  listCalendars,
  listEvents,
  updateEvent,
} from './googleCalendar';

type MockCalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay?: boolean;
  extendedProps?: Record<string, unknown>;
};

type MockMouseEvent = {
  clientX: number;
  clientY: number;
  preventDefault: Mock;
};

type MockFullCalendarProps = {
  datesSet?: (arg: { start: Date; end: Date }) => void;
  dateClick?: (arg: {
    jsEvent: MockMouseEvent & { detail: number };
    allDay: boolean;
    date: Date;
    resource?: { id: string };
  }) => void;
  eventClick?: (arg: { jsEvent: MockMouseEvent; event: ReturnType<typeof toEventApi> }) => void;
  eventDrop?: (arg: { event: ReturnType<typeof toEventApi>; revert: Mock }) => void;
  events?: MockCalendarEvent[];
};

const calendarRange = {
  start: new Date(2026, 4, 31),
  end: new Date(2026, 5, 7),
};
let dropRevert: Mock;

vi.mock('@fullcalendar/react', () => ({
  default: (props: MockFullCalendarProps) => <MockFullCalendar {...props} />,
}));

vi.mock('@fullcalendar/interaction', () => ({
  default: {},
}));

vi.mock('@fullcalendar/resource-timegrid', () => ({
  default: {},
}));

vi.mock('./googleCalendar', () => ({
  createEvent: vi.fn(),
  deleteEvent: vi.fn(),
  getSession: vi.fn(),
  listCalendars: vi.fn(),
  listEvents: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  updateEvent: vi.fn(),
  toCalendarEvent: (event: GoogleEvent, role: CalendarRole, calendarId: string) => ({
    id: `${role}:${event.id}`,
    title: event.summary || '(無題)',
    start: event.start.dateTime || event.start.date,
    end: event.end.dateTime || event.end.date,
    allDay: Boolean(event.start.date),
    resourceId: role,
    extendedProps: {
      role,
      calendarId,
      googleEventId: event.id,
      description: event.description || '',
      htmlLink: event.htmlLink,
    },
  }),
}));

describe('イベント保存', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem(
      'gcal-two-column-ui-settings',
      JSON.stringify({
        plannedCalendarId: 'planned-calendar',
        actualCalendarId: 'actual-calendar',
        slotMinTime: '06:00:00',
        slotMaxTime: '24:00:00',
      }),
    );

    vi.mocked(getSession).mockResolvedValue({ authenticated: true });
    vi.mocked(listCalendars).mockResolvedValue([
      { id: 'planned-calendar', summary: '予定カレンダー' },
      { id: 'actual-calendar', summary: '実績カレンダー' },
    ]);
    vi.mocked(listEvents).mockResolvedValue([]);
    vi.mocked(createEvent).mockResolvedValue(undefined);
    vi.mocked(updateEvent).mockResolvedValue(undefined);
    vi.mocked(deleteEvent).mockResolvedValue(undefined);
    dropRevert = vi.fn();
  });

  afterEach(() => {
    cleanup();
  });

  it('予定スロットから入力した内容でイベントを作成する', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.dblClick(await screen.findByRole('button', { name: '予定 09:00 に作成' }));
    await user.type(screen.getByPlaceholderText('タイトルを追加'), '設計レビュー');
    fireEvent.change(screen.getByLabelText('開始'), { target: { value: '2026-05-31T10:15' } });
    fireEvent.change(screen.getByLabelText('終了'), { target: { value: '2026-05-31T11:00' } });
    await user.type(screen.getByLabelText('説明'), 'API の確認');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(createEvent).toHaveBeenCalledWith(
        'planned-calendar',
        expect.objectContaining({
          title: '設計レビュー',
          description: 'API の確認',
          allDay: false,
        }),
      );
    });
    const draft = vi.mocked(createEvent).mock.calls[0][1];
    expect(draft.start).toEqual(new Date(2026, 4, 31, 10, 15));
    expect(draft.end).toEqual(new Date(2026, 4, 31, 11, 0));
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    });
    expect(await screen.findByText('イベントを作成しました。')).toBeInTheDocument();
    expect(listEvents).toHaveBeenCalledWith('planned-calendar', calendarRange.start, calendarRange.end);
    expect(listEvents).toHaveBeenCalledWith('actual-calendar', calendarRange.start, calendarRange.end);
  });

  it('既存イベントを編集して対象イベントを更新する', async () => {
    const user = userEvent.setup();
    vi.mocked(listEvents).mockImplementation(async (calendarId) =>
      calendarId === 'planned-calendar'
        ? [
            {
              id: 'event-1',
              summary: '旧タイトル',
              description: '旧メモ',
              start: { dateTime: new Date(2026, 4, 31, 9, 0).toISOString() },
              end: { dateTime: new Date(2026, 4, 31, 9, 30).toISOString() },
              htmlLink: 'https://calendar.google.com/event-1',
            },
          ]
        : [],
    );
    render(<App />);

    await user.click(await screen.findByRole('button', { name: '旧タイトル' }));
    const titleInput = screen.getByPlaceholderText('タイトルを追加');
    await user.clear(titleInput);
    await user.type(titleInput, '更新後タイトル');
    await user.clear(screen.getByLabelText('説明'));
    await user.type(screen.getByLabelText('説明'), '更新後メモ');
    await user.click(screen.getByRole('button', { name: '保存' }));

    await waitFor(() => {
      expect(updateEvent).toHaveBeenCalledWith(
        'planned-calendar',
        'event-1',
        expect.objectContaining({
          title: '更新後タイトル',
          description: '更新後メモ',
        }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '保存' })).not.toBeInTheDocument();
    });
    expect(await screen.findByText('イベントを更新しました。')).toBeInTheDocument();
  });

  it('タイトルが空のイベントは保存しない', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.dblClick(await screen.findByRole('button', { name: '予定 09:00 に作成' }));
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('タイトルを入力してください。')).toBeInTheDocument();
    expect(createEvent).not.toHaveBeenCalled();
    expect(updateEvent).not.toHaveBeenCalled();
  });

  it('作成に失敗したら編集内容を残してエラーを表示する', async () => {
    const user = userEvent.setup();
    vi.mocked(createEvent).mockRejectedValue(new Error('保存できませんでした'));
    render(<App />);

    await user.dblClick(await screen.findByRole('button', { name: '予定 09:00 に作成' }));
    await user.type(screen.getByPlaceholderText('タイトルを追加'), '失敗する予定');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('保存できませんでした')).toBeInTheDocument();
    expect(screen.getByDisplayValue('失敗する予定')).toBeInTheDocument();
  });

  it('ドラッグ相当の日時変更に失敗したら変更を戻してエラーを表示する', async () => {
    const user = userEvent.setup();
    vi.mocked(updateEvent).mockRejectedValue(new Error('日時を保存できませんでした'));
    vi.mocked(listEvents).mockImplementation(async (calendarId) =>
      calendarId === 'actual-calendar'
        ? [
            {
              id: 'actual-1',
              summary: '実績入力',
              start: { dateTime: new Date(2026, 4, 31, 13, 0).toISOString() },
              end: { dateTime: new Date(2026, 4, 31, 14, 0).toISOString() },
            },
          ]
        : [],
    );
    render(<App />);

    await user.click(await screen.findByRole('button', { name: '実績入力 を移動' }));

    await waitFor(() => {
      expect(updateEvent).toHaveBeenCalledWith(
        'actual-calendar',
        'actual-1',
        expect.objectContaining({ title: '実績入力' }),
      );
    });
    expect(dropRevert).toHaveBeenCalled();
    expect(await screen.findByText('日時を保存できませんでした')).toBeInTheDocument();
  });
});

function MockFullCalendar(props: MockFullCalendarProps) {
  const events = props.events ?? [];

  return (
    <div aria-label="カレンダー">
      <button type="button" onDoubleClick={() => props.dateClick?.(createDateClickArg('planned'))}>
        予定 09:00 に作成
      </button>
      <button type="button" onDoubleClick={() => props.dateClick?.(createDateClickArg('actual'))}>
        実績 09:00 に作成
      </button>
      {events.map((event) => {
        const eventApi = toEventApi(event);
        return (
          <div key={event.id}>
            <button type="button" onClick={() => props.eventClick?.({ event: eventApi, jsEvent: createMouseEvent() })}>
              {event.title}
            </button>
            <button
              type="button"
              onClick={() => props.eventDrop?.({ event: eventApi, revert: dropRevert })}
            >
              {event.title} を移動
            </button>
          </div>
        );
      })}
      <DatesSetTrigger onDatesSet={props.datesSet} />
    </div>
  );
}

function DatesSetTrigger(props: { onDatesSet?: (arg: { start: Date; end: Date }) => void }) {
  const didRun = useRef(false);

  useEffect(() => {
    if (didRun.current) {
      return;
    }
    didRun.current = true;
    props.onDatesSet?.(calendarRange);
  }, [props.onDatesSet]);
  return null;
}

function createDateClickArg(role: CalendarRole) {
  return {
    jsEvent: {
      ...createMouseEventFields(),
      detail: 2,
    },
    allDay: false,
    date: new Date(2026, 4, 31, 9, 0),
    resource: { id: role },
  };
}

function toEventApi(event: MockCalendarEvent) {
  const start = new Date(event.start);
  const end = new Date(event.end);

  return {
    title: event.title,
    start,
    end,
    allDay: Boolean(event.allDay),
    extendedProps: event.extendedProps ?? {},
  };
}

function createMouseEvent() {
  return createMouseEventFields();
}

function createMouseEventFields() {
  return {
    clientX: 80,
    clientY: 120,
    preventDefault: vi.fn(),
  };
}
