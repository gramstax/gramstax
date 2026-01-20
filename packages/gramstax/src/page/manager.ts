import {join} from "node:path"
import {existsSync, readdirSync} from "node:fs"
import type {Ctx} from "~/core/ctx"
import {createRequire} from "node:module"

/**
 * Provides static utilities for loading and managing page modules dynamically.
 *
 * @remarks
 * Used internally by Gramstax to load page classes from the `src/pages` directory.
 * Pages must export a class (not default export) that extends {@link Ctx}.
 *
 * @example
 * ```typescript
 * import { PageManager } from "gramstax";
 *
 * const pagesPath = PageManager.getFilePath();
 * const page = PageManager.getFileSync(`${pagesPath}/start.ts`);
 * const pages = PageManager.getFileManySync(pagesPath);
 *
 * console.log(page.name);
 * console.log(`Loaded pages: ${pages.length}`);
 * ```
 *
 * @public
 */
export class PageManager {
  /**
   * Extract a page class from a module's exports.
   *
   * @param mod - The module object containing exports.
   * @param path - Path to the file (used in error messages).
   * @param positionModule - Index of the exported class. Defaults to `0`.
   * @returns The page class at the specified position.
   *
   * @throws Error if file has no exports at the specified position.
   *
   * @example
   * ```typescript
   * const mod = await import("./pages/start.ts");
   * const StartPage = PageManager._getFile(mod, "./pages/start.ts", 0);
   * ```
   * @internal
   */
  static _getFile(mod: Record<any, any>, path: string, positionModule = 0) {
    const exp = Object.values(mod)
    const Page = exp[positionModule] as typeof Ctx // like StartPage. not have default export
    if (Page === undefined) {
      throw new Error(`File ${path} must have export (not default) class page`)
    }
    return Page
  }

  /**
   * Returns the default pages directory path.
   *
   * @returns Path to `src/pages` relative to `process.cwd()`.
   *
   * @example
   * ```typescript
   * const pagesPath = PageManager.getFilePath();
   * // => "/path/to/project/src/pages"
   * ```
   * @public
   */
  static getFilePath() {
    return join(process.cwd(), `src`, `pages`)
  }

  /**
   * Synchronously load a single page module.
   *
   * @param path - Path to the page file. Uses default pages directory when omitted.
   * @param positionModule - Index of the exported class. Used when file has multiple exports. Defaults to `0`.
   * @returns The first exported page class.
   *
   * @throws Error if file has no exports.
   *
   * @example
   * ```typescript
   * const StartPage = PageManager.getFileSync(
   *   "/path/to/project/src/pages/start.ts"
   * );
   * ```
   * @public
   */
  static getFileSync(path?: string, positionModule = 0) {
    if (!path) {
      path = this.getFilePath()
    }
    const mod = createRequire(path) as any
    const def = mod(path)
    return this._getFile(def, path, positionModule)
  }

  /**
   * Asynchronously load a single page module with cache busting.
   *
   * @param path - Path to the page file. Uses default pages directory when omitted.
   * @param positionModule - Index of the exported class. Appends timestamp for cache busting. Defaults to `0`.
   * @returns Promise resolving to the loaded page class.
   *
   * @example
   * ```typescript
   * const StartPage = await PageManager.getFile(
   *   "/path/to/project/src/pages/start.ts"
   * );
   * ```
   * @public
   */
  static async getFile(path?: string, positionModule = 0) {
    if (!path) {
      path = this.getFilePath()
    }
    const mod = (await import(`${path}?t=${Date.now()}`)) as Record<any, any>
    return this._getFile(mod, path, positionModule)
  }

  /**
   * Synchronously load all page modules from a directory.
   *
   * @param path - Path to the pages directory. Uses default pages directory when omitted.
   * @param positionModule - Index of the exported class. Used when files have multiple exports. Defaults to `0`.
   * @returns Array of page records containing `path` and `page` properties.
   *
   * @throws Error if directory does not exist.
   *
   * @example
   * ```typescript
   * const pages = PageManager.getFileManySync();
   * // => [{ path: "/path/to/start.ts", page: StartPage }, ...]
   * ```
   * @public
   */
  static getFileManySync(path?: string, positionModule = 0) {
    if (!path) {
      path = this.getFilePath()
    }
    if (!existsSync(path)) {
      throw new Error(`Directory ${path} is not found, please make it manually`)
    }

    const files = readdirSync(path)
    return files.map((file) => {
      const pathFile = join(path, file)
      return {
        path: pathFile,
        page: this.getFileSync(pathFile, positionModule)
      }
    })
  }

  /**
   * Clear the require cache for all page modules.
   *
   * @param path - Path to the pages directory. Enables hot-reloading of pages.
   * @returns `true` when cache is cleared.
   *
   * @throws Error if directory does not exist.
   *
   * @example
   * ```typescript
   * PageManager.clearCacheRequire();
   * // Clears cache for all pages in default directory
   * ```
   * @public
   */
  static clearCacheRequire(path?: string) {
    if (!path) {
      path = this.getFilePath()
    }
    if (!existsSync(path)) {
      throw new Error(`Directory ${path} is not found, please make it manually`)
    }

    const files = readdirSync(path)
    files.forEach((file) => {
      const pathFile = join(path, file)
      delete require.cache[require.resolve(pathFile)]
    })
    return true
  }
}
