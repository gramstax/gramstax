import {basename, join, extname} from "node:path"
import {readdirSync, readFileSync, existsSync, statSync, writeFileSync} from "node:fs"
import {watch, FSWatcher} from "chokidar"
import {PageManager} from "~/page/manager"
import {TemplateEngine} from "./engine"

/**
 * Compiled template structure containing all parsed template components.
 *
 * @remarks
 * This type represents the cached result of template compilation.
 * Each property holds compiled functions for different template sections.
 *
 * @internal
 */
type ICompiledTemplate = {
  /** Compiled media blocks indexed by base ID and language */
  media: ReturnType<typeof TemplateEngine.compileMedia>
  /** Compiled message blocks indexed by base ID and language */
  message: ReturnType<typeof TemplateEngine.compileMessages>
  /** Compiled keyboard blocks indexed by base ID, language, and type */
  keyboard: ReturnType<typeof TemplateEngine.compileKeyboards>
  /** Compiled description blocks indexed by base ID, scope, and language */
  description: ReturnType<typeof TemplateEngine.compileDescription>
}

/**
 * Configuration options for TemplateManager initialization.
 *
 * @remarks
 * Pass this object to the TemplateManager constructor to configure
 * template paths, hot-reloading, and watcher behavior.
 *
 * @example
 * ```typescript
 * const options: ITemplateOptions = {
 *   path: [join(process.cwd(), "src", "pages")],
 *   enableWatch: true,
 *   watchOptions: {ignored: /node_modules/}
 * }
 * ```
 *
 * @public
 */
type ITemplateOptions = {
  /** Array of directory paths to scan for template files */
  path: string[]
  /** Enable file watching for hot-reloading during development */
  enableWatch?: boolean
  /** {@link https://github.com/paulmillr/chokidar#persistence | Chokidar WatchOptions} passed to the file watcher */
  watchOptions?: any
}

/**
 * Manages template loading, compilation, caching, and hot-reloading from page files.
 *
 * @remarks
 * The `TemplateManager` class provides a centralized system for handling templates
 * used in Gramstax bots. It supports:
 * - Loading templates from static `template` properties in page classes
 * - Loading templates from external `.html` files
 * - Hot-reloading templates during development via file watching
 * - Multi-language support with fallback to `default`
 *
 * Templates are compiled once and cached for efficient retrieval.
 *
 * @example
 * ```typescript
 * import {TemplateManager} from "gramstax"
 * import {join} from "path"
 *
 * const tm = new TemplateManager({
 *   path: [join(process.cwd(), "src", "pages")],
 *   enableWatch: process.env.NODE_ENV === "development"
 * })
 *
 * // Get a compiled message
 * const message = tm.getMessage("start", "default", "en", {name: "John"})
 * ```
 *
 * @public
 */
export class TemplateManager {
  /** @internal Map of compiled templates keyed by filename (without extension) */
  _map = new Map<string, ICompiledTemplate>()
  /** @internal Reference to the TemplateEngine class for compilation */
  _engine = TemplateEngine
  /** @internal Active file system watchers for hot-reload */
  _watcher: FSWatcher[] = []
  /** @internal Reference to PageManager for loading page modules */
  _pageManager = PageManager
  /** @internal Set of supported template file extensions */
  _supportedExtensions = new Set([`.html`, `.ts`, `.js`])
  /** @readonly Base paths for scanning template files */
  readonly _path: ITemplateOptions[`path`]
  /** @readonly Flag indicating if file watching is enabled */
  readonly _isWatchEnabled: ITemplateOptions[`enableWatch`]

  /**
   * Creates a new TemplateManager instance.
   *
   * @param options - Configuration options for the template manager
   *
   * @remarks
   * The constructor validates paths, initializes watchers (if enabled),
   * and loads all template files from the specified paths.
   *
   * @example
   * ```typescript
   * const tm = new TemplateManager({
   *   path: [join(process.cwd(), "src", "pages")],
   *   enableWatch: true,
   *   watchOptions: {
   *     ignored: /node_modules/,
   *     persistent: true
   *   }
   * })
   * ```
   *
   * @throws Error if path is not a valid string array
   * @throws Error if any path does not exist or is not a directory
   */
  constructor(options: ITemplateOptions) {
    const {path, enableWatch = false} = options

    this._path = path
    this._isWatchEnabled = enableWatch

    this._validatePath()
    this._initializeWatcher(options.watchOptions)
    this._loadAllFiles()
  }

