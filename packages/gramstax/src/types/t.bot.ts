import type LoggingPretty from "logging-pretty"
import type {CacheExternal} from "~/cache/external"
import type {TemplateManager} from "~/template/manager"

/**
 * Configuration options for Gramstax bot instance.
 *
 * @public
 */
export type ITGramstaxParams = {
  /**
   * Telegram Bot API token.
   *
   * @remarks
   * This token is obtained from BotFather when creating a new bot.
   *
   * @example
   * ```typescript
   * token: "123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
   * ```
   */
  token: string

  /**
   * Deployment mode for the bot.
   *
   * @remarks
   * Supported modes:
   * - `"polling"` - Long polling mode for development
   * - `"webhook:<url>"` - Webhook mode with specified URL
   * - `"serverless:<adapter>"` - Serverless mode with specified adapter
   *
   * @example
   * ```typescript
   * deploy: "polling"
   * deploy: "webhook:https://example.com/bot"
   * deploy: "serverless:std/http"
   * ```
   */
  deploy: string

  /**
   * Logger configuration.
   *
   * @remarks
   * - Pass a `LoggingPretty` instance for custom logging
   * - Pass `true` to use the default logger
   * - Pass `null` or `false` to disable logging
   *
   * @defaultValue `false`
   */
  log?: LoggingPretty | boolean | null

  /**
   * Custom session cache implementation.
   *
   * @remarks
   * Provides external session storage for persisting user data across restarts.
   */
  cacheSession?: CacheExternal

  /**
   * Custom keyboard cache.
   *
   * @remarks
   * Used to cache inline/bottom keyboard configurations for super large keyboard.
   */
  cacheKeyboard?: Map<any, any>

  /**
   * Custom template manager instance.
   *
   * @remarks
   * Allows customization of message template rendering and management.
   */
  templateManager?: TemplateManager

  /**
   * Page routing configuration options.
   */
  optionsPage?: {
    /**
     * Use numeric callback data for smaller args.
     *
     * @remarks
     * When enabled, callback data uses numeric IDs instead of full strings,
     * reducing payload size for inline keyboards.
     *
     * @defaultValue `false`
     */
    shortCallbackData?: boolean
  }
}
