import { readFile } from "node:fs/promises"
import { PageManager } from "~/page/manager"
import { TemplateEngine } from "."
import { watch, FSWatcher } from "chokidar"
import { basename, join, extname } from "node:path"
import { readdirSync, readFileSync, existsSync, statSync, writeFileSync } from "node:fs"

/** Template file interface for better type safety */
type ICompiledTemplate = {
  media: ReturnType<typeof TemplateEngine.compileMedia>
  message: ReturnType<typeof TemplateEngine.compileMessages>
  keyboard: ReturnType<typeof TemplateEngine.compileKeyboards>
  description: ReturnType<typeof TemplateEngine.compileDescription>
}

/** Template loading options */
type ITemplateOptions = {
  /** Base path for template files */
  path: string[]
  /** Enable file watching for hot reloading for value template only */
  enableWatch?: boolean
}

/** Template management system */
export class TemplateManager {
  public _map = new Map<string, ICompiledTemplate>()
  public _engine = TemplateEngine
  public _watcher: FSWatcher[] = []
  public _supportedExtensions = new Set([`.html`, `.ts`])
  public readonly _path: ITemplateOptions[`path`]
  public readonly _isWatchEnabled: ITemplateOptions[`enableWatch`]
  public constructor(options: ITemplateOptions) {
    const { path, enableWatch = false } = options

    this._path = path
    this._isWatchEnabled = enableWatch

    this._validatePath()
    this._initializeWatcher()
    this._loadAllFiles()
  }

