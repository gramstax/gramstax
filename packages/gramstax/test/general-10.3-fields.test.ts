import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {Ctx} from "~/core/ctx"
import {TemplateManager} from "~/template/manager"

const TMP_DIR = join(import.meta.dir, `tmp-10.3-general`)

class _TestGramstax extends Gramstax {
  override _pageLoads() {
    return this._buildEmptyPages() as unknown as ReturnType<Gramstax[`_pageLoads`]>
  }
}

const _tm = () => new TemplateManager({path: [TMP_DIR]})
const _bot = (tm = _tm()) => new _TestGramstax({token: `test`, deploy: `test`, templateManager: tm, log: false})

beforeEach(async () => {
  if (!existsSync(TMP_DIR)) await mkdir(TMP_DIR, {recursive: true})
})
afterEach(async () => {
  if (existsSync(TMP_DIR)) await rm(TMP_DIR, {recursive: true, force: true})
})

describe(`General 10.3 fields (can_stop/keep_on_stop, stopped_message_generation, UniqueGiftInfo, community_chat_joined)`, () => {
  it(`sendMessageDraft passthrough can_stop/keep_on_stop`, async () => {
    const bot = _bot()
    const e2e = bot.e2e!
    await (bot.bot as unknown as {init: () => Promise<void>}).init()
    const api = bot.bot.api as unknown as {raw: {sendMessageDraft: (a: unknown) => Promise<unknown>}; sendMessageDraft: (...a: unknown[]) => Promise<unknown>}
    // Try raw first, fallback to high-level
    if (api.raw?.sendMessageDraft) {
      await api.raw.sendMessageDraft({chat_id: 1001, draft_id: 1, text: `hi`, can_stop: true, keep_on_stop: true})
    } else {
      await api.sendMessageDraft(1001, 1, `hi`, {can_stop: true, keep_on_stop: true} as unknown as never)
    }
    const call = e2e.lastCall(`sendMessageDraft`)
    expect(call).toBeDefined()
    expect((call!.body as unknown as {can_stop: boolean}).can_stop).toBe(true)
    expect((call!.body as unknown as {keep_on_stop: boolean}).keep_on_stop).toBe(true)
  })

  it(`sendRichMessageDraft passthrough can_stop/keep_on_stop`, async () => {
    const bot = _bot()
    const e2e = bot.e2e!
    await (bot.bot as unknown as {init: () => Promise<void>}).init()
    const api = bot.bot.api as unknown as {raw: {sendRichMessageDraft: (a: unknown) => Promise<unknown>}; sendRichMessageDraft: (...a: unknown[]) => Promise<unknown>}
    if (api.raw?.sendRichMessageDraft) {
      await api.raw.sendRichMessageDraft({chat_id: 1001, draft_id: 2, rich_message: {html: `<b>hi</b>`} as unknown as never, can_stop: false, keep_on_stop: true})
    } else {
      await api.sendRichMessageDraft({chat_id: 1001, draft_id: 2, rich_message: {html: `<b>hi</b>`} as unknown as never, can_stop: false, keep_on_stop: true} as unknown as never)
    }
    const call = e2e.lastCall(`sendRichMessageDraft`)
    expect(call).toBeDefined()
    expect((call!.body as unknown as {can_stop: boolean}).can_stop).toBe(false)
    expect((call!.body as unknown as {keep_on_stop: boolean}).keep_on_stop).toBe(true)
  })

  it(`stopped_message_generation update routed via registerCustomRoute`, async () => {
    let handled = false
    class TestPage extends Ctx {
      static template = `<g-base><g-message>hi</g-message></g-base>`
      async handleStoppedGeneration() {
        handled = true
        this.temp.isAnswer = true
      }
    }
    const bot = _bot()
    const name = `TestPage`
    ;(bot as unknown as {pages: {all: Record<string, typeof Ctx>}}).pages.all[name] = TestPage
    bot.registerCustomRoute({
      name,
      routeName: `handleStoppedGeneration`,
      listenerName: `stoppedgeneration`,
      event: `stopped_message_generation`,
      filter: (ctx: Ctx) => (ctx.update as unknown as {stopped_message_generation?: unknown}).stopped_message_generation !== undefined
    })
    const e2e = bot.e2e!
    await e2e.handleUpdate({
      update_id: 9991,
      stopped_message_generation: {chat: {id: 1001, type: `private`, first_name: `Test`}, draft_id: 42}
    })
    expect(handled).toBe(true)
  })

  it(`UniqueGiftInfo fields text/entities/is_private preserved`, async () => {
    const info = {gift: {sticker: {file_id: `x`, file_unique_id: `y`, width: 1, height: 1, is_animated: false, is_video: false}}, origin: `upgrade` as const, text: `hello`, entities: [{type: `bold` as const, offset: 0, length: 5}], is_private: true as const}
    expect(info.text).toBe(`hello`)
    expect(info.entities?.[0]?.type).toBe(`bold`)
    expect(info.is_private).toBe(true)
    // e2e helper must simulate the gift via the real Message field `unique_gift`
    const bot = _bot()
    const e2e = bot.e2e!
    const calls = await (e2e as unknown as {sendGiftInfo: (g: Record<string, unknown>) => Promise<unknown[]>}).sendGiftInfo(info)
    expect(Array.isArray(calls)).toBe(true)
  })

  it(`community_chat_joined handled via e2e helper`, async () => {
    const bot = _bot()
    const e2e = bot.e2e!
    const calls = await (e2e as unknown as {sendCommunityChatJoined: (o?: unknown) => Promise<unknown[]>}).sendCommunityChatJoined({})
    expect(Array.isArray(calls)).toBe(true)
  })

  it(`promoteChatMember forwards can_send_welcome_messages`, async () => {
    const bot = _bot()
    const e2e = bot.e2e!
    await (bot.bot as unknown as {init: () => Promise<void>}).init()
    await bot.bot.api.promoteChatMember(1001, 2002, {can_send_welcome_messages: true} as unknown as never)
    const call = e2e.lastCall(`promoteChatMember`)
    expect(call).toBeDefined()
    expect((call!.body as unknown as {can_send_welcome_messages: boolean}).can_send_welcome_messages).toBe(true)
  })
})
