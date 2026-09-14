/**
 * Page manager — discovers and loads template pages from the filesystem.
 *
 * @remarks
 * Scans the `pages/` directory for `.gts`, `.grm`, `.html` and other
 * template files, parses them into AST, and registers route handlers
 * for each page discovered.
 *
 * @public
 */

import {existsSync, readdirSync} from "node:fs"
import {createRequire} from "node:module"
import {join} from "node:path"
import type {Ctx} from "~/core/ctx"

/**
 * Provides static utilities for loading and managing page modules dynamically.
 *
 * @remarks
 * Used internally by Gramstax to load page classes from the `src/pages` directory.
 * Pages must export a class (not default export) that extends {@link (Ctx:class)}.
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
   * @public
   */
  static _getFile(mod: Record<string, unknown>, path: string, positionModule = 0) {
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
    const mod = createRequire(path)
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
    const mod = (await import(`${path}?t=${Date.now()}`)) as Record<string, unknown>
    return this._getFile(mod, path, positionModule)
  }

  /**
   * Synchronously load all page modules from a directory.
   *
   * Supports both flat `.ts`/`.js` files and subfolder `index.ts`/`index.js`
   * entries.  In a subfolder, **any** `.ts`/`.js` file (not just `index`) is
   * recognised as a page — its route name becomes `parentDir/basename`.  A
   * file `help.ts` is equivalent to `help/index.ts`; using both simultaneously
   * produces a duplicate error.  Nesting can be arbitrary deep.
   *
   * Supported cases and extensions:
   * - Extensions: `.ts` and `.js` only — other files are ignored.
   * - Flat file: `start.ts` → route `start`.
   * - Nested file: `admin/ban.ts` → route `admin/ban` (arbitrary depth).
   * - Directory index: `admin/index.ts` → route `admin`.
   * - A root-level `index.ts`/`index.js` has no parent route and is rejected
   *   with an empty-routeName error — rename it to a named file instead.
   *
   * @param path - Path to the pages directory. Uses default pages directory when omitted.
   * @param positionModule - Index of the exported class. Used when files have multiple exports. Defaults to `0`.
   * @returns Array of page records containing `path`, `page` and `routeName` properties.
   *
   * @throws Error if directory does not exist.
   * @throws Error if a file and a directory-index share the same route name.
   *
    * @example
    * ```typescript
    * const pages = PageManager.getFileManySync();
    * // => [
    * //   { path: "/path/to/start.ts",          page: StartPage,   routeName: "start" },
    * //   { path: "/path/to/settings.ts",       page: SettingsPage, routeName: "settings" },
    * //   { path: "/path/to/start/help.ts",     page: HelpPage,    routeName: "start/help" },
    * //   { path: "/path/to/start/help/index.ts", page: HelpPage,  routeName: "start/help" },
    * //                                        ↑ identical route — duplicate error if both exist
    * // ]
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

    const results: Array<{path: string; page: typeof Ctx; routeName: string}> = []

    const walk = (dir: string, parentRoute: string) => {
      const entries = readdirSync(dir, {withFileTypes: true})
      const dirNames: string[] = []
      const fileNames: string[] = []

      for (const entry of entries) {
        if (entry.isDirectory()) {
          dirNames.push(entry.name)
        } else if (entry.isFile()) {
          fileNames.push(entry.name)
        }
      }

      const dirSet = new Set(dirNames)
      for (const fileName of fileNames) {
        const baseName = fileName.replace(/\.(ts|js)$/, ``)
        if (baseName !== fileName && dirSet.has(baseName)) {
          const indexTsPath = join(dir, baseName, `index.ts`)
          const indexJsPath = join(dir, baseName, `index.js`)
          if (existsSync(indexTsPath) || existsSync(indexJsPath)) {
            const conflictPath = existsSync(indexTsPath) ? indexTsPath : indexJsPath
            throw new Error(
              `Duplicate page: "${join(dir, fileName)}" and "${conflictPath}" both define the route "${parentRoute ? `${parentRoute}/` : ``}${baseName}". ` +
              `Use either a flat file ("${fileName}") or a directory with an index file ("${baseName}/index.ts"), not both.`
            )
          }
        }
      }

      for (const dirName of dirNames) {
        walk(join(dir, dirName), parentRoute ? `${parentRoute}/${dirName}` : dirName)
      }

      for (const fileName of fileNames) {
        if (!/\.(ts|js)$/.test(fileName)) continue

        const isIndex = /^index\.(ts|js)$/.test(fileName)
        const routeName = isIndex
          ? parentRoute
          : parentRoute
            ? `${parentRoute}/${fileName.replace(/\.(ts|js)$/, ``)}`
            : fileName.replace(/\.(ts|js)$/, ``)

        if (!routeName) {
          throw new Error(`Empty routeName for "${join(dir, fileName)}" — a root-level index.ts/index.js has no parent route. Rename it to a named page file (e.g. "start.ts").`)
        }

        results.push({
          path: join(dir, fileName),
          page: this.getFileSync(join(dir, fileName), positionModule),
          routeName
        })
      }
    }

    walk(path, ``)
    return results
  }

  /**
   * Clear the require cache for all page modules.
   *
   * @remarks
   * CommonJS-only: entries are deleted from the `require` cache. In ESM
   * runtimes without a `require` cache this throws a descriptive error —
   * use the async {@link PageManager.getFile} path instead, which
   * cache-busts via an `?t=` import query.
   *
   * @param path - Path to the pages directory. Enables hot-reloading of pages.
   * @returns `true` when cache is cleared.
   *
   * @throws Error if directory does not exist.
   * @throws Error if no CommonJS require cache is available (ESM runtime).
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

    const cjsRequire = (globalThis as unknown as {require?: {cache: Record<string, unknown>; resolve: (id: string) => string}}).require
    if (!cjsRequire?.cache || !cjsRequire?.resolve) {
      throw new Error(`PageManager.clearCacheRequire requires the CommonJS require cache, which is unavailable in ESM. Use the async PageManager.getFile path (cache-busted import with ?t= query) to reload a page instead.`)
    }

    const clearDir = (dir: string) => {
      const entries = readdirSync(dir, {withFileTypes: true})
      for (const entry of entries) {
        const fullPath = join(dir, entry.name)
        if (entry.isDirectory()) {
          clearDir(fullPath)
        } else if (entry.isFile() && /\.(ts|js)$/.test(entry.name)) {
          delete cjsRequire.cache[cjsRequire.resolve(fullPath)]
        }
      }
    }

    clearDir(path)
    return true
  }
}
