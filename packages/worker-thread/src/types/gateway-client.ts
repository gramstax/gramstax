/**
 * Options for connecting a gateway client.
 *
 * @remarks
 * Reconnect is enabled by default: when the connection drops (e.g. the
 * gateway server worker restarts), the client retries with exponential
 * backoff and pending requests are retried transparently.
 * @public
 */
export type IGatewayClientOptions = {
  /** Shared secret matching the server's `token`. Sent during the connection handshake. */
  token?: string
  /** Automatically reconnect when the connection drops. Defaults to `true`. */
  reconnect?: boolean
  /** Maximum number of reconnect attempts before giving up. */
  retries?: number
  /** Upper bound (ms) for the exponential reconnect backoff. */
  maxRetryTime?: number
  /** Estimated maximum size in bytes of a single incoming message. Defaults to {@link DEFAULT_MAX_MESSAGE_SIZE}. */
  maxMessageSize?: number
  /** Use msgpackr binary encoding — preserves `Date`, `BigInt`, `undefined` and typed arrays. */
  messagepack?: boolean
}
