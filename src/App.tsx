import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import interactionPlugin, { type EventResizeDoneArg } from '@fullcalendar/interaction';
import resourceTimeGridPlugin from '@fullcalendar/resource-timegrid';
import type {
  DateSelectArg,
  DatesSetArg,
  EventApi,
  EventClickArg,
  EventContentArg,
  EventDropArg,
  EventInput,
} from '@fullcalendar/core';
import {
  createEvent,
  deleteEvent,
  getSession,
  listCalendars,
  listEvents,
  signIn,
  signOut,
  toCalendarEvent,
  updateEvent,
} from './googleCalendar';
import { defaultSettings, loadSettings, saveSettings } from './settings';
import type { AppSettings, CalendarRole, EventDraft, EventEditorState, GoogleCalendar } from './types';

const schedulerLicenseKey =
  (import.meta.env.VITE_FULLCALENDAR_LICENSE_KEY as string | undefined) || 'GPL-My-Project-Is-Open-Source';

const resources = [
  { id: 'planned', title: '予定', displayOrder: 1 },
  { id: 'actual', title: '実績', displayOrder: 2 },
];

const emptyDraft: EventDraft = {
  title: '',
  start: new Date(),
  end: addMinutes(new Date(), 30),
  allDay: false,
  description: '',
};

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [events, setEvents] = useState<EventInput[]>([]);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [editor, setEditor] = useState<EventEditorState | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCalendarOnly, setIsCalendarOnly] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canLoadEvents = Boolean(settings.plannedCalendarId && settings.actualCalendarId && isSignedIn);

  useEffect(() => {
    let isActive = true;

    const restoreSession = async () => {
      const authError = new URLSearchParams(window.location.search).get('auth_error');
      if (authError) {
        setError(decodeURIComponent(authError));
        window.history.replaceState({}, '', window.location.pathname);
      }

      setIsLoading(true);
      try {
        const session = await getSession();
        if (!isActive || !session.authenticated) {
          return;
        }

        setIsSignedIn(true);
        const nextCalendars = await listCalendars();
        if (!isActive) {
          return;
        }

        setCalendars(nextCalendars);
        setMessage('ログイン状態を復元しました。');
      } catch (err) {
        if (isActive) {
          setError(toErrorMessage(err));
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void restoreSession();

    return () => {
      isActive = false;
    };
  }, []);

  const selectedCalendarNames = useMemo(() => {
    const planned = calendars.find((calendar) => calendar.id === settings.plannedCalendarId)?.summary;
    const actual = calendars.find((calendar) => calendar.id === settings.actualCalendarId)?.summary;
    return { planned, actual };
  }, [calendars, settings.actualCalendarId, settings.plannedCalendarId]);

  const refreshEvents = useCallback(
    async (range = dateRange) => {
      if (!range || !settings.plannedCalendarId || !settings.actualCalendarId) {
        return;
      }

      setIsLoading(true);
      setError('');

      try {
        const [plannedEvents, actualEvents] = await Promise.all([
          listEvents(settings.plannedCalendarId, range.start, range.end),
          listEvents(settings.actualCalendarId, range.start, range.end),
        ]);
        const plannedCalendar = calendars.find((calendar) => calendar.id === settings.plannedCalendarId);
        const actualCalendar = calendars.find((calendar) => calendar.id === settings.actualCalendarId);

        setEvents([
          ...plannedEvents.map((event) => toCalendarEvent(event, 'planned', settings.plannedCalendarId, plannedCalendar)),
          ...actualEvents.map((event) => toCalendarEvent(event, 'actual', settings.actualCalendarId, actualCalendar)),
        ]);
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    [calendars, dateRange, settings.actualCalendarId, settings.plannedCalendarId],
  );

  useEffect(() => {
    if (canLoadEvents && dateRange && calendars.length > 0) {
      void refreshEvents(dateRange);
    }
  }, [calendars.length, canLoadEvents, dateRange, refreshEvents]);

  const handleSignIn = async () => {
    setIsLoading(true);
    setError('');

    try {
      if (isSignedIn) {
        await signOut();
        setIsSignedIn(false);
        setCalendars([]);
        setEvents([]);
        setEditor(null);
        setMessage('ログアウトしました。');
        return;
      }

      await signIn();
      return;
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingsChange = (nextSettings: AppSettings) => {
    setSettings(nextSettings);
    saveSettings(nextSettings);
    setEditor(null);
  };

  const handleDatesSet = (arg: DatesSetArg) => {
    const nextRange = { start: arg.start, end: arg.end };
    setDateRange(nextRange);

    if (settings.plannedCalendarId && settings.actualCalendarId && isSignedIn) {
      void refreshEvents(nextRange);
    }
  };

  const handleSelect = (arg: DateSelectArg) => {
    const role = getResourceId(arg.resource);
    if (!role) {
      setMessage('予定または実績の列を選択してください。');
      return;
    }

    const calendarId = getCalendarIdForRole(role, settings);
    if (!calendarId) {
      setMessage(`${getRoleLabel(role)}カレンダーを選択してください。`);
      return;
    }

    setEditor({
      mode: 'create',
      role,
      calendarId,
      anchor: toAnchor(arg.jsEvent),
      draft: {
        ...emptyDraft,
        start: arg.start,
        end: arg.end,
        allDay: arg.allDay,
      },
    });
  };

  const handleEventClick = (arg: EventClickArg) => {
    arg.jsEvent.preventDefault();

    const identity = getEventIdentity(arg.event);
    if (!identity) {
      setError('イベント情報を読み取れませんでした。');
      return;
    }

    const draft = draftFromEvent(arg.event);

    setEditor({
      mode: 'edit',
      ...identity,
      anchor: toAnchor(arg.jsEvent),
      draft,
      originalDraft: draft,
    });
  };

  const handleSaveEditor = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editor || isSaving) {
      return;
    }

    const draft = normalizeDraft({
      ...editor.draft,
      title: editor.mode === 'create' || editor.draft.title.trim() ? editor.draft.title : '無題',
    });
    if (!draft.title.trim()) {
      setError('タイトルを入力してください。');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      if (editor.mode === 'create') {
        await createEvent(editor.calendarId, draft);
        setMessage(`${getRoleLabel(editor.role)}イベントを作成しました。`);
      } else {
        if (!editor.eventId) {
          throw new Error('更新対象のイベントIDがありません。');
        }
        await updateEvent(editor.calendarId, editor.eventId, draft);
        setMessage('イベントを更新しました。');
      }

      setEditor(null);
      await refreshEvents();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteEditor = async () => {
    if (!editor?.eventId || isSaving) {
      return;
    }

    if (!window.confirm('このイベントを削除しますか？')) {
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await deleteEvent(editor.calendarId, editor.eventId);
      setEditor(null);
      setMessage('イベントを削除しました。');
      await refreshEvents();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCloseEditor = async () => {
    if (!editor || isSaving) {
      return;
    }

    if (editor.mode === 'create' || !editor.eventId || !editor.originalDraft) {
      setEditor(null);
      return;
    }

    const draft = normalizeDraft({
      ...editor.draft,
      title: editor.draft.title.trim() ? editor.draft.title : '無題',
    });

    if (areDraftsEqual(draft, normalizeDraft(editor.originalDraft))) {
      setEditor(null);
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      await updateEvent(editor.calendarId, editor.eventId, draft);
      setEditor(null);
      setMessage('イベントを更新しました。');
      await refreshEvents();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEditor = () => {
    if (isSaving) {
      return;
    }

    setEditor(null);
  };

  const handleDirectEventChange = async (arg: EventDropArg | EventResizeDoneArg) => {
    const identity = getEventIdentity(arg.event);
    if (!identity) {
      arg.revert();
      setError('イベント情報を読み取れませんでした。');
      return;
    }

    const draft = draftFromEvent(arg.event);

    setIsSaving(true);
    setError('');

    try {
      await updateEvent(identity.calendarId, identity.eventId, draft);
      setMessage('イベントの日時を更新しました。');
      setEditor(null);
    } catch (err) {
      arg.revert();
      setError(toErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const updateEditorDraft = (nextDraft: EventDraft) => {
    setEditor((current) => (current ? { ...current, draft: normalizeDraft(nextDraft) } : current));
  };

  return (
    <div className={`app-shell ${isCalendarOnly ? 'calendar-only' : ''}`}>
      {!isCalendarOnly && (
        <header className="topbar">
          <div>
            <h1>予定・実績カレンダー</h1>
            <p>Google Calendarの予定と実績を、週表示の2列で比較・編集します。</p>
          </div>
          <div className="topbar-actions">
            <button type="button" onClick={handleSignIn} disabled={isLoading || isSaving}>
              {isSignedIn ? 'ログアウト' : 'Googleでログイン'}
            </button>
            <button type="button" onClick={() => void refreshEvents()} disabled={!canLoadEvents || isLoading || isSaving}>
              更新
            </button>
            <button type="button" className="secondary" onClick={() => setIsCalendarOnly(true)}>
              カレンダーだけ表示
            </button>
          </div>
        </header>
      )}

      <main className="main-layout">
        {!isCalendarOnly && (
          <aside className="settings-panel">
            <h2>設定</h2>
            <CalendarSelect
              label="予定カレンダー"
              value={settings.plannedCalendarId}
              calendars={calendars}
              onChange={(plannedCalendarId) => handleSettingsChange({ ...settings, plannedCalendarId })}
            />
            <CalendarSelect
              label="実績カレンダー"
              value={settings.actualCalendarId}
              calendars={calendars}
              onChange={(actualCalendarId) => handleSettingsChange({ ...settings, actualCalendarId })}
            />
            <div className="time-grid">
              <label>
                表示開始
                <input
                  type="time"
                  value={settings.slotMinTime.slice(0, 5)}
                  onChange={(event) => {
                    const slotMinTime = `${event.currentTarget.value}:00`;
                    const slotMaxTime = toSlotMaxTime(slotMinTime, toTimeInputValue(settings.slotMaxTime));
                    handleSettingsChange({ ...settings, slotMinTime, slotMaxTime });
                  }}
                />
              </label>
              <label>
                表示終了
                <input
                  type="time"
                  value={toTimeInputValue(settings.slotMaxTime)}
                  onChange={(event) => {
                    const slotMaxTime = toSlotMaxTime(settings.slotMinTime, event.currentTarget.value);
                    handleSettingsChange({ ...settings, slotMaxTime });
                  }}
                />
              </label>
            </div>
            <button
              type="button"
              className="secondary"
              onClick={() => handleSettingsChange(defaultSettings)}
              disabled={isLoading || isSaving}
            >
              設定をリセット
            </button>
            <dl className="selected-summary">
              <div>
                <dt>予定</dt>
                <dd>{selectedCalendarNames.planned || '未選択'}</dd>
              </div>
              <div>
                <dt>実績</dt>
                <dd>{selectedCalendarNames.actual || '未選択'}</dd>
              </div>
            </dl>
          </aside>
        )}

        <section className="calendar-panel">
          {isCalendarOnly && (
            <button type="button" className="calendar-only-back" onClick={() => setIsCalendarOnly(false)}>
              戻る
            </button>
          )}
          {!isCalendarOnly && (message || error || isLoading || isSaving) && (
            <div className={`status ${error ? 'status-error' : ''}`}>
              {isLoading ? '読み込み中...' : isSaving ? '保存中...' : error || message}
            </div>
          )}
          <FullCalendar
            plugins={[resourceTimeGridPlugin, interactionPlugin]}
            schedulerLicenseKey={schedulerLicenseKey}
            initialView="resourceTimeGridWeek"
            locale="ja"
            firstDay={0}
            allDaySlot
            nowIndicator
            selectable={!isCalendarOnly && canLoadEvents}
            selectMirror
            unselectAuto={false}
            datesAboveResources
            resources={resources}
            resourceOrder="displayOrder"
            eventResourceEditable={false}
            editable={!isCalendarOnly && canLoadEvents && !isSaving}
            events={events}
            slotMinTime={settings.slotMinTime}
            slotMaxTime={settings.slotMaxTime}
            height="100%"
            headerToolbar={{
              left: 'prev,next today',
              center: 'title',
              right: '',
            }}
            buttonText={{
              today: '今日',
            }}
            datesSet={handleDatesSet}
            select={isCalendarOnly ? undefined : handleSelect}
            eventClick={handleEventClick}
            eventDrop={(arg) => void handleDirectEventChange(arg)}
            eventResize={(arg) => void handleDirectEventChange(arg)}
            eventClassNames={(arg) => [`event-${arg.event.extendedProps.role || 'unknown'}`]}
            eventContent={renderEventContent}
          />
        </section>
      </main>

      {editor && (
        <EventPopover
          editor={editor}
          isSaving={isSaving}
          onClose={() => void handleCloseEditor()}
          onCancel={handleCancelEditor}
          onDelete={() => void handleDeleteEditor()}
          onDraftChange={updateEditorDraft}
          onSubmit={(event) => void handleSaveEditor(event)}
        />
      )}
    </div>
  );
}

function EventPopover(props: {
  editor: EventEditorState;
  isSaving: boolean;
  onClose: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onDraftChange: (draft: EventDraft) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const { editor, isSaving, onClose } = props;
  const popoverRef = useRef<HTMLDivElement>(null);
  const isCreate = editor.mode === 'create';
  const popoverStyle = {
    left: `${Math.min(editor.anchor.x, window.innerWidth - 360)}px`,
    top: `${Math.min(editor.anchor.y, window.innerHeight - 460)}px`,
  };

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (isSaving) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Node) || popoverRef.current?.contains(target)) {
        return;
      }

      onClose();
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isSaving, onClose]);

  return (
    <div ref={popoverRef} className="event-popover" style={popoverStyle}>
      <form onSubmit={props.onSubmit}>
        <div className="popover-header">
          <span className={`role-chip role-${editor.role}`}>{getRoleLabel(editor.role)}</span>
          <div className="popover-header-actions">
            {!isCreate && editor.htmlLink && (
              <a className="mini-action" href={editor.htmlLink} target="_blank" rel="noreferrer">
                Googleで開く
              </a>
            )}
            {!isCreate && (
              <button type="button" className="mini-action danger" disabled={props.isSaving} onClick={props.onDelete}>
                削除
              </button>
            )}
            <button type="button" className="icon-button" aria-label="閉じる" disabled={props.isSaving} onClick={props.onClose}>
              ×
            </button>
          </div>
        </div>

        <EventFormFields editor={editor} onDraftChange={props.onDraftChange} />

        <div className="popover-actions">
          {isCreate ? (
            <>
              <button type="button" className="secondary" disabled={props.isSaving} onClick={props.onCancel}>
                キャンセル
              </button>
              <button type="submit" disabled={!editor.draft.title.trim() || props.isSaving}>
                保存
              </button>
            </>
          ) : (
            <>
              <span className="autosave-hint">{props.isSaving ? '保存中...' : '閉じると保存されます'}</span>
              <button type="button" className="secondary" disabled={props.isSaving} onClick={props.onCancel}>
                キャンセル
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  );
}

function EventFormFields(props: { editor: EventEditorState; onDraftChange: (draft: EventDraft) => void }) {
  const { draft } = props.editor;

  return (
    <div className="event-form">
      <input
        autoFocus
        className="title-input"
        value={draft.title}
        onChange={(event) => props.onDraftChange({ ...draft, title: event.currentTarget.value })}
        placeholder="タイトルを追加"
      />
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={draft.allDay}
          onChange={(event) => {
            const allDay = event.currentTarget.checked;
            const start = allDay ? startOfDay(draft.start) : draft.start;
            const end = allDay ? addDays(startOfDay(draft.end), 0) : draft.end;
            props.onDraftChange(normalizeDraft({ ...draft, allDay, start, end }));
          }}
        />
        終日
      </label>
      {draft.allDay ? (
        <div className="date-grid">
          <label>
            開始日
            <input
              type="date"
              value={formatDateInput(draft.start)}
              onChange={(event) => {
                const start = parseDateInput(event.currentTarget.value);
                props.onDraftChange({ ...draft, start });
              }}
            />
          </label>
          <label>
            終了日
            <input
              type="date"
              value={formatDateInput(addDays(draft.end, -1))}
              onChange={(event) => {
                const end = addDays(parseDateInput(event.currentTarget.value), 1);
                props.onDraftChange({ ...draft, end });
              }}
            />
          </label>
        </div>
      ) : (
        <div className="date-grid">
          <label>
            開始
            <input
              type="datetime-local"
              value={formatDateTimeInput(draft.start)}
              onChange={(event) => {
                const start = parseDateTimeInput(event.currentTarget.value);
                props.onDraftChange({ ...draft, start });
              }}
            />
          </label>
          <label>
            終了
            <input
              type="datetime-local"
              value={formatDateTimeInput(draft.end)}
              onChange={(event) => {
                const end = parseDateTimeInput(event.currentTarget.value);
                props.onDraftChange({ ...draft, end });
              }}
            />
          </label>
        </div>
      )}
      <label>
        説明
        <textarea
          value={draft.description}
          onChange={(event) => props.onDraftChange({ ...draft, description: event.currentTarget.value })}
          placeholder="メモ、URL、作業内容など"
        />
      </label>
    </div>
  );
}

function CalendarSelect(props: {
  label: string;
  value: string;
  calendars: GoogleCalendar[];
  onChange: (calendarId: string) => void;
}) {
  return (
    <label>
      {props.label}
      <select value={props.value} onChange={(event) => props.onChange(event.currentTarget.value)}>
        <option value="">選択してください</option>
        {props.calendars.map((calendar) => (
          <option key={calendar.id} value={calendar.id}>
            {calendar.summary}
            {calendar.primary ? '（メイン）' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

function getResourceId(resource: DateSelectArg['resource']): CalendarRole | null {
  const id = (resource as { id?: string } | undefined)?.id;
  return id === 'planned' || id === 'actual' ? id : null;
}

function getCalendarIdForRole(role: CalendarRole, settings: AppSettings) {
  return role === 'planned' ? settings.plannedCalendarId : settings.actualCalendarId;
}

function getRoleLabel(role: CalendarRole) {
  return role === 'planned' ? '予定' : '実績';
}

function getEventIdentity(event: EventApi) {
  const role = event.extendedProps.role as CalendarRole | undefined;
  const calendarId = event.extendedProps.calendarId as string | undefined;
  const eventId = event.extendedProps.googleEventId as string | undefined;

  if (!role || !calendarId || !eventId) {
    return null;
  }

  return {
    role,
    calendarId,
    eventId,
    htmlLink: event.extendedProps.htmlLink as string | undefined,
  };
}

function draftFromEvent(event: EventApi): EventDraft {
  const start = event.start ?? new Date();
  const end = event.end ?? (event.allDay ? addDays(start, 1) : addMinutes(start, 30));

  return normalizeDraft({
    title: event.title,
    start,
    end,
    allDay: event.allDay,
    description: (event.extendedProps.description as string | undefined) || '',
  });
}

function normalizeDraft(draft: EventDraft): EventDraft {
  const title = draft.title;
  const start = draft.allDay ? startOfDay(draft.start) : draft.start;
  let end = draft.allDay ? startOfDay(draft.end) : draft.end;

  if (end <= start) {
    end = draft.allDay ? addDays(start, 1) : addMinutes(start, 30);
  }

  return {
    title,
    start,
    end,
    allDay: draft.allDay,
    description: draft.description,
  };
}

function areDraftsEqual(left: EventDraft, right: EventDraft) {
  return (
    left.title === right.title &&
    left.start.getTime() === right.start.getTime() &&
    left.end.getTime() === right.end.getTime() &&
    left.allDay === right.allDay &&
    left.description === right.description
  );
}

function renderEventContent(arg: EventContentArg) {
  if (arg.event.allDay) {
    return <span className="calendar-event-title">{arg.event.title}</span>;
  }

  const timeRange = formatEventTimeRange(arg.event.start, arg.event.end);

  return (
    <span className="calendar-event-content">
      <span className="calendar-event-title">{arg.event.title}</span>
      {timeRange && <span className="calendar-event-time">{timeRange}</span>}
    </span>
  );
}

function formatEventTimeRange(start: Date | null, end: Date | null) {
  if (!start || !end) {
    return '';
  }

  return `${formatClockTime(start.getHours() * 60 + start.getMinutes())}-${formatClockTime(
    end.getHours() * 60 + end.getMinutes(),
  )}`;
}

function toAnchor(event: MouseEvent | null) {
  if (!event) {
    return { x: Math.max(24, window.innerWidth / 2 - 170), y: 96 };
  }

  return {
    x: Math.max(16, event.clientX + 12),
    y: Math.max(16, event.clientY + 12),
  };
}

function toTimeInputValue(duration: string) {
  const minutes = parseDurationMinutes(duration) % 1440;
  return formatClockTime(minutes);
}

function toSlotMaxTime(slotMinTime: string, endTimeValue: string) {
  const startMinutes = parseDurationMinutes(slotMinTime) % 1440;
  const endMinutes = parseClockMinutes(endTimeValue);
  const durationMinutes = endMinutes <= startMinutes ? endMinutes + 1440 : endMinutes;
  return formatDurationTime(durationMinutes);
}

function parseDurationMinutes(value: string) {
  const [hours = '0', minutes = '0'] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
}

function parseClockMinutes(value: string) {
  const [hours = '0', minutes = '0'] = value.split(':');
  return Number(hours) * 60 + Number(minutes);
}

function formatClockTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

function formatDurationTime(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateTimeInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function parseDateInput(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function parseDateTimeInput(value: string) {
  return new Date(value);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return '不明なエラーが発生しました。';
}