  /**
   * Validates and ensures all template directories exist.
   *
   * @remarks
   * This method checks that `_path` is a valid array of strings and that
   * each path exists and is a directory. Called during construction.
   *
   * @returns `true` if all paths are valid directories
   *
   * @throws Error if `_path` is not a string array
   * @throws Error if any path does not exist
   * @throws Error if any path is not a directory
   *
   * @example
   * ```typescript
   * this._validatePath()
   * // => true
   * ```
   *
   * @internal
   */
  _validatePath(): boolean {
    try {
      if (!this._path || !Array.isArray(this._path)) {
        throw new Error(`Path must be set as string array`)
      }

      for (let index = 0; index < this._path.length; index++) {
        const it = this._path[index] as string
        const exists = existsSync(it)
        if (!exists) {
          throw new Error(`Template base path is not exists: ${it}`)
        }

        const stats = statSync(it)
        if (!stats.isDirectory()) {
          throw new Error(`Template base path is not a directory: ${it}`)
        }
      }
      return true
    } catch (error) {
      throw new Error(`Failed to validate Template base path: ${String(error)}`)
    }
  }

  /**
   * Initializes file system watchers for hot reloading.
   *
   * @param options - Optional Chokidar watch options to customize watcher behavior
   *
   * @remarks
   * This method sets up file system watchers on each path in `_path` when
   * `enableWatch` is true. It listens for `change`, `add`, `unlink`, and `error` events.
   * The watchers are configured with `awaitWriteFinish` to avoid partial file reads.
   *
   * @example
   * ```typescript
   * this._initializeWatcher({
   *   ignored: /node_modules/,
   *   persistent: true
   * })
   * ```
   *
   * @throws Error if watcher is already initialized
   *
   * @internal
   */
  _initializeWatcher(options?: any): void {
    if (!this._isWatchEnabled) return

    if (this._watcher.length > 0) {
      throw new Error(`Watcher already enabled`)
    }

    for (let index = 0; index < this._path.length; index++) {
      const pt = this._path[index] as string
      const wc = watch(pt, {
        persistent: true,
        ignoreInitial: true,
        awaitWriteFinish: {
          stabilityThreshold: 100,
          pollInterval: 50
        },
        ...options
      })

      this._watcher[index] = wc
      wc.on(`change`, this._handleFileChange.bind(this))
      wc.on(`add`, this._handleFileAdd.bind(this))
      wc.on(`unlink`, this._handleFileDelete.bind(this))
      wc.on(`error`, this._handleWatchError.bind(this))
    }
  }

  /**
   * Handles file change events from the watcher.
   *
   * @param filepath - Full path to the changed file
   *
   * @remarks
   * Recompiles the template when a watched file is modified.
   * Only processes files with supported extensions.
   *
   * @example
   * ```typescript
   * this._handleFileChange("/src/pages/welcome.html")
   * ```
   *
   * @internal
   */
  _handleFileChange(filepath: string): void {
    const filename = basename(filepath)
    if (this._isValidFile(filename)) {
      this._loadFile(filename)
    }
  }

  /**
   * Handles file add events from the watcher.
   *
   * @param filepath - Full path to the added file
   *
   * @remarks
   * Compiles and caches a new template when a file is added.
   * Only processes files with supported extensions.
   *
   * @example
   * ```typescript
   * this._handleFileAdd("/src/pages/new-page.html")
   * ```
   *
   * @internal
   */
  _handleFileAdd(filepath: string): void {
    const fileName = basename(filepath)
    if (this._isValidFile(fileName)) {
      this._loadFile(fileName)
    }
  }

  /**
   * Handles file delete events from the watcher.
   *
   * @param filepath - Full path to the deleted file
   *
   * @remarks
   * Removes the compiled template from cache when its source file is deleted.
   *
   * @example
   * ```typescript
   * this._handleFileDelete("/src/pages/old-page.html")
   * ```
   *
   * @internal
   */
  _handleFileDelete(filepath: string): void {
    const fileName = basename(filepath)
    const fileKey = this._getKey(fileName)
    if (this._map.has(fileKey)) {
      this._map.delete(fileKey)
    }
  }

