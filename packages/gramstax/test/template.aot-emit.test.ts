import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {spawnSync} from "node:child_process"
import {cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {pathToFileURL} from "node:url"
import {TemplateEngine} from "~/template/engine"
import {TemplateManager} from "~/template/manager"
import type {ICompiledTemplate} from "~/types/template"
import {AotEmitter} from "../scripts/aot-emit"
import {generate} from "../scripts/build-manifest"

const FIXTURES = join(import.meta.dir, `fixtures`, `manifest`, `pages`)
const CTX_ABS = pathToFileURL(join(import.meta.dir, `..`, `src`, `core`, `ctx.ts`)).href
const SRC_INDEX = pathToFileURL(join(import.meta.dir, `..`, `src`, `index.ts`)).href
const SCRIPT = join(import.meta.dir, `..`, `scripts`, `build-manifest.ts`)

const DECLARATIVE = [
  `<g-base>`,
  `  <g-message>Hello {{name|upper}}! <g-switch value="status"><g-case is="on"><g-map src="items" join=", ">{{e}}</g-map></g-case><g-default>off</g-default></g-switch></g-message>`,
  `  <g-message lang="id">Halo {{name|upper}}!</g-message>`,
  `  <g-keyboard>`,
  `    <g-map src="rows">{{e.name}}</g-map>`,
  `  </g-keyboard>`,
  `  <g-media type="photo" src="{{photo}}">Shot by {{name}}</g-media>`,
  `</g-base>`
].join(`\n`)

const DATA_EN = {items: [`a`, `b`], name: `ann`, photo: `p.jpg`, rows: [{name: `X`}, {name: `Y`}], status: `on`}
const DATA_OFF = {items: [], name: `bo`, photo: `q.jpg`, rows: [{name: `Z`}], status: `idle`}

let dir: string
let emptyDir: string

function relinkCtx(root: string): void {
  const walk = (dirPath: string): void => {
    for (const entry of readdirSync(dirPath)) {
      const full = join(dirPath, entry)
      if (statSync(full).isDirectory()) {
        walk(full)
        continue
      }
      if (!full.endsWith(`.ts`)) continue
      writeFileSync(full, readFileSync(full, `utf-8`).replaceAll(`~/core/ctx`, CTX_ABS))
    }
  }
  walk(root)
}

function buildDeclarative(): ICompiledTemplate {
  const bases = TemplateEngine._processGBaseBlocks(DECLARATIVE)
  return {
    keyboard: TemplateEngine.compileBlockGKeyboards(DECLARATIVE, bases),
    media: TemplateEngine.compileBlockGMedia(DECLARATIVE, bases),
    message: TemplateEngine.compileBlockGMessage(DECLARATIVE, bases)
  } as unknown as ICompiledTemplate
}

function renderAll(manager: TemplateManager, key: string, data: Record<string, unknown>): unknown {
  return {
    keyboard: manager.getGKeyboard(key, `default`, `default`, `inline`, data),
    media: manager.getGMedia(key, `default`, `default`, data),
    message: manager.getGMessage(key, `default`, `default`, data),
    messageId: manager.getGMessage(key, `default`, `id`, data)
  }
}

function relinkGramstaxToSrc(file: string): void {
  const source = readFileSync(file, `utf-8`)
  expect(source).toContain(`from "gramstax"`)
  writeFileSync(file, source.replaceAll(`from "gramstax"`, `from "${SRC_INDEX}"`))
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), `aot-emit-`))
  emptyDir = mkdtempSync(join(tmpdir(), `aot-empty-`))
})

afterEach(() => {
  TemplateEngine.__emitHook = undefined
  rmSync(dir, {force: true, recursive: true})
  rmSync(emptyDir, {force: true, recursive: true})
})

