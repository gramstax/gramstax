/** Parse a widget tap request (`tap:<count>`) into the next count, or null when the request is malformed. */
export function nextCountFromTap(data: string): number | null {
  const match = /^tap:(\d+)$/.exec(data)
  if (match === null) return null
  return Number(match[1]) + 1
}
