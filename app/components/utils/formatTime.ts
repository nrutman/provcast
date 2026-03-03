/**
 * Format seconds as M:SS (e.g., "3:05").
 * Use for durations, file info, and general display.
 */
export function formatTimeBrief(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Format seconds as M:SS.t with tenths precision (e.g., "3:05.2").
 * Use for region boundaries and trim points.
 */
export function formatTimeTenths(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const whole = Math.floor(secs);
  const tenths = Math.floor((secs - whole) * 10);
  return `${mins}:${whole.toString().padStart(2, "0")}.${tenths}`;
}

/**
 * Format seconds as H:MM:SS.cc or M:SS.cc with centisecond precision (e.g., "1:23:45.67").
 * Use for playback position display.
 */
export function formatTimePrecise(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}
