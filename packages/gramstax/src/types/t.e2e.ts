/**
 * E2E testing helper types for Gramstax bots.
 *
 * @remarks
 * Types for the in-process E2E test helper that simulates Telegram updates
 * without an HTTP server. Mirrors the relevant subset of the Telegram Bot API
 * Update object for constructing mock messages, callback queries, and other
 * update types in tests.
 *
 * @packageDocumentation
 * @public
 */

export type ITE2eUser = {
  id?: number
  username?: string
  first_name?: string
  last_name?: string
  language_code?: string
  is_bot?: boolean
}

export type ITE2eChat = {
  id?: number
  type?: `private` | `group` | `supergroup` | `channel`
  first_name?: string
  last_name?: string
  username?: string
  title?: string
}

export type ITE2eUpdateOptions = {
  user?: ITE2eUser
  chat?: ITE2eChat
  date?: number
  message_id?: number
}

export type ITE2eMediaOptions = ITE2eUpdateOptions & {
  caption?: string
}

export type ITE2eLocationOptions = ITE2eUpdateOptions & {
  latitude?: number
  longitude?: number
}

export type ITE2eContactOptions = ITE2eUpdateOptions & {
  phone_number?: string
  first_name?: string
  last_name?: string
  user_id?: number
}

export type ITE2eCallbackQueryOptions = ITE2eUpdateOptions & {
  id?: string
  messageText?: string
}

export type ITE2eDiceOptions = ITE2eUpdateOptions & {
  emoji?: `🎲` | `🎯` | `🏀` | `⚽` | `🎰` | `🎳`
}
