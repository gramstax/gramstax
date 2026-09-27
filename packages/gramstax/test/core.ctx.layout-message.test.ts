import {describe, expect, it, mock} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {Ctx} from "~/core/ctx"
import {TemplateManager} from "~/template/manager"
import type {ITCtxParams} from "~/types/t.ctx"

const TEST_DIR = join(import.meta.dir, `views-layout-msg`)

class LayoutMsgPage extends Ctx {
  static data = this.buildData({name: `layout-msg-test`})
}

function createCtx(templateManager: unknown, languageCode?: string) {
  const from = {id: 1, is_bot: false, first_name: `Test`, ...(languageCode === undefined ? {} : {language_code: languageCode})} as any
  const ct = {
    api: {config: {use: () => {}}} as any,
    me: {id: 1, is_bot: true, first_name: `Bot`} as any,
    update: {message: {message_id: 1, date: 1, chat: {id: 1, type: `private`}, text: `hi`, from}} as any
  } as unknown as ITCtxParams[`ct`]

  return new LayoutMsgPage({
    ct,
    cacheSession: {} as unknown as ITCtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: templateManager as unknown as ITCtxParams[`templateManager`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
}

describe(`Ctx.getLayoutMessage`, () => {
  it(`passes group key, AGBaseId, language and data to the template manager`, () => {
    const getGMessage = mock(() => `ok`)
    const ctx = createCtx({getGMessage, layoutKey: (group: string) => `_layout:${group}`}, `xx`)
    const out = ctx.getLayoutMessage(`admin`, `navbar`, {a: 1})
    expect(out).toBe(`ok`)
    expect(getGMessage).toHaveBeenCalledTimes(1)
    expect(getGMessage).toHaveBeenCalledWith(`_layout:admin`, `navbar`, `xx`, {a: 1})
  })

  it(`falls back to default language content`, async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
    await mkdir(TEST_DIR, {recursive: true})
    try {
      const manager = new TemplateManager({path: [TEST_DIR]})
      manager.compileLayout(`admin`, `<g-base><g-message>NAV</g-message></g-base>`)
      const ctx = createCtx(manager, `xx`)
      expect(ctx.getLayoutMessage(`admin`)).toBe(`NAV`)
    } finally {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
  })

  it(`returns empty string on unknown group`, async () => {
    if (existsSync(TEST_DIR)) {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
    await mkdir(TEST_DIR, {recursive: true})
    try {
      const manager = new TemplateManager({path: [TEST_DIR]})
      const ctx = createCtx(manager)
      expect(ctx.getLayoutMessage(`nope`)).toBe(``)
    } finally {
      await rm(TEST_DIR, {recursive: true, force: true})
    }
  })
})
