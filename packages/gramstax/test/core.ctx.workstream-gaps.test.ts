import {describe, expect, it, mock} from "bun:test"
import {InputFile} from "grammy"
import {Ctx} from "~/core/ctx"
import {TemplateEngine} from "~/template/engine"
import type {ICtxParams} from "~/types/ctx"

class GapPage extends Ctx {
  static data = Ctx.buildData({name: `gapscan`})
}

const makeCtx = (update: Record<string, unknown>, extra?: {log?: unknown; onSendError?: unknown}): GapPage => {
  const tm = {getGMessage: mock(() => ({kind: `message`, text: `hello`, rich: false})), getGMedia: mock(() => undefined)} as never
  const ct = {api: {config: {use: () => {}}}, me: {id: 9, is_bot: true, first_name: `Bot`}, update} as unknown as ICtxParams[`ct`]
  return new GapPage({
    ct,
    cacheSession: {} as unknown as ICtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: tm as ICtxParams[`templateManager`],
    log: (extra?.log ?? null) as ICtxParams[`log`],
    onSendError: (extra?.onSendError ?? null) as unknown as ICtxParams[`onSendError`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
}

const msgUpdate = (chatId: number): Record<string, unknown> => ({
  message: {message_id: 1, date: 1, chat: {id: chatId, type: `private`}, text: `hi`, from: {id: 7, is_bot: false, first_name: `A`}}
})

describe(`workstream-gaps-send-context`, () => {
  it(`sendPageName reads the page name and falls back to unknown without data`, () => {
    expect(makeCtx(msgUpdate(1)).sendPageName()).toBe(`gapscan`)
    const bare = makeCtx(msgUpdate(1))
    ;(bare as unknown as {data: unknown}).data = undefined as never
    expect(bare.sendPageName()).toBe(`unknown`)
  })

  it(`sendChatId returns the numeric chat id and undefined when the update carries no chat`, () => {
    expect(makeCtx(msgUpdate(42)).sendChatId()).toBe(42)
    const noChat = makeCtx({message: {message_id: 1, date: 1, text: `hi`, from: {id: 7, is_bot: false, first_name: `A`}}})
    expect(noChat.sendChatId()).toBeUndefined()
  })

  it(`notifySendError forwards page, kind, and chatId to the hook`, () => {
    const seen: Array<{err: unknown; info: unknown}> = []
    const ctx = makeCtx(msgUpdate(5), {onSendError: (err: unknown, info: unknown) => void seen.push({err, info})})
    const err = new Error(`send boom`)
    ctx.notifySendError(err, `retryable`, 5)
    expect(seen.length).toBe(1)
    expect(seen[0]!.err).toBe(err)
    expect(seen[0]!.info).toEqual({page: `gapscan`, kind: `retryable`, chatId: 5})
  })

  it(`notifySendError stays silent without a hook and swallows a throwing hook`, () => {
    const silent = makeCtx(msgUpdate(1))
    expect(() => silent.notifySendError(new Error(`x`), `fallback-text`, 1)).not.toThrow()
    const throwing = makeCtx(msgUpdate(1), {
      onSendError: () => {
        throw new Error(`hook boom`)
      }
    })
    expect(() => throwing.notifySendError(new Error(`x`), `retryable`, 1)).not.toThrow()
  })
})

describe(`workstream-gaps-engine-media-src-privates`, () => {
  it(`_matchBareMediaPlaceholder accepts only bare placeholders (direct: no isolated public path)`, () => {
    expect(TemplateEngine._matchBareMediaPlaceholder(`{{image}}`)).toBe(`image`)
    expect(TemplateEngine._matchBareMediaPlaceholder(`  {{ user.avatar }}  `)).toBe(`user.avatar`)
    expect(TemplateEngine._matchBareMediaPlaceholder(`{{x|upper}}`)).toBeNull()
    expect(TemplateEngine._matchBareMediaPlaceholder(`pre-{{x}}`)).toBeNull()
    expect(TemplateEngine._matchBareMediaPlaceholder(`file.jpg`)).toBeNull()
    expect(TemplateEngine._matchBareMediaPlaceholder(``)).toBeNull()
  })

  it(`_resolveMediaDataPath walks dotted paths null-safely (direct: no isolated public path)`, () => {
    expect(TemplateEngine._resolveMediaDataPath({a: {b: {c: 7}}}, `a.b.c`)).toBe(7)
    expect(TemplateEngine._resolveMediaDataPath({a: {b: 1}}, `a.missing.deep`)).toBeUndefined()
    expect(TemplateEngine._resolveMediaDataPath(undefined, `a.b`)).toBeUndefined()
    expect(TemplateEngine._resolveMediaDataPath(null as never, `a`)).toBeUndefined()
  })

  it(`_compileMediaSrc passes objects by reference and strings through the compiled fn (direct: closure has no public handle)`, () => {
    const stringFn = (data?: Record<string, unknown>): string => String(data?.image ?? ``)
    const bare = TemplateEngine._compileMediaSrc(`{{image}}`, stringFn)
    const file = new InputFile(Buffer.from(`bytes`), `pic.bin`)
    expect(bare({image: file})).toBe(file)
    const buf = Buffer.from(`raw`)
    expect(bare({image: buf})).toBe(buf)
    expect(bare({image: `pic.jpg`})).toBe(`pic.jpg`)
    expect(bare({})).toBe(``)
    const plain = TemplateEngine._compileMediaSrc(`static.jpg`, stringFn)
    expect(plain).toBe(stringFn)
    expect(plain({image: file})).toBe(`[object Object]`)
  })

  it(`compileBlockGMedia wires bare src placeholders through the public compile path`, () => {
    const compiled = TemplateEngine.compileBlockGMedia(`<g-base><g-media type="photo" src="{{image}}">{{caption}}</g-media></g-base>`)
    const file = new InputFile(Buffer.from(`bytes`), `pic.bin`)
    const block = compiled.default?.default?.({image: file, caption: `Hi`})
    expect(block?.src).toBe(file)
    const textBlock = compiled.default?.default?.({image: `pic.jpg`, caption: `Hi`})
    expect(textBlock?.src).toBe(`pic.jpg`)
  })
})
