import {describe, expect, it, mock} from "bun:test"
import {SessionLock} from "~/core/session-lock"
import type {IRedisLockClient} from "~/types/session-lock"

const createLock = (overrides: {leaseMs?: number; onContended?: `skip` | `wait` | `serialize`} = {}, clientOverrides: Record<string, unknown> = {}) => {
  const client = {
    set: mock(async () => `OK`),
    eval: mock(async () => 1),
    ...clientOverrides
  } as unknown as IRedisLockClient
  const lock = new SessionLock(client, {leaseMs: overrides.leaseMs ?? 5000, onContended: overrides.onContended ?? `skip`})
  return {client, lock}
}

describe(`SessionLock (Redis atomic)`, () => {
  it(`acquires via SET NX with lease TTL`, async () => {
    const {client, lock} = createLock()
    const token = await lock.acquire(`u1:c1`)
    expect(token).toBeTruthy()
    expect(client.set).toHaveBeenCalledWith(`lock:u1:c1`, token, {PX: 5000, NX: true})
  })

  it(`returns null when the key is already held`, async () => {
    const {lock} = createLock({}, {set: mock(async () => null)})
    expect(await lock.acquire(`u1:c1`)).toBeNull()
  })

  it(`releases via atomic Lua script with the owned token`, async () => {
    const {client, lock} = createLock()
    await lock.release(`u1:c1`, `tok-1`)
    expect(client.eval).toHaveBeenCalledWith(expect.stringContaining(`redis.call("get", KEYS[1]) == ARGV[1]`), {
      keys: [`lock:u1:c1`],
      arguments: [`tok-1`]
    })
  })

  it(`withLock runs fn under lock and returns its value`, async () => {
    const {client, lock} = createLock()
    let ran = false
    const result = await lock.withLock(`u1:c1`, async () => {
      ran = true
      return 42
    })
    expect(ran).toBe(true)
    expect(result).toBe(42)
    expect(client.eval).toHaveBeenCalledTimes(1)
  })

  it(`withLock returns null when contended (skip mode)`, async () => {
    const {lock} = createLock({}, {set: mock(async () => null)})
    expect(await lock.withLock(`u1:c1`, async () => `x`)).toBeNull()
  })

  it(`wait mode retries until the lease frees`, async () => {
    let held = true
    const {lock} = createLock({leaseMs: 500, onContended: `wait`}, {set: mock(async () => (held ? null : `OK`))})
    let ran = false
    const pending = lock.withLock(`k`, async () => {
      ran = true
    })
    setTimeout(() => {
      held = false
    }, 20)
    expect(await pending).not.toBeNull()
    expect(ran).toBe(true)
  })

  it(`serialize mode queues jobs per key`, async () => {
    const {lock} = createLock({onContended: `serialize`})
    let active = 0
    let maxActive = 0
    const job = async () => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((resolve) => setTimeout(resolve, 10))
      active--
      return `done`
    }
    const results = await Promise.all([lock.withLock(`k`, job), lock.withLock(`k`, job), lock.withLock(`k`, job)])
    expect(results).toEqual([`done`, `done`, `done`])
    expect(maxActive).toBe(1)
  })
})