/**
 * Options for starting a gateway server.
 *
 * @remarks
 * Auth and method allow-lists are enforced per connection on the server side.
 * @public
 */
export type IGatewayServerOptions = {
  /** Shared secret required from connecting clients (sent via the client `connect` payload). */
  token?: string
  /** Restrict which registered methods may be invoked remotely. */
  allowedMethods?: string[]
  /** Maximum number of concurrent connections. */
  maxConnections?: number
  /** Estimated maximum size in bytes of a single incoming message. Defaults to {@link DEFAULT_MAX_MESSAGE_SIZE}. */
  maxMessageSize?: number
}
