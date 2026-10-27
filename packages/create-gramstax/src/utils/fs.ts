import {existsSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync} from "node:fs"
import {join} from "node:path"
import {appendGitignoreEntries} from "./project"

export class FsUt {
  static readonly DEFAULT_IGNORED_ENTRIES: ReadonlySet<string> = Object.freeze(new Set([`.git`, `.gitignore`, `.gitkeep`, `.DS_Store`, `Thumbs.db`]))

  /**
   * Shallow check whether a directory holds no real content.
   *
   * Only the top level plus one level inside subdirectories is inspected:
   * a subdirectory counts as empty when every entry inside it is ignored
   * (e.g. `logs/` containing only `.gitkeep`). Deeper nesting is not
   * traversed.
   *
   * Entries in `ignoredEntries` (default: `.git`, `.gitignore`, `.gitkeep`,
   * `.DS_Store`, `Thumbs.db`) are skipped at both levels. The default is a
   * fresh copy per call, never the shared `DEFAULT_IGNORED_ENTRIES` reference.
   */
  static isDirectoryEffectivelyEmpty(directoryPath: string, ignoredEntries: ReadonlySet<string> = new Set(FsUt.DEFAULT_IGNORED_ENTRIES)): boolean {
    let entries: string[]
    try {
      entries = readdirSync(directoryPath)
    } catch (error) {
      throw new Error(`Directory "${directoryPath}" does not exist or cannot be read: ${error instanceof Error ? error.message : String(error)}`)
    }
    const remainingEntries = entries.filter((entry) => !ignoredEntries.has(entry))
    if (remainingEntries.length === 0) return true
    for (const entry of remainingEntries) {
      const fullPath = join(directoryPath, entry)
      try {
        if (!statSync(fullPath).isDirectory()) return false
        const nestedEntries = readdirSync(fullPath).filter((nested) => !ignoredEntries.has(nested))
        if (nestedEntries.length > 0) return false
      } catch {
        return false
      }
    }
    return true
  }
  static resolvePackageManagerCommand(packageManager: `bun` | `npm` | `pnpm` | `yarn`, platform = process.platform): string {
    if (packageManager !== `bun` && packageManager !== `npm` && packageManager !== `pnpm` && packageManager !== `yarn`) {
      throw new Error(`Unsupported package manager "${packageManager}"`)
    }
    if (platform !== `win32`) {
      return packageManager
    }

    if (packageManager === `bun`) {
      return packageManager
    }

    return `${packageManager}.cmd`
  }

  /**
   * Whether `spawn` needs `shell: true` for the given package manager.
   *
   * @remarks
   * `.cmd`/`.bat` shims require `shell: true` on Windows (otherwise `spawn`
   * throws `EINVAL`); Bun is a real executable, so it needs no shell.
   */
  static resolveSpawnShell(packageManager: `bun` | `npm` | `pnpm` | `yarn`, platform = process.platform): boolean {
    return platform === `win32` && packageManager !== `bun`
  }

  static resolveInitialWorkingDirectory(currentDirectory = process.cwd(), initCwd = process.env.INIT_CWD): string {
    return initCwd?.trim() ? initCwd : currentDirectory
  }

  /**
   * Promote the shipped `gitignore` template file to `.gitignore`.
   *
   * @remarks
   * When no `.gitignore` exists yet the template is renamed. When one already
   * exists (scaffolding into a directory that only had one), the template
   * entries are merged into it via `appendGitignoreEntries` (deduped) so none
   * of the 30+ shipped rules are lost. The template file is removed either way,
   * otherwise the project ends up with a stray `gitignore` file.
   */
  static normalizeGitignoreFile(projectPath: string): void {
    const templatePath = join(projectPath, `gitignore`)
    const targetPath = join(projectPath, `.gitignore`)
    if (!existsSync(templatePath)) return
    if (!existsSync(targetPath)) {
      renameSync(templatePath, targetPath)
    } else {
      const templateContent = readFileSync(templatePath, `utf-8`)
      const targetContent = readFileSync(targetPath, `utf-8`)
      const templateEntries = templateContent.split(/\r?\n/).filter((line) => line.length > 0)
      writeFileSync(targetPath, appendGitignoreEntries(targetContent, templateEntries))
      unlinkSync(templatePath)
    }
  }
}
