import type {
  CalendarRole,
  EventDraft,
  GoogleCalendar,
  GoogleCalendarListResponse,
  GoogleEvent,
  GoogleEventsResponse,
} from './types';

const GIS_SCRIPT_ID = 'google-identity-services';
const GOOGLE_AUTH_SCOPE = [
  'https://www.googleapis.com/auth/calendar.readonly',
  'https://www.googleapis.com/auth/calendar.events',
].join(' ');

const FALLBACK_EVENT_COLORS: Record<CalendarRole, Required<CalendarEventColors>> = {
  planned: {
    backgroundColor: '#2764b3',
    foregroundColor: '#ffffff',
  },
  actual: {
    backgroundColor: '#28815f',
    foregroundColor: '#ffffff',
  },
};

type CalendarEventColors = {
  backgroundColor?: string;
  foregroundColor?: string;
};

type TokenClient = {
  requestAccessToken: (options?: { prompt?: string }) => void;
  callback: (response: TokenResponse) => void;
};

type TokenResponse = {
  access_token?: string;
  error?: string;
  error_description?: string;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (response: TokenResponse) => void;
          }) => TokenClient;
        };
      };
    };
  }
}

let tokenClient: TokenClient | null = null;
let accessToken = '';

export function hasAccessToken() {
  return Boolean(accessToken);
}

export async function signIn(clientId: string): Promise<void> {
  await loadGoogleIdentityServices();

  if (!window.google?.accounts?.oauth2) {
    throw new Error('Google Identity Servicesを読み込めませんでした。');
  }

  tokenClient ??= window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: GOOGLE_AUTH_SCOPE,
    callback: () => undefined,
  });

  await new Promise<void>((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error('Google認証クライアントを初期化できませんでした。'));
      return;
    }

    tokenClient.callback = (response) => {
      if (response.error) {
        reject(new Error(response.error_description || response.error));
        return;
      }

      if (!response.access_token) {
        reject(new Error('アクセストークンを取得できませんでした。'));
        return;
      }

      accessToken = response.access_token;
      resolve();
    };

    tokenClient.requestAccessToken({ prompt: accessToken ? '' : 'consent' });
  });
}

export async function listCalendars(): Promise<GoogleCalendar[]> {
  const data = await googleFetch<GoogleCalendarListResponse>(
    'https://www.googleapis.com/calendar/v3/users/me/calendarList',
  );

  return [...(data.items ?? [])].sort((a, b) => {
    if (a.primary) return -1;
    if (b.primary) return 1;
    return a.summary.localeCompare(b.summary, 'ja');
  });
}

export async function listEvents(calendarId: string, timeMin: Date, timeMax: Date): Promise<GoogleEvent[]> {
  const params = new URLSearchParams({
    singleEvents: 'true',
    orderBy: 'startTime',
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
  });

  const data = await googleFetch<GoogleEventsResponse>(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
  );

  return (data.items ?? []).filter((event) => event.status !== 'cancelled');
}

export async function createEvent(calendarId: string, draft: EventDraft) {
  await googleFetch(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(toGoogleEventBody(draft)),
  });
}

export async function updateEvent(calendarId: string, eventId: string, draft: EventDraft) {
  await googleFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(toGoogleEventBody(draft)),
    },
  );
}

export async function deleteEvent(calendarId: string, eventId: string) {
  await googleFetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: 'DELETE',
    },
  );
}

export function toCalendarEvent(
  event: GoogleEvent,
  role: CalendarRole,
  calendarId: string,
  colors: CalendarEventColors = {},
) {
  const isAllDay = Boolean(event.start.date);
  const fallbackColors = FALLBACK_EVENT_COLORS[role];
  const backgroundColor = colors.backgroundColor || fallbackColors.backgroundColor;
  const foregroundColor = colors.foregroundColor || fallbackColors.foregroundColor;

  return {
    id: `${role}:${event.id}`,
    title: event.summary || '(無題)',
    start: event.start.dateTime || event.start.date,
    end: event.end.dateTime || event.end.date,
    allDay: isAllDay,
    resourceId: role,
    backgroundColor,
    borderColor: backgroundColor,
    textColor: foregroundColor,
    editable: true,
    durationEditable: true,
    startEditable: true,
    extendedProps: {
      role,
      calendarId,
      googleEventId: event.id,
      description: event.description || '',
      htmlLink: event.htmlLink,
      recurringEventId: event.recurringEventId,
      originalStartTime: event.originalStartTime,
    },
  };
}

async function googleFetch<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  if (!accessToken) {
    throw new Error('Googleにログインしてください。');
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Google API request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

function loadGoogleIdentityServices(): Promise<void> {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.getElementById(GIS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google認証スクリプトの読み込みに失敗しました。')), {
        once: true,
      });
      return;
    }

    const script = document.createElement('script');
    script.id = GIS_SCRIPT_ID;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google認証スクリプトの読み込みに失敗しました。'));
    document.head.appendChild(script);
  });
}

function toGoogleEventBody(draft: EventDraft) {
  if (draft.allDay) {
    return {
      summary: draft.title,
      description: draft.description || undefined,
      start: { date: toDateOnly(draft.start) },
      end: { date: toDateOnly(draft.end) },
    };
  }

  return {
    summary: draft.title,
    description: draft.description || undefined,
    start: {
      dateTime: draft.start.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    end: {
      dateTime: draft.end.toISOString(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  };
}

function toDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
