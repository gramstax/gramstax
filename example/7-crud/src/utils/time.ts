export class TimeUt {
  static formatTimestamp(ts: number) {
    return new Date(ts).toISOString().replace(`T`, ` `).slice(0, 19)
  }
}
