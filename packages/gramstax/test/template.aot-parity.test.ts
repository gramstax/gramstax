import {afterEach, beforeEach, describe, expect, it} from "bun:test"
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {join} from "node:path"
import {pathToFileURL} from "node:url"
import {TemplateManager} from "~/template/manager"
import type {ICompiledTemplate} from "~/types/template"
import {AotEmitter} from "../scripts/aot-emit"

const SRC_INDEX = pathToFileURL(join(import.meta.dir, `..`, `src`, `index.ts`)).href
const CODEGEN_TOKENS = [`new Function`, `Function(`, `eval(`]

type Entry = {
  block: string
  template: string
  render: (manager: TemplateManager, data: Record<string, unknown>) => unknown
  datasets: Array<Record<string, unknown>>
}

const ENTRIES: Entry[] = [
  {block: `message`, datasets: [{name: `ann`}, {}], render: (manager, data) => manager.getGMessage(`parity-message`, `default`, `default`, data), template: `<g-base><g-message>Hello {{name|upper}}!</g-message></g-base>`},
  {block: `keyboard`, datasets: [{rows: [{name: `A`}, {name: `B`}]}, {}], render: (manager, data) => manager.getGKeyboard(`parity-keyboard`, `default`, `default`, `inline`, data), template: `<g-base><g-keyboard><g-map src="rows">{{e.name}}</g-map></g-keyboard></g-base>`},
  {block: `media`, datasets: [{name: `ann`, photo: `p.jpg`}, {}], render: (manager, data) => manager.getGMedia(`parity-media`, `default`, `default`, data), template: `<g-base><g-media type="photo" src="{{photo}}">Shot by {{name}}</g-media></g-base>`},
  {
    block: `poll`,
    datasets: [{choice: `b variant`, reason: `it is`, topic: `math`}, {}],
    render: (manager, data) => manager.getGPoll(`parity-poll`, `default`, `default`, data),
    template: `<g-base><g-poll type="quiz" correct="0" explanation="Because {{reason}}"><g-question>What is {{topic}}?</g-question><g-option>Answer A</g-option><g-option>{{choice|upper}}</g-option></g-poll></g-base>`
  },
  {block: `venue`, datasets: [{name: `Cafe`}, {}], render: (manager, data) => manager.getGVenue(`parity-venue`, `default`, `default`, data), template: `<g-base><g-venue title="{{name}}" address="Jl. Merdeka 1" latitude="-6.2" longitude="106.8"/></g-base>`},
  {block: `dice`, datasets: [{dice: `🎯`}, {}], render: (manager, data) => manager.getGDice(`parity-dice`, `default`, `default`, data), template: `<g-base><g-dice emoji="{{dice}}"/></g-base>`},
  {block: `callbackAnswer`, datasets: [{orderId: `o-1`}, {}], render: (manager, data) => manager.getGCallbackAnswer(`parity-callbackAnswer`, `default`, `default`, data), template: `<g-base><g-callback-answer>Pesanan {{orderId}} diproses</g-callback-answer></g-base>`},
  {block: `precheckoutError`, datasets: [{item: `susu`}, {}], render: (manager, data) => manager.getGPrecheckoutError(`parity-precheckoutError`, `default`, `default`, data), template: `<g-base><g-precheckout-error>Stok {{item}} habis</g-precheckout-error></g-base>`},
  {block: `shippingError`, datasets: [{city: `Bogor`}, {}], render: (manager, data) => manager.getGShippingError(`parity-shippingError`, `default`, `default`, data), template: `<g-base><g-shipping-error>Di luar zona {{city}}</g-shipping-error></g-base>`},
  {block: `inlineButton`, datasets: [{item: `Pro`}, {}], render: (manager, data) => manager.getGInlineButton(`parity-inlineButton`, `default`, `default`, data), template: `<g-base><g-inline-button text="Lihat {{item}}" start-parameter="detail-1"/></g-base>`},
  {block: `answerNote`, datasets: [{kind: `guest`}, {}], render: (manager, data) => manager.getGAnswerNote(`parity-answerNote`, `default`, `default`, data), template: `<g-base><g-answer-note>Guest fallback {{kind}}</g-answer-note></g-base>`},
  {block: `gift`, datasets: [{item: `stars`}, {}], render: (manager, data) => manager.getGGift(`parity-gift`, `default`, `default`, data), template: `<g-base><g-gift>Hadiah <b>{{item}}</b> untukmu!</g-gift></g-base>`},
  {
    block: `invoice`,
    datasets: [{days: `30`, orderId: `o-9`}, {}],
    render: (manager, data) => manager.getGInvoice(`parity-invoice`, `default`, `default`, data),
    template: `<g-base><g-invoice title="VIP {{days}} hari" description="Akses semua konten" payload="{{orderId}}" currency="XTR"><g-price label="VIP {{days}} hari" amount="100"/></g-invoice></g-base>`
  },
  {
    block: `paidMedia`,
    datasets: [{full: `v.mp4`, teaser: `t.jpg`}, {}],
    render: (manager, data) => manager.getGPaidMedia(`parity-paidMedia`, `default`, `default`, data),
    template: `<g-base><g-paid-media stars="100"><g-media type="photo" src="{{teaser}}">Bayar untuk membuka</g-media><g-media type="video" src="{{full}}">Konten full</g-media></g-paid-media></g-base>`
  },
  {block: `description`, datasets: [{x: `y`}, {}], render: (manager, data) => manager.getGDescription(`parity-description`, `default`, `default`, `default`, data), template: `<g-base><g-description>Desc {{x}}</g-description></g-base>`}
]

