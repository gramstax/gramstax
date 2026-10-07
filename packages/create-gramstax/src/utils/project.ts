import {readdirSync, readFileSync, renameSync, writeFileSync} from "node:fs"
import {join} from "node:path"

export const PACKAGE_MANAGERS = [`bun`, `npm`, `pnpm`, `yarn`] as const
export type IPackageManager = (typeof PACKAGE_MANAGERS)[number]
export const RUNTIMES = [`bun`, `node`] as const
export type IRuntime = (typeof RUNTIMES)[number]
export const PROJECT_NAME_PATTERN = /^[a-z0-9-_]{1,100}$/i
export const RUNTIME_PLACEHOLDERS = [`userName`, `result`, `res`]
export const BIOME_DEV_VERSION = `^2.5.5`

type IDependencySections = {
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
}

const DEP_SECTIONS = [`dependencies`, `devDependencies`, `peerDependencies`, `optionalDependencies`] as const

export function isValidProjectName(name: string): boolean {
  return PROJECT_NAME_PATTERN.test(name)
}

export function sanitizeProjectName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, `-`)
    .replace(/^-+|-+$/g, ``)
    .slice(0, 100)
    .replace(/-+$/g, ``)
  return slug || `gramstax-bot`
}

export function validateCliOptions(packageManager?: string, runtime?: string): void {
  if (packageManager !== undefined && !(PACKAGE_MANAGERS as readonly string[]).includes(packageManager)) {
    throw new Error(`Unsupported package manager "${packageManager}". Supported: ${PACKAGE_MANAGERS.join(`, `)}`)
  }
  if (runtime !== undefined && !(RUNTIMES as readonly string[]).includes(runtime)) {
    throw new Error(`Unsupported runtime "${runtime}". Supported: ${RUNTIMES.join(`, `)}`)
  }
}

export function replaceTemplateVariables(content: string, variables: Record<string, string>): string {
  let result = content
  for (const [key, value] of Object.entries(variables)) {
    // Use a replacer function so `$` sequences in values are not interpreted as pattern references
    result = result.replace(new RegExp(`{{${key}}}`, `g`), () => value)
  }
  return result
}

export function stripBiomeScripts(pkg: {scripts?: Record<string, string>}): void {
  if (!pkg.scripts) return
  for (const name of Object.keys(pkg.scripts)) {
    if (/^lint/.test(name) || /^format/.test(name)) delete pkg.scripts[name]
  }
}

export function removeDependency(pkg: IDependencySections, name: string): void {
  for (const section of DEP_SECTIONS) {
    const deps = pkg[section]
    if (deps) delete deps[name]
  }
}

export function appendGitignoreEntries(content: string, entries: string[]): string {
  let result = content.endsWith(`\n`) ? content : `${content}\n`
  const existing = new Set(result.split(/\r?\n/))
  for (const entry of entries) {
    if (!existing.has(entry)) {
      result += `${entry}\n`
      existing.add(entry)
    }
  }
  return result
}

export function appendEnvDbPath(content: string): string {
  if (content.includes(`DB_PATH`)) return content
  return `${content}\n\nDB_PATH="./data"\n`
}

/**
 * Build `src/core/services.ts` for the enabled feature set.
 *
 * `BotCore` calls `ServicesCore.start`/`ServicesCore.stop` unconditionally, but
 * `src/db` and `src/workers` are deleted outright for `--no-lmdb` /
 * `--no-worker-thread`. A static import of a deleted module would break the
 * generated project, so this file is the one seam the generator rewrites per
 * feature combination.
 */
export function buildServicesSource(useLmdb: boolean, useWorkerThread: boolean): string {
  const imports: string[] = []
  const starts: string[] = []
  const stops: string[] = []

  if (useLmdb) {
    imports.push(`import {Db} from "~/db"`)
    starts.push(`    await Db.start()`)
  }
  if (useWorkerThread) {
    imports.push(`import {JobWorker} from "~/workers/job"`)
    starts.push(`    await JobWorker.launchWorker()`)
  }

  // Workers stop first: a tick can still be mid-read, and tearing the store
  // down underneath it would turn an orderly stop into an LMDB error.
  if (useWorkerThread) {
    stops.push(`    try {
      await JobWorker.shutdown(1_000)
    } catch {
      // Never launched — startup failed, or a test drove the bot straight to
      // stop. shutdown() throws in that case, and that is not a failure here.
    }`)
  }
  if (useLmdb) stops.push(`    await Db.stop()`)

  const head = imports.length === 0 ? `` : `${imports.join(`\n`)}\n`

  if (!useLmdb && !useWorkerThread) {
    return `${head}
export class ServicesCore {
  /**
   * Nothing to bring up: this project was generated with both optional services
   * disabled, so \`src/db\` and \`src/workers\` were never scaffolded.
   */
  static async start(): Promise<void> {}

  static async stop(): Promise<void> {}
}
`
  }

  const summary = useLmdb && useWorkerThread ? `a database and a worker thread` : useLmdb ? `the database` : `the worker thread`

  const stopNote =
    useLmdb && useWorkerThread
      ? `
   *
   * Workers stop before the database: a tick can still be mid-read, and tearing
   * the store down underneath it would turn an orderly stop into an LMDB error.`
      : ``

  return `${head}
export class ServicesCore {
  /**
   * Bring up ${summary}. A freshly generated bot then starts with its optional
   * services already live, instead of leaving the wiring as an exercise for the
   * author.
   *
   * Called from \`BotCore.hookAfterStart\`.
   */
  static async start(): Promise<void> {
${starts.join(`\n`)}
  }

  /**
   * Shut those services down. Called from \`BotCore.stop\`.${stopNote}
   */
  static async stop(): Promise<void> {
${stops.join(`\n`)}
  }
}
`
}