  /**
   * Handles watcher errors.
   *
   * @param error - The error object from the watcher
   *
   * @remarks
   * Override this method in a subclass to implement custom error handling.
   *
   * @example
   * ```typescript
   * this._handleWatchError(new Error("ENOENT"))
   * ```
   *
   * @virtual
   */
  _handleWatchError(error: any): void {
    if (error) {
      // you can overrides
    }
  }

  /**
   * Loads all template files during initialization with batch optimization.
   *
   * @remarks
   * This method scans all paths for valid template files (`.html`, `.ts`, `.js`),
   * collects their raw contents, and compiles them in a batch. It uses shared
   * caches for imports to optimize performance. After compilation, raw templates
   * are cleared and `Page.template` properties are set to `undefined` for memory cleanup.
   *
   * @example
   * ```typescript
   * this._loadAllFiles()
   * ```
   *
   * @internal
   */
  _loadAllFiles(): void {
    const rawTemplates = new Map<string, string>()
    const pagesToCleanup: any[] = []

    // 1. Collect all raw templates (from all paths)
    for (let index = 0; index < this._path.length; index++) {
      const pt = this._path[index] as string
      const files = readdirSync(pt, `utf8`)
      const validFiles = files.filter((file) => this._isValidFile(file))

      for (const fileName of validFiles) {
        const path = join(pt, fileName)
        const ext = this._getExtension(fileName)
        const key = this._getKey(fileName)

        if (ext === `.html`) {
          rawTemplates.set(key, readFileSync(path, `utf8`))
        } else if (ext === `.ts` || ext === `.js`) {
          const Page = PageManager.getFileSync(path)
          if (Page?.template !== undefined) {
            rawTemplates.set(key, Page.template)
            pagesToCleanup.push(Page)
          }
        }
      }
    }

    // 2. Shared cache for imports across all pages in this batch
    const importCache = new Map<string, string>()

    // 3. Compile all collected templates
    for (const [key, template] of rawTemplates.entries()) {
      this._compile(key, template, undefined, importCache, rawTemplates)
    }

    // 4. Memory Cleanup: clear raw templates and set Page.template to undefined
    rawTemplates.clear()
    importCache.clear()
    for (const Page of pagesToCleanup) {
      Page.template = undefined
    }
  }

  /**
   * Loads and compiles a single template file.
   *
   * @param filename - Filename with extension to load
   *
   * @remarks
   * This method is primarily used by the file watcher for hot-reloading.
   * It searches all paths and compiles the first matching file found.
   *
   * @example
   * ```typescript
   * this._loadFile("welcome.html")
   * ```
   *
   * @throws Error if the file extension is not supported
   *
   * @internal
   */
  _loadFile(filename: string): void {
    for (let index = 0; index < this._path.length; index++) {
      const it = this._path[index] as string
      const path = join(it, filename)
      const ext = this._getExtension(filename)
      const key = this._getKey(filename)

      if (ext == `.html`) {
        const raw = readFileSync(path, `utf8`)
        this._compile(key, raw)
      } else if (ext == `.ts` || ext == `.js`) {
        const Page = PageManager.getFileSync(path)
        if (Page?.template !== undefined) {
          this._compile(key, Page.template)
          Page.template = undefined // Cleanup single file as well
        }
      } else {
        throw new Error(`File ${filename} is not support`)
      }
    }
  }

  /**
   * Extracts the file extension from a filename.
   *
   * @param filename - Filename to extract extension from
   * @returns Lowercase file extension including the dot (e.g., `.html`)
   *
   * @example
   * ```typescript
   * this._getExtension("welcome.HTML")
   * // => ".html"
   * ```
   *
   * @internal
   */
  _getExtension(filename: string): string {
    return extname(filename).toLowerCase()
  }

