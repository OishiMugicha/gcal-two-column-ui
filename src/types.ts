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
  start: GoogleEventDate;
  end: GoogleEventDate;
  status?: string;
  htmlLink?: string;
};

export type GoogleEventsResponse = {
  items?: GoogleEvent[];
};

export type PendingSelection = {
  start: Date;
  end: Date;
  allDay: boolean;
};
