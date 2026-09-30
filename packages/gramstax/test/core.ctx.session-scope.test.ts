import {describe, expect, it, mock} from "bun:test"
import {Ctx} from "~/core/ctx"
import type {ICtxParams} from "~/types/ctx"

class TestPage extends Ctx {
  static data = this.buildData({name: `session-scope-test`})
}

function createTestCtx(chatId: number, storage: Map<string, unknown>) {
  const ct = {
    api: {config: {use: () => {}}},
    me: {id: 1, is_bot: true, first_name: `Bot`} as any,
    update: {message: {chat: {id: chatId, type: `private`}, text: `test`, from: {id: 1, is_bot: false, first_name: `Test`}}} as any
  } as unknown as ICtxParams[`ct`]

  const cacheSession = {
    get: mock(async (key: string) => (storage.get(key) as unknown) ?? null),
    set: mock(async (key: string, value: unknown) => {
      storage.set(key, value)
      return true
    }),
    delete: mock(async (key: string) => {
      const existed = storage.has(key)
      storage.delete(key)
      return existed
    })
  }

  return new TestPage({
    ct,
    cacheSession: cacheSession as unknown as ICtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: {} as unknown as ICtxParams[`templateManager`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
}

describe(`Ctx session chat scoping (K4)`, () => {
  it(`does not share session state between different chats of the same user`, async () => {
    const storage = new Map<string, unknown>()
    const ctxChatA = createTestCtx(10, storage)
    const ctxChatB = createTestCtx(20, storage)

    await ctxChatA.setSession(`handleSessionText`, {text: `from-chat-A`})
    const sessionInB = await ctxChatB.getSession()

    expect(sessionInB).toBeNull()
  })

  it(`shares session state within the same chat`, async () => {
    const storage = new Map<string, unknown>()
    const ctxChatA1 = createTestCtx(10, storage)
    const ctxChatA2 = createTestCtx(10, storage)

    await ctxChatA1.setSession(`handleSessionText`, {text: `same-chat`})
    const sessionInA2 = await ctxChatA2.getSession()

    expect(sessionInA2?.method).toBe(`handleSessionText`)
    expect(sessionInA2?.params).toEqual({text: `same-chat`})
  })
})

describe(`Ctx clearSession scoping (K4)`, () => {
  it(`clears the session stored under the scoped user:chat key`, async () => {
    const storage = new Map<string, unknown>()
    const ctx = createTestCtx(10, storage)

    await ctx.setSession(`handleSessionText`, {text: `to-clear`})
    expect(storage.has(`1:10`)).toBe(true)

    const result = await ctx.clearSession()

    expect(result).toBe(true)
    expect(storage.has(`1:10`)).toBe(false)
    expect(await ctx.getSession()).toBeNull()
  })

  it(`does not clear sessions of other chats`, async () => {
    const storage = new Map<string, unknown>()
    const ctxChatA = createTestCtx(10, storage)
    const ctxChatB = createTestCtx(20, storage)

    await ctxChatA.setSession(`handleSessionText`, {text: `chat-a`})
    await ctxChatB.clearSession()

    expect(storage.has(`1:10`)).toBe(true)
    expect((await ctxChatA.getSession())?.params).toEqual({text: `chat-a`})
  })

  it(`returns null when neither from nor chat is present`, async () => {
    const ct = {
      api: {config: {use: () => {}}},
      me: {id: 1, is_bot: true, first_name: `Bot`} as any,
      update: {} as any
    } as unknown as ICtxParams[`ct`]

    const cacheSession = {
      get: mock(async () => null),
      set: mock(async () => true),
      delete: mock(async () => false)
    }

    const ctx = new TestPage({
      ct,
      cacheSession: cacheSession as unknown as ICtxParams[`cacheSession`],
      cacheKeyboard: new Map(),
      templateManager: {} as unknown as ICtxParams[`templateManager`],
      temp: {isAnswer: false, session: {}, data: {}}
    })

    expect(await ctx.clearSession()).toBeNull()
    expect(cacheSession.delete).not.toHaveBeenCalled()
  })

  it(`does not re-read the external cache after clearSession (memoization micro-opt)`, async () => {
    const storage = new Map<string, unknown>()
    const ctx = createTestCtx(10, storage)
    let getCalls = 0
    const origGet = ctx.cacheSession.get.bind(ctx.cacheSession)
    ;(ctx.cacheSession as {get: (k: string) => Promise<unknown>}).get = async (key: string) => {
      getCalls++
      return origGet(key)
    }

    await ctx.setSession(`handleSessionText`, {text: `to-clear`})
    await ctx.clearSession()
    getCalls = 0

    const session = await ctx.getSession()

    expect(session).toBeNull()
    expect(getCalls).toBe(0)
  })
})