  /**
   * Reads a template file's content from disk.
   *
   * @param filename - Filename to read (with or without extension)
   * @returns Template content string, or `null` if not found
   *
   * @remarks
   * If no extension is provided, tries `.ts`, `.js`, then `.html` in order.
   * Searches all configured paths until a match is found.
   *
   * @example
   * ```typescript
   * this._readTemplateFile("welcome")
   * // => "<base>...</base>"
   * ```
   *
   * @internal
   */
  _readTemplateFile(filename: string): string | null {
    for (const importPath of this._path) {
      // 1. Check if filename has extension
      const ext = extname(filename).toLowerCase()
      if (ext) {
        // If has extension, just try to read it directly
        const fullPath = join(importPath, filename)
        if (existsSync(fullPath) && statSync(fullPath).isFile()) {
          if (ext === `.html`) {
            return readFileSync(fullPath, `utf8`)
          } else if (ext === `.ts` || ext === `.js`) {
            try {
              const Page = PageManager.getFileSync(fullPath)
              return Page?.template ?? null
            } catch {
              return null
            }
          }
        }
        continue
      }

      // 2. If no extension, try .ts / .js then .html
      const tsPath = join(importPath, `${filename}.ts`)
      const jsPath = join(importPath, `${filename}.js`)
      if (existsSync(tsPath) && statSync(tsPath).isFile()) {
        try {
          const Page = PageManager.getFileSync(tsPath)
          return Page?.template ?? null
        } catch {
          // If failed to load TS, continue to check HTML
        }
      } else if (existsSync(jsPath) && statSync(jsPath).isFile()) {
        try {
          const Page = PageManager.getFileSync(tsPath)
          return Page?.template ?? null
        } catch {
          // If failed to load JS, continue to check HTML
        }
      }

      const htmlPath = join(importPath, `${filename}.html`)
      if (existsSync(htmlPath) && statSync(htmlPath).isFile()) {
        return readFileSync(htmlPath, `utf8`)
      }
    }
    return null
  }

  /**
   * Checks if a file has a supported template extension.
   *
   * @param filename - Filename to check
   * @returns `true` if file extension is `.html`, `.ts`, or `.js`
   *
   * @example
   * ```typescript
   * this._isValidFile("welcome.html")
   * // => true
   * ```
   *
   * @internal
   */
  _isValidFile(filename: string): boolean {
    return this._supportedExtensions.has(this._getExtension(filename))
  }

  /**
   * Derives the cache key from a filename by removing the extension.
   *
   * @param filename - Filename with extension
   * @returns Filename without extension (used as template key)
   *
   * @example
   * ```typescript
   * this._getKey("start-page.html") // => "start-page"
   * this._getKey("welcome.ts") // => "welcome"
   * ```
   *
   * @internal
   */
  _getKey(filename: string): string {
    return filename.replace(/\.[^/.]+$/, ``)
  }

  /**
   * Compiles a raw template string and stores the result in the cache.
   *
   * @param key - Template cache key (filename without extension)
   * @param template - Raw template HTML string
   * @param keepIfExist - Optional flags to preserve existing compiled parts
   * @param importCache - Optional shared cache for import resolution
   * @param rawCache - Optional pre-loaded raw template cache for batch loading
   *
   * @remarks
   * This method processes import blocks, compiles media, messages, keyboards,
   * and descriptions from the template. It uses `TemplateEngine` for compilation.
   * The `keepIfExist` parameter allows partial recompilation when only specific
   * template parts have changed.
   *
   * @example
   * ```typescript
   * this._compile("welcome", rawHtmlContent)
   *
   * const importCache = new Map<string, string>()
   * const rawCache = new Map([["partial", partialHtml]])
   * this._compile("main", mainHtml, undefined, importCache, rawCache)
   * ```
   *
   * @internal
   */
  _compile(key: string, template: string, keepIfExist?: Partial<{[K in keyof ICompiledTemplate]: boolean}>, importCache?: Map<string, string>, rawCache?: Map<string, string>) {
    const existing = this._map.get(key)
    const compiled = existing || ({} as ICompiledTemplate)
    let updated = false

    // Process Imports
    const processedTemplate = TemplateEngine.processImportBlocks(
      template,
      (src) => {
        // 1. Check rawCache (for batch loading)
        if (rawCache && rawCache.has(src)) {
          return rawCache.get(src)!
        }
        // 2. Fallback to disk
        return this._readTemplateFile(src)
      },
      0,
      importCache
    )

    // Memoize base blocks to avoid redundant regex parsing
    const baseBlocks = TemplateEngine._processBaseBlocks(processedTemplate)

    if (keepIfExist === undefined || keepIfExist?.media === false || existing?.media === undefined) {
      compiled.media = TemplateEngine.compileMedia(processedTemplate, baseBlocks)
      updated = true
    }
    if (keepIfExist === undefined || keepIfExist?.message === false || existing?.message === undefined) {
      compiled.message = TemplateEngine.compileMessages(processedTemplate, baseBlocks)
      updated = true
    }
    if (keepIfExist === undefined || keepIfExist?.keyboard === false || existing?.keyboard === undefined) {
      compiled.keyboard = TemplateEngine.compileKeyboards(processedTemplate, baseBlocks)
      updated = true
    }
    if (keepIfExist === undefined || keepIfExist?.description === false || existing?.description === undefined) {
      compiled.description = TemplateEngine.compileDescription(processedTemplate, baseBlocks)
      updated = true
    }

    if (updated) {
      this._map.set(key, compiled)
    }
  }

