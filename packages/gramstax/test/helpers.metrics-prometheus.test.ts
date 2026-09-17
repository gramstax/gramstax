import {describe, expect, it} from "bun:test"
import {mkdtempSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {MetricsStore, metricsToPrometheus} from "~/helpers/metrics"
import {TemplateManager} from "~/template/manager"

describe(`metricsToPrometheus`, () => {
  it(`emits listener counters with labels and type header`, () => {
    const store = new MetricsStore()
    store.recordUpdate(`text`, 12)
    store.recordUpdate(`text`, 8)
    const text = metricsToPrometheus(store.snapshot())
    expect(text).toContain(`# TYPE gramstax_updates_total counter`)
    expect(text).toContain(`gramstax_updates_total{listener="text"} 2`)
  })

  it(`emits latency lines when samples exist`, () => {
    const store = new MetricsStore()
    store.recordUpdate(`text`, 10)
    store.recordUpdate(`text`, 30)
    const text = metricsToPrometheus(store.snapshot())
    expect(text).toContain(`gramstax_update_duration_ms{quantile="avg"} 20`)
    expect(text).toContain(`gramstax_update_duration_ms{quantile="max"} 30`)
  })

  it(`skips latency lines when no samples`, () => {
    const store = new MetricsStore()
    const text = metricsToPrometheus(store.snapshot())
    expect(text).not.toContain(`gramstax_update_duration_ms`)
  })

  it(`emits queue stats when provided`, () => {
    const store = new MetricsStore()
    const text = metricsToPrometheus(store.snapshot(), {length: 2, maxSize: 100, waitingEnqueue: 1, waitingDequeue: 0})
    expect(text).toContain(`gramstax_queue_length 2`)
    expect(text).toContain(`gramstax_queue_max_size 100`)
    expect(text).toContain(`gramstax_queue_waiting_enqueue 1`)
    expect(text).toContain(`gramstax_queue_waiting_dequeue 0`)
  })

  it(`skips zero counters`, () => {
    const store = new MetricsStore()
    const text = metricsToPrometheus(store.snapshot())
    expect(text).not.toContain(`gramstax_updates_matched_total 0`)
    expect(text).not.toContain(`gramstax_updates_failed_total 0`)
  })

  it(`emits uptime seconds`, () => {
    const store = new MetricsStore()
    const text = metricsToPrometheus(store.snapshot())
    expect(text).toMatch(/gramstax_uptime_seconds \d+/)
  })

  it(`ends with a trailing newline`, () => {
    const store = new MetricsStore()
    expect(metricsToPrometheus(store.snapshot()).endsWith(`\n`)).toBe(true)
  })
})

describe(`hookTrace`, () => {
  it(`fires after a routed update`, async () => {
    const dir = mkdtempSync(join(tmpdir(), `gramstax-metrics-`))
    writeFileSync(join(dir, `page.html`), `<g-base><g-message>hi</g-message></g-base>`)
    const tm = new TemplateManager({path: [dir]})
    class TraceBot extends Gramstax {
      spans: unknown[] = []
      override hookTrace(span: {name: string; durationMs: number; attributes: Record<string, unknown>}): void {
        this.spans.push(span)
      }
    }
    const bot = new TraceBot({
      token: `test`,
      deploy: `test`,
      templateManager: tm,
      log: false,
      botConfig: {botInfo: {id: 123456789, is_bot: true, first_name: `Bot`, username: `test_bot`}} as never
    } as never)

    await bot.bot.handleUpdate({
      update_id: Math.floor(Math.random() * 1000000),
      message: {
        message_id: 1,
        chat: {id: 123456789, type: `private`},
        date: Math.floor(Date.now() / 1000),
        from: {id: 123456789, is_bot: false, first_name: `User`},
        text: `x`
      }
    } as never)

    expect(bot.spans.length).toBe(1)
    expect((bot.spans[0] as {name: string}).name).toBe(`text`)
    expect(typeof (bot.spans[0] as {durationMs: number}).durationMs).toBe(`number`)
    expect((bot.spans[0] as {attributes: {state: string}}).attributes.state).toBe(`no-match`)
  })
})