  /** Validate and ensure template directory exists. @returns Void */
  public _validatePath(): boolean {
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

  /** Initialize file system watcher for hot reloading. @returns Void */
  public _initializeWatcher(): void {
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
        }
      })

      this._watcher[index] = wc
      wc.on(`change`, this._handleFileChange.bind(this))
      wc.on(`add`, this._handleFileAdd.bind(this))
      wc.on(`unlink`, this._handleFileDelete.bind(this))
      wc.on(`error`, this._handleWatchError.bind(this))
    }
  }

  /** Handle file change events */
  public async _handleFileChange(filepath: string): Promise<void> {
    const filename = basename(filepath)
    if (this._isValidFile(filename)) {
      await this._loadFile(filename, false)
    }
  }

  /** Handle file add events */
  public async _handleFileAdd(filepath: string): Promise<void> {
    const fileName = basename(filepath)
    if (this._isValidFile(fileName)) {
      await this._loadFile(fileName, false)
    }
  }

  /** Handle file delete events */
  public _handleFileDelete(filepath: string): void {
    const fileName = basename(filepath)
    const fileKey = this._getKey(fileName)
    if (this._map.has(fileKey)) {
      this._map.delete(fileKey)
    }
  }

  /** Handle watcher errors */
  public _handleWatchError(error: any): void {
    if (error) {
      // you can overrides
    }
  }

  /** Load all Template files during initialization */
  public async _loadAllFiles(): Promise<void> {
    for (let index = 0; index < this._path.length; index++) {
      const pt = this._path[index] as string
      const files = readdirSync(pt, `utf8`)
      const validFiles = files.filter((file) => this._isValidFile(file))
      for (const fileName of validFiles) {
        await this._loadFile(fileName, true)
      }
    }
  }

  /** Load and compile a single template file */
  public async _loadFile(filename: string, useSync: boolean = true): Promise<void> {
    for (let index = 0; index < this._path.length; index++) {
      const it = this._path[index] as string
      const path = join(it, filename)
      const ext = this._getExtension(filename)
      const key = this._getKey(filename)

      // priority .html because if .html in directory /pages and have .ts file too its will still working
      if (ext == `.html`) {
        const raw = useSync ? readFileSync(path, `utf8`) : await readFile(path, `utf8`)
        this._compile(key, raw)
      } else if (ext == `.ts`) {
        const Page = await PageManager.getFile(path, false)
        if (Page?.template !== undefined) {
          this._compile(key, Page.template)
        }
        Page.template = undefined
      } else {
        throw new Error(`File ${filename} is not support`)
      }
    }
  }

  public _getExtension(filename: string): string {
    return extname(filename).toLowerCase()
  }

  public _isValidFile(filename: string): boolean {
    return this._supportedExtensions.has(this._getExtension(filename))
  }

  public _getKey(filename: string): string {
    return filename.replace(/\.[^/.]+$/, ``)
  }

  public _compile(key: string, template: string, keepIfExist?: Partial<{ [K in keyof ICompiledTemplate]: boolean }>) {
    const existing = this._map.get(key)
    const compiled = existing || ({} as ICompiledTemplate)
    let updated = false

    if (keepIfExist === undefined || keepIfExist?.media === false || existing?.media === undefined) {
      compiled.media = TemplateEngine.compileMedia(template)
      updated = true
    }
    if (keepIfExist === undefined || keepIfExist?.message === false || existing?.message === undefined) {
      compiled.message = TemplateEngine.compileMessages(template)
      updated = true
    }
    if (keepIfExist === undefined || keepIfExist?.keyboard === false || existing?.keyboard === undefined) {
      compiled.keyboard = TemplateEngine.compileKeyboards(template)
      updated = true
    }
    if (keepIfExist === undefined || keepIfExist?.description === false || existing?.description === undefined) {
      compiled.description = TemplateEngine.compileDescription(template)
      updated = true
    }

    if (updated) {
      this._map.set(key, compiled)
    }
  }

  /**
   * Get compiled media template
   * @param key Template identifier (filename without extension)
   * @param baseId Base id attr from block
   * @param language Target language code
   * @param data Template variables
   * @returns media object
   */
  public getMedia(key: string, baseId = `default`, language = `default`, data?: Record<string, any>): ReturnType<ICompiledTemplate[`media`][`default`][`default`]> {
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
   * Get compiled message template
   * @param key Template identifier (filename without extension)
   * @param baseId Base id attr from block
   * @param language Target language code
   * @param data Template variables
   * @returns Rendered message string
   */
  public getMessage(key: string, baseId = `default`, language = `default`, data?: Record<string, any>): string {
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
   * @param key Template identifier (filename without extension)
   * @param baseId Base id attr from block
   * @param language Target language code
   * @param scope Scope of the command
   * @returns Description string
   */
  public getDescription(key: string, baseId = `default`, language = `default`, scope = `default`, data?: Record<string, any>): string {
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

  public getDescriptionLanguage(key: string, baseId = `default`, scope = `default`): string[] {
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

  public getDescriptionScopes(key: string, baseId = `default`): string[] {
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
   * Get compiled keyboard template
   * @param key Template identifier (filename without extension)
   * @param baseId Base id attr from block
   * @param language Target language code
   * @param data Template variables
   * @returns Array of rendered button labels
   */
  public getKeyboard(key: string, baseId = `default`, language = `default`, type: `inline` | `bottom` = `inline`, data?: Record<string, any>): string[] {
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
   * Write template to file and update cache
   * @param filename Target filename (with extension)
   * @param template string content to write
   * @returns Promise that resolves when file is written
   */
  public async write(filename: string, template: string): Promise<boolean | null> {
    if (this._getExtension(filename) != `.html`) {
      return null
    }

    for (let index = 0; index < this._path.length; index++) {
      const filepath = join(this._path[index] as string, filename)
      const exists = existsSync(filepath)
      if (exists) {
        writeFileSync(filepath, template, `utf8`)
        await this._loadFile(filename, false)
        return true
      }
    }
    return null
  }

  /**
   * Check if template exists
   * @param key Template identifier
   * @returns True if template exists
   */
  public has(key: string): boolean {
    return this._map.has(key)
  }

  /**
   * Cleanup resources and close watchers
   * @returns Promise void
   */
  public async destroy(): Promise<void> {
    if (this._watcher) {
      for (const wt of this._watcher) {
        await wt.close()
      }
    }
    this._map.clear()
  }
}
