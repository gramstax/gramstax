import {describe, expect, it, mock} from "bun:test"
import {Ctx} from "~/core/ctx"
import type {ITCtxParams} from "~/types/t.ctx"

class TestPage extends Ctx {
  static data = this.buildData({name: `session-scope-test`})
}

function createTestCtx(chatId: number, storage: Map<string, unknown>) {
  const ct = {
    api: {config: {use: () => {}}},
    me: {id: 1, is_bot: true, first_name: `Bot`} as any,
    update: {message: {chat: {id: chatId, type: `private`}, text: `test`, from: {id: 1, is_bot: false, first_name: `Test`}}} as any
  } as unknown as ITCtxParams[`ct`]

  const cacheSession = {
    get: mock(async (key: string) => (storage.get(key) as unknown) ?? null),
    set: mock(async (key: string, value: unknown) => {
      storage.set(key, value)
      return true
    })
  }

  return new TestPage({
    ct,
    cacheSession: cacheSession as unknown as ITCtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: {} as unknown as ITCtxParams[`templateManager`],
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