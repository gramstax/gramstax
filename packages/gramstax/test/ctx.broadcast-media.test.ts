import {describe, it, expect, beforeEach, afterEach, mock} from "bun:test"
import {mkdir, rm, writeFile} from "node:fs/promises"
import {existsSync} from "node:fs"
import {join} from "node:path"
import {TemplateManager} from "~/template/manager"
import {Ctx} from "~/core/ctx"

const TEST_DIR = join(import.meta.dir, `ctx_broadcast_views`)

class BroadcastCtx extends Ctx {
  static data = this.buildData({name: `broadcast`})
}

describe(`Ctx.broadcastMedia`, () => {
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
      <base>
        <media type="photo" src="photo-default.jpg">Hello</media>
        <media lang="id" type="photo" src="photo-id.jpg">Halo</media>
      </base>
    `
    )

    const templateManager = new TemplateManager({path: [TEST_DIR]})

    const sendPhoto = mock(() => true)
    const ct = {
      api: {
        sendPhoto
      }
    } as any

    const ctx = new BroadcastCtx({
      ct,
      cacheSession: {} as any,
      cacheKeyboard: new Map(),
      templateManager,
      temp: {isAnswer: false, session: {}, data: {}}
    })

    await ctx.broadcastMedia([1, 2], [`default`, `id`])

    expect(sendPhoto).toHaveBeenCalledTimes(2)
    expect(sendPhoto).toHaveBeenNthCalledWith(1, 1, `photo-default.jpg`, expect.objectContaining({caption: `Hello`, parse_mode: `HTML`}))
    expect(sendPhoto).toHaveBeenNthCalledWith(2, 2, `photo-id.jpg`, expect.objectContaining({caption: `Halo`, parse_mode: `HTML`}))
  })
})
