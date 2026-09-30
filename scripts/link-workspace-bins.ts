import {chmodSync, mkdirSync, writeFileSync} from "node:fs"
import {join, resolve} from "node:path"

// Bun does NOT link `workspace:*` bins, so `node_modules/.bin/gramstax`
// is missing and bare `gramstax` in example scripts fails. This
// postinstall shim writes a tiny launcher pointing at the built CLI.
// Idempotent: safe to re-run on every install. Output is gitignored.
const root = resolve(join(import.meta.dir, `..`))
const target = join(root, `packages`, `gramstax`, `dist`, `src`, `cli`, `gramstax.js`)
const binDir = join(root, `node_modules`, `.bin`)

mkdirSync(binDir, {recursive: true})
writeFileSync(join(binDir, `gramstax`), `#!/bin/sh\nexec bun "${target}" "$@"\n`)
writeFileSync(join(binDir, `gramstax.cmd`), `@bun "${target}" %*\r\n`)
chmodSync(join(binDir, `gramstax`), 0o755)
console.log(`linked workspace bin: gramstax -> ${target}`)
