export const PACKAGE_MANAGERS = [`bun`, `npm`, `pnpm`, `yarn`] as const
export type PackageManager = (typeof PACKAGE_MANAGERS)[number]

export const RUNTIMES = [`bun`, `node`] as const
export type Runtime = (typeof RUNTIMES)[number]

export const PROJECT_NAME_PATTERN = /^[a-z0-9-_]{1,100}$/i

const BIOME_SCRIPTS = [`lint`, `lint:fix`, `format`]

export function isValidProjectName(name: string): boolean {
  return PROJECT_NAME_PATTERN.test(name)
}

export function sanitizeProjectName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, `-`)
    .replace(/^-+|-+$/g, ``)
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
  for (const name of BIOME_SCRIPTS) {
    delete pkg.scripts[name]
  }
}

export function removeDependency(pkg: {dependencies?: Record<string, string>}, name: string): void {
  if (!pkg.dependencies) return
  delete pkg.dependencies[name]
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

export function removeTsconfigPathMappings(content: string, names: string[]): string {
  let result = content
  for (const name of names) {
    result = result.replace(new RegExp(`,?\\s*\\n\\s*"${name}":\\s*\\[[\\s\\S]*?\\]`, `g`), ``)
  }
  return result
}

export function resolveWorkspaceDeps(pkg: {dependencies?: Record<string, string>}, version: string | undefined): void {
  if (version === undefined || !pkg.dependencies) return
  const ver = `^${version}`
  for (const [name, val] of Object.entries(pkg.dependencies)) {
    if (val === `workspace:*`) {
      pkg.dependencies[name] = ver
    }
  }
}

export class SetupCancelledError extends Error {
  constructor() {
    super(`Setup cancelled`)
    this.name = `SetupCancelledError`
  }
}

export function resolveRuntimeScripts(runtime: Runtime, scripts: Record<string, string>): Record<string, string> {
  if (runtime === `bun`) return scripts
  const next = {...scripts}
  next.dev = `node --watch src/index.ts`
  next.start = `node src/index.ts`
  delete next.build
  return next
}
