import {describe, it, expect, beforeEach, afterEach, mock} from "bun:test"
import {mkdir, rm, writeFile} from "node:fs/promises"
import {existsSync} from "node:fs"
import {join} from "node:path"
import {InlineKeyboard} from "grammy"
import {TemplateManager} from "~/template/manager"
import {Ctx} from "~/core/ctx"
import type {ITCtxParams} from "~/types/t.ctx"

const TEST_DIR = join(import.meta.dir, `ctx_broadcast_views`)

class BroadcastCtx extends Ctx {
  static data = this.buildData({name: `broadcast`})
}

describe(`Ctx.renderBroadcastMedia`, () => {
  beforeEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
    await mkdir(TEST_DIR, {recursive: true})
  })

  afterEach(async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
  })

  it(`should send media based on template type and language`, async () => {
    await writeFile(
      join(TEST_DIR, `broadcast.html`),
      `
      <g-base>
        <g-media type="photo" src="photo-default.jpg">Hello</g-media>
        <g-media lang="id" type="photo" src="photo-id.jpg">Halo</g-media>
      </g-base>
    `
    )

    const templateManager = new TemplateManager({path: [TEST_DIR]})

    const sendPhoto = mock(() => true)
    const ct = {
      api: {
        sendPhoto
      }
    } as unknown as ITCtxParams[`ct`]

    const ctx = new BroadcastCtx({
      ct,
      cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
      cacheKeyboard: new Map(),
      templateManager,
      temp: {isAnswer: false, session: {}, data: {}}
    })

    await ctx.renderBroadcastMedia([1, 2], [`default`, `id`])

    expect(sendPhoto).toHaveBeenCalledTimes(2)
    expect(sendPhoto).toHaveBeenNthCalledWith(1, 1, `photo-default.jpg`, expect.objectContaining({caption: `Hello`, parse_mode: `HTML`}))
    expect(sendPhoto).toHaveBeenNthCalledWith(2, 2, `photo-id.jpg`, expect.objectContaining({caption: `Halo`, parse_mode: `HTML`}))
  })

  it(`should send pipe-delimited photo src values as media group`, async () => {
    await writeFile(
      join(TEST_DIR, `broadcast.html`),
      `
      <g-base>
        <g-media type="photo" src="one.jpg|two.jpg|three.jpg">Album</g-media>
      </g-base>
    `
    )

    const templateManager = new TemplateManager({path: [TEST_DIR]})

    const sendPhoto = mock(() => true)
    const sendMediaGroup = mock<(chatId: number, media: unknown[], other?: unknown, signal?: unknown) => Promise<unknown>>(() => true as any)
    const ct = {
      api: {
        sendPhoto,
        sendMediaGroup
      }
    } as unknown as ITCtxParams[`ct`]

    const ctx = new BroadcastCtx({
      ct,
      cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
      cacheKeyboard: new Map(),
      templateManager,
      temp: {isAnswer: false, session: {}, data: {}}
    })

    await ctx.renderBroadcastMedia([1], [`default`], new InlineKeyboard())

    expect(sendPhoto).not.toHaveBeenCalled()
    expect(sendMediaGroup).toHaveBeenCalledTimes(1)
    expect(sendMediaGroup.mock.calls[0]![1]).toEqual([
      {type: `photo`, media: `one.jpg`, caption: `Album`, parse_mode: `HTML`},
      {type: `photo`, media: `two.jpg`},
      {type: `photo`, media: `three.jpg`}
    ])
  })

  it(`should keep unsupported pipe-delimited media types on single-send path`, async () => {
    await writeFile(
      join(TEST_DIR, `broadcast.html`),
      `
      <g-base>
        <g-media type="animation" src="one.gif|two.gif">Animation</g-media>
      </g-base>
    `
    )

    const templateManager = new TemplateManager({path: [TEST_DIR]})

    const sendAnimation = mock(() => true)
    const sendMediaGroup = mock(() => true)
    const ct = {
      api: {
        sendAnimation,
        sendMediaGroup
      }
    } as unknown as ITCtxParams[`ct`]

    const ctx = new BroadcastCtx({
      ct,
      cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
      cacheKeyboard: new Map(),
      templateManager,
      temp: {isAnswer: false, session: {}, data: {}}
    })

    await ctx.renderBroadcastMedia([1], [`default`])

    expect(sendMediaGroup).not.toHaveBeenCalled()
    expect(sendAnimation).toHaveBeenCalledTimes(1)
    expect(sendAnimation).toHaveBeenCalledWith(1, `one.gif|two.gif`, expect.objectContaining({caption: `Animation`, parse_mode: `HTML`}))
  })

  it(`should reply with media group for supported pipe-delimited media src values`, async () => {
    await writeFile(
      join(TEST_DIR, `broadcast.html`),
      `
      <g-base>
        <g-media type="document" src="one.pdf|two.pdf">Docs</g-media>
      </g-base>
    `
    )

    const templateManager = new TemplateManager({path: [TEST_DIR]})

    const replyWithDocument = mock(() => true)
    const replyWithMediaGroup = mock<(chatId: number, media: unknown[], other?: unknown, signal?: unknown) => Promise<unknown>>(() => true as any)
    const ct = {
      from: {language_code: `default`},
      update: {message: {chat: {id: 1}, from: {language_code: `default`}, message_id: 1}},
      api: {sendDocument: replyWithDocument, sendMediaGroup: replyWithMediaGroup}
    } as unknown as ITCtxParams[`ct`]

    const ctx = new BroadcastCtx({
      ct,
      cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
      cacheKeyboard: new Map(),
      templateManager,
      temp: {isAnswer: false, session: {}, data: {}}
    })

    await ctx.renderMediaGroup(`document`)

    expect(replyWithDocument).not.toHaveBeenCalled()
    expect(replyWithMediaGroup).toHaveBeenCalledTimes(1)
    expect(replyWithMediaGroup.mock.calls[0]![1]).toEqual([
      {type: `document`, media: `one.pdf`, caption: `Docs`, parse_mode: `HTML`},
      {type: `document`, media: `two.pdf`}
    ])
  })

  it(`should expose convenience media group reply methods for all supported group types`, async () => {
    const sendMediaGroup = mock<(chatId: number, media: unknown[], other?: unknown, signal?: unknown) => Promise<unknown>>(() => true as any)
    const ct = {
      from: {language_code: `default`},
      update: {message: {chat: {id: 1}, from: {language_code: `default`}, message_id: 1}},
      api: {sendMediaGroup}
    } as unknown as ITCtxParams[`ct`]
    const templateManager = {
      getGMedia: mock((key: string) => ({
        type: key.replace(`Group`, ``),
        src: `one|two`,
        srcList: [`one`, `two`],
        caption: key
      }))
    } as unknown as TemplateManager

    class PhotoGroupCtx extends Ctx {
      static data = this.buildData({name: `photoGroup`})
    }
    class VideoGroupCtx extends Ctx {
      static data = this.buildData({name: `videoGroup`})
    }
    class AudioGroupCtx extends Ctx {
      static data = this.buildData({name: `audioGroup`})
    }
    class DocumentGroupCtx extends Ctx {
      static data = this.buildData({name: `documentGroup`})
    }

    const params = {
      ct,
      cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
      cacheKeyboard: new Map(),
      templateManager,
      temp: {isAnswer: false, session: {}, data: {}}
    }

    await new PhotoGroupCtx(params).renderPhotoGroup()
    await new VideoGroupCtx(params).renderVideoGroup()
    await new AudioGroupCtx(params).renderAudioGroup()
    await new DocumentGroupCtx(params).renderDocumentGroup()

    expect(sendMediaGroup).toHaveBeenCalledTimes(4)
    expect(sendMediaGroup.mock.calls[0]![1]).toEqual([{type: `photo`, media: `one`, caption: `photoGroup`, parse_mode: `HTML`}, {type: `photo`, media: `two`}])
    expect(sendMediaGroup.mock.calls[1]![1]).toEqual([{type: `video`, media: `one`, caption: `videoGroup`, parse_mode: `HTML`}, {type: `video`, media: `two`}])
    expect(sendMediaGroup.mock.calls[2]![1]).toEqual([{type: `audio`, media: `one`, caption: `audioGroup`, parse_mode: `HTML`}, {type: `audio`, media: `two`}])
    expect(sendMediaGroup.mock.calls[3]![1]).toEqual([{type: `document`, media: `one`, caption: `documentGroup`, parse_mode: `HTML`}, {type: `document`, media: `two`}])
  })

  it(`should reply with mixed photo and video media-group block`, async () => {
    await writeFile(
      join(TEST_DIR, `broadcast.html`),
      `
      <g-base>
        <g-media-group>
          <g-media type="photo" src="{{photoUrl}}">Mixed {{title}}</g-media>
          <g-media type="video" src="{{videoUrl}}"></g-media>
          <g-media type="photo" src="static.jpg"></g-media>
        </g-media-group>
      </g-base>
    `
    )

    const templateManager = new TemplateManager({path: [TEST_DIR]})

    const replyWithMediaGroup = mock<(chatId: number, media: unknown[], other?: unknown, signal?: unknown) => Promise<unknown>>(() => true as any)
    const ct = {
      from: {language_code: `default`},
      update: {message: {chat: {id: 1}, from: {language_code: `default`}, message_id: 1}},
      api: {sendMediaGroup: replyWithMediaGroup}
    } as unknown as ITCtxParams[`ct`]

    const ctx = new BroadcastCtx({
      ct,
      cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
      cacheKeyboard: new Map(),
      templateManager,
      temp: {isAnswer: false, session: {}, data: {}}
    })

    await ctx.renderMediaGroup(undefined, {photoUrl: `photo.jpg`, videoUrl: `video.mp4`, title: `Album`})

    expect(replyWithMediaGroup.mock.calls[0]![1]).toEqual([
      {type: `photo`, media: `photo.jpg`, caption: `Mixed Album`, parse_mode: `HTML`},
      {type: `video`, media: `video.mp4`},
      {type: `photo`, media: `static.jpg`}
    ])
  })

  it(`should respect lang attribute on inner media items inside media-group`, async () => {
    await writeFile(
      join(TEST_DIR, `broadcast.html`),
      `
      <g-base>
        <g-media-group>
          <g-media type="photo" src="en.jpg">English</g-media>
          <g-media lang="wkwkland" type="photo" src="wkwk.jpg">Wkwkland</g-media>
          <g-media type="photo" src="shared.jpg"></g-media>
        </g-media-group>
      </g-base>
    `
    )

    const templateManager = new TemplateManager({path: [TEST_DIR]})

    const replyWithMediaGroup = mock<(chatId: number, media: unknown[], other?: unknown, signal?: unknown) => Promise<unknown>>(() => true as any)
    const ct = {
      from: {language_code: `default`},
      update: {message: {chat: {id: 1}, from: {language_code: `default`}, message_id: 1}},
      api: {sendMediaGroup: replyWithMediaGroup}
    } as unknown as ITCtxParams[`ct`]

    const ctxDefault = new BroadcastCtx({
      ct,
      cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
      cacheKeyboard: new Map(),
      templateManager,
      temp: {isAnswer: false, session: {}, data: {}}
    })

    // Default language: only items without lang (2 items)
    await ctxDefault.renderMediaGroup(undefined)

    expect(replyWithMediaGroup).toHaveBeenCalledTimes(1)
    expect(replyWithMediaGroup.mock.calls[0]![1]).toEqual([
      {type: `photo`, media: `en.jpg`, caption: `English`, parse_mode: `HTML`},
      {type: `photo`, media: `shared.jpg`}
    ])
  })

  it(`should replace editMedia with media group reply for supported pipe-delimited media src values`, async () => {
    await writeFile(
      join(TEST_DIR, `broadcast.html`),
      `
      <g-base>
        <g-media type="video" src="one.mp4|two.mp4">Videos</g-media>
      </g-base>
    `
    )

    const templateManager = new TemplateManager({path: [TEST_DIR]})

    const deleteMessage = mock(() => true)
    const editMessageMedia = mock(() => true)
    const replyWithMediaGroup = mock<(chatId: number, media: unknown[], other?: unknown, signal?: unknown) => Promise<unknown>>(() => true as any)
    const ct = {
      from: {language_code: `default`},
      update: {message: {chat: {id: 1}, message_id: 1}},
      api: {deleteMessage, editMessageMedia, sendMediaGroup: replyWithMediaGroup}
    } as unknown as ITCtxParams[`ct`]

    const ctx = new BroadcastCtx({
      ct,
      cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
      cacheKeyboard: new Map(),
      templateManager,
      temp: {isAnswer: false, session: {}, data: {}}
    })

    await ctx.renderEditMedia(`video`)

    expect(editMessageMedia).not.toHaveBeenCalled()
    expect(deleteMessage).toHaveBeenCalledTimes(1)
    expect(replyWithMediaGroup.mock.calls[0]![1]).toEqual([
      {type: `video`, media: `one.mp4`, caption: `Videos`, parse_mode: `HTML`},
      {type: `video`, media: `two.mp4`}
    ])
  })

  it(`should expose convenience edit media group methods for all supported group types`, async () => {
    const deleteMessage = mock(() => true)
    const replyWithMediaGroup = mock<(chatId: number, media: unknown[], other?: unknown, signal?: unknown) => Promise<unknown>>(() => true as any)
    const ct = {
      from: {language_code: `default`},
      update: {message: {chat: {id: 1}, message_id: 1}},
      api: {deleteMessage, sendMediaGroup: replyWithMediaGroup}
    } as unknown as ITCtxParams[`ct`]
    const templateManager = {
      getGMedia: mock((key: string) => ({
        type: key.replace(/Media/, ``),
        src: `one|two`,
        srcList: [`one`, `two`],
        caption: key
      }))
    } as unknown as TemplateManager

    class PhotoGroupEditCtx extends Ctx {
      static data = this.buildData({name: `photoGroupEdit`})
    }
    class VideoGroupEditCtx extends Ctx {
      static data = this.buildData({name: `videoGroupEdit`})
    }
    class AudioGroupEditCtx extends Ctx {
      static data = this.buildData({name: `audioGroupEdit`})
    }
    class DocumentGroupEditCtx extends Ctx {
      static data = this.buildData({name: `documentGroupEdit`})
    }

    const params = {
      ct,
      cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
      cacheKeyboard: new Map(),
      templateManager,
      temp: {isAnswer: false, session: {}, data: {}}
    }

    await new PhotoGroupEditCtx(params).renderEditPhotoGroup()
    await new VideoGroupEditCtx(params).renderEditVideoGroup()
    await new AudioGroupEditCtx(params).renderEditAudioGroup()
    await new DocumentGroupEditCtx(params).renderEditDocumentGroup()

    expect(deleteMessage).toHaveBeenCalledTimes(4)
    expect(replyWithMediaGroup).toHaveBeenCalledTimes(4)
    expect(replyWithMediaGroup).toHaveBeenCalledTimes(4)
    expect(replyWithMediaGroup.mock.calls[0]![1]).toEqual([{type: `photo`, media: `one`, caption: `photoGroupEdit`, parse_mode: `HTML`}, {type: `photo`, media: `two`}])
    expect(replyWithMediaGroup.mock.calls[1]![1]).toEqual([{type: `video`, media: `one`, caption: `videoGroupEdit`, parse_mode: `HTML`}, {type: `video`, media: `two`}])
    expect(replyWithMediaGroup.mock.calls[2]![1]).toEqual([{type: `audio`, media: `one`, caption: `audioGroupEdit`, parse_mode: `HTML`}, {type: `audio`, media: `two`}])
    expect(replyWithMediaGroup.mock.calls[3]![1]).toEqual([{type: `document`, media: `one`, caption: `documentGroupEdit`, parse_mode: `HTML`}, {type: `document`, media: `two`}])
  })
})
