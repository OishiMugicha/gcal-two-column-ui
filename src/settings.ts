import type { AppSettings } from './types';

const SETTINGS_KEY = 'gcal-two-column-ui-settings';

export const defaultSettings: AppSettings = {
  plannedCalendarId: '',
  actualCalendarId: '',
  slotMinTime: '06:00:00',
  slotMaxTime: '24:00:00',
};

export function loadSettings(): AppSettings {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) {
    return defaultSettings;
  }

  try {
    return {
      ...defaultSettings,
      ...JSON.parse(raw),
    };
  } catch {
    return defaultSettings;
  }
}

export function saveSettings(settings: AppSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
