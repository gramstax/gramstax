import dayjs from "dayjs"
import tz from "dayjs/plugin/timezone"
import utc from "dayjs/plugin/utc"

dayjs.extend(utc)
dayjs.extend(tz)

export class TimeHe {
  static template = `YYYY-MM-DD HH:mm:ss`

  /**
   * Format time sebagai UTC.
   * Input boleh Date | number(ms) | string(ISO).
   * Penting: selalu dayjs.utc(...) agar tidak kebaca timezone server.
   */
  static format(time: string | number | Date, includeMs = false) {
    const formatStr = includeMs ? `${this.template}.SSS` : this.template
    return dayjs.utc(time).format(formatStr)
  }

  /** String "now" dalam UTC (konsisten di semua negara/server) */
  static utc(includeMs = false) {
    const formatStr = includeMs ? `${this.template}.SSS` : this.template
    return dayjs.utc().format(formatStr)
  }

  /** Unix timestamp (ms) UTC */
  static utcUnix() {
    return dayjs.utc().valueOf()
  }

  /** JS Date yang merepresentasikan instant UTC (Date itu absolute) */
  static utcDate() {
    return dayjs.utc().toDate()
  }

  static formatUptime(seconds: number) {
    const days = Math.floor(seconds / 86400)
    const hours = Math.floor((seconds % 86400) / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (days > 0) return `${days}d ${hours}h ${minutes}m`
    if (hours > 0) return `${hours}h ${minutes}m ${secs}s`
    if (minutes > 0) return `${minutes}m ${secs}s`
    return `${secs}s`
  }
}
