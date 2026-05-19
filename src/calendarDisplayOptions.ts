export const calendarDisplayOptions = {
  eventMinHeight: 15,
} as const;

export type TimedEventRange = {
  startMinutes: number;
  endMinutes: number;
};

export type VerticalSpan = {
  top: number;
  bottom: number;
};

export function getTimedEventVerticalSpan(
  event: TimedEventRange,
  pixelsPerMinute: number,
  eventMinHeight = calendarDisplayOptions.eventMinHeight,
): VerticalSpan {
  const top = event.startMinutes * pixelsPerMinute;
  const naturalBottom = event.endMinutes * pixelsPerMinute;

  return {
    top,
    bottom: Math.max(top + eventMinHeight, naturalBottom),
  };
}

export function doVerticalSpansOverlap(left: VerticalSpan, right: VerticalSpan) {
  return left.top < right.bottom && right.top < left.bottom;
}
