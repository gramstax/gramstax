import {existsSync} from "node:fs"
import {join} from "node:path"
import {config as loadDotenv} from "dotenv"

/**
 * Resolve the project env files in precedence order.
 *
 * @remarks
 * Highest precedence first. `.env.local` is skipped in `test` mode, matching
 * Next.js: tests must not silently pick up a developer's local secrets.
 *
 * @param cwd - Absolute project root.
 * @param mode - Runtime mode; defaults to `NODE_ENV` or `development`.
 * @returns Every candidate env-file path, whether or not the file exists.
 *
 * @internal
 */
export function projectEnvFiles(cwd: string, mode: string = process.env.NODE_ENV ?? `development`): string[] {
  const files = [join(cwd, `.env.${mode}.local`)]
  if (mode !== `test`) files.push(join(cwd, `.env.local`))
  files.push(join(cwd, `.env.${mode}`), join(cwd, `.env`))
  return files
}

/**
 * Load project-root env files into `process.env`.
 *
 * @remarks
 * Files are loaded high-to-low with `override: false`, so the first file that
 * defines a key wins and variables already exported by the shell are untouched.
 * The project root is the given directory only; parent directories are never
 * searched.
 *
 * @param cwd - Absolute project root.
 * @param mode - Runtime mode; defaults to `NODE_ENV` or `development`.
 * @returns The existing files that were loaded, in precedence order.
 *
 * @throws Error when an existing env file cannot be parsed or read.
 *
 * @internal
 */
export function loadProjectEnv(cwd: string, mode: string = process.env.NODE_ENV ?? `development`): string[] {
  const loaded: string[] = []
  for (const file of projectEnvFiles(cwd, mode)) {
    if (existsSync(file) === false) continue
    const result = loadDotenv({path: file, override: false})
    if (result.error !== undefined) {
      throw new Error(`gramstax: cannot load env file ${file}: ${result.error.message}`)
    }
    loaded.push(file)
  }
  return loaded
}
