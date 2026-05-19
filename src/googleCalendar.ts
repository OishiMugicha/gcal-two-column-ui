import type {
  CalendarRole,
  EventDraft,
  GoogleCalendar,
  GoogleEvent,
} from './types';

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

type AuthSession = {
  authenticated: boolean;
};

export async function getSession(): Promise<AuthSession> {
  return apiFetch<AuthSession>('/api/auth/session');
}

export async function signIn(): Promise<void> {
  window.location.assign('/api/auth/google/start');
}

export async function signOut(): Promise<void> {
  await apiFetch('/api/auth/logout', { method: 'POST' });
}

export async function listCalendars(): Promise<GoogleCalendar[]> {
  return apiFetch<GoogleCalendar[]>('/api/calendars');
}

export async function listEvents(calendarId: string, timeMin: Date, timeMax: Date): Promise<GoogleEvent[]> {
  const params = new URLSearchParams({
    calendarId,
    timeMin: timeMin.toISOString(),
    timeMax: timeMax.toISOString(),
  });

  return apiFetch<GoogleEvent[]>(`/api/events?${params}`);
}

export async function createEvent(calendarId: string, draft: EventDraft) {
  await apiFetch('/api/events', {
    method: 'POST',
    body: JSON.stringify({
      calendarId,
      event: toGoogleEventBody(draft),
    }),
  });
}

export async function updateEvent(calendarId: string, eventId: string, draft: EventDraft) {
  await apiFetch(`/api/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      calendarId,
      event: toGoogleEventBody(draft),
    }),
  });
}

export async function deleteEvent(calendarId: string, eventId: string) {
  const params = new URLSearchParams({ calendarId });
  await apiFetch(`/api/events/${encodeURIComponent(eventId)}?${params}`, {
    method: 'DELETE',
  });
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

async function apiFetch<T = unknown>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });

  if (!response.ok) {
    let message = '';
    try {
      const data = (await response.json()) as { error?: string };
      message = data.error || '';
    } catch {
      message = await response.text();
    }

    if (response.status === 401) {
      throw new Error('Googleにログインしてください。');
    }
    throw new Error(message || `API request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
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
