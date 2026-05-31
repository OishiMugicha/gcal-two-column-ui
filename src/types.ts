export type CalendarRole = 'planned' | 'actual';

export type AppSettings = {
  plannedCalendarId: string;
  actualCalendarId: string;
  slotMinTime: string;
  slotMaxTime: string;
};

export type GoogleCalendar = {
  id: string;
  summary: string;
  primary?: boolean;
  backgroundColor?: string;
  foregroundColor?: string;
};

export type GoogleCalendarListResponse = {
  items?: GoogleCalendar[];
};

export type GoogleEventDate = {
  date?: string;
  dateTime?: string;
  timeZone?: string;
};

export type GoogleEvent = {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: GoogleEventDate;
  end: GoogleEventDate;
  status?: string;
  htmlLink?: string;
  recurringEventId?: string;
  originalStartTime?: GoogleEventDate;
};

export type GoogleEventsResponse = {
  items?: GoogleEvent[];
};

export type EventDraft = {
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  description: string;
};

export type EventEditorMode = 'create' | 'edit';

type EventEditorBaseState = {
  mode: EventEditorMode;
  calendarId: string;
  role: CalendarRole;
  anchor: {
    x: number;
    y: number;
  };
  draft: EventDraft;
};

export type EventCreateEditorState = EventEditorBaseState & {
  mode: 'create';
};

export type EventEditEditorState = EventEditorBaseState & {
  mode: 'edit';
  eventId: string;
  htmlLink?: string;
};

export type EventEditorState = EventCreateEditorState | EventEditEditorState;
