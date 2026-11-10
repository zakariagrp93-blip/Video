export function formatEtaCli(sec: number | null): string {
  if (sec === null || !Number.isFinite(sec)) return '';
  return sec < 60 ? ` (~${Math.round(sec)} s left)` : ` (~${Math.round(sec / 60)} min left)`;
}
