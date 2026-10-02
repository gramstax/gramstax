import {mkdirSync, renameSync, writeFileSync} from "node:fs"
import {join, relative, resolve, sep} from "node:path"
import {PageManager} from "~/page/manager"
import type {IRouteManifestEntry} from "~/types/manifest"

export class RouteCollector {
  /**
   * Walk the pages directory and collect one manifest entry per page file.
   *
   * @remarks
   * Route names are derived by `PageManager.getFileManySync` from the file path,
   * so two files can collide (e.g. `admin.ts` alongside `admin/index.ts`). The
   * collision is fatal here rather than silently letting one page shadow the
   * other at runtime — the error names both offending files.
   *
   * @param pagesDir - Pages root to scan. Resolved against the process cwd when relative.
   * @returns One entry per discovered page file, each carrying its POSIX-relative `file`, the page class `name`, and the walk-derived `routeName`.
   *
   * @throws Error when two page files map to the same `routeName`.
   *
   * @public
   */
  collect(pagesDir: string): Array<IRouteManifestEntry> {
    const root = resolve(pagesDir)
    const seen = new Map<string, string>()
    const routes: Array<IRouteManifestEntry> = []
    for (const {path, page, routeName} of PageManager.getFileManySync(root)) {
      const file = relative(root, path).split(sep).join(`/`)
      const first = seen.get(routeName)
      if (first !== undefined) {
        throw new Error(`Duplicate routeName "${routeName}" from "${first}" and "${file}". Each page file must map to a unique route.`)
      }
      seen.set(routeName, file)
      routes.push({file, name: page.name, routeName})
    }
    return routes
  }

  /**
   * Write the collected routes to `<outDir>/routes.json`.
   *
   * @remarks
   * Writes to a `.tmp` sibling first and renames it over the final name, so a
   * concurrent reader (or a crashed build) never observes a half-written
   * `routes.json`. `mkdirSync` is recursive, so `outDir` need not pre-exist.
   *
   * @param outDir - Directory that receives `routes.json`. Resolved against the process cwd when relative.
   * @param routes - Route entries to serialize, in collection order.
   *
   * @public
   */
  write(outDir: string, routes: Array<IRouteManifestEntry>): void {
    const dir = resolve(outDir)
    mkdirSync(dir, {recursive: true})
    const final = join(dir, `routes.json`)
    const tmp = join(dir, `routes.json.tmp`)
    writeFileSync(tmp, `${JSON.stringify(routes, null, 2)}\n`, `utf-8`)
    renameSync(tmp, final)
  }
}
