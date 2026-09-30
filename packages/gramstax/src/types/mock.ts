import type {LoggingHelper} from "~/helpers/log"

/**
 * Telegram JSON response shape for mock server responses.
 *
 * @remarks
 * This is the minimal Bot API response contract used by the mock server:
 * `ok` indicates success and `result` contains the payload.
 *
 * @example
 * ```typescript
 * const response: IMockTelegramJson = {ok: true, result: {foo: `bar`}}
 * ```
 *
 * @public
 */
export type IMockTelegramJson = {
  /** Indicates whether the mock request is successful. */
  ok: boolean
  /** Result payload returned by the mock method. */
  result?: unknown
  /** Error description when the request fails. */
  description?: string
}

/**
 * Handler signature for mock Telegram methods.
 *
 * @remarks
 * Return a Bot API-like JSON object. `method` is the Telegram method name
 * extracted from the URL path (e.g. `getMe`, `setWebhook`).
 *
 * @example
 * ```typescript
 * const handler: IMockTelegramHandler = ({method}) => ({ok: true, result: {method}})
 * ```
 *
 * @public
 */
export type IMockTelegramHandler = (payload: {method: string; request: Request}) => Promise<IMockTelegramJson> | IMockTelegramJson

/**
 * Recorded outbound Bot API request captured by the mock server.
 *
 * @remarks
 * Each entry represents one HTTP request made by the bot under test to the mock server.
 * Access via `mockServer.requests` or `mockServer.lastRequest(method)`.
 *
 * @public
 */
export type IMockTelegramRequestRecord = {
  /** Telegram Bot API method name, e.g. `sendMessage`. */
  method: string
  /** Parsed request body when available. */
  body: unknown
  /** Request URL. */
  url: string
  /** Request HTTP method. */
  requestMethod: string
  /** Request headers copied into a plain object. */
  headers: Record<string, string>
}

/**
 * Basic Telegram mock user profile used when generating updates.
 *
 * @remarks
 * Mirrors the Telegram Bot API `User` object. Used by `sendText`, `sendPhoto`,
 * `sendCallbackQuery`, and other helper methods to construct mock message updates.
 * The mock server fills missing fields with defaults (e.g. `language_code: "en"`).
 *
 * @public
 */
export type IMockTelegramUser = {
  /** Unique identifier for the user. Defaults to `1001`. */
  id?: number
  /** `true` if this user is a bot. Defaults to `false`. */
  is_bot?: boolean
  /** First name of the user. Defaults to `"Test"`. */
  first_name?: string
  /** Last name of the user. */
  last_name?: string
  /** Username of the user. Required by bots that use `UserGuard`. */
  username?: string
  /** IETF language tag of the user's locale. Defaults to `"en"`. */
  language_code?: string
}

/**
 * Basic Telegram mock chat profile used when generating message updates.
 *
 * @remarks
 * Mirrors the Telegram Bot API `Chat` object. Used alongside `IMockTelegramUser`
 * to construct mock message updates sent to the bot's webhook.
 *
 * @public
 */
export type IMockTelegramChat = {
  /** Unique identifier for the chat. Defaults to `1001`. */
  id?: number
  /** Type of the chat. Defaults to `"private"`. */
  type?: `private` | `group` | `supergroup` | `channel`
  /** First name for private chats. Defaults to `"Test"`. */
  first_name?: string
  /** Last name for private chats. */
  last_name?: string
  /** Username for private chats, supergroups, or channels. */
  username?: string
  /** Title for group, supergroup, or channel chats. */
  title?: string
}

/**
 * Shared options for generated mock updates.
 *
 * @remarks
 * Base options object passed to all `send*` helper methods on `MockTelegramServer`.
 * Controls the simulated user, chat context, and response wait behavior.
 *
 * @public
 */
