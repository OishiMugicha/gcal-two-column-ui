import { describe, expect, it } from 'vitest';
import { doVerticalSpansOverlap, getTimedEventVerticalSpan } from './calendarDisplayOptions';

describe('timed event vertical layout', () => {
  it('does not make adjacent 15-minute and 60-minute events visually overlap', () => {
    const firstEvent = getTimedEventVerticalSpan(
      {
        startMinutes: 12 * 60 + 45,
        endMinutes: 13 * 60,
      },
      0.8,
    );
    const secondEvent = getTimedEventVerticalSpan(
      {
        startMinutes: 13 * 60,
        endMinutes: 14 * 60,
      },
      0.8,
    );

    expect(doVerticalSpansOverlap(firstEvent, secondEvent)).toBe(false);
  });

  it('still detects events that actually overlap in time', () => {
    const firstEvent = getTimedEventVerticalSpan(
      {
        startMinutes: 12 * 60 + 45,
        endMinutes: 13 * 60 + 15,
      },
      0.8,
    );
    const secondEvent = getTimedEventVerticalSpan(
      {
        startMinutes: 13 * 60,
        endMinutes: 14 * 60,
      },
      0.8,
    );

    expect(doVerticalSpansOverlap(firstEvent, secondEvent)).toBe(true);
  });
});
