import {existsSync, readdirSync, renameSync, unlinkSync} from "node:fs"
import {join} from "node:path"

export class FsUt {
  static DEFAULT_IGNORED_ENTRIES = new Set([`.git`, `.gitignore`, `.gitkeep`, `.DS_Store`, `Thumbs.db`])
  static isDirectoryEffectivelyEmpty(directoryPath: string, ignoredEntries = FsUt.DEFAULT_IGNORED_ENTRIES): boolean {
    const entries = readdirSync(directoryPath)
    const remainingEntries = entries.filter((entry) => !ignoredEntries.has(entry))
    return remainingEntries.length === 0
  }
  static resolvePackageManagerCommand(packageManager: `bun` | `npm` | `pnpm` | `yarn`, platform = process.platform): string {
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
   * Node.js refuses to spawn `.cmd`/`.bat` shims with `shell: false` on Windows
   * (throws `EINVAL`), and the published CLI runs under Node (`#!/usr/bin/env node`),
   * e.g. via `npx create-gramstax`. Bun is a real executable, so it needs no shell.
   */
  static resolveSpawnShell(packageManager: `bun` | `npm` | `pnpm` | `yarn`, platform = process.platform): boolean {
    return platform === `win32` && packageManager !== `bun`
  }

  static resolveInitialWorkingDirectory(currentDirectory = process.cwd(), initCwd = process.env.INIT_CWD): string {
    return initCwd ?? currentDirectory
  }

  /**
   * Promote the shipped `gitignore` template file to `.gitignore`.
   *
   * @remarks
   * When a `.gitignore` already exists (scaffolding into a directory that
   * only had one), the template copy must be removed instead of renamed,
   * otherwise the project ends up with a stray `gitignore` file.
   */
  static normalizeGitignoreFile(projectPath: string): void {
    const templatePath = join(projectPath, `gitignore`)
    const targetPath = join(projectPath, `.gitignore`)
    if (!existsSync(templatePath)) return
    if (!existsSync(targetPath)) {
      renameSync(templatePath, targetPath)
    } else {
      unlinkSync(templatePath)
    }
  }
}
