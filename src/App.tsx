import { useCallback, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import interactionPlugin from '@fullcalendar/interaction';
import resourceTimeGridPlugin from '@fullcalendar/resource-timegrid';
import type { DateSelectArg, DatesSetArg, EventInput } from '@fullcalendar/core';
import {
  createActualEvent,
  hasAccessToken,
  listCalendars,
  listEvents,
  signIn,
  toCalendarEvent,
} from './googleCalendar';
import { defaultSettings, loadSettings, saveSettings } from './settings';
import type { AppSettings, GoogleCalendar, PendingSelection } from './types';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
const schedulerLicenseKey =
  (import.meta.env.VITE_FULLCALENDAR_LICENSE_KEY as string | undefined) || 'GPL-My-Project-Is-Open-Source';

const resources = [
  { id: 'planned', title: '予定', displayOrder: 1 },
  { id: 'actual', title: '実績', displayOrder: 2 },
];

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
  const [events, setEvents] = useState<EventInput[]>([]);
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [actualTitle, setActualTitle] = useState('');
  const [isSignedIn, setIsSignedIn] = useState(() => hasAccessToken());
  const [isLoading, setIsLoading] = useState(false);
  const [isCalendarOnly, setIsCalendarOnly] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canLoadEvents = Boolean(settings.plannedCalendarId && settings.actualCalendarId && isSignedIn);

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

        setEvents([
          ...plannedEvents.map((event) => toCalendarEvent(event, 'planned')),
          ...actualEvents.map((event) => toCalendarEvent(event, 'actual')),
        ]);
      } catch (err) {
        setError(toErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    [dateRange, settings.actualCalendarId, settings.plannedCalendarId],
  );

  const handleSignIn = async () => {
    if (!googleClientId) {
      setError('.env.localにVITE_GOOGLE_CLIENT_IDを設定してください。');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await signIn(googleClientId);
      setIsSignedIn(true);
      const nextCalendars = await listCalendars();
      setCalendars(nextCalendars);
      setMessage('Googleにログインしました。予定カレンダーと実績カレンダーを選択してください。');
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSettingsChange = (nextSettings: AppSettings) => {
    setSettings(nextSettings);
    saveSettings(nextSettings);
  };

  const handleDatesSet = (arg: DatesSetArg) => {
    const nextRange = { start: arg.start, end: arg.end };
    setDateRange(nextRange);

    if (settings.plannedCalendarId && settings.actualCalendarId && isSignedIn) {
      void refreshEvents(nextRange);
    }
  };

  const handleSelect = (arg: DateSelectArg) => {
    const resourceId = getResourceId(arg.resource);
    if (resourceId !== 'actual') {
      setMessage('実績レーンでドラッグすると実績イベントを作成できます。');
      return;
    }

    setActualTitle('');
    setPendingSelection({
      start: arg.start,
      end: arg.end,
      allDay: arg.allDay,
    });
  };

  const handleCreateActual = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!pendingSelection || !actualTitle.trim()) {
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      await createActualEvent(
        settings.actualCalendarId,
        actualTitle.trim(),
        pendingSelection.start,
        pendingSelection.end,
        pendingSelection.allDay,
      );
      setPendingSelection(null);
      setActualTitle('');
      setMessage('実績を作成しました。');
      await refreshEvents();
    } catch (err) {
      setError(toErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`app-shell ${isCalendarOnly ? 'calendar-only' : ''}`}>
      {!isCalendarOnly && (
        <header className="topbar">
          <div>
            <h1>予定・実績カレンダー</h1>
            <p>Google Calendarの予定と実績を、週表示の各日2レーンで比較します。</p>
          </div>
          <div className="topbar-actions">
            <button type="button" onClick={handleSignIn} disabled={isLoading}>
              {isSignedIn ? '再ログイン' : 'Googleでログイン'}
            </button>
            <button type="button" onClick={() => void refreshEvents()} disabled={!canLoadEvents || isLoading}>
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
              disabled={isLoading}
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
          {!isCalendarOnly && (message || error || isLoading) && (
            <div className={`status ${error ? 'status-error' : ''}`}>
              {isLoading ? '読み込み中...' : error || message}
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
            selectable={!isCalendarOnly}
            selectMirror
            unselectAuto={false}
            datesAboveResources
            resources={resources}
            resourceOrder="displayOrder"
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
            eventClick={(arg) => {
              const link = arg.event.extendedProps.htmlLink as string | undefined;
              if (link) {
                window.open(link, '_blank', 'noopener,noreferrer');
              }
            }}
            eventClassNames={(arg) => [`event-${arg.event.extendedProps.role || 'unknown'}`]}
          />
        </section>
      </main>

      {pendingSelection && (
        <div className="modal-backdrop" role="presentation">
          <form className="modal" onSubmit={handleCreateActual}>
            <h2>実績を作成</h2>
            <p>{formatSelectionRange(pendingSelection)}</p>
            <label>
              タイトル
              <input
                autoFocus
                value={actualTitle}
                onChange={(event) => setActualTitle(event.currentTarget.value)}
                placeholder="例: 設計作業"
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="secondary" onClick={() => setPendingSelection(null)}>
                キャンセル
              </button>
              <button type="submit" disabled={!actualTitle.trim() || isLoading}>
                作成
              </button>
            </div>
          </form>
        </div>
      )}
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

function getResourceId(resource: DateSelectArg['resource']) {
  return (resource as { id?: string } | undefined)?.id;
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

function formatSelectionRange(selection: PendingSelection) {
  const formatter = new Intl.DateTimeFormat('ja-JP', {
    month: 'numeric',
    day: 'numeric',
    hour: selection.allDay ? undefined : '2-digit',
    minute: selection.allDay ? undefined : '2-digit',
  });

  return `${formatter.format(selection.start)} - ${formatter.format(selection.end)}`;
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return '不明なエラーが発生しました。';
}
