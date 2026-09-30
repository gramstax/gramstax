import {cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync} from "node:fs"
import {tmpdir} from "node:os"
import {dirname, join, relative, sep} from "node:path"

function rewriteAlias(file: string, root: string): void {
  const depth = relative(root, dirname(file)).split(sep).filter((part) => part.length > 0).length
  const prefix = `../`.repeat(depth)
  const source = readFileSync(file, `utf-8`)
  const rewritten = source.replace(/from\s*(['"])~\//g, `from $1${prefix}`)
  if (rewritten !== source) writeFileSync(file, rewritten)
}

function walk(dir: string, out: Array<string>): void {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (full.endsWith(`.ts`)) out.push(full)
  }
}

export class FixtureCopy {
  static copySrc(): string {
    const dest = mkdtempSync(join(tmpdir(), `gx11-src-`))
    cpSync(join(import.meta.dir, `../src`), dest, {recursive: true})
    const files: Array<string> = []
    walk(dest, files)
    for (const file of files) rewriteAlias(file, dest)
    const modules = join(dest, `node_modules`)
    mkdirSync(modules, {recursive: true})
    const link = join(modules, `gramstax`)
    if (existsSync(link) === false) symlinkSync(join(import.meta.dir, `../node_modules/gramstax`), link, `junction`)
    return dest
  }
}