describe(`AOT emitter`, () => {
  it(`emits an importable module with JIT-identical output`, async () => {
    const emitter = new AotEmitter()
    emitter.beginCollect()
    let compiled: ICompiledTemplate
    try {
      compiled = buildDeclarative()
    } finally {
      emitter.endCollect()
    }
    const bodies = emitter.collectBodies({message: compiled.message, keyboard: compiled.keyboard})
    expect(bodies.size).toBeGreaterThan(0)
    const source = emitter.emitModule(`demo`, DECLARATIVE, compiled)
    expect(source).toContain(`import {__esc, FILTERS, TemplateEngine} from "gramstax"`)
    const messageOnly = new AotEmitter()
    messageOnly.beginCollect()
    try {
      const bases = TemplateEngine._processGBaseBlocks(DECLARATIVE)
      const messages = TemplateEngine.compileBlockGMessage(DECLARATIVE, bases)
      const pure = messageOnly.emitModule(`pure`, DECLARATIVE, {message: messages})
      expect(pure).toContain(`import {__esc, FILTERS} from "gramstax"`)
      expect(pure).not.toContain(`TemplateEngine`)
    } finally {
      messageOnly.endCollect()
    }
    writeFileSync(join(dir, `demo.g.js`), source)
    relinkGramstaxToSrc(join(dir, `demo.g.js`))
    const jit = new TemplateManager({path: [emptyDir]})
    jit._compile(`jit`, DECLARATIVE)
    const aot = new TemplateManager({path: [emptyDir]})
    const loaded = (await import(pathToFileURL(join(dir, `demo.g.js`)).href)) as {template?: ICompiledTemplate}
    if (loaded.template === undefined) throw new Error(`demo.g.js has no template export`)
    aot._registerCompiled(`aot`, loaded.template)
    expect(renderAll(aot, `aot`, DATA_EN)).toEqual(renderAll(jit, `jit`, DATA_EN))
    expect(renderAll(aot, `aot`, DATA_OFF)).toEqual(renderAll(jit, `jit`, DATA_OFF))
  })

  it(`with-guard rejects script blocks naming key and ESM reason`, () => {
    for (const template of [`<g-base><g-message>Hi {{~~ name ~~}}!</g-message></g-base>`, `<g-base><g-message>Hi <g-script>return name;</g-script>!</g-message></g-base>`]) {
      const emitter = new AotEmitter()
      emitter.beginCollect()
      try {
        const bases = TemplateEngine._processGBaseBlocks(template)
        const compiled = TemplateEngine.compileBlockGMessage(template, bases)
        let message = ``
        try {
          emitter.emitModule(`risky`, template, compiled)
        } catch (error: unknown) {
          message = error instanceof Error ? error.message : String(error)
        }
        expect(message).toContain(`risky`)
        expect(message).toContain(`with`)
        expect(message).toContain(`ESM`)
      } finally {
        emitter.endCollect()
      }
    }
  })

  it(`rejects non-function non-JSON leaves explicitly`, () => {
    const emitter = new AotEmitter()
    const untagged = (): string => `untagged`
    let fnMessage = ``
    try {
      emitter.collectBodies({message: untagged} as unknown as ICompiledTemplate)
    } catch (error: unknown) {
      fnMessage = error instanceof Error ? error.message : String(error)
    }
    expect(fnMessage).toContain(`AOT cannot emit`)
    expect(fnMessage).toContain(`message`)
    let dateMessage = ``
    try {
      emitter.collectBodies({message: new Date(0)} as unknown as ICompiledTemplate)
    } catch (error: unknown) {
      dateMessage = error instanceof Error ? error.message : String(error)
    }
    expect(dateMessage).toContain(`AOT cannot emit`)
  })

  it(`stubs refuse to render and shared stubs emit once`, () => {
    const raw = `<g-base><g-message>Hi</g-message></g-base>`
    const emitter = new AotEmitter()
    emitter.beginCollect()
    try {
      const bases = TemplateEngine._processGBaseBlocks(raw)
      const messages = TemplateEngine.compileBlockGMessage(raw, bases)
      const stub = messages.default?.default as unknown as () => unknown
      expect(() => stub()).toThrow(`AOT stub`)
      expect(emitter.collectBodies({pair: [messages, messages]}).size).toBeGreaterThan(0)
      const source = emitter.emitModule(`dup`, raw, {x: messages, y: messages})
      expect(source.match(/const fn\d+ = /g)?.length).toBe(1)
    } finally {
      emitter.endCollect()
    }
  })

  it(`safeKey sanitizes slashes for filenames`, () => {
    expect(new AotEmitter().safeKey(`admin/users`)).toBe(`admin_users`)
    expect(new AotEmitter().safeKey(`9lives`)).toBe(`_9lives`)
  })

  it(`--aot flow writes gen/ with importable manifest`, async () => {
    const pages = mkdtempSync(join(tmpdir(), `aot-pages-`))
    const outDir = mkdtempSync(join(tmpdir(), `aot-out-`))
    try {
      cpSync(FIXTURES, pages, {recursive: true})
      relinkCtx(pages)
      mkdirNested(pages)
      generate(pages, outDir, {aot: true})
      expect(existsSync(join(outDir, `gen`, `card.g.js`))).toBe(true)
      expect(existsSync(join(outDir, `gen`, `start.g.js`))).toBe(true)
      expect(existsSync(join(outDir, `gen`, `admin_users.g.js`))).toBe(true)
      expect(existsSync(join(outDir, `gen`, `sub_note.g.js`))).toBe(true)
      expect(existsSync(join(outDir, `gen`, `manifest.js`))).toBe(true)
      for (const entry of readdirSync(join(outDir, `gen`))) {
        if (entry.endsWith(`.g.js`)) relinkGramstaxToSrc(join(outDir, `gen`, entry))
      }
      const loaded = (await import(pathToFileURL(join(outDir, `gen`, `manifest.js`)).href)) as {templates?: Record<string, ICompiledTemplate>}
      if (loaded.templates === undefined) throw new Error(`gen/manifest.js has no templates export`)
      expect(Object.keys(loaded.templates).sort()).toEqual([`admin/users`, `card`, `start`, `sub/note`])
      const aot = new TemplateManager({path: [emptyDir]})
      for (const [key, template] of Object.entries(loaded.templates)) aot._registerCompiled(key, template)
      const jit = new TemplateManager({path: [emptyDir]})
      jit._compile(`card`, readFileSync(join(pages, `card.html`), `utf-8`))
      expect(aot.getGMessage(`card`, `default`, `default`, {})).toBe(jit.getGMessage(`card`, `default`, `default`, {}))
    } finally {
      rmSync(pages, {force: true, recursive: true})
      rmSync(outDir, {force: true, recursive: true})
    }
  })

  it(`emitted modules are edge-safe with Function sabotaged`, async () => {
    const pages = mkdtempSync(join(tmpdir(), `aot-edge-pages-`))
    const outDir = mkdtempSync(join(tmpdir(), `aot-edge-out-`))
    try {
      cpSync(FIXTURES, pages, {recursive: true})
      relinkCtx(pages)
      writeFileSync(join(pages, `showcase.html`), `${DECLARATIVE}\n`)
      generate(pages, outDir, {aot: true})
      const genDir = join(outDir, `gen`)
      const files = readdirSync(genDir).filter((entry) => entry.endsWith(`.js`))
      expect(files.length).toBeGreaterThan(0)
      for (const file of files) {
        const source = readFileSync(join(genDir, file), `utf-8`)
        expect(source).not.toContain(`new Function`)
        expect(source).not.toContain(`Function(`)
        expect(source).not.toContain(`eval(`)
      }
      for (const entry of files) {
        if (entry.endsWith(`.g.js`)) relinkGramstaxToSrc(join(genDir, entry))
      }
      const jit = new TemplateManager({path: [emptyDir]})
      jit._compile(`showcase`, DECLARATIVE)
      const expectedEn = renderAll(jit, `showcase`, DATA_EN)
      const expectedOff = renderAll(jit, `showcase`, DATA_OFF)
      const RealFunction = globalThis.Function
      globalThis.Function = (() => {
        throw new Error(`codegen disabled on edge`)
      }) as unknown as FunctionConstructor
      try {
        const loaded = (await import(pathToFileURL(join(genDir, `manifest.js`)).href)) as {templates?: Record<string, ICompiledTemplate>}
        if (loaded.templates?.showcase === undefined) throw new Error(`showcase missing from gen manifest`)
        const aot = new TemplateManager({path: [emptyDir]})
        aot._registerCompiled(`showcase`, loaded.templates.showcase)
        expect(renderAll(aot, `showcase`, DATA_EN)).toEqual(expectedEn)
        expect(renderAll(aot, `showcase`, DATA_OFF)).toEqual(expectedOff)
      } finally {
        globalThis.Function = RealFunction
      }
    } finally {
      rmSync(pages, {force: true, recursive: true})
      rmSync(outDir, {force: true, recursive: true})
    }
  })

  it(`build-manifest --aot CLI writes gen/`, () => {
    const pages = mkdtempSync(join(tmpdir(), `aot-cli-pages-`))
    const outDir = mkdtempSync(join(tmpdir(), `aot-cli-out-`))
    try {
      cpSync(FIXTURES, pages, {recursive: true})
      relinkCtx(pages)
      const res = spawnSync(process.execPath, [SCRIPT, pages, outDir, `--aot`], {encoding: `utf-8`})
      expect(res.status).toBe(0)
      expect(existsSync(join(outDir, `gen`, `manifest.js`))).toBe(true)
      expect(existsSync(join(outDir, `manifest.js`))).toBe(true)
      expect(existsSync(join(outDir, `routes.json`))).toBe(true)
    } finally {
      rmSync(pages, {force: true, recursive: true})
      rmSync(outDir, {force: true, recursive: true})
    }
  })
})

function mkdirNested(pages: string): void {
  mkdirSync(join(pages, `sub`), {recursive: true})
  writeFileSync(join(pages, `sub`, `note.html`), `<g-base><g-message>NOTE</g-message></g-base>\n`)
}
