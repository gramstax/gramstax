import {afterAll, beforeAll, describe, expect, it, mock} from "bun:test"
import {existsSync} from "node:fs"
import {mkdir, rm} from "node:fs/promises"
import {join} from "node:path"
import {Gramstax} from "~/core/bot"
import {TemplateManager} from "~/template/manager"
import type {ICt} from "~/types/ctx"

const TEST_PAGES_DIR = join(import.meta.dir, `download-integration-pages`)

beforeAll(async () => {
  if (!existsSync(TEST_PAGES_DIR)) {
    await mkdir(TEST_PAGES_DIR, {recursive: true})
  }
})

afterAll(async () => {
  if (existsSync(TEST_PAGES_DIR)) {
    await rm(TEST_PAGES_DIR, {recursive: true, force: true})
  }
})

const createBot = () => {
  const tm = new TemplateManager({path: [TEST_PAGES_DIR]})
  return new Gramstax({
    token: `test`,
    deploy: `test`,
    templateManager: tm,
    log: false,
    botConfig: {botInfo: {id: 123456789, is_bot: true, first_name: `Bot`, username: `test_bot`}} as any
  } as never)
}

describe(`file download — full Gramstax pipeline integration`, () => {
  it(`mounts hydrateFiles transformer without crashing`, () => {
    const bot = createBot()
    const xformers = (bot.bot.api.config as unknown as {installedTransformers: () => unknown[]}).installedTransformers()
    expect(xformers.length).toBeGreaterThan(0)
  })

  it(`Ctx.download works via real createCtx instance`, async () => {
    const bot = createBot()
    const ct = {
      update: {message: {chat: {id: 1, type: `private`}, text: `x`, from: {id: 1, is_bot: false, first_name: `T`}}},
      api: {config: {use: () => {}}},
      me: {id: 1, is_bot: true, first_name: `Bot`}
    } as unknown as ICt

    const ctx = bot.createCtx(ct)
    const downloadMock = mock(async (path?: string) => path ?? `/tmp/file.bin`)
    ;(ctx as unknown as {getFile: () => Promise<{download: (path?: string) => Promise<string>}>}).getFile = mock(async () => ({download: downloadMock}))

    const path = await ctx.download()
    expect(path).toBe(`/tmp/file.bin`)
    expect(downloadMock).toHaveBeenCalledWith(undefined)
  })

  it(`Ctx.download works with explicit path`, async () => {
    const bot = createBot()
    const ct = {
      update: {message: {chat: {id: 1, type: `private`}, text: `x`, from: {id: 1, is_bot: false, first_name: `T`}}},
      api: {config: {use: () => {}}},
      me: {id: 1, is_bot: true, first_name: `Bot`}
    } as unknown as ICt

    const ctx = bot.createCtx(ct)
    const downloadMock = mock(async (path?: string) => path ?? `/tmp/file.bin`)
    ;(ctx as unknown as {getFile: () => Promise<{download: (path?: string) => Promise<string>}>}).getFile = mock(async () => ({download: downloadMock}))

    const path = await ctx.download(`/tmp/report.pdf`)
    expect(path).toBe(`/tmp/report.pdf`)
    expect(downloadMock).toHaveBeenCalledWith(`/tmp/report.pdf`)
  })
})
