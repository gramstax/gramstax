/**
 * build-manifest.ts
 *
 * Emits a static-import manifest module from a pages directory for
 * filesystem-less boot (Cloudflare Workers and other runtimes without
 * `readdirSync`/`require` at runtime).
 *
 * Single source of truth: page discovery reuses PageManager.getFileManySync
 * (same routeName derivation, same duplicate errors); `.html` template keys
 * mirror the TemplateManager walk (index files use the parent route).
 * Class-inline `static template` strings ride the imported classes and are
 * compiled by `_pageLoadsFromManifest` — only `.html` files are embedded.
 *
 * Usage:
 *   bun run build:manifest -- <pagesDir> <outFile>
 *       → e.g. bun run build:manifest -- example/11-cloudflare-worker/src/pages example/11-cloudflare-worker/src/manifest.ts
 *
 * The outFile SHOULD live outside the pages dir; entries matching outFile
 * are skipped so regenerating never compiles the manifest as a page.
 */

import {existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync} from "node:fs"
import {dirname, join, relative, resolve, sep} from "node:path"
import {RouteCollector} from "../src/cli/collect"
import {PageManager} from "../src/page/manager"
import {TemplateManager} from "../src/template/manager"
import {AotEmitter} from "./aot-emit"

export function collectHtmlTemplates(rootDir: string, skipResolved?: string): Array<{key: string; template: string}> {
  const found: Array<{key: string; template: string}> = []
  const walkHtml = (dir: string, parentKey: string): void => {
    for (const entry of readdirSync(dir, {withFileTypes: true})) {
      const full = join(dir, entry.name)
      if (skipResolved !== undefined && resolve(full) === skipResolved) continue
      if (entry.isDirectory()) {
        walkHtml(full, parentKey ? `${parentKey}/${entry.name}` : entry.name)
        continue
      }
      if (!entry.name.endsWith(`.html`)) continue
      const isIndex = /^index\.html$/.test(entry.name)
      const key = isIndex && parentKey ? parentKey : `${parentKey ? `${parentKey}/` : ``}${entry.name.replace(/\.html$/, ``)}`
      found.push({key, template: readFileSync(full, `utf-8`)})
    }
  }
  walkHtml(rootDir, ``)
  return found
}

export function buildManifest(pagesDir: string, outFile: string): {pages: number; templates: number} {
  const root = resolve(pagesDir)
  if (!existsSync(root)) {
    throw new Error(`Pages directory "${pagesDir}" does not exist`)
  }
  const outResolved = resolve(outFile)
  const outDir = dirname(outResolved)
  const toPosix = (p: string) => relative(root, p).split(sep).join(`/`)
  const toImport = (p: string) => {
    const rel = relative(outDir, p)
      .split(sep)
      .join(`/`)
      .replace(/\.(ts|js)$/, ``)
    return rel.startsWith(`.`) ? rel : `./${rel}`
  }

  const entries = PageManager.getFileManySync(root).filter(({path}) => resolve(path) !== outResolved)
  const imports: Array<string> = []
  const pageLines: Array<string> = []
  for (const {path, page, routeName} of entries) {
    const className = page.name
    if (!/^[A-Za-z_$][\w$]*$/.test(className)) {
      throw new Error(`Cannot emit import for class "${className}" in ${path} — page classes need a static identifier for manifest output`)
    }
    const spec = toImport(path)
    imports.push(`import {${className}} from ${JSON.stringify(spec)}`)
    pageLines.push(`    {path: ${JSON.stringify(toPosix(path))}, routeName: ${JSON.stringify(routeName)}, page: ${className}},`)
  }

  const templateLines: Array<string> = []
  for (const {key, template} of collectHtmlTemplates(root, outResolved)) {
    templateLines.push(`    {key: ${JSON.stringify(key)}, template: ${JSON.stringify(template)}},`)
  }

  const asJs = outResolved.endsWith(`.js`)
  const typeImport = asJs ? `` : `import type {ITAppManifest} from "gramstax"\n\n`
  const typeName = asJs ? `` : `: ITAppManifest`
  const body = `${imports.join(`\n`)}\n${typeImport}export const manifest${typeName} = {\n  pages: [\n${pageLines.join(`\n`)}\n  ],\n  templates: [\n${templateLines.join(`\n`)}\n  ]\n}\n\nexport default manifest\n`
  mkdirSync(outDir, {recursive: true})
  writeFileSync(outResolved, body)
  return {pages: entries.length, templates: templateLines.length}
}

