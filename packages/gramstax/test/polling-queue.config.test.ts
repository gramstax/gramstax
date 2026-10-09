import {describe, expect, it} from "bun:test"
import {GramstaxConfigLoader} from "~/cli/config"

/**
 * `optionsDeploy.polling.queue` validation.
 *
 * `_validateConfig` throws synchronously, so `load` is an `async` wrapper: a
 * synchronous throw inside an async body becomes a rejection, which lets every
 * failure case be asserted with `expect(...).rejects` instead of a bare
 * `expect(() => ...).toThrow`.
 */
const load = async (polling: unknown, deploy = `polling`) => {
  const loader = new GramstaxConfigLoader()
  return loader._validateConfig(`gramstax.config.ts`, {deploy, optionsDeploy: {polling}})
}

describe(`optionsDeploy.polling.queue validation`, () => {
  it(`accepts a full queue block`, async () => {
    const out = await load({maxRetries: 5, queue: {enabled: true, workerCount: 4, perChatConcurrency: 1, maxQueueSize: 5000, blockWhenFull: false, enqueueTimeoutMs: 1000, waiterTimeoutMs: 2000}})
    expect(out.optionsDeploy?.polling?.maxRetries).toBe(5)
    expect(out.optionsDeploy?.polling?.queue).toEqual({enabled: true, workerCount: 4, perChatConcurrency: 1, maxQueueSize: 5000, blockWhenFull: false, enqueueTimeoutMs: 1000, waiterTimeoutMs: 2000})
  })

  it(`accepts a queue block on its own`, async () => {
    const out = await load({queue: {enabled: true}})
    expect(out.optionsDeploy?.polling?.queue).toEqual({enabled: true})
    expect(out.optionsDeploy?.polling?.maxRetries).toBeUndefined()
  })

  it(`accepts a polling drainTimeoutMs`, async () => {
    const out = await load({queue: {drainTimeoutMs: 500}})
    expect((out.optionsDeploy?.polling as {queue?: {drainTimeoutMs?: number}}).queue?.drainTimeoutMs).toBe(500)
  })

  it(`rejects a negative polling drainTimeoutMs`, async () => {
    await expect(load({queue: {drainTimeoutMs: -1}})).rejects.toThrow(/`optionsDeploy\.polling\.queue\.drainTimeoutMs` must be a non-negative number/)
  })

  it(`rejects unknown fields and names the polling path`, async () => {
    await expect(load({queue: {nope: 1}})).rejects.toThrow(/unknown field `nope` in `optionsDeploy\.polling\.queue`/)
  })

  it(`rejects an unknown field beside a valid queue`, async () => {
    await expect(load({queue: {workerCount: 2}, nope: 1})).rejects.toThrow(/unknown field `nope` in `optionsDeploy\.polling` \(supported: `maxRetries`, `queue`, `dropPendingUpdates`\)/)
  })

  it(`rejects workerCount below 1`, async () => {
    await expect(load({queue: {workerCount: 0}})).rejects.toThrow(/`optionsDeploy\.polling\.queue\.workerCount` must be a positive number/)
  })

  it(`rejects maxQueueSize of 0`, async () => {
    await expect(load({queue: {maxQueueSize: 0}})).rejects.toThrow(/`optionsDeploy\.polling\.queue\.maxQueueSize` must be a positive number/)
  })

  it(`rejects a non-boolean blockWhenFull`, async () => {
    await expect(load({queue: {blockWhenFull: `yes`}})).rejects.toThrow(/`optionsDeploy\.polling\.queue\.blockWhenFull` must be a boolean/)
  })

  it(`still rejects maxRetries: -2`, async () => {
    await expect(load({maxRetries: -2})).rejects.toThrow(/-1 or a non-negative/)
  })

  it(`still rejects a polling branch under deploy webhook`, async () => {
    await expect(load({maxRetries: 2}, `webhook`)).rejects.toThrow(/does not match/)
  })
})

/**
 * Parity with `optionsDeploy.webhook.queue`: one table, both branches. A value
 * that is legal under one branch must be legal under the other, and a value
 * rejected by one must be rejected by the other — otherwise the shared
 * validator has drifted.
 */
describe(`queue validator parity between polling and webhook`, () => {
  const loadWebhook = async (queue: unknown) => {
    const loader = new GramstaxConfigLoader()
    return loader._validateConfig(`gramstax.config.ts`, {deploy: `webhook`, optionsDeploy: {webhook: {url: `https://example.com/hook`, secretToken: `s3cr3t`, queue}}})
  }

  const cases: Array<{queue: unknown; valid: boolean}> = [
    {queue: {}, valid: true},
    {queue: {enabled: true, maxQueueSize: 5000, workerCount: 8, perChatConcurrency: 1, blockWhenFull: true, enqueueTimeoutMs: 10_000, waiterTimeoutMs: 30_000}, valid: true},
    {queue: {perChatConcurrency: 0}, valid: true},
    {queue: {nope: 1}, valid: false},
    {queue: {enabled: `yes`}, valid: false},
    {queue: {maxQueueSize: 0}, valid: false},
    {queue: {maxQueueSize: -1}, valid: false},
    {queue: {maxQueueSize: Number.POSITIVE_INFINITY}, valid: false},
    {queue: {workerCount: 0}, valid: false},
    // Non-integers pass: the shared validator only enforces `>= 1`, never
    // integrality. Locked here so the quirk stays identical on both branches
    // rather than one side silently gaining an integer check.
    {queue: {workerCount: 1.5}, valid: true},
    {queue: {perChatConcurrency: -1}, valid: false},
    {queue: {blockWhenFull: `yes`}, valid: false},
    {queue: {enqueueTimeoutMs: -1}, valid: false},
    {queue: {waiterTimeoutMs: -1}, valid: false},
    {queue: {waiterTimeoutMs: `x`}, valid: false},
    {queue: {drainTimeoutMs: -1}, valid: false},
    {queue: {drainTimeoutMs: `x`}, valid: false},
    {queue: {drainTimeoutMs: 0}, valid: true},
    {queue: [], valid: false}
  ]

  for (const entry of cases) {
    const label = JSON.stringify(entry.queue)
    it(`polling and webhook agree on ${label}`, async () => {
      const polling = load({queue: entry.queue}).then(
        () => `ok`,
        () => `threw`
      )
      const webhook = loadWebhook(entry.queue).then(
        () => `ok`,
        () => `threw`
      )
      const results = await Promise.all([polling, webhook])
      expect(results[0]).toBe(results[1])
      expect(results[0] === `ok`).toBe(entry.valid)
    })
  }
})
