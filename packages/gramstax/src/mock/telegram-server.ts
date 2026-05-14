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
 * Options for configuring the mock Telegram server.
 *
 * @remarks
 * `token` is required. Use `handlers` to override specific methods, and
 * `defaultHandler` as a fallback for any unmatched method.
 *
 * @example
 * ```typescript
 * const options: ITMockTelegramServerOptions = {
 *   token: `BOT_TOKEN`,
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
  /** Bot token used to build the API base path. */
  token: string
  /** Hostname for the local server (defaults to 127.0.0.1). */
  hostname?: string
  /** Port for the local server (0 selects a random free port). */
  port?: number
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
 * const server = new MockTelegramServer({token: "BOT_TOKEN"})
 * await server.start()
 * console.log(server.apiRoot)
 * await server.stop()
 * ```
 *
 * @public
 */
export class MockTelegramServer {
  /** Bot token used in the URL path (e.g. /bot<token>/getMe). */
  token: string
  /** Hostname for the local server (defaults to 127.0.0.1). */
  hostname: string
  /** Port for the local server (0 selects a random free port). */
  port: number
  /** Custom handlers for specific Telegram methods (e.g. getMe). */
  handlers: Record<string, ITMockTelegramHandler>
  /** Default handler when a method has no specific handler. */
  defaultHandler?: ITMockTelegramHandler
  /** Base URL for API calls (e.g. http://127.0.0.1:1234). */
  apiRoot = ``
  /** Underlying Bun server instance (set after start). */
  server?: {port?: number; stop: () => void}

  /**
   * Create a new mock server instance.
   *
   * @remarks
   * Use `port: 0` to let Bun select a free port automatically.
   *
   * @example
   * ```typescript
   * const server = new MockTelegramServer({token: `BOT_TOKEN`, port: 0})
   * ```
   *
   * @param options - Server options.
   * @public
   */
  constructor(options: ITMockTelegramServerOptions) {
    this.token = options.token
    this.hostname = options.hostname ?? `127.0.0.1`
    this.port = options.port ?? 0
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
  }

  private _json(payload: ITMockTelegramJson) {
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: {"Content-Type": `application/json`}
    })
  }

  private _defaultResponse(method: string): ITMockTelegramJson {
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
      return {ok: true, result: true}
    }

    if (method === `getWebhookInfo`) {
      return {ok: true, result: {url: ``}}
    }

    return {ok: true, result: true}
  }

  private async _handleRequest(request: Request) {
    const {pathname} = new URL(request.url)
    const basePath = `/bot${this.token}/`
    if (!pathname.startsWith(basePath)) {
      return new Response(`Not found`, {status: 404})
    }

    const method = pathname.slice(basePath.length)
    const handler = this.handlers[method] ?? this.defaultHandler
    const result = handler ? await handler({method, request}) : this._defaultResponse(method)
    return this._json(result)
  }
}
