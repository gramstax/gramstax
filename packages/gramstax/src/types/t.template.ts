import type {ChokidarOptions} from "chokidar"
import type {TemplateEngine} from "~/template/engine"

/**
 * Compiled template structure containing all parsed template components.
 *
 * @remarks
 * This type represents the cached result of template compilation.
 * Each property holds compiled functions for different template sections.
 *
 * @public
 */
export type ITCompiledTemplate = {
  /** Compiled media blocks indexed by base ID and language */
  media: ReturnType<typeof TemplateEngine.compileBlockGMedia>
  /** Compiled poll blocks indexed by base ID and language */
  poll: ReturnType<typeof TemplateEngine.compileBlockGPoll>
  /** Compiled message blocks indexed by base ID and language */
  message: ReturnType<typeof TemplateEngine.compileBlockGMessage>
  /** Compiled keyboard blocks indexed by base ID, language, and type */
  keyboard: ReturnType<typeof TemplateEngine.compileBlockGKeyboards>
  /** Compiled description blocks indexed by base ID, scope, and language */
  description: ReturnType<typeof TemplateEngine.compileBlockGDescription>
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
 * const options = {
 *   path: [join(process.cwd(), "src", "pages")],
 *   enableWatch: true,
 *   watchOptions: {ignored: /node_modules/}
 * }
 * ```
 *
 * @public
 */
export type ITTemplateOptions = {
  /** Array of directory paths to scan for template files */
  path: string[]
  /** Enable file watching for hot-reloading during development */
  enableWatch?: boolean
  /** {@link https://github.com/paulmillr/chokidar#persistence | Chokidar WatchOptions} passed to the file watcher */
  watchOptions?: ChokidarOptions
  /**
   * Hook invoked after a template file is (re)compiled.
   *
   * @remarks
   * Fires on initial load and on watch reloads. Users typically clear
   * dependent caches here (e.g. the bot's keyboard cache).
   */
  onReload?: () => void
}