export type IMockTelegramUpdateOptions = {
  /** Simulated user profile. Merged with mock server defaults. */
  user?: IMockTelegramUser
  /** Simulated chat profile. Merged with mock server defaults. */
  chat?: IMockTelegramChat
  /** Unix timestamp for the message date. Defaults to `Date.now()`. */
  date?: number
  /** Message ID for the update. Auto-incremented if not provided. */
  message_id?: number
  /** Time to wait for outbound Bot API calls after posting the update to the webhook. Defaults to 1000ms. Use 0 to disable waiting. */
  responseTimeoutMs?: number
}

/**
 * Options for generated mock media message updates.
 *
 * @remarks
 * Extends `IMockTelegramUpdateOptions` with a `caption` field.
 * Used by `sendPhoto`, `sendVideo`, `sendAudio`, `sendDocument`,
 * `sendAnimation`, and `sendVoice`.
 *
 * @public
 */
export type IMockTelegramMediaOptions = IMockTelegramUpdateOptions & {
  /** Caption text displayed below the media. */
  caption?: string
}

/**
 * Options for generated mock location updates.
 *
 * @remarks
 * Extends `IMockTelegramUpdateOptions` with `latitude` and `longitude`.
 * Used by `sendLocation`.
 *
 * @public
 */
export type IMockTelegramLocationOptions = IMockTelegramUpdateOptions & {
  /** Latitude of the location. Defaults to `0`. */
  latitude?: number
  /** Longitude of the location. Defaults to `0`. */
  longitude?: number
}

/**
 * Options for generated mock contact updates.
 *
 * @remarks
 * Extends `IMockTelegramUpdateOptions` with contact fields.
 * Used by `sendContact`.
 *
 * @public
 */
export type IMockTelegramContactOptions = IMockTelegramUpdateOptions & {
  /** Contact phone number. Defaults to `"+10000000000"`. */
  phone_number?: string
  /** Contact first name. Defaults to `"Test"`. */
  first_name?: string
  /** Contact last name. */
  last_name?: string
  /** Telegram user ID associated with the contact. */
  user_id?: number
}

/**
 * Options for generated mock callback query updates.
 *
 * @remarks
 * Extends `IMockTelegramUpdateOptions` with callback-specific fields.
 * Used by `sendCallbackQuery`.
 *
 * @public
 */
export type IMockTelegramCallbackQueryOptions = IMockTelegramUpdateOptions & {
  /** Callback query ID. Defaults to `"mock-callback-{updateId}"`. */
  id?: string
  /** Text of the message the callback was attached to. Defaults to `"Mock message"`. */
  messageText?: string
}

/**
 * Logger subset used by the mock Telegram server.
 *
 * @remarks
 * Picks the level methods off `LoggingHelper` that the mock server emits
 * (lifecycle, request, and update events). Consumed by
 * `IMockTelegramServerOptions.log` and the `MockTelegramServer.log` field.
 *
 * @internal
 */
export type IMockTelegramLog = Pick<LoggingHelper, `info` | `debug` | `success` | `error`>

/**
 * Options for configuring the mock Telegram server.
 *
 * @remarks
 * Use `handlers` to override specific methods, and
 * `defaultHandler` as a fallback for any unmatched method.
 *
 * @example
 * ```typescript
 * const options: IMockTelegramServerOptions = {
 *   port: 0,
 *   handlers: {
 *     getMe: () => ({ok: true, result: {is_bot: true}})
 *   }
 * }
 * ```
 *
 * @public
 */
export type IMockTelegramServerOptions = {
  /** Hostname for the local server (defaults to 127.0.0.1). */
  hostname?: string
  /** Port for the local server (0 selects a random free port). */
  port?: number
  /** Logger configuration. Pass true to use the default Gramstax logger. */
  log?: IMockTelegramLog | boolean | null
  /** Per-method handlers keyed by Telegram method name (e.g. getMe). */
  handlers?: Record<string, IMockTelegramHandler>
  /** Fallback handler used when a method has no specific handler. */
  defaultHandler?: IMockTelegramHandler
}
