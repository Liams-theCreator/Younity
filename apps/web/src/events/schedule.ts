export function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
export function scheduleDuration(start: string, end: string) {
  const minutes = (Date.parse(end) - Date.parse(start)) / 60000
  return Number.isFinite(minutes) && minutes > 0
    ? `${Math.floor(minutes / 60)}h ${minutes % 60 ? `${minutes % 60}m` : ''}`.trim()
    : null
}