  /**
   * Gets compiled media template data.
   *
   * @param key - Template identifier (filename without extension)
   * @param baseId - Base block ID matching `<base id="...">`
   * @param language - Target language code (falls back to `default`)
   * @param data - Template variables for interpolation
   * @returns Media object containing type, src, and caption
   *
   * @remarks
   * Retrieves the compiled media function for the specified template and language,
   * then executes it with the provided data to generate the media payload.
   *
   * @example
   * ```typescript
   * const media = tm.getMedia("photo-page", "default", "en", {photoUrl: "..."})}
   * // => {type: "photo", src: "...", caption: "..."}
   * ```
   *
   * @public
   */
  getMedia(key: string, baseId = `default`, language = `default`, data?: Record<string, any>): ReturnType<ICompiledTemplate[`media`][`default`][`default`]> {
    const map = this._map.get(key)
    const one = map?.media?.[baseId]
    const func = one?.[language] || one?.[`default`]

    try {
      if (!func) {
        throw new Error(`Media function not found, please check your template`)
      }

      return func(data)
    } catch {
      return {} as any
    }
  }

  /**
   * Gets a compiled message template string.
   *
   * @param key - Template identifier (filename without extension)
   * @param baseId - Base block ID matching `<base id="...">`
   * @param language - Target language code (falls back to `default`)
   * @param data - Template variables for interpolation
   * @returns Rendered message string, or empty string if not found
   *
   * @remarks
   * Retrieves the compiled message function for the specified template and language,
   * then executes it with the provided data to generate the message.
   *
   * @example
   * ```typescript
   * const message = tm.getMessage("start", "default", "en", {name: "John"})
   * // => "Hello, John! Welcome to the bot."
   * ```
   *
   * @public
   */
  getMessage(key: string, baseId = `default`, language = `default`, data?: Record<string, any>): string {
    try {
      const map = this._map.get(key)
      const one = map?.message?.[baseId]
      const func = one?.[language] || one?.[`default`]
      if (!func) {
        throw ``
      }

      return func(data)
    } catch {
      return ``
    }
  }

  /**
   * Gets a command description for Telegram menu.
   *
   * @param key - Template identifier (filename without extension)
   * @param baseId - Base block ID matching `<base id="...">`
   * @param language - Target language code (falls back to `default`)
   * @param scope - Telegram bot command scope (e.g., `default`, `admin`)
   * @param data - Template variables for interpolation
   * @returns Rendered description string, or empty string if not found
   *
   * @remarks
   * Retrieves the compiled description function for the specified template, scope,
   * and language, then executes it with the provided data.
   *
   * @example
   * ```typescript
   * const desc = tm.getDescription("start", "default", "en")
   * // => "Start the bot"
   * ```
   *
   * @public
   */
  getDescription(key: string, baseId = `default`, language = `default`, scope = `default`, data?: Record<string, any>): string {
    try {
      const map = this._map.get(key)
      const one = map?.description?.[baseId]?.[scope]
      const func = one?.[language] || one?.[`default`]
      if (!func) {
        throw ``
      }

      return func(data)
    } catch {
      return ``
    }
  }

  /**
   * Gets available languages for a description.
   *
   * @param key - Template identifier (filename without extension)
   * @param baseId - Base block ID matching `<base id="...">`
   * @param scope - Telegram bot command scope
   * @returns Array of language codes present for the scope
   *
   * @remarks
   * Useful for determining which languages are defined for a command description.
   *
   * @example
   * ```typescript
   * const languages = tm.getDescriptionLanguage("start", "default", "default")
   * // => ["default", "en", "id"]
   * ```
   *
   * @public
   */
  getDescriptionLanguage(key: string, baseId = `default`, scope = `default`): string[] {
    try {
      const map = this._map.get(key)
      const obj = map?.description?.[baseId]?.[scope]
      if (obj) {
        return Object.keys(obj)
      }

      return []
    } catch {
      return []
    }
  }

