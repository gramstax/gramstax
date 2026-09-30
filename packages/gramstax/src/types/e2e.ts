/**
 * Simulated Telegram user for E2E updates.
 *
 * @remarks
 * Partial mirror of the Telegram Bot API User object. Any omitted field falls
 * back to the helper default (`id` 1001, `first_name` `Test`, `is_bot` false,
 * `language_code` `en`). Consumed by `E2eHelper._defaultUser`.
 *
 * @public
 */
export type IE2eUser = {
  /** Telegram user id. Accepted values: any positive integer. @defaultValue 1001 */
  id?: number
  /** Telegram username without the `@` prefix. Accepted values: any username string. */
  username?: string
  /** User first name. Accepted values: any non-empty string. @defaultValue `Test` */
  first_name?: string
  /** User last name. Accepted values: any string. Only sent when provided. */
  last_name?: string
  /** IETF language tag of the user. Accepted values: any language code. @defaultValue `en` */
  language_code?: string
  /** Whether this user is a bot. Accepted values: `true` or `false`. @defaultValue false */
  is_bot?: boolean
}

/**
 * Simulated chat object for E2E updates.
 *
 * @remarks
 * Partial mirror of the Telegram Bot API Chat object. Any omitted field falls
 * back to the helper default (`id` 1001, `type` `private`, `first_name` `Test`).
 * Consumed by `E2eHelper._defaultChat`.
 *
 * @public
 */
export type IE2eChat = {
  /** Chat id. Accepted values: any integer. @defaultValue 1001 */
  id?: number
  /** Chat type. Accepted values: `private`, `group`, `supergroup`, `channel`. @defaultValue `private` */
  type?: `private` | `group` | `supergroup` | `channel`
  /** First name for private chats. Accepted values: any string. @defaultValue `Test` */
  first_name?: string
  /** Last name for private chats. Accepted values: any string. Only sent when provided. */
  last_name?: string
  /** Chat username for public chats. Accepted values: any username string. Only sent when provided. */
  username?: string
  /** Title for group, supergroup, and channel chats. Accepted values: any string. Only sent when provided. */
  title?: string
}

/**
 * Base update options for E2E updates.
 *
 * @remarks
 * Shared envelope for every `E2eHelper.send*` simulation method. Controls the
 * sender, chat, and sequencing (`message_id`, `date`) of the injected update.
 *
 * @public
 */
export type IE2eUpdateOptions = {
  /** Sender override. Accepted values: any `IE2eUser` partial. Falls back to the default mock user. */
  user?: IE2eUser
  /** Chat override. Accepted values: any `IE2eChat` partial. Falls back to the default mock chat. */
  chat?: IE2eChat
  /** Unix timestamp of the message. Accepted values: any positive integer. @defaultValue current time in seconds */
  date?: number
  /** Telegram message id. Accepted values: any positive integer. @defaultValue auto-incremented helper counter */
  message_id?: number
}

/**
 * E2E options for media messages (caption support).
 *
 * @remarks
 * Extends `IE2eUpdateOptions` with an optional caption. Used by `sendPhoto`,
 * `sendVideo`, `sendAudio`, `sendDocument`, `sendAnimation`, and `sendVoice`.
 *
 * @public
 */
export type IE2eMediaOptions = IE2eUpdateOptions & {
  /** Media caption text. Accepted values: any string. Only sent when provided. */
  caption?: string
}

/**
 * E2E options for location messages.
 *
 * @remarks
 * Extends `IE2eUpdateOptions` with geographic coordinates. Used by
 * `E2eHelper.sendLocation`, which defaults both axes to `0`.
 *
 * @public
 */
export type IE2eLocationOptions = IE2eUpdateOptions & {
  /** Latitude in degrees. Accepted values: -90 to 90. @defaultValue 0 */
  latitude?: number
  /** Longitude in degrees. Accepted values: -180 to 180. @defaultValue 0 */
  longitude?: number
}

