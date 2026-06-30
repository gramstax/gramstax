/**
 * In-process E2E testing helper — simulates Telegram updates without HTTP.
 *
 * @remarks
 * Provides a lightweight alternative to spinning up a full webhook server
 * for E2E tests. Uses `bot.api.config.use()` to intercept all outbound
 * Bot API calls in memory (0 HTTP, 0 Bun.serve), and injects Telegram
 * Update objects directly via `bot.bot.handleUpdate()`.
 *
 * **Typical usage:**
 *
 * ```typescript
 * import {BotCore} from "../src/core/bot"
 *
 * const bot = new BotCore({deploy: "test", token: "test", log: false})
 * const e2e = bot.e2e
 *
 * const responses = await e2e.sendText("/start", {user: {id: 2001}})
 * expect(responses[0]?.body?.text).toContain("Welcome")
 * ```
 *
 * @public
 */

import type {Gramstax} from "~/core/bot"
import type {ITE2eUpdateOptions, ITE2eMediaOptions, ITE2eLocationOptions, ITE2eContactOptions, ITE2eCallbackQueryOptions, ITE2eDiceOptions, ITE2eUser, ITE2eChat} from "~/types/t.e2e"

/**
 * Captured outbound Bot API call record.
 *
 * @remarks
 * Each entry represents one call made by the bot handler (e.g. `sendMessage`,
 * `answerCallbackQuery`, `editMessageText`). Access fields by iterating
 * `e2e.calls` or using `e2e.lastCall(method)`.
 *
 * @example
 * ```typescript
 * const sendMsg = e2e.lastCall("sendMessage")
 * expect(sendMsg?.body?.text).toBe("Hello")
 * ```
 *
 * @public
 */
export type ITE2eApiCall = {
  /** Telegram Bot API method name, e.g. `sendMessage`. */
  method: string
  /** Parameters sent to the API method (chat_id, text, reply_markup, etc.). */
  body: any
  /** Unix timestamp when the call was captured. */
  timestamp: number
}

/**
 * In-process E2E testing helper for Gramstax bots.
 *
 * @remarks
 * Attached to `Gramstax.e2e` when the bot is created with `deploy: "test"`.
 * All methods simulate Telegram updates without any HTTP server or port binding.
 *
 * @public
 */
export class E2eHelper {
  /**
   * All captured outbound Bot API calls (sendMessage, answerCallbackQuery, etc.).
   *
   * @remarks
   * Cleared automatically between tests. Each entry includes the API method,
   * the parameters object, and a timestamp.
   */
  calls: ITE2eApiCall[] = []

  private _nextUpdateId = 1
  private _nextMessageId = 1
  private _nextApiMsgId = 1

  /** @param bot - The parent Gramstax instance. */
  constructor(private bot: Gramstax) {
    this.bot.bot.api.config.use(async (_prev, method, payload) => {
      this.calls.push({
        method,
        body: payload as Record<string, unknown>,
        timestamp: Date.now()
      })
      if (method === `getMe`) {
        return {ok: true, result: {id: 123456789, is_bot: true, first_name: `GramstaxMock`, username: `gramstax_mock_bot`}} as any
      }
      if (method === `getWebhookInfo`) {
        return {ok: true, result: {url: ``}} as any
      }
      if (method === `setWebhook`) {
        return {ok: true, result: true} as any
      }
      if (method === `getMyCommands`) {
        return {ok: true, result: []} as any
      }
      if (method === `setMyCommands`) {
        return {ok: true, result: true} as any
      }
      if (method === `getUpdates`) {
        return {ok: true, result: []} as any
      }

      return {ok: true, result: {message_id: this._nextApiMsgId++}} as any
    })
  }

  private _initialized = false

  /** @internal Ensure bot is initialized before handling updates. */
  private async _ensureInit(): Promise<void> {
    if (this._initialized) return
    this._initialized = true
    await this.bot.bot.init()
  }

  // ── inspection ────────────────────────────────────────────────

