/**
 * Mock Telegram server — simulates the Telegram Bot API for testing.
 *
 * @remarks
 * Provides a lightweight HTTP server that mimics Telegram's Bot API
 * endpoints, enabling offline integration testing without a real
 * Telegram connection.
 *
 * @public
 */

import {log, type LoggingHelper} from "~/helpers/log"

/**
 * Telegram JSON response shape for mock server responses.
 *
 * @remarks
 * This is the minimal Bot API response contract used by the mock server:
 * `ok` indicates success and `result` contains the payload.
 *
 * @example
 * ```typescript
 * const response: ITTelegramJson = {ok: true, result: {foo: `bar`}}
 * ```
 *
 * @public
 */
export type ITMockTelegramJson = {
  /** Indicates whether the mock request is successful. */
  ok: boolean
  /** Result payload returned by the mock method. */
  result: unknown
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
 * const handler: ITMockTelegramHandler = ({method}) => ({ok: true, result: {method}})
 * ```
 *
 * @public
 */
export type ITMockTelegramHandler = (payload: {method: string; request: Request}) => Promise<ITMockTelegramJson> | ITMockTelegramJson

/**
 * Recorded outbound Bot API request captured by the mock server.
 *
 * @remarks
 * Each entry represents one HTTP request made by the bot under test to the mock server.
 * Access via `mockServer.requests` or `mockServer.lastRequest(method)`.
 *
 * @public
 */
export type ITMockTelegramRequestRecord = {
  /** Telegram Bot API method name, e.g. `sendMessage`. */
  method: string
  /** Parsed request body when available. */
  body: any
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
export type ITMockTelegramUser = {
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
 * Mirrors the Telegram Bot API `Chat` object. Used alongside `ITMockTelegramUser`
 * to construct mock message updates sent to the bot's webhook.
 *
 * @public
 */
export type ITMockTelegramChat = {
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
export type ITMockTelegramUpdateOptions = {
  /** Simulated user profile. Merged with mock server defaults. */
  user?: ITMockTelegramUser
  /** Simulated chat profile. Merged with mock server defaults. */
  chat?: ITMockTelegramChat
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
 * Extends `ITMockTelegramUpdateOptions` with a `caption` field.
 * Used by `sendPhoto`, `sendVideo`, `sendAudio`, `sendDocument`,
 * `sendAnimation`, and `sendVoice`.
 *
 * @public
 */
export type ITMockTelegramMediaOptions = ITMockTelegramUpdateOptions & {
  /** Caption text displayed below the media. */
  caption?: string
}

/**
 * Options for generated mock location updates.
 *
 * @remarks
 * Extends `ITMockTelegramUpdateOptions` with `latitude` and `longitude`.
 * Used by `sendLocation`.
 *
 * @public
 */
export type ITMockTelegramLocationOptions = ITMockTelegramUpdateOptions & {
  /** Latitude of the location. Defaults to `0`. */
  latitude?: number
  /** Longitude of the location. Defaults to `0`. */
  longitude?: number
}

/**
 * Options for generated mock contact updates.
 *
 * @remarks
 * Extends `ITMockTelegramUpdateOptions` with contact fields.
 * Used by `sendContact`.
 *
 * @public
 */
export type ITMockTelegramContactOptions = ITMockTelegramUpdateOptions & {
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
 * Extends `ITMockTelegramUpdateOptions` with callback-specific fields.
 * Used by `sendCallbackQuery`.
 *
 * @public
 */
export type ITMockTelegramCallbackQueryOptions = ITMockTelegramUpdateOptions & {
  /** Callback query ID. Defaults to `"mock-callback-{updateId}"`. */
  id?: string
  /** Text of the message the callback was attached to. Defaults to `"Mock message"`. */
  messageText?: string
}

type ITMockTelegramReadableRequest = {
  method: string
  headers: {
    get(name: string): string | null
  }
  json(): Promise<unknown>
  formData(): Promise<{entries(): Iterable<[string, unknown]>}>
  text(): Promise<string>
}

type ITMockTelegramLog = Pick<LoggingHelper, `info` | `debug` | `success` | `error`>

/**
 * Options for configuring the mock Telegram server.
 *
 * @remarks
 * Use `handlers` to override specific methods, and
 * `defaultHandler` as a fallback for any unmatched method.
 *
 * @example
 * ```typescript
 * const options: ITMockTelegramServerOptions = {
 *   port: 0,
 *   handlers: {
 *     getMe: () => ({ok: true, result: {is_bot: true}})
 *   }
 * }
 * ```
 *
 * @public
 */
export type ITMockTelegramServerOptions = {
  /** Hostname for the local server (defaults to 127.0.0.1). */
  hostname?: string
  /** Port for the local server (0 selects a random free port). */
  port?: number
  /** Logger configuration. Pass true to use the default Gramstax logger. */
  log?: ITMockTelegramLog | boolean | null
  /** Per-method handlers keyed by Telegram method name (e.g. getMe). */
  handlers?: Record<string, ITMockTelegramHandler>
  /** Fallback handler used when a method has no specific handler. */
  defaultHandler?: ITMockTelegramHandler
}

/**
 * In-process mock Telegram API server for local testing.
 *
 * @remarks
 * Provides a minimal subset of the Telegram Bot API for local development.
 * It does not emulate network delays, rate limits, or full Telegram behavior.
 *
 * @example
 * ```typescript
 * const server = new MockTelegramServer()
 * await server.start()
 * console.log(server.apiRoot)
 * await server.stop()
 * ```
 *
 * @public
 */
export class MockTelegramServer {
  /** Latest bot token observed from the URL path (e.g. /bot<token>/getMe). */
  botToken = ``
  /** Hostname for the local server (defaults to 127.0.0.1). */
  hostname: string
  /** Port for the local server (0 selects a random free port). */
  port: number
  /** Optional logger for mock server lifecycle and request events. */
  log?: ITMockTelegramLog
  /** Custom handlers for specific Telegram methods (e.g. getMe). */
  handlers: Record<string, ITMockTelegramHandler>
  /** Default handler when a method has no specific handler. */
  defaultHandler?: ITMockTelegramHandler
  /** Base URL for API calls (e.g. http://127.0.0.1:1234). */
  apiRoot = ``
  /** Webhook URL set through `setWebhook`. */
  webhookUrl = ``
  /** Captured outbound Bot API requests made by the bot under test. */
  requests: ITMockTelegramRequestRecord[] = []
  /** Captured inbound updates generated by helper methods. */
  updates: Record<string, unknown>[] = []
  /** Underlying Bun server instance (set after start). */
  server?: {port?: number; stop: () => void}
  private _nextUpdateId = 1
  private _nextMessageId = 1

  /**
   * Create a new mock server instance.
   *
   * @remarks
   * Use `port: 0` to let Bun select a free port automatically.
   *
   * @example
   * ```typescript
   * const server = new MockTelegramServer({port: 0})
   * ```
   *
   * @param options - Server options.
   * @public
   */
  constructor(options: ITMockTelegramServerOptions = {}) {
    this.hostname = options.hostname ?? `127.0.0.1`
    this.port = options.port ?? 0
    this.log = options.log === true ? log : !options.log ? undefined : options.log
    this.handlers = options.handlers ?? {}
    this.defaultHandler = options.defaultHandler
  }

  /**
   * Start the mock server.
   *
   * @remarks
   * If already started, returns the existing `apiRoot` without restarting.
   *
   * @returns The base API URL.
   * @public
   */
  async start() {
    if (this.server) {
      return this.apiRoot
    }

    const server = Bun.serve({
      port: this.port,
      hostname: this.hostname,
      fetch: async (request) => this._handleRequest(request)
    })

    this.server = server
    this.apiRoot = `http://${this.hostname}:${server.port ?? this.port}`
    process.once(`SIGINT`, () => this.stop())
    process.once(`SIGTERM`, () => this.stop())
    this.log?.info?.(`Mock Telegram server started: ${this.apiRoot}`)
    return this.apiRoot
  }

  /**
   * Stop the mock server.
   *
   * @remarks
   * After calling this, the server is no longer reachable and must be started again
   * with `start()`.
   *
   * @public
   */
  async stop() {
    this.server?.stop()
    this.server = undefined
    this.log?.info?.(`Mock Telegram server stopped`)
  }

  private _json(payload: ITMockTelegramJson) {
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {"Content-Type": `application/json`}
    })
  }

  /**
   * Get the most recent captured Bot API request.
   *
   * @remarks
   * When `method` is provided, searches backwards for the last request matching that method name.
   * Without `method`, returns the absolute last request regardless of method.
   *
   * @param method - Optional Telegram Bot API method name to filter by (e.g. `sendMessage`).
   * @returns The last matching request record, or `undefined` if none found.
   * @public
   */
  lastRequest(method?: string) {
    if (!method) {
      return this.requests[this.requests.length - 1]
    }

    for (let index = this.requests.length - 1; index >= 0; index--) {
      const request = this.requests[index]
      if (request?.method === method) {
        return request
      }
    }
    return undefined
  }

  /**
   * Clear the captured outbound Bot API request log.
   *
   * @remarks
   * Useful between test cases to isolate request assertions.
   * Does not affect the `updates` log.
   *
   * @public
   */
  clearRequests() {
    this.requests.length = 0
  }

  private _defaultResponse(method: string, body?: unknown): ITMockTelegramJson {
    if (method === `getMe`) {
      return {
        ok: true,
        result: {
          id: 123456789,
          is_bot: true,
          first_name: `Mock`,
          username: `mock_gramstax_bot`
        }
      }
    }

    if (method === `getUpdates`) {
      return {ok: true, result: []}
    }

    if (method === `getMyCommands`) {
      return {ok: true, result: []}
    }

    if (method === `setMyCommands`) {
      return {ok: true, result: true}
    }

    if (method === `setWebhook`) {
      const data = this._bodyRecord(body)
      const url = typeof data?.url === `string` ? data.url : ``
      this.webhookUrl = url
      this.log?.info?.(`Mock Telegram webhook set: ${url}`)
      return {ok: true, result: true}
    }

    if (method === `getWebhookInfo`) {
      return {ok: true, result: {url: this.webhookUrl}}
    }

    return {ok: true, result: true}
  }

  private async _handleRequest(request: Request) {
    const {pathname} = new URL(request.url)
    const match = pathname.match(/^\/bot([^/]+)\/(.+)$/)
    if (!match) {
      return new Response(`Not found`, {status: 404})
    }

    const botToken = match[1]
    const method = match[2]
    if (!botToken || !method) {
      return new Response(`Not found`, {status: 404})
    }

    this.botToken = botToken
    const body = await this._readBody(request.clone())
    this.log?.debug?.(`Mock Telegram API request: ${method}`)
    this.requests.push({
      method,
      body,
      url: request.url,
      requestMethod: request.method,
      headers: Object.fromEntries(request.headers.entries())
    })

    const handler = this.handlers[method] ?? this.defaultHandler
    const result = handler ? await handler({method, request}) : this._defaultResponse(method, body)
    return this._json(result)
  }

  private _bodyRecord(body: unknown): Record<string, unknown> | undefined {
    return body && typeof body === `object` && !Array.isArray(body) ? (body as Record<string, unknown>) : undefined
  }

  private async _readBody(request: ITMockTelegramReadableRequest): Promise<unknown> {
    if (request.method === `GET` || request.method === `HEAD`) {
      return undefined
    }

    const contentType = request.headers.get(`content-type`) || ``
    try {
      if (contentType.includes(`application/json`)) {
        return await request.json()
      }

      if (contentType.includes(`multipart/form-data`) || contentType.includes(`application/x-www-form-urlencoded`)) {
        const form = await request.formData()
        return Object.fromEntries(form.entries())
      }

      const text = await request.text()
      if (!text) {
        return undefined
      }

      try {
        return JSON.parse(text) as unknown
      } catch {
        return text
      }
    } catch {
      return undefined
    }
  }

  private _defaultUser(user?: ITMockTelegramUser) {
    return {
      id: user?.id ?? 1001,
      is_bot: user?.is_bot ?? false,
      first_name: user?.first_name ?? `Test`,
      ...(user?.last_name ? {last_name: user.last_name} : {}),
      ...(user?.username ? {username: user.username} : {}),
      language_code: user?.language_code ?? `en`
    }
  }

  private _defaultChat(chat?: ITMockTelegramChat) {
    return {
      id: chat?.id ?? 1001,
      type: chat?.type ?? `private`,
      first_name: chat?.first_name ?? `Test`,
      ...(chat?.last_name ? {last_name: chat.last_name} : {}),
      ...(chat?.username ? {username: chat.username} : {}),
      ...(chat?.title ? {title: chat.title} : {})
    }
  }

  private _nextIds(options?: ITMockTelegramUpdateOptions) {
    return {
      updateId: this._nextUpdateId++,
      messageId: options?.message_id ?? this._nextMessageId++,
      date: options?.date ?? Math.floor(Date.now() / 1000)
    }
  }

  private _buildMessageUpdate(message: Record<string, unknown>, options?: ITMockTelegramUpdateOptions) {
    const {updateId, messageId, date} = this._nextIds(options)
    return {
      update_id: updateId,
      message: {
        message_id: messageId,
        date,
        chat: this._defaultChat(options?.chat),
        from: this._defaultUser(options?.user),
        ...message
      }
    }
  }

  private async _postUpdate(update: Record<string, unknown>, options?: ITMockTelegramUpdateOptions) {
    await this._waitForWebhookUrl(options?.responseTimeoutMs ?? 1000)
    if (!this.webhookUrl) {
      throw new Error(`Webhook URL is not set. Call setWebhook first or assign mockServer.webhookUrl.`)
    }

    const requestStartIndex = this.requests.length
    this.updates.push(update)
    this.log?.info?.(`Mock Telegram update sent: ${this.webhookUrl}`)
    const response = await fetch(this.webhookUrl, {
      method: `POST`,
      headers: {"Content-Type": `application/json`},
      body: JSON.stringify(update)
    })

    if (!response.ok) {
      throw new Error(`Webhook request failed with status ${response.status}`)
    }

    const responses = await this._waitForResponses(requestStartIndex, options?.responseTimeoutMs ?? 1000)
    this.log?.info?.(`Mock Telegram bot responses captured: ${responses.length}`)
    return responses
  }

  private async _waitForWebhookUrl(timeoutMs: number) {
    if (this.webhookUrl || timeoutMs <= 0) {
      return this.webhookUrl
    }

    const startedAt = Date.now()
    while (Date.now() - startedAt < timeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 5))
      if (this.webhookUrl) {
        break
      }
    }

    return this.webhookUrl
  }

  private async _waitForResponses(requestStartIndex: number, responseTimeoutMs: number) {
    if (responseTimeoutMs <= 0) {
      return this._userResponseRequests(requestStartIndex)
    }

    if (this._userResponseRequests(requestStartIndex).length > 0) {
      return this._userResponseRequests(requestStartIndex)
    }

    const startedAt = Date.now()
    while (Date.now() - startedAt < responseTimeoutMs) {
      await new Promise((resolve) => setTimeout(resolve, 5))
      if (this._userResponseRequests(requestStartIndex).length > 0) {
        break
      }
    }

    return this._userResponseRequests(requestStartIndex)
  }

  private _userResponseRequests(requestStartIndex: number) {
    return this.requests.slice(requestStartIndex).filter((request) => this._isUserResponseMethod(request.method))
  }

  private _isUserResponseMethod(method: string) {
    return method.startsWith(`send`) || method.startsWith(`edit`) || method.startsWith(`answer`) || method.startsWith(`delete`) || method.startsWith(`copy`) || method.startsWith(`forward`) || method === `pinChatMessage` || method === `unpinChatMessage` || method === `setMessageReaction`
  }

  /**
   * Simulate a user sending a text message to the bot.
   *
   * @remarks
   * Automatically adds `bot_command` entity if the text starts with `/`.
   * Posts the update to the webhook and waits for outbound Bot API responses.
   *
   * @param text - The message text to send.
   * @param options - User, chat, and timeout options.
   * @returns Array of captured Bot API responses from the bot under test.
   * @public
   */
  async sendText(text: string, options?: ITMockTelegramUpdateOptions) {
    const entities = text.startsWith(`/`) ? [{offset: 0, length: text.split(` `)[0]?.length ?? text.length, type: `bot_command`}] : undefined
    return await this._postUpdate(this._buildMessageUpdate({text, ...(entities ? {entities} : {})}, options), options)
  }

  /**
   * Simulate a user sending a photo message.
   *
   * @param options - Caption, user, chat, and timeout options.
   * @returns Array of captured Bot API responses.
   * @public
   */
  async sendPhoto(options?: ITMockTelegramMediaOptions) {
    return await this._postUpdate(this._buildMessageUpdate({photo: [{file_id: `mock-photo-file-id`, file_unique_id: `mock-photo-unique-id`, width: 1, height: 1}], ...(options?.caption ? {caption: options.caption} : {})}, options), options)
  }

  /**
   * Simulate a user sending a video message.
   *
   * @param options - Caption, user, chat, and timeout options.
   * @returns Array of captured Bot API responses.
   * @public
   */
  async sendVideo(options?: ITMockTelegramMediaOptions) {
    return await this._postUpdate(this._buildMessageUpdate({video: {file_id: `mock-video-file-id`, file_unique_id: `mock-video-unique-id`, width: 1, height: 1, duration: 1}, ...(options?.caption ? {caption: options.caption} : {})}, options), options)
  }

  /**
   * Simulate a user sending an audio message.
   *
   * @param options - Caption, user, chat, and timeout options.
   * @returns Array of captured Bot API responses.
   * @public
   */
  async sendAudio(options?: ITMockTelegramMediaOptions) {
    return await this._postUpdate(this._buildMessageUpdate({audio: {file_id: `mock-audio-file-id`, file_unique_id: `mock-audio-unique-id`, duration: 1}, ...(options?.caption ? {caption: options.caption} : {})}, options), options)
  }

  /**
   * Simulate a user sending a document (file) message.
   *
   * @param options - Caption, user, chat, and timeout options.
   * @returns Array of captured Bot API responses.
   * @public
   */
  async sendDocument(options?: ITMockTelegramMediaOptions) {
    return await this._postUpdate(this._buildMessageUpdate({document: {file_id: `mock-document-file-id`, file_unique_id: `mock-document-unique-id`, file_name: `mock.txt`}, ...(options?.caption ? {caption: options.caption} : {})}, options), options)
  }

  /**
   * Simulate a user sending an animation (GIF) message.
   *
   * @param options - Caption, user, chat, and timeout options.
   * @returns Array of captured Bot API responses.
   * @public
   */
  async sendAnimation(options?: ITMockTelegramMediaOptions) {
    return await this._postUpdate(this._buildMessageUpdate({animation: {file_id: `mock-animation-file-id`, file_unique_id: `mock-animation-unique-id`, width: 1, height: 1, duration: 1}, ...(options?.caption ? {caption: options.caption} : {})}, options), options)
  }

  /**
   * Simulate a user sending a voice message.
   *
   * @param options - Caption, user, chat, and timeout options.
   * @returns Array of captured Bot API responses.
   * @public
   */
  async sendVoice(options?: ITMockTelegramMediaOptions) {
    return await this._postUpdate(this._buildMessageUpdate({voice: {file_id: `mock-voice-file-id`, file_unique_id: `mock-voice-unique-id`, duration: 1}, ...(options?.caption ? {caption: options.caption} : {})}, options), options)
  }

  /**
   * Simulate a user sending a video note (round video) message.
   *
   * @param options - User, chat, and timeout options.
   * @returns Array of captured Bot API responses.
   * @public
   */
  async sendVideoNote(options?: ITMockTelegramUpdateOptions) {
    return await this._postUpdate(this._buildMessageUpdate({video_note: {file_id: `mock-video-note-file-id`, file_unique_id: `mock-video-note-unique-id`, length: 1, duration: 1}}, options), options)
  }

  /**
   * Simulate a user sending a sticker message.
   *
   * @param options - User, chat, and timeout options.
   * @returns Array of captured Bot API responses.
   * @public
   */
  async sendSticker(options?: ITMockTelegramUpdateOptions) {
    return await this._postUpdate(this._buildMessageUpdate({sticker: {file_id: `mock-sticker-file-id`, file_unique_id: `mock-sticker-unique-id`, type: `regular`, width: 1, height: 1, is_animated: false, is_video: false}}, options), options)
  }

  /**
   * Simulate a user sending a location message.
   *
   * @param options - Latitude, longitude, user, chat, and timeout options.
   * @returns Array of captured Bot API responses.
   * @public
   */
  async sendLocation(options?: ITMockTelegramLocationOptions) {
    return await this._postUpdate(this._buildMessageUpdate({location: {latitude: options?.latitude ?? 0, longitude: options?.longitude ?? 0}}, options), options)
  }

  /**
   * Simulate a user sending a contact message.
   *
   * @param options - Phone number, name, user, chat, and timeout options.
   * @returns Array of captured Bot API responses.
   * @public
   */
  async sendContact(options?: ITMockTelegramContactOptions) {
    return await this._postUpdate(
      this._buildMessageUpdate(
        {
          contact: {
            phone_number: options?.phone_number ?? `+10000000000`,
            first_name: options?.first_name ?? `Test`,
            ...(options?.last_name ? {last_name: options.last_name} : {}),
            ...(options?.user_id ? {user_id: options.user_id} : {})
          }
        },
        options
      ),
      options
    )
  }

  /**
   * Simulate a user pressing an inline keyboard button (callback query).
   *
   * @remarks
   * Constructs a callback query update with the specified `data` payload.
   * The bot under test should answer with `answerCallbackQuery` and optionally edit the message.
   *
   * @param data - The callback_data string from the pressed button.
   * @param options - Callback ID, message text, user, chat, and timeout options.
   * @returns Array of captured Bot API responses.
   * @public
   */
  async sendCallbackQuery(data: string, options?: ITMockTelegramCallbackQueryOptions) {
    const {updateId, messageId, date} = this._nextIds(options)
    return await this._postUpdate(
      {
        update_id: updateId,
        callback_query: {
          id: options?.id ?? `mock-callback-${updateId}`,
          from: this._defaultUser(options?.user),
          message: {
            message_id: messageId,
            date,
            chat: this._defaultChat(options?.chat),
            text: options?.messageText ?? `Mock message`
          },
          chat_instance: `mock-chat-instance`,
          data
        }
      },
      options
    )
  }
}
