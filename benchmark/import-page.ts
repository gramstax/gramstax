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
  let startTemplate = `<g-base id="common"><g-keyboard>Item 1, Item 2, Item 3</g-keyboard><g-message>Common Header</g-message></g-base>\n`
  for (let i = 0; i < 50; i++) {
    startTemplate += `<g-base id="block-${i}"><g-message>Block ${i} content</g-message></g-base>\n`
  }
  await writeFile(join(BENCH_DIR, `start.html`), startTemplate)

  // 2. Create 104 pages that all import from start.html
  const pageCount = 104
  for (let i = 0; i < pageCount; i++) {
    const pageTemplate = `
        <g-base>
            <g-import src="start" base="common" />
            <g-import src="start" base="block-${i % 50}" />
            <g-message>Page ${i} unique content</g-message>
        </g-base>`
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
