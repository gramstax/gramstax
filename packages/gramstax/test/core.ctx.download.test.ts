import {describe, expect, it, mock} from "bun:test"
import {Ctx} from "~/core/ctx"
import type {ICtxParams} from "~/types/ctx"

const createCtx = () => {
  const ct = {
    api: {config: {use: () => {}}},
    me: {id: 1, is_bot: true, first_name: `Bot`},
    update: {message: {chat: {id: 1, type: `private`}, text: `x`, from: {id: 1, is_bot: false, first_name: `T`}}}
  } as unknown as ICtxParams[`ct`]
  return new Ctx({
    ct,
    cacheSession: {} as unknown as ICtxParams[`cacheSession`],
    cacheKeyboard: new Map(),
    templateManager: {} as unknown as ICtxParams[`templateManager`],
    temp: {isAnswer: false, session: {}, data: {}}
  })
}

describe(`Ctx.download`, () => {
  it(`downloads to a temp path when path omitted`, async () => {
    const ctx = createCtx()
    const download = mock(async (path?: string) => path ?? `/tmp/file.bin`)
    ;(ctx as unknown as {getFile: () => Promise<{download: (path?: string) => Promise<string>}>}).getFile = mock(async () => ({download}))

    const path = await ctx.download()

    expect(path).toBe(`/tmp/file.bin`)
    expect(download).toHaveBeenCalledWith(undefined)
  })

  it(`downloads to an explicit path`, async () => {
    const ctx = createCtx()
    const download = mock(async (path?: string) => path ?? `/tmp/file.bin`)
    ;(ctx as unknown as {getFile: () => Promise<{download: (path?: string) => Promise<string>}>}).getFile = mock(async () => ({download}))

    const path = await ctx.download(`/tmp/report.pdf`)

    expect(path).toBe(`/tmp/report.pdf`)
    expect(download).toHaveBeenCalledWith(`/tmp/report.pdf`)
  })

  it(`rejects download path containing ".." via forward slash`, async () => {
    const ctx = createCtx()
    const download = mock(async (path?: string) => path ?? `/tmp/file.bin`)
    ;(ctx as unknown as {getFile: () => Promise<{download: (path?: string) => Promise<string>}>}).getFile = mock(async () => ({download}))

    await expect(ctx.download(`../../etc/passwd`)).rejects.toThrow(`..`)
    expect(download).not.toHaveBeenCalled()
  })

  it(`rejects download path containing ".." via backslash`, async () => {
    const ctx = createCtx()
    const download = mock(async (path?: string) => path ?? `/tmp/file.bin`)
    ;(ctx as unknown as {getFile: () => Promise<{download: (path?: string) => Promise<string>}>}).getFile = mock(async () => ({download}))

    await expect(ctx.download(`..\\..\\secret.txt`)).rejects.toThrow(`..`)
    expect(download).not.toHaveBeenCalled()
  })

  it(`rejects download path containing null bytes`, async () => {
    const ctx = createCtx()
    const download = mock(async (path?: string) => path ?? `/tmp/file.bin`)
    ;(ctx as unknown as {getFile: () => Promise<{download: (path?: string) => Promise<string>}>}).getFile = mock(async () => ({download}))

    await expect(ctx.download(`/tmp/bad\0file`)).rejects.toThrow(`null bytes`)
    expect(download).not.toHaveBeenCalled()
  })

  it(`rejects download path with embedded ".." segment`, async () => {
    const ctx = createCtx()
    const download = mock(async (path?: string) => path ?? `/tmp/file.bin`)
    ;(ctx as unknown as {getFile: () => Promise<{download: (path?: string) => Promise<string>}>}).getFile = mock(async () => ({download}))

    await expect(ctx.download(`/tmp/a/../b/file.txt`)).rejects.toThrow(`..`)
    expect(download).not.toHaveBeenCalled()
  })
})