/**
 * E2E options for contact messages.
 *
 * @remarks
 * Extends `IE2eUpdateOptions` with contact card fields. Used by
 * `E2eHelper.sendContact`.
 *
 * @public
 */
export type IE2eContactOptions = IE2eUpdateOptions & {
  /** Contact phone number in international format. Accepted values: any phone string. @defaultValue `+10000000000` */
  phone_number?: string
  /** Contact first name. Accepted values: any string. @defaultValue `Test` */
  first_name?: string
  /** Contact last name. Accepted values: any string. Only sent when provided. */
  last_name?: string
  /** Telegram user id of the contact when known. Accepted values: any positive integer. Only sent when provided. */
  user_id?: number
}

/**
 * E2E options for callback query updates.
 *
 * @remarks
 * Extends `IE2eUpdateOptions` with callback-query envelope fields. Used by
 * `E2eHelper.sendCallbackQuery` to build the surrounding message stub.
 *
 * @public
 */
export type IE2eCallbackQueryOptions = IE2eUpdateOptions & {
  /** Callback query id. Accepted values: any string. @defaultValue `mock-callback-{updateId}` */
  id?: string
  /** Text of the message the button is attached to. Accepted values: any string. @defaultValue `Mock message` */
  messageText?: string
}

/**
 * E2E options for dice messages.
 *
 * @remarks
 * Extends `IE2eUpdateOptions` with the dice emoji selector. Used by
 * `E2eHelper.sendDice`, which always rolls value `1`.
 *
 * @public
 */
export type IE2eDiceOptions = IE2eUpdateOptions & {
  /** Dice emoji variant. Accepted values: `🎲`, `🎯`, `🏀`, `⚽`, `🎰`, `🎳`. @defaultValue `🎲` */
  emoji?: `🎲` | `🎯` | `🏀` | `⚽` | `🎰` | `🎳`
}

/**
 * Options for simulating a chat member status transition update.
 *
 * @remarks
 * Used with `E2eHelper.sendChatMemberUpdate` and
 * `E2eHelper.sendMyChatMemberUpdate` to simulate membership changes.
 *
 * @public
 */
export type IE2eChatMemberOptions = IE2eUpdateOptions & {
  /** Old chat member status (default: `"kicked"` for user, `"left"` for bot). Accepted values: any member status string. @defaultValue `kicked` (`sendChatMemberUpdate`) or `left` (`sendMyChatMemberUpdate`) */
  oldStatus?: string
  /** New chat member status (default: `"member"`). Accepted values: any member status string. @defaultValue `member` */
  newStatus?: string
  /** Whether the old member was restricted (`is_member`). Accepted values: `true` or `false`. Only sent when `oldStatus` is `restricted`. @defaultValue false */
  oldIsMember?: boolean
  /** Whether the new member is restricted (`is_member`). Accepted values: `true` or `false`. Only sent when `newStatus` is `restricted`. @defaultValue true */
  newIsMember?: boolean
  /** Bot ID used for my_chat_member updates (default: matches bot info). Accepted values: any positive integer. @defaultValue bot info id or `123456789` */
  botId?: number
}

/**
 * Captured outbound Bot API call record.
 *
 * @remarks
 * Each entry represents one call made by the bot handler (e.g. `sendMessage`,
 * `answerCallbackQuery`, `editMessageText`). Access fields by iterating
 * `e2e.calls` or using `e2e.lastCall(method)`. Recorded by the
 * `bot.api.config.use()` interceptor in `E2eHelper`.
 *
 * @example
 * ```typescript
 * const sendMsg = e2e.lastCall(`sendMessage`)
 * expect(sendMsg?.body?.text).toBe(`Hello`)
 * ```
 *
 * @public
 */
export type IE2eApiCall = {
  /** Telegram Bot API method name, e.g. `sendMessage`. Accepted values: any Bot API method string. */
  method: string
  /** Parameters sent to the API method (chat_id, text, reply_markup, etc.). Accepted values: any payload object. */
  body: unknown
  /** Unix timestamp when the call was captured. Accepted values: milliseconds since epoch from `Date.now()`. */
  timestamp: number
}
