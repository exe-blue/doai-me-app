/**
 * 24h window helper for dashboard/runs
 */
export function getWindow24h(): { start: Date; end: Date; startISO: string; endISO: string } {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return {
    start,
    end,
    startISO: start.toISOString(),
    endISO: end.toISOString(),
  };
}

export function formatHourKey(date: Date): string {
  return date.toISOString().slice(0, 13) + ":00:00.000Z";
}
