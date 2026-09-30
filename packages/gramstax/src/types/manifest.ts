import type {Ctx} from "~/core/ctx"

/**
 * One page entry of a static app manifest.
 *
 * @remarks
 * Emitted by `buildManifest` as `{path, routeName, page}` per discovered
 * page file. Consumed by `_pageLoadsFromManifest` — `path` feeds
 * `_pageRegisterEntry` (and the empty-`routeName` error), `routeName` is the
 * template key for the class-inline template compile, `page` is the imported
 * page class whose `static template` rides along.
 *
 * @public
 */
export type IPageManifestEntry = {
  /**
   * POSIX-relative path of the page file from the pages root.
   *
   * @remarks
   * Walk-relative (`toPosix`), not the absolute filesystem path — e.g.
   * `admin/settings.ts`. Used for diagnostics and page registration.
   */
  path: string
  /**
   * Walk-derived route for the page.
   *
   * @remarks
   * Index files use the parent route. Must be non-empty — an empty value
   * throws in `_pageLoadsFromManifest`. Doubles as the template key for the
   * class-inline template compile.
   */
  routeName: string
  /**
   * Imported page class for the entry.
   */
  page: typeof Ctx
}

/**
 * One embedded `.html` template entry of a static app manifest.
 *
 * @remarks
 * Collected by `collectHtmlTemplates` — only `.html` files are embedded;
 * class-inline `static template` strings ride the page classes instead.
 * Consumed by `_pageLoadsFromManifest` via `templateManager._compile(key, template)`.
 *
 * @public
 */
export type ITemplateManifestEntry = {
  /**
   * Template key the fragment compiles under.
   *
   * @remarks
   * Mirrors the `TemplateManager` walk — index files use the parent route,
   * so `settings/index.html` compiles under `settings`.
   */
  key: string
  /**
   * Raw `.html` file content.
   */
  template: string
}

/**
 * One route entry of a static app manifest.
 *
 * @remarks
 * Collected by `RouteCollector.collect` and persisted to `routes.json`.
 * Joined with `pages` by `routeName` in `_pageLoadsFromManifest` — a route
 * with no matching page throws. `file` becomes the registration `path`.
 *
 * @public
 */
export type IRouteManifestEntry = {
  /**
   * Page class name for the entry.
   *
   * @remarks
   * The imported class identifier (`page.name`) — distinct from `routeName`,
   * which is the walk-derived route the page registers under.
   */
  name: string
  /**
   * POSIX-relative path of the page file from the pages root.
   *
   * @remarks
   * Same walk-relative shape as `IPageManifestEntry.path` — e.g.
   * `admin/settings.ts`. Passed as `path` to `_pageRegisterEntry`.
   */
  file: string
  /**
   * Walk-derived route for the page.
   *
   * @remarks
   * Join key against `IPageManifestEntry.routeName`. Duplicates throw at
   * collect time — each page file must map to a unique route.
   */
  routeName: string
}

/**
 * Static page/template manifest for filesystem-less boot.
 *
 * @remarks
 * Emitted by `buildManifest` (static imports + embedded `.html`) and
 * consumed by `_pageLoadsFromManifest` — same routing tables as the
 * directory scan, with no directory read. `routes` is optional: when
 * present, registration walks `routes` (joined to `pages` by `routeName`);
 * otherwise it walks `pages` directly.
 *
 * @public
 */
export type IAppManifest = {
  /**
   * Page entries keyed by walk-derived route.
   */
  pages: Array<IPageManifestEntry>
  /**
   * Embedded `.html` template entries.
   */
  templates: Array<ITemplateManifestEntry>
  /**
   * Optional route entries persisted from `routes.json`.
   */
  routes?: Array<IRouteManifestEntry>
}
