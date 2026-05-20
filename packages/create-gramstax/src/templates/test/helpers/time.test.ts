import {describe, it, expect} from "bun:test"
import {TimeHe} from "../../src/helpers/time"

describe(`TimeHe`, () => {
  describe(`format`, () => {
    it(`formats a Date object as UTC string`, () => {
      const date = new Date(`2025-01-15T10:30:00.000Z`)
      const result = TimeHe.format(date)
      expect(result).toBe(`2025-01-15 10:30:00`)
    })

    it(`formats a timestamp (ms) as UTC string`, () => {
      const ts = Date.UTC(2025, 0, 15, 10, 30, 0)
      const result = TimeHe.format(ts)
      expect(result).toBe(`2025-01-15 10:30:00`)
    })

    it(`formats an ISO string as UTC string`, () => {
      const result = TimeHe.format(`2025-01-15T10:30:00Z`)
      expect(result).toBe(`2025-01-15 10:30:00`)
    })

    it(`includes milliseconds when includeMs is true`, () => {
      const date = new Date(`2025-01-15T10:30:00.123Z`)
      const result = TimeHe.format(date, true)
      expect(result).toBe(`2025-01-15 10:30:00.123`)
    })

    it(`excludes milliseconds when includeMs is false`, () => {
      const date = new Date(`2025-01-15T10:30:00.123Z`)
      const result = TimeHe.format(date, false)
      expect(result).toBe(`2025-01-15 10:30:00`)
    })
  })

  describe(`utc`, () => {
    it(`returns current time as formatted UTC string`, () => {
      const result = TimeHe.utc()
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    })

    it(`returns current time with milliseconds when includeMs is true`, () => {
      const result = TimeHe.utc(true)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}$/)
    })
  })

  describe(`utcUnix`, () => {
    it(`returns a numeric timestamp in milliseconds`, () => {
      const result = TimeHe.utcUnix()
      expect(typeof result).toBe(`number`)
      expect(result).toBeGreaterThan(1_700_000_000_000)
    })
  })

  describe(`utcDate`, () => {
    it(`returns a Date object`, () => {
      const result = TimeHe.utcDate()
      expect(result instanceof Date).toBe(true)
    })
  })

  describe(`formatUptime`, () => {
    it(`formats seconds only`, () => {
      expect(TimeHe.formatUptime(45)).toBe(`45s`)
    })

    it(`formats minutes and seconds`, () => {
      expect(TimeHe.formatUptime(125)).toBe(`2m 5s`)
    })

    it(`formats hours, minutes, and seconds`, () => {
      expect(TimeHe.formatUptime(3725)).toBe(`1h 2m 5s`)
    })

    it(`formats days, hours, and minutes`, () => {
      expect(TimeHe.formatUptime(90061)).toBe(`1d 1h 1m`)
    })

    it(`formats multiple days`, () => {
      expect(TimeHe.formatUptime(259200)).toBe(`3d 0h 0m`)
    })

    it(`handles zero seconds`, () => {
      expect(TimeHe.formatUptime(0)).toBe(`0s`)
    })

    it(`handles exact minute boundaries`, () => {
      expect(TimeHe.formatUptime(60)).toBe(`1m 0s`)
    })

    it(`handles exact hour boundaries`, () => {
      expect(TimeHe.formatUptime(3600)).toBe(`1h 0m 0s`)
    })

    it(`handles exact day boundaries`, () => {
      expect(TimeHe.formatUptime(86400)).toBe(`1d 0h 0m`)
    })
  })
})
