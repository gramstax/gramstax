import {run, bench, group} from "mitata"
import {mkdir, rm, writeFile} from "node:fs/promises"
import {existsSync} from "node:fs"
import {join} from "node:path"
import {TemplateManager} from "../packages/gramstax/src/template/manager"

const BENCH_DIR = join(process.cwd(), `benchmark`, `tmp_bench_views`)

async function setup() {
  if (existsSync(BENCH_DIR)) {
    await rm(BENCH_DIR, {recursive: true, force: true})
  }
  await mkdir(BENCH_DIR, {recursive: true})

  // 1. Create a large "start" template with many blocks
  let startTemplate = `<base id="common"><keyboard>Item 1, Item 2, Item 3</keyboard><message>Common Header</message></base>\n`
  for (let i = 0; i < 50; i++) {
    startTemplate += `<base id="block-${i}"><message>Block ${i} content</message></base>\n`
  }
  await writeFile(join(BENCH_DIR, `start.html`), startTemplate)

  // 2. Create 104 pages that all import from start.html
  const pageCount = 104
  for (let i = 0; i < pageCount; i++) {
    const pageTemplate = `
        <base>
            <import src="start" base="common" />
            <import src="start" base="block-${i % 50}" />
            <message>Page ${i} unique content</message>
        </base>`
    await writeFile(join(BENCH_DIR, `page-${i}.html`), pageTemplate)
  }
}

async function cleanup() {
  await rm(BENCH_DIR, {recursive: true, force: true})
}

await setup()

group(`Template Initialization (105 files)`, () => {
  bench(`TemplateManager.init`, () => {
    new TemplateManager({path: [BENCH_DIR]})
  })
})

await run()
await cleanup()