function stripJsonComments(content: string): string {
  let result = ``
  let index = 0
  let quote: `"` | `'` | undefined
  while (index < content.length) {
    const char = content[index] ?? ``
    const next = content[index + 1] ?? ``
    if (quote !== undefined) {
      result += char
      if (char === `\\`) {
        result += next
        index += 2
        continue
      }
      if (char === quote) quote = undefined
      index += 1
      continue
    }
    if (char === `"` || char === `'`) {
      quote = char
      result += char
      index += 1
      continue
    }
    if (char === `/` && next === `/`) {
      while (index < content.length && (content[index] ?? ``) !== `\n`) index += 1
      continue
    }
    if (char === `/` && next === `*`) {
      index += 2
      while (index < content.length && !((content[index] ?? ``) === `*` && (content[index + 1] ?? ``) === `/`)) index += 1
      index += 2
      continue
    }
    result += char
    index += 1
  }
  return result
}

export function removeTsconfigPathMappings(content: string, names: string[]): string {
  if (names.length === 0) return content
  let parsed: {compilerOptions?: {paths?: Record<string, string[]>}}
  try {
    parsed = JSON.parse(stripJsonComments(content)) as {compilerOptions?: {paths?: Record<string, string[]>}}
  } catch {
    return content
  }
  const paths = parsed.compilerOptions?.paths
  if (!paths) return content
  let changed = false
  for (const name of names) {
    if (name in paths) {
      delete paths[name]
      changed = true
    }
  }
  if (!changed) return content
  return `${JSON.stringify(parsed, null, 2)}\n`
}

export function setTsconfigCompilerOptions(content: string, options: Record<string, string | boolean>): string {
  let parsed: {compilerOptions?: Record<string, unknown>}
  try {
    parsed = JSON.parse(stripJsonComments(content)) as {compilerOptions?: Record<string, unknown>}
  } catch {
    return content
  }
  if (!parsed.compilerOptions) return content
  let changed = false
  for (const [key, value] of Object.entries(options)) {
    if (parsed.compilerOptions[key] !== value) {
      parsed.compilerOptions[key] = value
      changed = true
    }
  }
  if (!changed) return content
  return `${JSON.stringify(parsed, null, 2)}\n`
}

export function resolveWorkspaceDeps(pkg: IDependencySections, version: string | undefined): void {
  const sections = DEP_SECTIONS.map((section) => pkg[section])
  const pending = sections.some((deps) => deps !== undefined && Object.values(deps).includes(`workspace:*`))
  if (version === undefined) {
    if (pending) throw new Error(`Cannot resolve "workspace:*" dependencies without a concrete version`)
    return
  }
  const pinned = `^${version}`
  for (const deps of sections) {
    if (!deps) continue
    for (const [name, value] of Object.entries(deps)) {
      if (value === `workspace:*`) deps[name] = pinned
    }
  }
}

export class SetupCancelledError extends Error {
  constructor() {
    super(`Setup cancelled`)
    this.name = `SetupCancelledError`
  }
}

function toNodeBuildScript(value: string): string {
  if (/^bun build\b/.test(value)) return `tsc --outDir dist`
  return value.replace(/^bun(?=\s|$)/, `node`)
}

export function resolveRuntimeScripts(runtime: IRuntime, scripts: Record<string, string>): Record<string, string> {
  if (runtime === `bun`) return scripts
  const next = {...scripts}
  for (const [key, value] of Object.entries(next)) {
    // `gramstax start` boots TypeScript directly (TS paths + `~` alias),
    // so it stays on Bun even for node-runtime projects.
    if (value.includes(`gramstax start`)) continue
    if (key === `dev` || key === `start`) {
      next[key] = value.replace(/^bun(?=\s|$)/, `node`)
    } else if (key === `build`) {
      next[key] = toNodeBuildScript(value)
    } else if (key === `build:gramstax`) {
      // `bun --bun gramstax build` only needs the flag to boot under Bun;
      // the bare binary is what node runs.
      next[key] = value.replace(/^bun\s+--bun\s+/, ``)
    } else if (/^test($|:)/.test(key)) {
      next[key] = value.replace(/^bun test\b/, `node --test`)
    }
  }
  return next
}

export function assertNoLeftoverPlaceholders(rootDir: string, allowed: readonly string[] = RUNTIME_PLACEHOLDERS): void {
  const stack = [rootDir]
  while (stack.length > 0) {
    const current = stack.pop()
    if (current === undefined) continue
    for (const entry of readdirSync(current, {withFileTypes: true})) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        stack.push(full)
        continue
      }
      if (!entry.isFile()) continue
      const raw = readFileSync(full)
      if (raw.includes(0)) continue
      const text = raw.toString(`utf-8`)
      for (const match of text.matchAll(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g)) {
        const name = match[1] ?? ``
        if (!allowed.includes(name)) {
          throw new Error(`Unreplaced template placeholder {{${name}}} in file ${full}`)
        }
      }
    }
  }
}

export function writeTextFileAtomic(filePath: string, content: string): void {
  const tmpPath = `${filePath}.tmp-${process.pid}`
  writeFileSync(tmpPath, content, `utf8`)
  renameSync(tmpPath, filePath)
}

export function writeJsonFileAtomic(filePath: string, value: unknown): void {
  writeTextFileAtomic(filePath, `${JSON.stringify(value, null, 2)}\n`)
}
