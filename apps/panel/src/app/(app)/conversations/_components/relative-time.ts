/**
 * Formats a date string as a human-friendly relative time in Spanish.
 *
 * Examples: "Ahora", "Hace 5 min", "Hace 2 h", "Ayer", "Hace 3 d", "12 jun"
 */
export function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "Ahora";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} d`;
  return date.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}
