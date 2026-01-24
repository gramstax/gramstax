import {readdirSync} from "node:fs"

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

  static resolveInitialWorkingDirectory(currentDirectory = process.cwd(), initCwd = process.env.INIT_CWD): string {
    return initCwd ?? currentDirectory
  }
}
