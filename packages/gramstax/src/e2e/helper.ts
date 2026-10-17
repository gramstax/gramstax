import type {Gramstax} from "~/core/bot"
import type {IE2eApiCall, IE2eCallbackQueryOptions, IE2eChat, IE2eChatMemberOptions, IE2eContactOptions, IE2eDiceOptions, IE2eLocationOptions, IE2eMediaOptions, IE2eUpdateOptions, IE2eUser} from "~/types/e2e"

/**
 * In-process E2E testing helper — simulates Telegram updates without HTTP.
 *
 * @remarks
 * Provides a lightweight alternative to spinning up a full webhook server
 * for E2E tests. Uses `bot.api.config.use()` to intercept all outbound
 * Bot API calls in memory (0 HTTP, 0 Bun.serve), and injects Telegram
 * Update objects directly via `bot.bot.handleUpdate()`.
 *
 * Attached to `Gramstax.e2e` when the bot is created with `deploy: "test"`.
 * All methods simulate Telegram updates without any HTTP server or port binding.
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
export class E2eHelper {
  /**
   * All captured outbound Bot API calls (sendMessage, answerCallbackQuery, etc.).
   *
   * @remarks
   * Cleared automatically between tests. Each entry includes the API method,
   * the parameters object, and a timestamp.
   */
  calls: IE2eApiCall[] = []

  /**
   * Next `update_id` allocated by `_nextIds` for a simulated update, restored to `1` by `reset()`.
   *
   * @internal
   */
  _nextUpdateId = 1
  /**
   * Next `message_id` allocated by `_nextIds` for a simulated update, restored to `1` by `reset()`.
   *
   * @internal
   */
  _nextMessageId = 1
  /**
   * Next `message_id` allocated in canned `send*` interceptor responses, restored to `1` by `reset()`.
   *
   * @internal
   */
  _nextApiMsgId = 1
  /**
   * Whether `_ensureInit()` already ran `bot.bot.init()`, cleared by `reset()`.
   *
   * @internal
   */
  _initialized = false

  /** Bot API methods treated as internal: answered but never recorded in `calls`. Mirrors the mock allowlist. */
  static readonly _INTERNAL_METHODS = new Set([`getMe`, `getWebhookInfo`, `setWebhook`, `getMyCommands`, `getUpdates`])

  /** @param bot - The parent Gramstax instance. */
  constructor(public bot: Gramstax) {
    ;(this.bot.bot.api.config.use as unknown as (fn: (prev: unknown, method: string, payload: unknown) => Promise<unknown>) => void)(async (_prev, method, payload) => {
      if (E2eHelper._INTERNAL_METHODS.has(method)) {
        return this._internalResponse(method)
      }
      this.calls.push({
        method,
        body: payload as Record<string, unknown>,
        timestamp: Date.now()
      })
      if (method === `setMyCommands`) {
        return {ok: true, result: true}
      }
      // Stream plugin API methods
      if (method === `sendMessageDraft`) {
        const msgId = (payload as unknown as {draft_id?: number})?.draft_id ?? this._nextApiMsgId++
        return {
          ok: true,
          result: {
            message_id: msgId,
            date: Math.floor(Date.now() / 1000),
            chat: (payload as unknown as {chat_id?: number})?.chat_id ? {id: (payload as unknown as {chat_id: number}).chat_id, type: `private`} : {id: 0, type: `private`}
          }
        } as unknown as never
      }
      if (method === `sendRichMessageDraft`) {
        const msgId = (payload as unknown as {draft_id?: number})?.draft_id ?? this._nextApiMsgId++
        return {
          ok: true,
          result: {
            message_id: msgId,
            date: Math.floor(Date.now() / 1000),
            chat: (payload as unknown as {chat_id?: number})?.chat_id ? {id: (payload as unknown as {chat_id: number}).chat_id, type: `private`} : {id: 0, type: `private`}
          }
        } as unknown as never
      }
      if (method === `sendRichMessage`) {
        const p = payload as unknown as {rich_message?: unknown}
        return {
          ok: true,
          result: {
            message_id: this._nextApiMsgId++,
            date: Math.floor(Date.now() / 1000),
            chat: {id: 0, type: `private`},
            ...(p?.rich_message ? {rich_message: p.rich_message} : {})
          }
        } as unknown as never
      }
      if (method === `editEphemeralMessageText` || method === `editEphemeralMessageCaption` || method === `editEphemeralMessageMedia` || method === `editEphemeralMessageReplyMarkup` || method === `deleteEphemeralMessage`) {
        return {ok: true, result: true} as unknown as never
      }
      if (method === `promoteChatMember`) {
        return {ok: true, result: true} as unknown as never
      }
      if (method.startsWith(`send`)) {
        const chatId = (payload as unknown as {chat_id?: number})?.chat_id ?? 0
        return {
          ok: true,
          result: {message_id: this._nextApiMsgId++, date: Math.floor(Date.now() / 1000), chat: {id: chatId, type: `private`}}
        } as unknown as never
      }
      if (method.startsWith(`answer`) || method.startsWith(`edit`) || method.startsWith(`delete`) || method.startsWith(`copy`) || method.startsWith(`forward`) || method === `pinChatMessage` || method === `unpinChatMessage` || method === `setMessageReaction`) {
        return {ok: true, result: true} as unknown as never
      }

      return {ok: true, result: true} as unknown as never
    })
  }

  /**
   * Return the canned response for a boot-time Bot API method.
   *
   * @remarks
   * Methods listed in `_INTERNAL_METHODS` are answered but never recorded in `calls`, so boot
   * traffic stays out of a test's assertions. `getMe` returns a fixed bot identity,
   * `getWebhookInfo` an empty URL, `setWebhook` a bare success, and `getMyCommands` — plus any
   * other internal method reaching here — an empty list.
   *
   * @param method - The internal Bot API method name.
   * @returns The canned `{ok: true, result}` body.
   *
   * @internal
   */
  _internalResponse(method: string): unknown {
    if (method === `getMe`) {
      return {ok: true, result: {id: 123456789, is_bot: true, first_name: `GramstaxMock`, username: `gramstax_mock_bot`}}
    }
    if (method === `getWebhookInfo`) {
      return {ok: true, result: {url: ``}}
    }
    if (method === `setWebhook`) {
      return {ok: true, result: true}
    }
    if (method === `getMyCommands`) {
      return {ok: true, result: []}
    }
    return {ok: true, result: []}
  }

  /** @internal Ensure bot is initialized before handling updates. */
  async _ensureInit(): Promise<void> {
    if (this._initialized) return
    this._initialized = true
    await this.bot.bot.init()
  }

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

  /**
   * Resets the helper: clears calls and restarts update/message counters.
   *
   * @remarks
   * Unlike `clearCalls` (calls-only), `reset` also restores `_nextUpdateId`,
   * `_nextMessageId`, `_nextApiMsgId` to `1` and requires re-initialization.
   */
  reset() {
    this.calls.length = 0
    this._nextUpdateId = 1
    this._nextMessageId = 1
    this._nextApiMsgId = 1
    this._initialized = false
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
    return this.bot.templateManager.getGMessage(page, aGBaseId, aLang, data).text
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
    return this.bot.templateManager.getGKeyboard(page, aGBaseId, aLang, aType, data).rows
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
  extractText(call: IE2eApiCall): string | undefined {
    const body = call?.body as {text?: string; caption?: string; rich_message?: {html?: string; markdown?: string}} | undefined
    return body?.rich_message?.html ?? body?.rich_message?.markdown ?? body?.text ?? body?.caption
  }

  /**
   * Narrows one captured API call's `body` to the shape a test expects.
   *
   * @remarks
   * `IE2eApiCall.body` is `Record<string, unknown>` on purpose: the Bot API body
   * differs per method, so the library cannot narrow it without lying about half
   * the methods. Assertions that reach into a method-specific field (`media`,
   * `reply_markup`, `rich_message`) declare that shape here at the call site.
   *
   * @typeParam T - The method-specific body shape the caller asserts on.
   * @param call - Captured API call, or `undefined` when there was no reply.
   * @returns The body cast to `T`, or `undefined` when the call is absent.
   *
   * @example
   * ```typescript
   * expect(e2e.bodyOf<{media?: {type?: string}}>(call)?.media?.type).toBe(`photo`)
   * ```
   */
  bodyOf<T = Record<string, unknown>>(call: IE2eApiCall | undefined): T | undefined {
    return call?.body as T | undefined
  }

  /**
   * Extract inline keyboard button labels from a captured API call.
   *
   * @param call - Captured API call (e.g. from `sendText` response array).
   * @returns Flat array of button text labels.
   */
  extractButtonLabels(call: IE2eApiCall): string[] {
    const markup = this.bodyOf<{reply_markup?: {inline_keyboard?: unknown[][]; keyboard?: unknown[][]}}>(call)?.reply_markup
    const inline = markup?.inline_keyboard?.flat().map((b) => (typeof b === `string` ? b : ((b as {text?: string} | null | undefined)?.text ?? ``))) ?? []
    const bottom = markup?.keyboard?.flat().map((b) => (typeof b === `string` ? b : ((b as {text?: string} | null | undefined)?.text ?? ``))) ?? []
    return [...inline, ...bottom].filter((label) => label !== ``)
  }

  /**
   * Build the `from` sender object for a simulated update.
   *
   * @remarks
   * Tests key presence with `in` rather than truthiness, so an explicit override always wins even
   * when its value is falsy. `last_name` and `username` are spread only when the key is present,
   * keeping absent fields absent rather than empty.
   *
   * @param user - Partial sender override.
   * @returns A Telegram `User` shaped object.
   *
   * @internal
   */
  _defaultUser(user?: IE2eUser) {
    return {
      id: user !== undefined && `id` in user ? user.id : 1001,
      is_bot: user !== undefined && `is_bot` in user ? user.is_bot : false,
      first_name: user !== undefined && `first_name` in user ? user.first_name : `Test`,
      ...(user !== undefined && `last_name` in user ? {last_name: user.last_name} : {}),
      ...(user !== undefined && `username` in user ? {username: user.username} : {}),
      language_code: user !== undefined && `language_code` in user ? user.language_code : `en`
    }
  }

  /**
   * Build the `chat` object for a simulated update.
   *
   * @remarks
   * Tests key presence with `in` rather than truthiness, so an explicit override always wins even
   * when its value is falsy. `last_name`, `username`, and `title` are spread only when the key is
   * present, keeping absent fields absent rather than empty.
   *
   * @param chat - Partial chat override.
   * @returns A Telegram `Chat` shaped object.
   *
   * @internal
   */
  _defaultChat(chat?: IE2eChat) {
    return {
      id: chat !== undefined && `id` in chat ? chat.id : 1001,
      type: chat !== undefined && `type` in chat ? chat.type : `private`,
      first_name: chat !== undefined && `first_name` in chat ? chat.first_name : `Test`,
      ...(chat !== undefined && `last_name` in chat ? {last_name: chat.last_name} : {}),
      ...(chat !== undefined && `username` in chat ? {username: chat.username} : {}),
      ...(chat !== undefined && `title` in chat ? {title: chat.title} : {})
    }
  }

  /**
   * Allocate the next update id, message id, and timestamp for a simulated update.
   *
   * @remarks
   * `updateId` always comes from the internal counter, which `reset()` returns to `1`.
   * `messageId` and `date` are taken when the key is present on `options`, otherwise from the
   * counter and the current time in seconds.
   *
   * @param options - Update options that may override `message_id` and `date`.
   * @returns The update id, the message id, and the unix timestamp in seconds.
   *
   * @internal
   */
  _nextIds(options?: IE2eUpdateOptions) {
    return {
      updateId: this._nextUpdateId++,
      messageId: options !== undefined && `message_id` in options ? options.message_id : this._nextMessageId++,
      date: options !== undefined && `date` in options ? options.date : Math.floor(Date.now() / 1000)
    }
  }

  /**
   * Read the post-dispatch settle delay off the update options.
   *
   * @remarks
   * `settleMs` is read through a widening cast because it is not declared on `IE2eUpdateOptions` —
   * it reaches the helper as an extra property and is what `handleUpdate` waits for after
   * dispatching an update, so a caller whose handler defers its API calls raises it. Absent means
   * `0`, leaving only the single tick `handleUpdate` always awaits.
   *
   * @param options - Update options, which may carry an undeclared `settleMs`.
   * @returns The settle delay in milliseconds, `0` when absent.
   *
   * @internal
   */
  _settleFrom(options: IE2eUpdateOptions | undefined): number {
    return (options as {settleMs?: number} | undefined)?.settleMs ?? 0
  }

  /**
   * Wrap a partial message in a Telegram `message` update envelope.
   *
   * @remarks
   * The caller's fields are spread last and therefore win over the envelope's `message_id`,
   * `date`, `chat`, and `from`, so a caller can override those directly. Use `sendCallbackQuery`
   * for updates that must not carry a `message`, since a callback query nests its own message
   * object.
   *
   * @param message - Message fields to merge into the envelope.
   * @param options - Update options supplying the sender, chat, and id overrides.
   * @returns A Telegram `Update` object carrying a `message` field.
   *
   * @internal
   */
  _buildMessageUpdate(message: Record<string, unknown>, options?: IE2eUpdateOptions) {
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
  async handleUpdate(update: Record<string, unknown>, settleMs = 0): Promise<IE2eApiCall[]> {
    await this._ensureInit()
    const startIndex = this.calls.length
    await this.bot.bot.handleUpdate(update as unknown as Parameters<Gramstax[`bot`][`handleUpdate`]>[0])
    // Allow microtasks to settle (some API calls may be deferred)
    await new Promise((resolve) => setTimeout(resolve, settleMs))
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
  async sendText(text: string, options?: IE2eUpdateOptions) {
    const entities = text.startsWith(`/`) ? [{offset: 0, length: text.split(` `)[0]?.length ?? text.length, type: `bot_command`}] : undefined
    return await this.handleUpdate(this._buildMessageUpdate({text, ...(entities ? {entities} : {})}, options), this._settleFrom(options))
  }

  /**
   * Simulate a user sending a photo message.
   *
   * @param options - Caption, user, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendPhoto(options?: IE2eMediaOptions) {
    return await this.handleUpdate(this._buildMessageUpdate({photo: [{file_id: `mock-photo-file-id`, file_unique_id: `mock-photo-unique-id`, width: 1, height: 1}], ...(options !== undefined && `caption` in options ? {caption: options.caption} : {})}, options), this._settleFrom(options))
  }

  /**
   * Simulate a user sending a video message.
   *
   * @param options - Caption, user, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendVideo(options?: IE2eMediaOptions) {
    return await this.handleUpdate(this._buildMessageUpdate({video: {file_id: `mock-video-file-id`, file_unique_id: `mock-video-unique-id`, width: 1, height: 1, duration: 1}, ...(options !== undefined && `caption` in options ? {caption: options.caption} : {})}, options), this._settleFrom(options))
  }

  /**
   * Simulate a user sending an audio message.
   *
   * @param options - Caption, user, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendAudio(options?: IE2eMediaOptions) {
    return await this.handleUpdate(this._buildMessageUpdate({audio: {file_id: `mock-audio-file-id`, file_unique_id: `mock-audio-unique-id`, duration: 1}, ...(options !== undefined && `caption` in options ? {caption: options.caption} : {})}, options), this._settleFrom(options))
  }

  /**
   * Simulate a user sending a document (file) message.
   *
   * @param options - Caption, user, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendDocument(options?: IE2eMediaOptions) {
    return await this.handleUpdate(this._buildMessageUpdate({document: {file_id: `mock-document-file-id`, file_unique_id: `mock-document-unique-id`, file_name: `mock.txt`}, ...(options !== undefined && `caption` in options ? {caption: options.caption} : {})}, options), this._settleFrom(options))
  }

  /**
   * Simulate a user sending an animation (GIF) message.
   *
   * @param options - Caption, user, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendAnimation(options?: IE2eMediaOptions) {
    return await this.handleUpdate(
      this._buildMessageUpdate({animation: {file_id: `mock-animation-file-id`, file_unique_id: `mock-animation-unique-id`, width: 1, height: 1, duration: 1}, ...(options !== undefined && `caption` in options ? {caption: options.caption} : {})}, options),
      this._settleFrom(options)
    )
  }

  /**
   * Simulate a user sending a voice message.
   *
   * @param options - Caption, user, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendVoice(options?: IE2eMediaOptions) {
    return await this.handleUpdate(this._buildMessageUpdate({voice: {file_id: `mock-voice-file-id`, file_unique_id: `mock-voice-unique-id`, duration: 1}, ...(options !== undefined && `caption` in options ? {caption: options.caption} : {})}, options), this._settleFrom(options))
  }

  /**
   * Simulate a user sending a video note (round video) message.
   *
   * @param options - User, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendVideoNote(options?: IE2eUpdateOptions) {
    return await this.handleUpdate(this._buildMessageUpdate({video_note: {file_id: `mock-video-note-file-id`, file_unique_id: `mock-video-note-unique-id`, length: 1, duration: 1}}, options), this._settleFrom(options))
  }

  /**
   * Simulate a user sending a sticker message.
   *
   * @param options - User, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendSticker(options?: IE2eUpdateOptions) {
    return await this.handleUpdate(this._buildMessageUpdate({sticker: {file_id: `mock-sticker-file-id`, file_unique_id: `mock-sticker-unique-id`, type: `regular`, width: 1, height: 1, is_animated: false, is_video: false}}, options), this._settleFrom(options))
  }

  /**
   * Simulate a user sending a location message.
   *
   * @param options - Latitude, longitude, user, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendLocation(options?: IE2eLocationOptions) {
    return await this.handleUpdate(this._buildMessageUpdate({location: {latitude: options !== undefined && `latitude` in options ? options.latitude : 0, longitude: options !== undefined && `longitude` in options ? options.longitude : 0}}, options), this._settleFrom(options))
  }

  /**
   * Simulate a user sending a contact message.
   *
   * @param options - Phone number, name, user, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendContact(options?: IE2eContactOptions) {
    return await this.handleUpdate(
      this._buildMessageUpdate(
        {
          contact: {
            phone_number: options !== undefined && `phone_number` in options ? options.phone_number : `+10000000000`,
            first_name: options !== undefined && `first_name` in options ? options.first_name : `Test`,
            ...(options !== undefined && `last_name` in options ? {last_name: options.last_name} : {}),
            ...(options !== undefined && `user_id` in options ? {user_id: options.user_id} : {})
          }
        },
        options
      ),
      this._settleFrom(options)
    )
  }

  /**
   * Simulate a user pressing an inline keyboard button (callback query).
   *
   * @param data - The `callback_data` string from the pressed button.
   * @param options - Callback ID, message text, user, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendCallbackQuery(data: string, options?: IE2eCallbackQueryOptions) {
    const {updateId, messageId, date} = this._nextIds(options)
    return await this.handleUpdate(
      {
        update_id: updateId,
        callback_query: {
          id: options !== undefined && `id` in options ? options.id : `mock-callback-${updateId}`,
          from: this._defaultUser(options?.user),
          message: {
            message_id: messageId,
            date,
            chat: this._defaultChat(options?.chat),
            text: options !== undefined && `messageText` in options ? options.messageText : `Mock message`
          },
          chat_instance: `mock-chat-instance`,
          data
        }
      },
      this._settleFrom(options)
    )
  }

  /**
   * Simulate a user sending a dice message.
   *
   * @param options - Dice emoji, user, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendDice(options?: IE2eDiceOptions) {
    return await this.handleUpdate(this._buildMessageUpdate({dice: {emoji: options !== undefined && `emoji` in options ? options.emoji : `🎲`, value: 1}}, options), this._settleFrom(options))
  }

  /**
   * Simulate an edited text message.
   *
   * @param text - The new message text.
   * @param options - User, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendEditedText(text: string, options?: IE2eUpdateOptions) {
    const {updateId, messageId, date} = this._nextIds(options)
    return await this.handleUpdate(
      {
        update_id: updateId,
        edited_message: {
          message_id: messageId,
          date,
          chat: this._defaultChat(options?.chat),
          from: this._defaultUser(options?.user),
          text,
          edit_date: Math.floor(Date.now() / 1000)
        }
      },
      this._settleFrom(options)
    )
  }

  /**
   * Simulate a user joining a chat (service message).
   *
   * @param options - User, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendNewChatMembers(options?: IE2eUpdateOptions) {
    const user = this._defaultUser(options?.user)
    return await this.handleUpdate(this._buildMessageUpdate({new_chat_members: [user]}, options), this._settleFrom(options))
  }

  /**
   * Simulate the bot receiving a channel post.
   *
   * @param text - The post text.
   * @param options - User, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendChannelPost(text: string, options?: IE2eUpdateOptions) {
    const {updateId, messageId, date} = this._nextIds(options)
    return await this.handleUpdate(
      {
        update_id: updateId,
        channel_post: {
          message_id: messageId,
          date,
          chat: this._defaultChat(options?.chat),
          text,
          ...(text.startsWith(`/`) ? {entities: [{offset: 0, length: text.split(` `)[0]?.length ?? text.length, type: `bot_command`}]} : {})
        }
      },
      this._settleFrom(options)
    )
  }

  /**
   * Simulate a poll update sent by the bot (used for poll answer testing).
   *
   * @param pollId - The poll identifier.
   * @param optionIds - Array of selected option IDs.
   * @param options - User, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendPollAnswer(pollId: string, optionIds: number[], options?: IE2eUpdateOptions) {
    const {updateId} = this._nextIds(options)
    return await this.handleUpdate(
      {
        update_id: updateId,
        poll_answer: {
          poll_id: pollId,
          user: this._defaultUser(options?.user),
          option_ids: optionIds
        }
      },
      this._settleFrom(options)
    )
  }

  /**
   * Simulate an inline query sent by a user.
   *
   * @param query - The inline query text.
   * @param options - User, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendInlineQuery(query: string, options?: IE2eUpdateOptions) {
    const {updateId} = this._nextIds(options)
    return await this.handleUpdate(
      {
        update_id: updateId,
        inline_query: {
          id: `mock-inline-${updateId}`,
          from: this._defaultUser(options?.user),
          query,
          offset: ``
        }
      },
      this._settleFrom(options)
    )
  }

  /**
   * Simulate a user choosing a result from an inline query.
   *
   * @param resultId - The chosen result ID.
   * @param query - The inline query text.
   * @param options - User, chat, and response options.
   * @returns API calls made while processing this update.
   */
  async sendChosenInlineResult(resultId: string, query: string, options?: IE2eUpdateOptions) {
    const {updateId} = this._nextIds(options)
    return await this.handleUpdate(
      {
        update_id: updateId,
        chosen_inline_result: {
          result_id: resultId,
          from: this._defaultUser(options?.user),
          query
        }
      },
      this._settleFrom(options)
    )
  }

  // ── chat member helpers ────────────────────────────────────────

  /**
   * Simulate a chat member status transition (`chat_member` update).
   *
   * @remarks
   * Fires `chatMemberFilter` handlers on pages that define corresponding
   * `handleChatMember*` methods. The bot must be admin in the chat to
   * normally receive these updates. In test mode the update is injected
   * directly via {@link E2eHelper.handleUpdate}.
   *
   * @example
   * ```typescript
   * // Simulate a user joining (kicked → member)
   * await e2e.sendChatMemberUpdate({oldStatus: "kicked", newStatus: "member", chat: {type: "supergroup"}})
   * ```
   *
   * @param options - Old/new statuses and user/chat configuration.
   * @returns API calls made while processing this update.
   */
  async sendChatMemberUpdate(options?: IE2eChatMemberOptions) {
    const {updateId} = this._nextIds(options)
    const botId = options !== undefined && `botId` in options ? options.botId : (this.bot.bot.botInfo?.id ?? 123456789)
    const userId = options?.user !== undefined && `id` in options.user ? options.user.id : 1001
    const oldStatus = options !== undefined && `oldStatus` in options ? options.oldStatus : `kicked`
    const newStatus = options !== undefined && `newStatus` in options ? options.newStatus : `member`
    return await this.handleUpdate(
      {
        update_id: updateId,
        chat_member: {
          chat: this._defaultChat({...options?.chat, type: options?.chat?.type ?? `supergroup`}),
          from: this._defaultUser(options?.user),
          date: options !== undefined && `date` in options ? options.date : Math.floor(Date.now() / 1000),
          old_chat_member: {
            user: {id: userId, is_bot: userId === botId, first_name: `User`},
            status: oldStatus,
            ...(oldStatus === `restricted` ? {is_member: options !== undefined && `oldIsMember` in options ? options.oldIsMember : false} : {})
          },
          new_chat_member: {
            user: {id: userId, is_bot: userId === botId, first_name: `User`},
            status: newStatus,
            ...(newStatus === `restricted` ? {is_member: options !== undefined && `newIsMember` in options ? options.newIsMember : true} : {})
          }
        }
      },
      this._settleFrom(options)
    )
  }

  /**
   * Simulate the bot's own chat member status transition (`my_chat_member` update).
   *
   * @remarks
   * Fires `myChatMemberFilter` handlers on pages that define corresponding
   * `handleMyChatMember*` methods. Use this to test bot promotion/demotion
   * scenarios.
   *
   * @example
   * ```typescript
   * // Simulate bot being promoted to admin
   * await e2e.sendMyChatMemberUpdate({oldStatus: "member", newStatus: "administrator"})
   * ```
   *
   * @param options - Old/new statuses and chat configuration.
   * @returns API calls made while processing this update.
   */
  async sendMyChatMemberUpdate(options?: IE2eChatMemberOptions) {
    const {updateId} = this._nextIds(options)
    const botId = options !== undefined && `botId` in options ? options.botId : (this.bot.bot.botInfo?.id ?? 123456789)
    const oldStatus = options !== undefined && `oldStatus` in options ? options.oldStatus : `left`
    const newStatus = options !== undefined && `newStatus` in options ? options.newStatus : `member`
    return await this.handleUpdate(
      {
        update_id: updateId,
        my_chat_member: {
          chat: this._defaultChat({...options?.chat, type: options?.chat?.type ?? `supergroup`}),
          from: {id: botId, is_bot: true, first_name: `GramstaxBot`},
          date: options !== undefined && `date` in options ? options.date : Math.floor(Date.now() / 1000),
          old_chat_member: {
            user: {id: botId, is_bot: true, first_name: `GramstaxBot`},
            status: oldStatus
          },
          new_chat_member: {
            user: {id: botId, is_bot: true, first_name: `GramstaxBot`},
            status: newStatus
          }
        }
      },
      this._settleFrom(options)
    )
  }

  // ── Bot API 10.3 helpers ──────────────────────────────────────

  /**
   * Simulate a user stopping message generation (Bot API 10.3 `stopped_message_generation`).
   *
   * @param options - Chat, draft, thread and response options
   * @returns API calls made while processing this update
   * @public
   */
  async sendStoppedGeneration(options?: IE2eUpdateOptions & {chat?: IE2eChat; draft_id?: number; message_thread_id?: number}) {
    const {updateId} = this._nextIds(options)
    return await this.handleUpdate(
      {
        update_id: updateId,
        stopped_message_generation: {
          chat: this._defaultChat(options?.chat),
          draft_id: options !== undefined && `draft_id` in options ? options.draft_id : 1,
          ...(options?.message_thread_id !== undefined ? {message_thread_id: options.message_thread_id} : {})
        }
      },
      this._settleFrom(options)
    )
  }

  /**
   * Alias for `sendStoppedGeneration` (Bot API 10.3).
   *
   * @param options - Chat, draft, thread and response options
   * @returns API calls made while processing this update
   * @public
   */
  async sendStoppedMessageGeneration(options?: IE2eUpdateOptions & {chat?: IE2eChat; draft_id?: number; message_thread_id?: number}) {
    return await this.sendStoppedGeneration(options)
  }

  /**
   * Simulate a community chat joined service message (Bot API 10.3 `community_chat_joined`).
   *
   * @param options - User, chat and response options
   * @returns API calls made while processing this update
   * @public
   */
  async sendCommunityChatJoined(options?: IE2eUpdateOptions & {community?: {id?: number; name?: string}}) {
    return await this.handleUpdate(this._buildMessageUpdate({community_chat_joined: {community: options !== undefined && `community` in options ? options.community : {id: 1, name: `Test Community`}}}, options), this._settleFrom(options))
  }

  /**
   * Simulate a message containing `UniqueGiftInfo` fields (Bot API 10.3 `text/entities/is_private`).
   *
   * @param giftInfo - Gift info payload (gift, origin, text, entities, is_private)
   * @param options - User, chat and response options
   * @returns API calls made while processing this update
   * @public
   */
  async sendGiftInfo(giftInfo: Record<string, unknown>, options?: IE2eUpdateOptions) {
    return await this.handleUpdate(this._buildMessageUpdate({unique_gift: giftInfo}, options), this._settleFrom(options))
  }

  // ── stream helpers ────────────────────────────────────────────

  /**
   * Get all captured stream-related API calls.
   *
   * @remarks
   * Returns calls to `sendMessageDraft`, `sendRichMessageDraft`,
   * `sendRichMessage`, and `sendMessage` methods made during stream operations.
   *
   * @returns Array of stream-related API calls.
   */
  streamCalls(): IE2eApiCall[] {
    return this.calls.filter(
      (c) =>
        c.method === `sendMessageDraft` ||
        c.method === `sendRichMessageDraft` ||
        c.method === `sendRichMessage` ||
        c.method === `sendMessage` ||
        c.method === `editMessageText` ||
        c.method === `editMessageCaption` ||
        c.method === `editMessageMedia` ||
        c.method === `editMessageReplyMarkup` ||
        c.method === `editEphemeralMessageText` ||
        c.method === `editEphemeralMessageCaption` ||
        c.method === `editEphemeralMessageMedia` ||
        c.method === `editEphemeralMessageReplyMarkup` ||
        c.method === `deleteEphemeralMessage`
    )
  }

  /**
   * Extract all text chunks from stream API calls.
   *
   * @remarks
   * Collects the `text` field from `sendMessageDraft` calls and the HTML
   * markup from `sendRichMessageDraft` and `sendRichMessage` calls —
   * useful for asserting that streamed content matches expected output.
   *
   * @returns Array of text chunks.
   */
  streamChunks(): string[] {
    return this.streamCalls()
      .map((c) => (c.body as any)?.text ?? (c.body as any)?.rich_message?.markdown ?? (c.body as any)?.rich_message?.html ?? ``)
      .filter(Boolean)
  }
}