  /**
   * Find the most recent captured API call.
   *
   * @param method - Optional method name to filter by (e.g. `"sendMessage"`).
   * @returns The last matching call, or `undefined` if none found.
   *
   * @example
   * ```typescript
   * const last = e2e.lastCall()
   * const msg  = e2e.lastCall("sendMessage")
   * ```
   */
  lastCall(method?: string) {
    if (!method) {
      return this.calls[this.calls.length - 1]
    }
    for (let i = this.calls.length - 1; i >= 0; i--) {
      if (this.calls[i]?.method === method) return this.calls[i]
    }
    return undefined
  }

  /**
   * Clear all captured API calls.
   *
   * @remarks
   * Call in `beforeEach()` to isolate test assertions.
   */
  clearCalls() {
    this.calls.length = 0
  }

  // ── template helpers ──────────────────────────────────────────

  /**
   * Render a page message template.
   *
   * @param page - Page name.
   * @param aGBaseId - Base block ID.
   * @param data - Template data variables.
   * @param aLang - Language code (default `"default"`).
   * @returns Rendered message string.
   */
  gmsg(page: string, aGBaseId: string, data?: Record<string, any>, aLang = `default`): string {
    return this.bot.templateManager.getGMessage(page, aGBaseId, aLang, data)
  }

  /**
   * Build keyboard button labels from a page template.
   *
   * @param page - Page name.
   * @param aGBaseId - Base block ID.
   * @param aType - Keyboard type (`"inline"` or `"bottom"`).
   * @param data - Template data variables.
   * @param aLang - Language code (default `"default"`).
   * @returns Array of button text labels (nested keyboard flattened).
   */
  gkb(page: string, aGBaseId: string, aType: `inline` | `bottom` = `inline`, data?: Record<string, any>, aLang = `default`): string[] {
    return this.bot.templateManager.getGKeyboard(page, aGBaseId, aLang, aType, data)
  }

  /**
   * Get media configuration from a page template.
   *
   * @param page - Page name.
   * @param aGBaseId - Base block ID.
   * @param data - Template data variables.
   * @param aLang - Language code (default `"default"`).
   * @returns Media configuration object.
   */
  gmedia(page: string, aGBaseId: string, data?: Record<string, any>, aLang = `default`): Record<string, any> {
    return this.bot.templateManager.getGMedia(page, aGBaseId, aLang, data)
  }

  /**
   * Extract text content from a captured API call, handling both
   * `sendMessage` (body.text) and `sendRichMessage` (body.rich_message.html).
   *
   * @param call - Captured API call.
   * @returns The message text, or `undefined` if neither field is present.
   */
  extractText(call: ITE2eApiCall): string | undefined {
    return (call?.body as any)?.rich_message?.html ?? (call?.body as any)?.text
  }

  /**
   * Extract inline keyboard button labels from a captured API call.
   *
   * @param call - Captured API call (e.g. from `sendText` response array).
   * @returns Flat array of button text labels.
   */
  extractButtonLabels(call: ITE2eApiCall): string[] {
    return (call?.body?.reply_markup as any)?.inline_keyboard?.flat().map((b: any) => b.text) ?? []
  }

  // ── update build helpers ──────────────────────────────────────

  private _defaultUser(user?: ITE2eUser) {
    return {
      id: user?.id ?? 1001,
      is_bot: user?.is_bot ?? false,
      first_name: user?.first_name ?? `Test`,
      ...(user?.last_name ? {last_name: user.last_name} : {}),
      ...(user?.username ? {username: user.username} : {}),
      language_code: user?.language_code ?? `en`
    }
  }

  private _defaultChat(chat?: ITE2eChat) {
    return {
      id: chat?.id ?? 1001,
      type: chat?.type ?? `private`,
      first_name: chat?.first_name ?? `Test`,
      ...(chat?.last_name ? {last_name: chat.last_name} : {}),
      ...(chat?.username ? {username: chat.username} : {}),
      ...(chat?.title ? {title: chat.title} : {})
    }
  }

  private _nextIds(options?: ITE2eUpdateOptions) {
    return {
      updateId: this._nextUpdateId++,
      messageId: options?.message_id ?? this._nextMessageId++,
      date: options?.date ?? Math.floor(Date.now() / 1000)
    }
  }

