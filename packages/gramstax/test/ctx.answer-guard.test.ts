/**
 * Locks the `isAnswer` attribution contract under concurrent dispatch.
 *
 * @remarks
 * The answer guard transformer is installed on the **shared** `bot.api` exactly
 * once, so it must resolve the owning `Ctx` per async execution context. A
 * key-on-api store (WeakMap or a module-level slot) is single-slot by
 * construction, because every `Ctx` shares one api object — these cases are the
 * guard against that regression.
 */

import {describe, expect, it} from "bun:test"
import {Ctx} from "../src"

class ProbeCtx extends Ctx {
  static data = Ctx.buildData({name: `probe`})
  static template = `<g-base><g-message>x</g-message></g-base>`
  async handleFreeText(): Promise<void> {}
}

type RawFn = (method: string, payload: unknown, signal: AbortSignal) => Promise<unknown>
type Transformer = (prev: RawFn, method: string, payload: unknown, signal: AbortSignal) => Promise<unknown>

/** Minimal stand-in for grammY's Api: records calls, exposes config.use. */
function makeSharedApi() {
  const use: Transformer[] = []
  const api = {
    installedTransformers: 0,
    config: {
      use(fn: Transformer) {
        api.installedTransformers += 1
        use.push(fn)
      }
    },
    async call(method: string) {
      const signal = new AbortController().signal
      const payload: unknown = {}
      let chain: RawFn = () => Promise.resolve({ok: true})
      for (const fn of use) {
        const prev = chain
        chain = (m, p, s) => fn(prev, m, p, s)
      }
      return await chain(method, payload, signal)
    }
  }
  return api
}

const makeCtx = (api: ReturnType<typeof makeSharedApi>) => new ProbeCtx({ct: {update: {update_id: 1}, api, me: {id: 1, is_bot: true, first_name: `b`}}, temp: {isAnswer: false, session: {}, data: {}}} as never)

describe(`Ctx answer guard under concurrency`, () => {
  it(`attributes isAnswer to the ctx whose api call it belongs to`, async () => {
    const api = makeSharedApi()
    const first = makeCtx(api)
    const second = makeCtx(api)

    // concurrent dispatch: both handler bodies are live before either calls the api
    await Promise.all([
      Ctx._answerScope(first, async () => {
        await Promise.resolve()
        await api.call(`sendMessage`)
      }),
      Ctx._answerScope(second, async () => {
        await Promise.resolve()
        await api.call(`getMe`)
      })
    ])

    expect(first.temp.isAnswer).toBe(true) // sendMessage is an answer method
    expect(second.temp.isAnswer).toBe(false) // getMe is not
  })

  it(`keeps attribution correct across interleaved awaits`, async () => {
    const api = makeSharedApi()
    const first = makeCtx(api)
    const second = makeCtx(api)

    await Promise.all([
      (async () => {
        await Ctx._answerScope(first, async () => {
          await new Promise((r) => setTimeout(r, 10))
          await api.call(`sendMessage`)
        })
      })(),
      (async () => {
        await Ctx._answerScope(second, async () => {
          await api.call(`getMe`)
          await new Promise((r) => setTimeout(r, 10))
        })
      })()
    ])

    expect(first.temp.isAnswer).toBe(true)
    expect(second.temp.isAnswer).toBe(false)
  })

  it(`installs the transformer exactly once per shared api`, () => {
    const api = makeSharedApi()
    makeCtx(api)
    makeCtx(api)
    makeCtx(api)
    expect(api.installedTransformers).toBe(1)
  })

  it(`leaves isAnswer untouched for calls outside any dispatch scope`, async () => {
    const api = makeSharedApi()
    const ctx = makeCtx(api)
    await api.call(`sendMessage`)
    expect(ctx.temp.isAnswer).toBe(false)
  })
})