export function generate(pagesDir: string, outDir: string, options?: {aot?: boolean}): {pages: number; templates: number; routes: number} {
  const root = resolve(pagesDir)
  if (!existsSync(root)) {
    throw new Error(`Pages directory "${pagesDir}" does not exist`)
  }
  const outResolved = resolve(outDir)
  const generatedFile = (abs: string): boolean => abs === join(outResolved, `manifest.js`) || abs === join(outResolved, `routes.json`) || abs.startsWith(`${join(outResolved, `gen`)}${sep}`)
  const collector = new RouteCollector()
  const routes = collector.collect(root).filter((entry) => generatedFile(resolve(root, entry.file)) === false)
  collector.write(outResolved, routes)
  const stats = buildManifest(root, join(outResolved, `manifest.js`))
  if (options?.aot === true) {
    emitAot(root, outResolved)
  }
  return {pages: stats.pages, routes: routes.length, templates: stats.templates}
}

function emitAot(root: string, outResolved: string): void {
  const genDir = join(outResolved, `gen`)
  rmSync(genDir, {recursive: true, force: true})
  mkdirSync(genDir, {recursive: true})
  const html = collectHtmlTemplates(root)
  const manager = new TemplateManager({path: [genDir]})
  const importCache = new Map<string, string>()
  const rawCache = new Map<string, string>(html.map((entry): [string, string] => [entry.key, entry.template]))
  const emitter = new AotEmitter()
  const seen = new Map<string, string>()
  // Class-inline templates first: boot compiles them under the routeName, so
  // they need frozen modules too — otherwise edge runtimes hit `new Function`.
  // A same-key .html template overwrites below, mirroring boot precedence.
  for (const {page, routeName} of PageManager.getFileManySync(root)) {
    const inline = page.template
    if (typeof inline !== `string`) continue
    emitKey(emitter, manager, importCache, rawCache, genDir, routeName, inline, seen)
  }
  for (const {key, template} of html) {
    emitKey(emitter, manager, importCache, rawCache, genDir, key, template, seen)
  }
  // gen/manifest.js exposes {templates} for 024 adapters; pages stay in
  // userland source (023 manifest.js) in AOT v1.
  const lines = [...seen.values()].map((alias) => `import {template as ${alias}} from "./${alias}.g.js"`)
  lines.push(`export const templates = {${[...seen.entries()].map(([key, alias]) => `${JSON.stringify(key)}: ${alias}`).join(`, `)}}`)
  writeFileSync(join(genDir, `manifest.js`), `${lines.join(`\n`)}\n`)
}

function emitKey(emitter: AotEmitter, manager: TemplateManager, importCache: Map<string, string>, rawCache: Map<string, string>, genDir: string, key: string, template: string, seen: Map<string, string>): void {
  emitter.beginCollect()
  try {
    manager.compile(key, template, undefined, importCache, rawCache)
  } finally {
    emitter.endCollect()
  }
  const compiled = manager.getCompiled(key)
  if (compiled === undefined) {
    throw new Error(`AOT found no compiled template for key "${key}"`)
  }
  const alias = emitter.safeKey(key)
  writeFileSync(join(genDir, `${alias}.g.js`), emitter.emitModule(key, template, compiled))
  seen.set(key, alias)
}

if (import.meta.main && (process.argv[1] ?? ``).endsWith(`build-manifest.ts`)) {
  const args = process.argv.slice(2).filter((arg) => arg !== `--aot`)
  const [pagesDir, outFileOrDir] = args
  if (!pagesDir || !outFileOrDir) {
    console.error(`Usage: bun run build:manifest -- <pagesDir> <outFile>`)
    console.error(`   or: bun run build:manifest -- <pagesDir> <outDir> --aot`)
    process.exit(1)
  }
  if (process.argv.includes(`--aot`)) {
    const stats = generate(pagesDir, outFileOrDir, {aot: true})
    console.log(`AOT written to ${outFileOrDir}/gen (${stats.pages} pages, ${stats.templates} templates, ${stats.routes} routes)`)
  } else {
    const stats = buildManifest(pagesDir, outFileOrDir)
    console.log(`Manifest written to ${outFileOrDir} (${stats.pages} pages, ${stats.templates} templates)`)
  }
}
