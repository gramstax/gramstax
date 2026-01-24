import {access, cp, mkdtemp, rm} from "node:fs/promises"
import {spawn} from "node:child_process"
import {tmpdir} from "node:os"
import {dirname, join, resolve} from "node:path"
import {fileURLToPath} from "node:url"

const DEFAULT_REPO = `https://github.com/gramstax/gramstax`
const DEFAULT_REF = `main`
const USAGE = `Usage: sync-gramstax-docs.ts [--ref main] [--out assets/markdown] [--token <token>]`

const args = process.argv.slice(2)

const readArg = (name: string): string | undefined => {
  const index = args.indexOf(`--${name}`)
  if (index === -1) {
    return undefined
  }

  return args[index + 1]
}

const run = (command: string, commandArgs: string[]) =>
  new Promise<void>((resolvePromise, rejectPromise) => {
    const child = spawn(command, commandArgs, {stdio: `inherit`})
    child.on(`error`, rejectPromise)
    child.on(`close`, (code) => {
      if (code === 0) {
        resolvePromise()
        return
      }

      rejectPromise(new Error(`Command failed: ${command}`))
    })
  })

const buildCloneUrl = (repoUrl: string, token: string | undefined) => {
  if (!token || !repoUrl.startsWith(`https://`)) {
    return repoUrl
  }

  const url = new URL(repoUrl)
  if (!url.username) {
    url.username = token
  }

  return url.toString()
}

const ensureDocsExist = async (docsPath: string) => {
  try {
    await access(docsPath)
  } catch (error) {
    throw new Error(`Docs path not found: ${docsPath}. ${String(error)}`)
  }
}

const main = async () => {
  if (args.includes(`--help`) || args.includes(`-h`)) {
    console.log(USAGE)
    return
  }

  const repo = readArg(`repo`) ?? DEFAULT_REPO
  const ref = readArg(`ref`) ?? DEFAULT_REF
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const out = resolve(readArg(`out`) ?? join(scriptDir, `..`, `assets`, `markdown`))
  const token = readArg(`token`) ?? process.env.GRAMSTAX_GIT_TOKEN
  const cloneUrl = buildCloneUrl(repo, token)

  const tempDir = await mkdtemp(join(tmpdir(), `gramstax-docs-`))
  const sourceDocsPath = join(tempDir, `packages`, `gramstax`, `docs`, `markdown`)

  try {
    await run(`git`, [`clone`, `--depth`, `1`, `--branch`, ref, cloneUrl, tempDir])
    await ensureDocsExist(sourceDocsPath)
    await rm(out, {recursive: true, force: true})
    await cp(sourceDocsPath, out, {recursive: true})
    console.log(`Synced docs to ${out}`)
  } finally {
    await rm(tempDir, {recursive: true, force: true})
  }
}

main().catch((error) => {
  console.error(String(error))
  process.exitCode = 1
})