let dir: string
let emptyDir: string

function relinkGramstaxToSrc(file: string): void {
  const source = readFileSync(file, `utf-8`)
  expect(source).toContain(`from "gramstax"`)
  writeFileSync(file, source.replaceAll(`from "gramstax"`, `from "${SRC_INDEX}"`))
}

async function checkParity(entry: Entry, sabotage: boolean): Promise<void> {
  const key = `parity-${entry.block}`
  const jit = new TemplateManager({path: [emptyDir]})
  jit.compile(key, entry.template)
  const expected = entry.datasets.map((data) => entry.render(jit, data))
  const emitter = new AotEmitter()
  const scratch = new TemplateManager({path: [emptyDir]})
  emitter.beginCollect()
  try {
    scratch.compile(key, entry.template)
  } finally {
    emitter.endCollect()
  }
  const compiled = (scratch as unknown as {_map: Map<string, ICompiledTemplate>})._map.get(key)
  if (compiled === undefined) throw new Error(`no compiled template for ${key}`)
  const source = emitter.emitModule(key, entry.template, compiled)
  for (const token of CODEGEN_TOKENS) expect(source).not.toContain(token)
  const file = join(dir, `${emitter.safeKey(key)}.g.js`)
  writeFileSync(file, source)
  relinkGramstaxToSrc(file)
  const RealFunction = globalThis.Function
  if (sabotage) {
    globalThis.Function = (() => {
      throw new Error(`codegen disabled on edge`)
    }) as unknown as FunctionConstructor
  }
  try {
    const loaded = (await import(pathToFileURL(file).href)) as {template?: ICompiledTemplate}
    if (loaded.template === undefined) throw new Error(`no template export in ${file}`)
    const aot = new TemplateManager({path: [emptyDir]})
    aot.registerCompiled(key, loaded.template)
    entry.datasets.forEach((data, index) => {
      expect(entry.render(aot, data)).toEqual(expected[index])
    })
  } finally {
    if (sabotage) globalThis.Function = RealFunction
  }
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), `aot-parity-`))
  emptyDir = mkdtempSync(join(tmpdir(), `aot-parity-empty-`))
})

afterEach(() => {
  rmSync(dir, {force: true, recursive: true})
  rmSync(emptyDir, {force: true, recursive: true})
})

describe(`AOT 15-block parity`, () => {
  for (const entry of ENTRIES) {
    it(`${entry.block} renders identically JIT vs AOT`, async () => {
      await checkParity(entry, entry.block === `media`)
    })
  }

  it(`covers every _compile dispatch field`, () => {
    expect(ENTRIES.map((entry) => entry.block).sort()).toEqual([`answerNote`, `callbackAnswer`, `description`, `dice`, `gift`, `inlineButton`, `invoice`, `keyboard`, `media`, `message`, `paidMedia`, `poll`, `precheckoutError`, `shippingError`, `venue`])
  })
})
