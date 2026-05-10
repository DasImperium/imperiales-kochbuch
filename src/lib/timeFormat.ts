// Time format: "30 min", "1,5 h", "2 h"
export const TIME_REGEX = /^\s*\d+([.,]\d+)?\s*(min|h)\s*$/i;

export function validateTime(s: string): string | null {
  if (!TIME_REGEX.test(s)) return null;
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

export function formatTime(s: string | null | undefined): string {
  if (!s) return "—";
  return s.replace(/\s+/g, " ").trim();
}
