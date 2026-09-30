import {mkdirSync, renameSync, writeFileSync} from "node:fs"
import {join, relative, resolve, sep} from "node:path"
import {PageManager} from "~/page/manager"
import type {ITRouteManifestEntry} from "~/page/manifest"

export class RouteCollector {
  collect(pagesDir: string): Array<ITRouteManifestEntry> {
    const root = resolve(pagesDir)
    const seen = new Map<string, string>()
    const routes: Array<ITRouteManifestEntry> = []
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

  write(outDir: string, routes: Array<ITRouteManifestEntry>): void {
    const dir = resolve(outDir)
    mkdirSync(dir, {recursive: true})
    const final = join(dir, `routes.json`)
    const tmp = join(dir, `routes.json.tmp`)
    writeFileSync(tmp, `${JSON.stringify(routes, null, 2)}\n`, `utf-8`)
    renameSync(tmp, final)
  }
}