  private _buildMessageUpdate(message: Record<string, unknown>, options?: ITE2eUpdateOptions) {
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

  /**
   * Inject an Update object directly into the bot and capture responses.
   *
   * @param update - A raw Telegram Update object.
   * @returns All API calls made while processing this update.
   */
  async handleUpdate(update: Record<string, unknown>): Promise<ITE2eApiCall[]> {
    await this._ensureInit()
    const startIndex = this.calls.length
    await this.bot.bot.handleUpdate(update as any)
    // Allow microtasks to settle (some API calls may be deferred)
    await new Promise((resolve) => setTimeout(resolve, 0))
    return this.calls.slice(startIndex)
  }

  // ── user simulation helpers ───────────────────────────────────

  /**
   * Simulate a user sending a text message.
   *
   * @param text - The message text. If it starts with `/` a `bot_command` entity is added.
   * @param options - User, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendText(text: string, options?: ITE2eUpdateOptions) {
    const entities = text.startsWith(`/`) ? [{offset: 0, length: text.split(` `)[0]?.length ?? text.length, type: `bot_command`}] : undefined
    return await this.handleUpdate(this._buildMessageUpdate({text, ...(entities ? {entities} : {})}, options))
  }

  /**
   * Simulate a user sending a photo message.
   *
   * @param options - Caption, user, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendPhoto(options?: ITE2eMediaOptions) {
    return await this.handleUpdate(
      this._buildMessageUpdate({photo: [{file_id: `mock-photo-file-id`, file_unique_id: `mock-photo-unique-id`, width: 1, height: 1}], ...(options?.caption ? {caption: options.caption} : {})}, options)
    )
  }

  /**
   * Simulate a user sending a video message.
   *
   * @param options - Caption, user, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendVideo(options?: ITE2eMediaOptions) {
    return await this.handleUpdate(
      this._buildMessageUpdate({video: {file_id: `mock-video-file-id`, file_unique_id: `mock-video-unique-id`, width: 1, height: 1, duration: 1}, ...(options?.caption ? {caption: options.caption} : {})}, options)
    )
  }

  /**
   * Simulate a user sending an audio message.
   *
   * @param options - Caption, user, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendAudio(options?: ITE2eMediaOptions) {
    return await this.handleUpdate(
      this._buildMessageUpdate({audio: {file_id: `mock-audio-file-id`, file_unique_id: `mock-audio-unique-id`, duration: 1}, ...(options?.caption ? {caption: options.caption} : {})}, options)
    )
  }

  /**
   * Simulate a user sending a document (file) message.
   *
   * @param options - Caption, user, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendDocument(options?: ITE2eMediaOptions) {
    return await this.handleUpdate(
      this._buildMessageUpdate({document: {file_id: `mock-document-file-id`, file_unique_id: `mock-document-unique-id`, file_name: `mock.txt`}, ...(options?.caption ? {caption: options.caption} : {})}, options)
    )
  }

  /**
   * Simulate a user sending an animation (GIF) message.
   *
   * @param options - Caption, user, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendAnimation(options?: ITE2eMediaOptions) {
    return await this.handleUpdate(
      this._buildMessageUpdate({animation: {file_id: `mock-animation-file-id`, file_unique_id: `mock-animation-unique-id`, width: 1, height: 1, duration: 1}, ...(options?.caption ? {caption: options.caption} : {})}, options)
    )
  }

  /**
   * Simulate a user sending a voice message.
   *
   * @param options - Caption, user, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendVoice(options?: ITE2eMediaOptions) {
    return await this.handleUpdate(
      this._buildMessageUpdate({voice: {file_id: `mock-voice-file-id`, file_unique_id: `mock-voice-unique-id`, duration: 1}, ...(options?.caption ? {caption: options.caption} : {})}, options)
    )
  }

  /**
   * Simulate a user sending a video note (round video) message.
   *
   * @param options - User, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendVideoNote(options?: ITE2eUpdateOptions) {
    return await this.handleUpdate(this._buildMessageUpdate({video_note: {file_id: `mock-video-note-file-id`, file_unique_id: `mock-video-note-unique-id`, length: 1, duration: 1}}, options))
  }

  /**
   * Simulate a user sending a sticker message.
   *
   * @param options - User, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendSticker(options?: ITE2eUpdateOptions) {
    return await this.handleUpdate(
      this._buildMessageUpdate({sticker: {file_id: `mock-sticker-file-id`, file_unique_id: `mock-sticker-unique-id`, type: `regular`, width: 1, height: 1, is_animated: false, is_video: false}}, options)
    )
  }

  /**
   * Simulate a user sending a location message.
   *
   * @param options - Latitude, longitude, user, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendLocation(options?: ITE2eLocationOptions) {
    return await this.handleUpdate(this._buildMessageUpdate({location: {latitude: options?.latitude ?? 0, longitude: options?.longitude ?? 0}}, options))
  }

  /**
   * Simulate a user sending a contact message.
   *
   * @param options - Phone number, name, user, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendContact(options?: ITE2eContactOptions) {
    return await this.handleUpdate(
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
      )
    )
  }

  /**
   * Simulate a user pressing an inline keyboard button (callback query).
   *
   * @param data - The `callback_data` string from the pressed button.
   * @param options - Callback ID, message text, user, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendCallbackQuery(data: string, options?: ITE2eCallbackQueryOptions) {
    const {updateId, messageId, date} = this._nextIds(options)
    return await this.handleUpdate({
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
    })
  }

  /**
   * Simulate a user sending a dice message.
   *
   * @param options - Dice emoji, user, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendDice(options?: ITE2eDiceOptions) {
    return await this.handleUpdate(
      this._buildMessageUpdate({dice: {emoji: options?.emoji ?? `🎲`, value: 1}}, options)
    )
  }

  /**
   * Simulate an edited text message.
   *
   * @param text - The new message text.
   * @param options - User, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendEditedText(text: string, options?: ITE2eUpdateOptions) {
    const {updateId, messageId, date} = this._nextIds(options)
    return await this.handleUpdate({
      update_id: updateId,
      edited_message: {
        message_id: messageId,
        date,
        chat: this._defaultChat(options?.chat),
        from: this._defaultUser(options?.user),
        text,
        edit_date: Math.floor(Date.now() / 1000)
      }
    })
  }

  /**
   * Simulate a user joining a chat (service message).
   *
   * @param options - User, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendNewChatMembers(options?: ITE2eUpdateOptions) {
    const user = this._defaultUser(options?.user)
    return await this.handleUpdate(
      this._buildMessageUpdate({new_chat_members: [user]}, options)
    )
  }

  /**
   * Simulate the bot receiving a channel post.
   *
   * @param text - The post text.
   * @param options - User, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendChannelPost(text: string, options?: ITE2eUpdateOptions) {
    const {updateId, messageId, date} = this._nextIds(options)
    return await this.handleUpdate({
      update_id: updateId,
      channel_post: {
        message_id: messageId,
        date,
        chat: this._defaultChat(options?.chat),
        text,
        ...(text.startsWith(`/`) ? {entities: [{offset: 0, length: text.split(` `)[0]?.length ?? text.length, type: `bot_command`}]} : {})
      }
    })
  }

  /**
   * Simulate a poll update sent by the bot (used for poll answer testing).
   *
   * @param pollId - The poll identifier.
   * @param optionIds - Array of selected option IDs.
   * @param options - User, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendPollAnswer(pollId: string, optionIds: number[], options?: ITE2eUpdateOptions) {
    const {updateId} = this._nextIds(options)
    return await this.handleUpdate({
      update_id: updateId,
      poll_answer: {
        poll_id: pollId,
        user: this._defaultUser(options?.user),
        option_ids: optionIds
      }
    })
  }

  /**
   * Simulate an inline query sent by a user.
   *
   * @param query - The inline query text.
   * @param options - User, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendInlineQuery(query: string, options?: ITE2eUpdateOptions) {
    const {updateId} = this._nextIds(options)
    return await this.handleUpdate({
      update_id: updateId,
      inline_query: {
        id: `mock-inline-${updateId}`,
        from: this._defaultUser(options?.user),
        query,
        offset: ``
      }
    })
  }

  /**
   * Simulate a user choosing a result from an inline query.
   *
   * @param resultId - The chosen result ID.
   * @param query - The inline query text.
   * @param options - User, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendChosenInlineResult(resultId: string, query: string, options?: ITE2eUpdateOptions) {
    const {updateId} = this._nextIds(options)
    return await this.handleUpdate({
      update_id: updateId,
      chosen_inline_result: {
        result_id: resultId,
        from: this._defaultUser(options?.user),
        query
      }
    })
  }
}