  /**
   * Gets available scopes for a description.
   *
   * @param key - Template identifier (filename without extension)
   * @param baseId - Base block ID matching `<base id="...">`
   * @returns Array of scope keys for the description
   *
   * @remarks
   * Useful for determining which scopes are defined for a command.
   *
   * @example
   * ```typescript
   * const scopes = tm.getDescriptionScopes("start", "default")
   * // => ["default", "admin"]
   * ```
   *
   * @public
   */
  getDescriptionScopes(key: string, baseId = `default`): string[] {
    try {
      const map = this._map.get(key)
      const obj = map?.description?.[baseId]
      if (obj) {
        return Object.keys(obj)
      }

      return []
    } catch {
      return []
    }
  }

  /**
   * Gets compiled keyboard template labels.
   *
   * @param key - Template identifier (filename without extension)
   * @param baseId - Base block ID matching `<base id="...">`
   * @param language - Target language code (falls back to `default`)
   * @param type - Keyboard type: `inline` or `bottom`
   * @param data - Template variables for interpolation
   * @returns Array of rendered button labels, or empty array if not found
   *
   * @remarks
   * Retrieves the compiled keyboard function for the specified template, language,
   * and type, then executes it with the provided data to generate button labels.
   *
   * @example
   * ```typescript
   * const buttons = tm.getKeyboard("start", "default", "en", "inline")
   * // => ["Counter", "Help", "Settings"]
   * ```
   *
   * @public
   */
  getKeyboard(key: string, baseId = `default`, language = `default`, type: `inline` | `bottom` = `inline`, data?: Record<string, any>): string[] {
    try {
      const map = this._map.get(key)
      const one = map?.keyboard?.[baseId]
      const func = one?.[language]?.[type] || one?.[`default`]?.[type]
      if (!func) {
        throw []
      }

      return func(data)
    } catch {
      return []
    }
  }

  /**
   * Writes a template to file and updates the cache.
   *
   * @param filename - Target filename with `.html` extension
   * @param template - Template string content to write
   * @returns `true` if file was written, `null` if file not found or invalid extension
   *
   * @remarks
   * Only `.html` files are supported for writing. The method searches all
   * configured paths for an existing file and updates it in place.
   * After writing, the template is recompiled and cached.
   *
   * @example
   * ```typescript
   * const success = await tm.write("welcome.html", newTemplateContent)
   * if (success) {
   *   console.log("Template updated")
   * }
   * ```
   *
   * @public
   */
  async write(filename: string, template: string): Promise<boolean | null> {
    if (this._getExtension(filename) != `.html`) {
      return null
    }

    for (let index = 0; index < this._path.length; index++) {
      const filepath = join(this._path[index] as string, filename)
      const exists = existsSync(filepath)
      if (exists) {
        writeFileSync(filepath, template, `utf8`)
        this._loadFile(filename)
        return true
      }
    }
    return null
  }

  /**
   * Checks if a template exists in the cache.
   *
   * @param key - Template identifier (filename without extension)
   * @returns `true` if template exists in cache
   *
   * @example
   * ```typescript
   * if (tm.has("welcome")) {
   *   const msg = tm.getMessage("welcome", "default", "en")
   * }
   * ```
   *
   * @public
   */
  has(key: string): boolean {
    return this._map.has(key)
  }

  /**
   * Cleans up resources and closes file watchers.
   *
   * @returns Promise that resolves after watchers are closed
   *
   * @remarks
   * Call this method when shutting down the bot to properly release
   * file system resources. Clears the template cache as well.
   *
   * @example
   * ```typescript
   * // Cleanup on shutdown
   * process.on("SIGINT", async () => {
   *   await tm.destroy()
   *   process.exit(0)
   * })
   * ```
   *
   * @public
   */
  async destroy(): Promise<void> {
    if (this._watcher) {
      for (const wt of this._watcher) {
        await wt.close()
      }
    }
    this._map.clear()
  }
}
