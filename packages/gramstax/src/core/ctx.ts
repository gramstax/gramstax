/**
 * Extended context — adds Gramstax features to the base bot context.
 *
 * @remarks
 * Wraps the framework's context with template rendering, page navigation,
 * media group editing, and CLI input support. Each incoming update is
 * routed through this context before reaching handler pages.
 *
 * @public
 */

import {setTimeout} from "node:timers/promises"
import type {FileFlavor} from "@grammyjs/files"
import type {MessageDraftPiece, StreamContextExtension} from "@grammyjs/stream"
import {Context, InlineKeyboard, InputMediaBuilder, Keyboard} from "grammy"
import type {InputMediaAudio, InputMediaDocument, InputMediaPhoto, InputMediaVideo} from "grammy/types"
import type {CacheExternal, ITCacheRpc} from "~/cache/external"
import type {LoggingHelper} from "~/helpers/log"
import type {ITMediaBlock} from "~/template/engine"
import type {TemplateManager} from "~/template/manager"
import type {
  _KbButtonWithPageText,
  _KbCallbackData,
  _KbPageLike,
  ITBottomKb,
  ITBottomKbParams,
  ITBuildDataOptions,
  ITCt,
  ITCtxParams,
  ITData,
  ITInBoKb,
  ITInlineKb,
  ITInlineKbParams,
  ITKbCols,
  ITKbDest,
  ITOptEdit,
  ITOptEditMedia1,
  ITOptEditMedia2,
  ITOptFallbackEdit,
  ITOptReply,
  ITOptReplyAnimation,
  ITOptReplyAudio,
  ITOptReplyContact,
  ITOptReplyDocument,
  ITOptReplyLocation,
  ITOptReplyPhoto,
  ITOptReplyRich,
  ITOptReplySticker,
  ITOptReplyVideo,
  ITOptReplyVideoNote,
  ITOptReplyVoice,
  ITPageData,
  ITPageDataBase,
  ITTemp
} from "../types/t.ctx"

type ITMediaGroupType = Extract<ITMediaBlock[`type`], `photo` | `video` | `audio` | `document`>
type ITMediaGroupInput = InputMediaAudio | InputMediaDocument | InputMediaPhoto | InputMediaVideo
type ITMediaGroupItem = NonNullable<ITMediaBlock[`mediaGroup`]>[number]

/**
 * Extended `InlineKeyboard` — overrides `.text()` so the `data` parameter
 * accepts a page class or instance directly (besides a plain string).
 *
 * @example
 * ```ts
 * const kb = new GramstaxInlineKeyboard()
 *   .text("Open Settings", SettingsPage)                // callback from SettingsPage.data.callbackQueryData()
 *   .text("Help", HelpPage.data.callbackQueryData())    // [not recomended for types check] string works too
 * ```
 *
 * @internal
 */
class GramstaxInlineKeyboard extends InlineKeyboard {
  /**
   * Add a callback button.
   *
   * @param text - Button label. Pass a **page class/instance** to
   *   automatically resolve `page.data.intentText` as the label, or a
   *   plain `string`/grammY button object for the default behavior.
   * @param data - Callback data. Pass a **page class/instance** to
   *   automatically use `page.data.callbackQueryData()`, or pass a
   *   plain `string` for the default behavior.
   * @returns `this` for chaining.
   *
   * @internal
   */
  override text(text: Parameters<InlineKeyboard[`text`]>[0] | _KbPageLike | _KbButtonWithPageText, data?: Parameters<InlineKeyboard[`text`]>[1] | _KbPageLike): this {
    let label: Parameters<InlineKeyboard[`text`]>[0] = text as Parameters<InlineKeyboard[`text`]>[0]
    if (typeof label === `function` || label instanceof Ctx) {
      const PageClass = (typeof label === `function` ? label : label.constructor) as typeof Ctx
      Helper.ensurePageHasCallback(PageClass)
      label = Helper.resolvePageText(PageClass)
    } else if (typeof label === `object` && label !== null) {
      const btn = label as {text?: unknown}
      if (typeof btn.text === `function` || btn.text instanceof Ctx) {
        const PageClass = (typeof btn.text === `function` ? btn.text : btn.text.constructor) as typeof Ctx
        Helper.ensurePageHasCallback(PageClass)
        label = {...btn, text: Helper.resolvePageText(PageClass)} as Parameters<InlineKeyboard[`text`]>[0]
      }
    }
    if (data !== undefined && typeof data !== `string`) {
      if (`result` in data && `page` in data && `args` in data) {
        const cb = data as unknown as _KbCallbackData
        return super.text(label, cb.result)
      }
      const PageClass = (typeof data === `function` ? data : data.constructor) as typeof Ctx
      Helper.ensurePageHasCallback(PageClass)
      const cb = (PageClass.data as unknown as {callbackQueryData: () => _KbCallbackData<typeof Ctx, []>}).callbackQueryData()
      return super.text(label, cb.result)
    }
    return super.text(label, data as Parameters<InlineKeyboard[`text`]>[1])
  }
}

/**
 * Extended `Keyboard` (reply keyboard) — overrides `.text()` so the `text`
 * parameter accepts a page class/instance (besides a plain string). When a
 * page is passed the button label resolves to the page's `intentText`.
 *
 * @example
 * ```ts
 * const kb = new GramstaxKeyboard()
 *   .text(BalancePage)          // label → BalancePage.data.intentText
 *   .row()
 *   .text("Manual Label")       // string works too
 * ```
 *
 * @internal
 */
class GramstaxKeyboard extends Keyboard {
  /**
   * Add a text button for the reply keyboard.
   *
   * @param text - Button label. Pass a **page class/instance** to
   *   automatically resolve `page.data.intentText` as the label
   *   (or a plain `string` for the default behavior).
   * @param options - Optional styling (see grammY `Keyboard.text`).
   * @returns `this` for chaining.
   *
   * @internal
   */
  override text(text: string | typeof Ctx | Ctx, options?: Parameters<Keyboard[`text`]>[1]): this {
    if (typeof text !== `string`) {
      const PageClass = (typeof text === `function` ? text : text.constructor) as typeof Ctx
      text = PageClass.data?.intentText ?? ``
    }
    return super.text(text, options)
  }
}

/**
 * Internal helper methods for media-group construction and page-keyboard
 * button resolution. Not part of the public API surface.
 *
 * @internal
 */
class Helper {
  static MEDIA_GROUP_TYPES = new Set<ITMediaBlock[`type`]>([`photo`, `video`, `audio`, `document`])
  static isMediaGroupType(type: ITMediaBlock[`type`]): type is ITMediaGroupType {
    return Helper.MEDIA_GROUP_TYPES.has(type)
  }

  static buildMediaGroupOptions(options: Record<string, unknown>) {
    const mediaGroupOptions = {...(options ?? {})}
    delete mediaGroupOptions.parse_mode
    delete mediaGroupOptions.reply_markup
    return mediaGroupOptions
  }

  static buildMediaGroupFromItems(items: ITMediaGroupItem[], caption?: string): ITMediaGroupInput[] {
    return items.map((item, index) => {
      const itemCaption = item.caption ?? (index === 0 ? caption : undefined)
      const opts = itemCaption ? {caption: itemCaption, parse_mode: `HTML` as const} : undefined
      if (item.type === `photo`) return InputMediaBuilder.photo(item.src, opts)
      if (item.type === `video`) return InputMediaBuilder.video(item.src, opts)
      if (item.type === `audio`) return InputMediaBuilder.audio(item.src, opts)
      return InputMediaBuilder.document(item.src, opts)
    })
  }

  static buildMediaGroup(type: ITMediaGroupType, srcList: string[], caption?: string): ITMediaGroupInput[] {
    return srcList.map((media, index) => {
      const opts = index === 0 && caption ? {caption, parse_mode: `HTML` as const} : undefined
      if (type === `photo`) return InputMediaBuilder.photo(media, opts)
      if (type === `video`) return InputMediaBuilder.video(media, opts)
      if (type === `audio`) return InputMediaBuilder.audio(media, opts)
      return InputMediaBuilder.document(media, opts)
    })
  }

  /**
   * Resolve a page class/instance to its default intent text (no language).
   *
   * @param page - Page class or instance.
   * @returns The resolved button label.
   *
   * @internal
   */
  static resolvePageText(page: typeof Ctx | Ctx): string {
    const PageClass = (typeof page === `function` ? page : page.constructor) as typeof Ctx
    return PageClass.data?.intentText ?? PageClass.data?.name ?? ``
  }

  /**
   * Ensure a page class defines the `handleCallbackQueryData` route.
   *
   * @param PageClass - Page class referenced in an inline keyboard.
   * @throws Error when the page lacks a `handleCallbackQueryData` handler.
   *
   * @internal
   */
  static ensurePageHasCallback(PageClass: typeof Ctx) {
    const hasCallback = typeof (PageClass.prototype as unknown as Record<string, unknown>).handleCallbackQueryData === `function`
    if (!hasCallback) {
      const pageName = (PageClass.data as {name?: string} | undefined)?.name ?? (PageClass as unknown as {name?: string}).name ?? `unknown`
      throw new Error(`Page "${pageName}" referenced in inline keyboard does not define handleCallbackQueryData. The button would have no registered handler. Add "async handleCallbackQueryData()" to the page class.`)
    }
  }

  /**
   * Resolve a page class/instance to its language-specific intent text.
   *
   * @param page - Page class or instance.
   * @param lang - Optional language code; falls back to `intentText`.
   * @returns The resolved button label.
   *
   * @internal
   */
  static resolvePageTextLang(page: typeof Ctx | Ctx, lang?: string): string {
    const PageClass = (typeof page === `function` ? page : page.constructor) as typeof Ctx
    const map = PageClass.data?.intentTextMap
    if (map) {
      if (lang && map[lang]) return map[lang]
      if (map.default) return map.default
    }
    // Fallback to intentText (already set from map.default or plain string)
    return PageClass.data?.intentText ?? PageClass.data?.name ?? ``
  }
}

/**
 * The context/page base class that provides access to user data, session management,
 * template rendering, and reply methods.
 *
 * @remarks
 * Extend this class to create page handlers. Define static `template` property for
 * HTML-like templates and static `data` via `Ctx.buildData` for routing configuration.
 *
 * @example Basic Without PageBase
 * ```typescript
 * import {Ctx} from "gramstax" // not recommended, use PageBase with extends Ctx instead
 * import {Menu1Page} from "./menu1"
 * import {Menu2Page} from "./menu2"
 *
 * class StartPage extends Ctx {
 *   async handleCallbackQueryData() {
 *     const kb = this.inlineKeyboardT([Menu1Page, Menu2Page])
 *     await this.render(kb)
 *   }
 *
 *   static template = `
 *     <g-base>
 *       <g-keyboard>Button 1, Button 2</g-keyboard>
 *       <g-message>Hello {{name}}!</g-message>
 *     </g-base>
 *   `
 * }
 * ```
 *
 * @example Multi Base Id
 * ```typescript
 * import {Ctx} from "gramstax"
 * import {Menu1Page} from "./menu1"
 * import {Menu2Page} from "./menu2"
 *
 * class StartPage extends Ctx {
 *   async handleCallbackQueryData() {
 *     const kb = this.inlineKeyboardT([Menu1Page, Menu2Page], "2", "special-kb")
 *     await this.render()
 *   }
 *
 *   static template = `
 *     <g-base id="special-kb">
 *       <g-keyboard>Button 1, Button 2</g-keyboard>
 *     </g-base>
 *     <g-base>
 *       <g-message>Hello {{name}}!</g-message>
 *     </g-base>
 *   `
 * }
 * ```
 *
 * @public
 */
export class Ctx extends Context {
  /**
   * HTML-like template string for the page.
   *
   * @remarks
   * Must contain a `<g-base></g-base>` block. Supports template interpolation with `{{variable}}` syntax.
   *
   * @example Basic
   * ```typescript
   * class MyPage extends Ctx {
   *   static template = `
   *     <g-base>
   *       <g-keyboard>Button 1, Button 2</g-keyboard>
   *       <g-message>Hello {{name}}!</g-message>
   *     </g-base>
   *   `
   * }
   * ```
   *
   * @example Multi Id
   * ```typescript
   * class MyPage extends Ctx {
   *   static template = `
   *     <g-base id="lah">
   *       <g-keyboard>Button 1, Button 2</g-keyboard>
   *     </g-base>
   *     <g-base>
   *       <g-message>Hello {{name}}!</g-message>
   *     </g-base>
   *   `
   * }
   * ```
   *
   * @example Multi Language
   * ```typescript
   * class MyPage extends Ctx {
   *   static template = `
   *     <g-base id="lah">
   *       <g-keyboard type="inline">Button 1, Button 2</g-keyboard>
   *       <g-keyboard type="inline" lang="id">Tombol 1, Tombol 2</g-keyboard>
   *     </g-base>
   *     <g-base>
   *       <g-message>Hello {{name}}!</g-message>
   *       <g-message lang="id">Halo {{name}}!</g-message>
   *     </g-base>
   *   `
   * }
   * ```
   *
   * @virtual
   * @public
   */
  static template?: string

  static readonly ANSWER_API_METHODS = new Set([
    `sendMessage`,
    `sendPhoto`,
    `sendAudio`,
    `sendDocument`,
    `sendVideo`,
    `sendAnimation`,
    `sendVoice`,
    `sendVideoNote`,
    `sendMediaGroup`,
    `sendLocation`,
    `sendVenue`,
    `sendContact`,
    `sendPoll`,
    `sendDice`,
    `sendSticker`,
    `sendChatAction`,
    `sendInvoice`,
    `sendGame`,
    `sendMessageDraft`,
    `sendRichMessage`,
    `sendRichMessageDraft`,
    `sendChatJoinRequestWebApp`,
    `sendPaidMedia`,
    `sendChecklist`,
    `answerCallbackQuery`,
    `answerInlineQuery`,
    `answerWebAppQuery`,
    `answerShippingQuery`,
    `answerPreCheckoutQuery`,
    `answerChatJoinRequestQuery`,
    `editMessageText`,
    `editMessageCaption`,
    `editMessageMedia`,
    `editMessageReplyMarkup`,
    `editMessageChecklist`,
    `editMessageLiveLocation`,
    `editMessageLiveLocationInline`,
    `stopMessageLiveLocation`,
    `stopMessageLiveLocationInline`,
    `setMessageReaction`,
    `deleteMessage`,
    `deleteMessages`,
    `forwardMessage`,
    `forwardMessages`,
    `copyMessage`,
    `copyMessages`,
    `pinChatMessage`,
    `unpinChatMessage`,
    `unpinAllChatMessages`
  ])

  /**

  /**
   * Page routing data created by `Ctx.buildData`.
   *
   * @remarks
   * Only define when you want to override the intent and have a callback arg.
   * If nothing is needed, let the system handle it automatically.
   *
   * @example
   * ```typescript
   * class MyPage extends Ctx {
   *   // For args `handle*CallbackQueryData`
   *   static data = this.buildData((confirm?: string) => [confirm])
   *
   *   // For args `handle*CallbackQueryData` and `handle*Text` and `handle*CommandText` (Besides "handleFree*")
   *   static data = this.buildData({
   *     callbackQueryData: (confirm?: string) => [confirm],
   *     intentText: `my_page`,
   *     intentCommandText: `hello`
   *   })
   * }
   * ```
   *
   * @remarks
   * Optional by default — pages that do NOT define `static data` inherit
   * `ITPageDataStatic | undefined`. Pages that override via `buildData(...)`
   * get fully typed `callbackQueryData` with the configured args.
   *
   * @public
   */
  static data?: ITPageDataBase

  /**
   * Instance-level access to the page routing data.
   *
   * @remarks
   * This property mirrors the static `data` property but is accessible via `this.data`
   * within instance methods. Use `this.data.callbackQueryData()` internally.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   const cbd = this.data.callbackQueryData("argument_1", "args2")
   *   console.log(cbd) // "page_name:argument_1:args2"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  data = (this.constructor as unknown as {data: ITPageData}).data

  /**
   * Streams an iterator of message pieces to the current chat, making
   * text appear progressively as editing message drafts.
   *
   * @remarks
   * Provided at runtime by the `\@grammyjs/stream` plugin middleware.
   * The `stream()` plugin must be installed on the bot for this method
   * to be available. Gramstax registers it by default.
   *
   * Each `MessageDraftPiece` is either a plain string or an object
   * `{text, entities?, draft_id?}`. Chunks with the same `draft_id`
   * belong to the same draft; the first chunk crossing 4096 chars is
   * split into a new message. Entities offsets are relative to the
   * entire stream, not per-chunk.
   *
   * @param stream - An iterable of text chunks that make up the message.
   * @param otherMessageDraft - Optional remaining parameters forwarded to `sendMessageDraft`.
   * @param otherMessage - Optional remaining parameters forwarded to `sendMessage`.
   * @param signal - Optional `AbortSignal` to cancel streaming.
   * @returns Array of sent text messages.
   *
   * @public
   */
  async replyWithStream(
    stream: Iterable<MessageDraftPiece> | AsyncIterable<MessageDraftPiece>,
    otherMessageDraft?: Parameters<StreamContextExtension[`replyWithStream`]>[1],
    otherMessage?: Parameters<StreamContextExtension[`replyWithStream`]>[2],
    signal?: Parameters<StreamContextExtension[`replyWithStream`]>[3]
  ): Promise<unknown> {
    const api = this.api as unknown as StreamContextExtension[`api`]
    const chatId = this.chatId
    if (chatId === undefined) {
      throw new Error(`This update does not belong to a chat, so you cannot call 'streamMessage'`)
    }
    const msg = this.msg
    const messageThreadId = msg?.is_topic_message ? {message_thread_id: msg.message_thread_id} : {}
    return api.streamMessage(chatId, 256 * this.update.update_id, stream, {...messageThreadId, ...otherMessageDraft}, {...messageThreadId, ...otherMessage}, signal)
  }

  /**
   * Streams an iterator of markdown strings to the current chat as
   * a single rich message that updates progressively.
   *
   * @remarks
   * Provided at runtime by the `\@grammyjs/stream` plugin middleware.
   * The `stream()` plugin must be installed on the bot for this method
   * to be available. Gramstax registers it by default.
   *
   * Uses `sendRichMessageDraft` for intermediate updates and
   * `sendRichMessage` for the final message. The draft identifier is
   * derived from the current `update_id`.
   *
   * @param stream - An iterable of markdown string chunks.
   * @param otherRichMessageDraft - Optional remaining parameters for `sendRichMessageDraft`.
   * @param otherRichMessage - Optional remaining parameters for `sendRichMessage`.
   * @param baseInputRichMessage - Optional fields merged into the `rich_message` of every API call.
   * @param signal - Optional `AbortSignal` to cancel streaming.
   * @returns The sent rich message object.
   *
   * @public
   */
  async replyWithMarkdownStream(
    stream: Iterable<string> | AsyncIterable<string>,
    otherRichMessageDraft?: Parameters<StreamContextExtension[`replyWithMarkdownStream`]>[1],
    otherRichMessage?: Parameters<StreamContextExtension[`replyWithMarkdownStream`]>[2],
    baseInputRichMessage?: Parameters<StreamContextExtension[`replyWithMarkdownStream`]>[3],
    signal?: Parameters<StreamContextExtension[`replyWithMarkdownStream`]>[4]
  ): Promise<unknown> {
    const api = this.api as unknown as StreamContextExtension[`api`]
    const chatId = this.chatId
    if (chatId === undefined) {
      throw new Error(`This update does not belong to a chat, so you cannot call 'streamMarkdown'`)
    }
    const msg = this.msg
    const messageThreadId = msg?.is_topic_message ? {message_thread_id: msg.message_thread_id} : {}
    return api.streamMarkdown(chatId, this.update.update_id, stream, {...messageThreadId, ...otherRichMessageDraft}, {...messageThreadId, ...otherRichMessage}, baseInputRichMessage, signal)
  }

  /**
   * Streams an iterator of HTML strings to the current chat as
   * a single rich message that updates progressively.
   *
   * @remarks
   * Provided at runtime by the `\@grammyjs/stream` plugin middleware.
   * The `stream()` plugin must be installed on the bot for this method
   * to be available. Gramstax registers it by default.
   *
   * Uses `sendRichMessageDraft` for intermediate updates and
   * `sendRichMessage` for the final message. The draft identifier is
   * derived from the current `update_id`.
   *
   * @param stream - An iterable of HTML string chunks.
   * @param otherRichMessageDraft - Optional remaining parameters for `sendRichMessageDraft`.
   * @param otherRichMessage - Optional remaining parameters for `sendRichMessage`.
   * @param baseInputRichMessage - Optional fields merged into the `rich_message` of every API call.
   * @param signal - Optional `AbortSignal` to cancel streaming.
   * @returns The sent rich message object.
   *
   * @public
   */
  async replyWithHtmlStream(
    stream: Iterable<string> | AsyncIterable<string>,
    otherRichMessageDraft?: Parameters<StreamContextExtension[`replyWithHtmlStream`]>[1],
    otherRichMessage?: Parameters<StreamContextExtension[`replyWithHtmlStream`]>[2],
    baseInputRichMessage?: Parameters<StreamContextExtension[`replyWithHtmlStream`]>[3],
    signal?: Parameters<StreamContextExtension[`replyWithHtmlStream`]>[4]
  ): Promise<unknown> {
    const api = this.api as unknown as StreamContextExtension[`api`]
    const chatId = this.chatId
    if (chatId === undefined) {
      throw new Error(`This update does not belong to a chat, so you cannot call 'streamHtml'`)
    }
    const msg = this.msg
    const messageThreadId = msg?.is_topic_message ? {message_thread_id: msg.message_thread_id} : {}
    return api.streamHtml(chatId, this.update.update_id, stream, {...messageThreadId, ...otherRichMessageDraft}, {...messageThreadId, ...otherRichMessage}, baseInputRichMessage, signal)
  }

  /**
   * The full {@link (Ctx:class).message} object from Telegram (non-nullable).
   *
   * Alias for `ctx.update.message`.
   *
   * @readonly
   * @public
   */
  get message(): NonNullable<Context[`message`]> {
    return super.message as NonNullable<Context[`message`]>
  }

  /**
   * The full {@link (Ctx:class).msg} object from Telegram (non-nullable).
   *
   * Shorthand for `this.message` with fallback across message-like update fields.
   *
   * @readonly
   * @public
   */
  get msg(): NonNullable<Context[`msg`]> {
    return super.msg as NonNullable<Context[`msg`]>
  }

  /**
   * The full {@link (Ctx:class).callbackQuery} object from Telegram (non-nullable).
   *
   * Alias for `ctx.update.callback_query`.
   *
   * @readonly
   * @public
   */
  get callbackQuery(): NonNullable<Context[`callbackQuery`]> {
    return super.callbackQuery as NonNullable<Context[`callbackQuery`]>
  }

  /**
   * The full {@link (Ctx:class).from} object from Telegram (non-nullable).
   *
   * @readonly
   * @public
   */
  get from(): NonNullable<Context[`from`]> {
    return super.from as NonNullable<Context[`from`]>
  }

  /**
   * The full {@link (Ctx:class).businessConnection} object from Telegram (non-nullable).
   *
   * Alias for `ctx.update.business_connection`.
   *
   * @readonly
   * @public
   */
  get businessConnection(): NonNullable<Context[`businessConnection`]> {
    return super.businessConnection as NonNullable<Context[`businessConnection`]>
  }

  /**
   * The full {@link (Ctx:class).businessMessage} object from Telegram (non-nullable).
   *
   * Alias for `ctx.update.business_message`.
   *
   * @readonly
   * @public
   */
  get businessMessage(): NonNullable<Context[`businessMessage`]> {
    return super.businessMessage as NonNullable<Context[`businessMessage`]>
  }

  /**
   * The full {@link (Ctx:class).channelPost} object from Telegram (non-nullable).
   *
   * Alias for `ctx.update.channel_post`.
   *
   * @readonly
   * @public
   */
  get channelPost(): NonNullable<Context[`channelPost`]> {
    return super.channelPost as NonNullable<Context[`channelPost`]>
  }

  /**
   * The full {@link (Ctx:class).chat} object from Telegram (non-nullable).
   *
   * @readonly
   * @public
   */
  get chat(): NonNullable<Context[`chat`]> {
    return super.chat as NonNullable<Context[`chat`]>
  }

  /**
   * The full {@link (Ctx:class).chatBoost} object from Telegram (non-nullable).
   *
   * Alias for `ctx.update.chat_boost`.
   *
   * @readonly
   * @public
   */
  get chatBoost(): NonNullable<Context[`chatBoost`]> {
    return super.chatBoost as NonNullable<Context[`chatBoost`]>
  }

  /**
   * The full {@link (Ctx:class).chatJoinRequest} object from Telegram (non-nullable).
   *
   * Alias for `ctx.update.chat_join_request`.
   *
   * @readonly
   * @public
   */
  get chatJoinRequest(): NonNullable<Context[`chatJoinRequest`]> {
    return super.chatJoinRequest as NonNullable<Context[`chatJoinRequest`]>
  }

  /**
   * The full {@link (Ctx:class).chatMember} object from Telegram (non-nullable).
   *
   * Alias for `ctx.update.chat_member`.
   *
   * @readonly
   * @public
   */
  get chatMember(): NonNullable<Context[`chatMember`]> {
    return super.chatMember as NonNullable<Context[`chatMember`]>
  }

  /**
   * The full {@link (Ctx:class).chosenInlineResult} object from Telegram (non-nullable).
   *
   * Alias for `ctx.update.chosen_inline_result`.
   *
   * @readonly
   * @public
   */
  get chosenInlineResult(): NonNullable<Context[`chosenInlineResult`]> {
    return super.chosenInlineResult as NonNullable<Context[`chosenInlineResult`]>
  }

  /**
   * The full {@link (Ctx:class).deletedBusinessMessages} object from Telegram (non-nullable).
   *
   * Alias for `ctx.update.deleted_business_messages`.
   *
   * @readonly
   * @public
   */
  get deletedBusinessMessages(): NonNullable<Context[`deletedBusinessMessages`]> {
    return super.deletedBusinessMessages as NonNullable<Context[`deletedBusinessMessages`]>
  }

  /**
   * The full {@link (Ctx:class).editedBusinessMessage} object from Telegram (non-nullable).
   *
   * Alias for `ctx.update.edited_business_message`.
   *
   * @readonly
   * @public
   */
  get editedBusinessMessage(): NonNullable<Context[`editedBusinessMessage`]> {
    return super.editedBusinessMessage as NonNullable<Context[`editedBusinessMessage`]>
  }

  /**
   * The full {@link (Ctx:class).editedChannelPost} object from Telegram (non-nullable).
   *
   * Alias for `ctx.update.edited_channel_post`.
   *
   * @readonly
   * @public
   */
  get editedChannelPost(): NonNullable<Context[`editedChannelPost`]> {
    return super.editedChannelPost as NonNullable<Context[`editedChannelPost`]>
  }

  /**
   * The full {@link (Ctx:class).editedMessage} object from Telegram (non-nullable).
   *
   * Alias for `ctx.update.edited_message`.
   *
   * @readonly
   * @public
   */
  get editedMessage(): NonNullable<Context[`editedMessage`]> {
    return super.editedMessage as NonNullable<Context[`editedMessage`]>
  }

  /**
   * The full {@link (Ctx:class).guestMessage} object from Telegram (non-nullable).
   *
   * Alias for `ctx.update.guest_message`.
   *
   * @readonly
   * @public
   */
  get guestMessage(): NonNullable<Context[`guestMessage`]> {
    return super.guestMessage as NonNullable<Context[`guestMessage`]>
  }

  /**
   * The full {@link (Ctx:class).inlineQuery} object from Telegram (non-nullable).
   *
   * Alias for `ctx.update.inline_query`.
   *
   * @readonly
   * @public
   */
  get inlineQuery(): NonNullable<Context[`inlineQuery`]> {
    return super.inlineQuery as NonNullable<Context[`inlineQuery`]>
  }

  /**
   * The full {@link (Ctx:class).managedBot} object from Telegram (non-nullable).
   *
   * Alias for `ctx.update.managed_bot`.
   *
   * @readonly
   * @public
   */
  get managedBot(): NonNullable<Context[`managedBot`]> {
    return super.managedBot as NonNullable<Context[`managedBot`]>
  }

  /**
   * The full {@link (Ctx:class).messageReaction} object from Telegram (non-nullable).
   *
   * Alias for `ctx.update.message_reaction`.
   *
   * @readonly
   * @public
   */
  get messageReaction(): NonNullable<Context[`messageReaction`]> {
    return super.messageReaction as NonNullable<Context[`messageReaction`]>
  }

  /**
   * The full {@link (Ctx:class).poll} object from Telegram (non-nullable).
   *
   * Alias for `ctx.update.poll`.
   *
   * @readonly
   * @public
   */
  get poll(): NonNullable<Context[`poll`]> {
    return super.poll as NonNullable<Context[`poll`]>
  }

  /**
   * The full {@link (Ctx:class).pollAnswer} object from Telegram (non-nullable).
   *
   * Alias for `ctx.update.poll_answer`.
   *
   * @readonly
   * @public
   */
  get pollAnswer(): NonNullable<Context[`pollAnswer`]> {
    return super.pollAnswer as NonNullable<Context[`pollAnswer`]>
  }

  /**
   * The full {@link (Ctx:class).preCheckoutQuery} object from Telegram (non-nullable).
   *
   * Alias for `ctx.update.pre_checkout_query`.
   *
   * @readonly
   * @public
   */
  get preCheckoutQuery(): NonNullable<Context[`preCheckoutQuery`]> {
    return super.preCheckoutQuery as NonNullable<Context[`preCheckoutQuery`]>
  }

  /**
   * The full {@link (Ctx:class).purchasedPaidMedia} object from Telegram (non-nullable).
   *
   * Alias for `ctx.update.purchased_paid_media`.
   *
   * @readonly
   * @public
   */
  get purchasedPaidMedia(): NonNullable<Context[`purchasedPaidMedia`]> {
    return super.purchasedPaidMedia as NonNullable<Context[`purchasedPaidMedia`]>
  }

  /**
   * The full {@link (Ctx:class).removedChatBoost} object from Telegram (non-nullable).
   *
   * Alias for `ctx.update.removed_chat_boost`.
   *
   * @readonly
   * @public
   */
  get removedChatBoost(): NonNullable<Context[`removedChatBoost`]> {
    return super.removedChatBoost as NonNullable<Context[`removedChatBoost`]>
  }

  /**
   * The full {@link (Ctx:class).senderChat} object from Telegram (non-nullable).
   *
   * @readonly
   * @public
   */
  get senderChat(): NonNullable<Context[`senderChat`]> {
    return super.senderChat as NonNullable<Context[`senderChat`]>
  }

  /**
   * The combined first and last name from the user's Telegram profile.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   // this.from.first_name = "Alya"
   *   // this.from.last_name = "Putri"
   *   console.log(this.fromFullName) // "Alya Putri"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get fromFullName() {
    return `${this.from?.first_name} ${this.from?.last_name || ``}`
  }

  /**
   * All arg tokens parsed from message text.
   *
   * @remarks
   * Splits the message text by space separator starting from the configured position.
   *
   * @example
   * ```typescript
   * // Message: "start 123 456"
   * async handleArgsText() {
   *   console.log(this.msgTextArgs) // ["123", "456"]
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgTextArgs() {
    return this.getArgs(this.msg?.text, `space`, this.data?._positionArgText || this.temp?.data?._positionArgText)
  }

  /**
   * The first arg token parsed from message text.
   *
   * @example
   * ```typescript
   * // Message: "start 123 456"
   * async handleArgsText() {
   *   console.log(this.msgTextArg) // "123"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgTextArg() {
    return this.msgTextArgs[0] as string
  }

  /**
   * All arg tokens from a command message.
   *
   * @remarks
   * Splits the message text by space separator starting from position 1.
   *
   * @example
   * ```typescript
   * // Message: "/start 123 456"
   * async handleCommandArgsText() {
   *   console.log(this.msgTextCommandArgs) // ["123", "456"]
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgTextCommandArgs() {
    return this.getArgs(this.msg?.text, `space`)
  }

  /**
   * The first arg token from a command message.
   *
   * @example
   * ```typescript
   * // Message: "/start 123"
   * async handleCommandArgsText() {
   *   console.log(this.msgTextCommandArg) // "123"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgTextCommandArg() {
    return this.msgTextCommandArgs[0] as string
  }

  /**
   * All arg tokens parsed from caption text.
   *
   * @example
   * ```typescript
   * // Caption: "start 123 456"
   * async handleCaptionArgsPhoto() {
   *   console.log(this.msgCaptionArgs) // ["123", "456"]
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgCaptionArgs() {
    return this.getArgs(this.msg?.caption, `space`)
  }

  /**
   * The first arg token from caption text.
   *
   * @example
   * ```typescript
   * // Caption: "start 123 456"
   * async handleCaptionArgsPhoto() {
   *   console.log(this.msgCaptionArg) // "123"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgCaptionArg() {
    return this.msgCaptionArgs[0] as string
  }

  /**
   * All arg tokens from a caption command.
   *
   * @example
   * ```typescript
   * // Caption: "/photo 123 456"
   * async handleCommandCaptionArgsPhoto() {
   *   console.log(this.msgCommandCaptionArgs) // ["123", "456"]
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgCommandCaptionArgs() {
    return this.getArgs(this.msg?.caption, `space`)
  }

  /**
   * The first arg token from a caption command.
   *
   * @example
   * ```typescript
   * // Caption: "/photo 123"
   * async handleCommandCaptionArgsPhoto() {
   *   console.log(this.msgCommandCaptionArg) // "123"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get msgCommandCaptionArg() {
    return this.msgCommandCaptionArgs[0] as string
  }

  /**
   * All arg tokens parsed from callback data.
   *
   * @remarks
   * Splits the callback data by colon separator.
   *
   * @example
   * ```typescript
   * // Callback: "menu:settings:ok"
   * async handleArgsCallback() {
   *   console.log(this.callbackQueryDataArgs) // ["settings", "ok"]
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get callbackQueryDataArgs() {
    return this.getArgs(this.callbackQuery?.data, `colon`)
  }

  /**
   * The first arg token parsed from callback data.
   *
   * @example
   * ```typescript
   * // Data: "menu:settings:ok"
   * async handleArgsCallback() {
   *   console.log(this.callbackQueryDataArg) // "settings"
   * }
   * ```
   *
   * @readonly
   * @public
   */
  get callbackQueryDataArg() {
    return this.callbackQueryDataArgs?.[0] as string
  }

  /**
   * External cache for session storage.
   *
   * @public
   */
  cacheSession: CacheExternal<ITCacheRpc>

  /**
   * Cache for keyboard instances.
   *
   * @public
   */
  cacheKeyboard: Map<string, unknown>

  /**
   * Template manager for message rendering.
   *
   * @public
   */
  templateManager: TemplateManager

  /**
   * Logger instance from Gramstax, for runtime warnings.
   *
   * @public
   */
  log: LoggingHelper | null | undefined

  /**
   * Temporary state storage for the current request.
   *
   * @public
   */
  temp: ITTemp

  /**
   * Per-request session fetch memoization.
   *
   * @remarks
   * Caches the result of `getSession()` for the lifetime of the current
   * request so repeated calls within one update do not hit the external
   * session cache (Redis/SaaS) again.
   *
   * - `sessionLoaded` — `true` once the session has been read or written in
   *   this request. When `true`, `getSession()` returns `sessionValue`
   *   without contacting the external cache.
   * - `sessionValue` — the memoized session payload, or `null` when no
   *   session exists for the current user/chat.
   *
   * @internal
   */
  memoization: {sessionLoaded: boolean; sessionValue: ITCacheRpc | null} = {sessionLoaded: false, sessionValue: null}

  /**
   * Tracks per-request Api instances where the answer guard transformer has already been installed
   * @internal
   */
  static readonly _answerApiGuard = new WeakSet<object>()

  /**
   * Creates a new Ctx instance.
   *
   * **note:**
   * For most pages do not define a constructor
   *
   * @param params - The initialization parameters. See {@link ITCtxParams} for details.
   *
   * @public
   */
  constructor(params: ITCtxParams) {
    const ct: ITCt = params.ct ?? (params as unknown as ITCt)
    super(ct.update, ct.api, ct.me)
    if (this.api?.config?.use && !Ctx._answerApiGuard.has(this.api)) {
      Ctx._answerApiGuard.add(this.api)
      this.api.config.use((prev, method, payload, signal) => {
        this.temp.isAnswer = Ctx.ANSWER_API_METHODS.has(method)
        return prev(method, payload, signal)
      })
    }
    this.cacheSession = params.cacheSession
    this.cacheKeyboard = params.cacheKeyboard
    this.templateManager = params.templateManager
    this.log = params.log
    this.temp = params.temp
  }

  /**
   * Page-level hook before route handler execution.
   *
   * @remarks
   * Return `false` to **skip only the target route handler** (e.g.
   * `handleFreeText`, `handleCallbackQueryData`, etc.). The rest of the
   * framework is untouched — you can still call `.render()`, `.renderEdit()`,
   * `.renderAnswerCallback()`, and other Ctx methods normally inside
   * this hook before returning `false`.
   *
   * In other words: returning `false` does NOT freeze the page — it
   * only prevents one specific handler from running.
   *
   * Useful for:
   * - Per-page cooldown / rate limiting (reply "please wait" then abort)
   * - Precondition checks (reply with redirect page then abort)
   * - Session validity gates
   *
   * @returns `true` to continue (handler runs), `false` to abort (handler skipped).
   *
   * @example
   * ```typescript
   * // Cooldown — reply then abort the handler
   * async hookBeforeRoute() {
   *   const last = await this.cacheSession.get(`${this.from.id}:lastAction`)
   *   if (last && Date.now() - Number(last) < 2000) {
   *     await this.renderAnswerCallback(`Please wait...`) // still works
   *     return false // only skips the target handler
   *   }
   *   await this.cacheSession.set(`${this.from.id}:lastAction`, String(Date.now()))
   *   return true
   * }
   * ```
   *
   * @example
   * ```typescript
   * // KYC gate — send redirect page then abort
   * async hookBeforeRoute() {
   *   const profile = await this.db.getUser(this.from.id)
   *   if (!profile?.kycVerified) {
   *     await new KycPage(this).showForm() // redirect works
   *     return false // only skips the guarded handler
   *   }
   *   return true
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async hookBeforeRoute?(): Promise<boolean>

  /**
   * Page-level hook after a route handler execution.
   *
   * @remarks
   * Always runs after the handler returns (even when the handler returns
   * undefined / null). Ideal for cleanup, analytics, or chained side effects.
   *
   * Useful for:
   * - Recording page visit timestamps
   * - Auto-clearing stale session data
   * - Firing post-processing jobs
   *
   * @example
   * ```typescript
   * // Notify admins of high-value actions
   * async hookAfterRoute() {
   *   if (this.temp.session?.params.amount > 10000) {
   *     await this.api.sendMessage(ADMIN_CHAT_ID, `Large withdrawal: ${this.temp.session.amount}`)
   *   }
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async hookAfterRoute?(): Promise<void>

  /**
   * Sends a message to multiple users in bulk.
   *
   * @remarks
   * Automatically throttles after 30 messages to respect Telegram rate limits.
   * Uses each user's specified language code for template rendering.
   *
   * @param ids - Array of user IDs to send the message to.
   * @param languageCode - Array of language codes corresponding to each user.
   * @param keyboard - Optional keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block message (or null to use default).
   * @param options - Optional send options (or null to omit).
   * @param throwError - If true, throws errors instead of swallowing them (or null to use false).
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   const userIds = [123456, 789012]
   *   const langs = ["en", "id"]
   *   await this.renderBroadcast(userIds, langs)
   * }
   * ```
   *
   * @public
   */
  async renderBroadcast(
    ids: number[],
    languageCode: string[],
    keyboard?: ITInBoKb | null,
    data?: ITData | null,
    AGBaseId?: string | null,
    options?: ITOptReply | null,
    throwError: boolean | null = false,
    chunkSize: number | null = null,
    chunkDelayMs: number | null = null,
    excludeIds: number[] | null = null
  ) {
    const res = {successCount: 0, failedCount: 0, totalCount: 0, skippedCount: 0}
    res.totalCount = ids.length
    const limitFree = 30
    const excluded = excludeIds !== null && excludeIds.length > 0 ? new Set(excludeIds) : null
    const msgs = languageCode.map((it) => this.templateManager.getGMessage(this.data.name, AGBaseId ?? undefined, it, data ?? undefined))
    let firstError: unknown
    for (let index = 0; index < ids.length; index++) {
      const id = ids[index]
      if (excluded?.has(id!)) {
        res.skippedCount += 1
        continue
      }
      const msg = msgs[index] ?? msgs[msgs.length - 1]
      if (msg === undefined || msg === ``) {
        res.failedCount += 1
        continue
      }
      try {
        await this.api.sendMessage(id!, msg, {
          parse_mode: `HTML`,
          reply_markup: keyboard ?? undefined,
          ...(options ?? {})
        })
        res.successCount += 1
      } catch (error) {
        res.failedCount += 1
        firstError ??= error
      }
      if ((index + 1) % limitFree === 0) {
        await setTimeout(1200)
      } else if (chunkSize !== null && chunkSize > 0 && (index + 1) % chunkSize === 0 && index + 1 < ids.length) {
        await setTimeout(chunkDelayMs ?? 500)
      }
    }
    if (throwError && res.failedCount > 0) {
      throw {...res, err: firstError}
    }
    return res
  }

  /**
   * Sends a media message to multiple users in bulk.
   *
   * @remarks
   * Media type and arg are inferred from the template `<g-media>` block.
   * If a supported media type (`photo`, `video`, `audio`, `document`) uses a pipe-delimited
   * `src`, it is sent as a Telegram media group. Telegram media groups do not support
   * reply markup, so keyboards are ignored for grouped media.
   * Automatically throttles after 30 messages to respect Telegram rate limits.
   * Uses each user's specified language code for template rendering.
   *
   * @param ids - Array of user IDs to send the media to.
   * @param languageCode - Array of language codes corresponding to each user.
   * @param keyboard - Optional keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media (or null to use default).
   * @param options - Optional send options for the inferred media type (or null to omit).
   * @param throwError - If true, throws errors instead of swallowing them (or null to use false).
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   const userIds = [123456, 789012]
   *   const langs = ["en", "id"]
   *   await this.renderBroadcastMedia(userIds, langs)
   * }
   * ```
   *
   * @public
   */
  async renderBroadcastMedia(
    ids: number[],
    languageCode: string[],
    keyboard?: ITInBoKb | null,
    data?: ITData | null,
    AGBaseId?: string | null,
    options?: ITOptReplyPhoto | ITOptReplyVideo | ITOptReplyAudio | ITOptReplyDocument | ITOptReplyAnimation | ITOptReplyVoice | ITOptReplyVideoNote | ITOptReplySticker | ITOptReplyLocation | ITOptReplyContact | null,
    throwError: boolean | null = false,
    chunkSize: number | null = null,
    chunkDelayMs: number | null = null,
    excludeIds: number[] | null = null
  ) {
    const res = {successCount: 0, failedCount: 0, totalCount: 0, skippedCount: 0}
    res.totalCount = ids.length
    const limitFree = 30
    const excluded = excludeIds !== null && excludeIds.length > 0 ? new Set(excludeIds) : null
    const medias = languageCode.map((it) => this.templateManager.getGMedia(this.data.name, AGBaseId ?? undefined, it, data ?? undefined))
    let firstError: unknown
    for (let index = 0; index < ids.length; index++) {
      const id = ids[index]
      if (excluded?.has(id!)) {
        res.skippedCount += 1
        continue
      }
      const med = medias[index] ?? medias[medias.length - 1]
      try {
        if (!med) {
          throw new Error(`Media not found for template "${this.data.name}"`)
        }
        const opt = {parse_mode: `HTML`, reply_markup: keyboard ?? undefined, ...(options ?? {})} as Record<string, unknown>

        if (med.type === `group` && med.mediaGroup && med.mediaGroup.length > 0) {
          await this.api.sendMediaGroup(id!, Helper.buildMediaGroupFromItems(med.mediaGroup, med.caption), Helper.buildMediaGroupOptions(opt))
        } else if (Helper.isMediaGroupType(med.type) && med.srcList && med.srcList.length > 1) {
          await this.api.sendMediaGroup(id!, Helper.buildMediaGroup(med.type, med.srcList, med.caption), Helper.buildMediaGroupOptions(opt))
        } else if (med.type === `photo`) await this.api.sendPhoto(id!, med.src!, {caption: med.caption!, ...opt})
        else if (med.type === `video`) await this.api.sendVideo(id!, med.src!, {caption: med.caption!, ...opt})
        else if (med.type === `audio`) await this.api.sendAudio(id!, med.src!, {caption: med.caption!, ...opt})
        else if (med.type === `document`) await this.api.sendDocument(id!, med.src!, {caption: med.caption!, ...opt})
        else if (med.type === `animation`) await this.api.sendAnimation(id!, med.src!, {caption: med.caption!, ...opt})
        else if (med.type === `voice`) await this.api.sendVoice(id!, med.src!, opt)
        else if (med.type === `video_note`) await this.api.sendVideoNote(id!, med.src!, opt)
        else if (med.type === `sticker`) await this.api.sendSticker(id!, med.src!, opt)
        else if (med.type === `location`) await this.api.sendLocation(id!, parseInt(med.latitude!), parseInt(med.longitude!), opt)
        else if (med.type === `contact`) await this.api.sendContact(id!, med.phone!, med.first_name!, {vcard: med.vcard!, ...opt})
        else throw new Error(`Unknown media type "${med.type}"`)

        res.successCount += 1
      } catch (error) {
        res.failedCount += 1
        firstError ??= error
      }
      if ((index + 1) % limitFree === 0) {
        await setTimeout(1200)
      } else if (chunkSize !== null && chunkSize > 0 && (index + 1) % chunkSize === 0 && index + 1 < ids.length) {
        await setTimeout(chunkDelayMs ?? 500)
      }
    }
    if (throwError && res.failedCount > 0) {
      throw {...res, err: firstError}
    }
    return res
  }

  /**
   * Sends a text message reply using the page template.
   *
   * @param keyboard - Optional keyboard markup from {@link (Ctx:class).inlineKeyboard} or {@link (Ctx:class).bottomKeyboard} (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template base ID position for block message (or null to use default).
   * @param options - Optional reply options (or null to omit).
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   // Automatic reply with content from this.template
   *   await this.render()
   *
   *   // With keyboard builder and data
   *   const kb = this.inlineKeyboard((k) => k.text("OK", "ok"))
   *   await this.render(kb, {name: "John"})
   *
   *   // With keyboard short and custom AGBaseId between reply and keyboard
   *   const kb = this.inlineKeyboardT([StartPage], `1`, "my-custom-id")
   *   await this.render(kb, {name: "John"}, "id-hello-world")
   * }
   * ```
   *
   * @public
   */
  async render(keyboard?: ITInBoKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptReply | null) {
    const msg = this.templateManager.getGMessage(this.data.name, AGBaseId ?? undefined, this.from?.language_code, data ?? undefined)
    return await this.reply(msg, {
      parse_mode: `HTML`,
      reply_markup: keyboard ?? undefined,
      ...(options ?? {})
    })
  }

  /**
   * Downloads the file attached to the current message.
   *
   * @remarks
   * Requires the `@grammyjs/files` plugin (`hydrateFiles` — mounted by
   * default in Gramstax). Without a path, the file is saved to a
   * temporary location and its path is returned; with a path, the file
   * is written there.
   *
   * **Security:** when `path` is supplied it must not contain NUL bytes
   * or `..` path segments. Absolute or traversal-like values throw — keep
   * downloads inside a dedicated directory (e.g. `os.tmpdir()` or
   * `process.cwd()/downloads`) and pass only a `basename`-derived name
   * when the name comes from user input. The no-arg form (tmp file) is
   * always safe.
   *
   * @param path - Optional destination file path.
   * @returns The saved file path.
   *
   * @public
   */
  async download(path?: string) {
    if (path !== undefined) {
      if (path.includes(`\0`)) throw new Error(`download path must not contain null bytes`)
      if (path.split(/[/\\]/).includes(`..`)) throw new Error(`download path must not contain ".." segments (got "${path}")`)
    }
    const file = await (this as unknown as FileFlavor<Ctx>).getFile()
    return file.download(path)
  }

  /**
   * Sends a rich message reply using the page template.
   *
   * @remarks
   * Uses `replyWithRichMessage` (Telegram Bot API {@link TemplateEngine.BOT_API_VERSION})
   * to send structured rich text with headings, lists, tables, media, block
   * quotations, collapsible blocks, footnotes, and formulas.
   *
   * The page template's `<g-message>` HTML content is passed as the `html` field
   * of `InputRichMessage`. Use the Bot API 10.2 Rich HTML tags in your template
   * (e.g. `<h1>`, `<table>`, `<blockquote>`) — they are validated by
   * {@link TemplateEngine.validateBlockGMessageRich}.
   *
   * Rich message limits:
   * - Up to 32,768 UTF-8 characters
   * - Up to 500 blocks
   * - Up to 16 nesting levels
   * - Up to 20 table columns
   *
   * @param keyboard - Optional keyboard markup from {@link (Ctx:class).inlineKeyboard} or {@link (Ctx:class).bottomKeyboard} (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template base ID position for block message (or null to use default).
   * @param options1 - Optional `InputRichMessage` fields (`is_rtl`, `skip_entity_detection`) (or null to omit).
   * @param options2 - Optional send options (or null to omit).
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   // Rich message with template content
   *   await this.renderRich()
   *
   *   // With keyboard and data
   *   const kb = this.inlineKeyboard((k) => k.text("OK", "ok"))
   *   await this.renderRich(kb, {name: "John"})
   * }
   * ```
   *
   * @public
   */
  async renderRich(keyboard?: ITInBoKb | null, data?: ITData | null, AGBaseId?: string | null, options1?: ITOptReplyRich[0] | null, options2?: ITOptReplyRich[1] | null) {
    const msg = this.templateManager.getGMessage(this.data.name, AGBaseId ?? undefined, this.from?.language_code, data ?? undefined)
    return await this.replyWithRichMessage(
      {html: msg, ...(options1 ?? {})},
      {
        reply_markup: keyboard ?? undefined,
        ...(options2 ?? {})
      }
    )
  }

  /**
   * Sends or edits a rich message using the page template, auto-selecting
   * between {@link (Ctx:class).renderRich} and {@link (Ctx:class).renderEditRich},
   * auto-detected from `!!this.callbackQuery`.
   *
   * @param keyboard - Optional keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template base ID (or null to use default).
   * @param options1 - Optional `InputRichMessage` fields (or null to omit).
   * @param options2 - Optional send/edit options (or null to omit).
   * @param fallbackEdit - Fallback when the edit fails:
   *                        `delete-reply` (default) deletes the original message and sends a new one; `reply` sends without deleting; `disable` rethrows.
   * @returns The sent or edited message object.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   await this.renderAutoRich()
   * }
   * ```
   *
   * @public
   */
  async renderAutoRich(keyboard?: ITInBoKb | null, data?: ITData | null, AGBaseId?: string | null, options1?: ITOptReplyRich[0] | null, options2?: ITOptReplyRich[1] | ITOptEdit | null, fallbackEdit: ITOptFallbackEdit = `delete-reply`) {
    const edit = !!this.callbackQuery
    if (edit) {
      return await this.renderEditRich(keyboard as ITInlineKb, data, AGBaseId, options1, options2 as unknown as ITOptEdit, fallbackEdit)
    }
    return await this.renderRich(keyboard, data, AGBaseId, options1, options2 as ITOptReplyRich[1])
  }

  /**
   * Edits an existing message with rich content using the page template.
   *
   * @remarks
   * Uses `editMessageText` with an `InputRichMessage` payload (Telegram Bot API
   * {@link TemplateEngine.BOT_API_VERSION}). This method can edit both text and
   * rich messages — pass a rich HTML template and it will be sent as structured
   * rich content.
   *
   * If editing fails (e.g. message too old), the fallback behavior is controlled
   * by `fallbackEdit` (default `delete-reply`: deletes the original message and
   * sends a new rich reply — the result looks like an in-place edit).
   *
   * Rich message limits:
   * - Up to 32,768 UTF-8 characters
   * - Up to 500 blocks
   * - Up to 16 nesting levels
   * - Up to 20 table columns
   *
   * @param keyboardInline - Optional inline keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template base ID position for block message (or null to use default).
   * @param options1 - Optional `InputRichMessage` fields (`is_rtl`, `skip_entity_detection`) (or null to omit).
   * @param options2 - Optional edit options (or null to omit).
   * @param fallbackEdit - Fallback when the edit fails: `delete-reply` (default) deletes
   *                        the original message then sends a new one; `reply` sends without
   *                        deleting; `disable` rethrows the error.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   const kb = this.inlineKeyboard((k) => k.text("OK", "ok"))
   *   await this.renderEditRich(kb, {status: "updated"})
   * }
   * ```
   *
   * @public
   */
  async renderEditRich(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options1?: ITOptReplyRich[0] | null, options2?: ITOptEdit | null, fallbackEdit: ITOptFallbackEdit = `delete-reply`) {
    try {
      const msg = this.templateManager.getGMessage(this.data.name, AGBaseId ?? undefined, this.from?.language_code, data ?? undefined)
      return await this.editMessageText(
        {html: msg, ...(options1 ?? {})},
        {
          reply_markup: keyboardInline ?? undefined,
          ...(options2 ?? {})
        }
      )
    } catch (error) {
      if (fallbackEdit === `disable`) {
        throw error
      }
      if (fallbackEdit === `delete-reply`) {
        try {
          await this.deleteMessage()
        } catch {
          // delete failure (e.g. already deleted) must not block the fallback reply
        }
      }
      return await this.renderRich(keyboardInline, data, AGBaseId, options1, options2)
    }
  }

  /**
   * Sends a media message reply with dynamic type selection.
   *
   * @remarks
   * This is the base method for all media reply methods. Use specific methods
   * like {@link (Ctx:class).renderPhoto} or {@link (Ctx:class).renderVideo} for simpler usage.
   *
   * @typeParam T - The media type to send.
   * @param type - The media type (photo, video, audio, document, animation, voice, video_note, sticker, location, contact).
   * @param keyboard - Optional keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media (or null to use default).
   * @param options - Type-specific options for the media (or null to omit).
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   await this.renderMedia("photo")
   * }
   * ```
   *
   * @public
   */
  async renderMedia<T extends Exclude<ITMediaBlock[`type`], `group`>>(
    type: T,
    keyboard?: ITInBoKb | null,
    data?: ITData | null,
    AGBaseId?: string | null,
    options?:
      | (T extends `photo`
          ? ITOptReplyPhoto
          : T extends `video`
            ? ITOptReplyVideo
            : T extends `audio`
              ? ITOptReplyAudio
              : T extends `document`
                ? ITOptReplyDocument
                : T extends `animation`
                  ? ITOptReplyAnimation
                  : T extends `voice`
                    ? ITOptReplyVoice
                    : T extends `video_note`
                      ? ITOptReplyVideoNote
                      : T extends `sticker`
                        ? ITOptReplySticker
                        : T extends `location`
                          ? ITOptReplyLocation
                          : T extends `contact`
                            ? ITOptReplyContact
                            : undefined)
      | null
  ) {
    const med = this.templateManager.getGMedia(this.data.name, AGBaseId ?? undefined, this.from?.language_code, data ?? undefined)
    const opt = {parse_mode: `HTML`, reply_markup: keyboard ?? undefined, ...(options ?? {})} as Record<string, unknown>

    if (type === `photo`) return await this.replyWithPhoto(med.src!, {caption: med.caption!, ...opt})
    if (type === `video`) return await this.replyWithVideo(med.src!, {caption: med.caption!, ...opt})
    if (type === `audio`) return await this.replyWithAudio(med.src!, {caption: med.caption!, ...opt})
    if (type === `document`) return await this.replyWithDocument(med.src!, {caption: med.caption!, ...opt})
    if (type === `animation`) return await this.replyWithAnimation(med.src!, {caption: med.caption!, ...opt})
    if (type === `voice`) return await this.replyWithVoice(med.src!, opt)
    if (type === `video_note`) return await this.replyWithVideoNote(med.src!, opt)
    if (type === `sticker`) return await this.replyWithSticker(med.src!, opt)
    if (type === `location`) return await this.replyWithLocation(parseInt(med.latitude!), parseInt(med.longitude!), opt)
    if (type === `contact`) return await this.replyWithContact(med.phone!, med.first_name!, {vcard: med.vcard!, ...opt})
  }

  /**
   * Sends a Telegram media group using pipe-delimited `src` values or a `<g-media-group>` block from the page template.
   *
   * @remarks
   * Only `photo`, `video`, `audio`, and `document` support Telegram media groups.
   * Omit `type` when the template uses `<g-media-group>` with per-item media types.
   * The first item receives the template caption. Telegram media groups do not support
   * reply markup, so keyboards are ignored for grouped media.
   *
   * @param type - Supported media group type. When the template uses `<g-media-group>` (or null to include all items).
   *   only items matching this type are included. When omitted, all items are sent.
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media (or null to use default).
   * @param options - Optional media-group send options (or null to omit).
   * @returns The sent media group messages.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   await this.renderMediaGroup("photo") // only send photo
   *   await this.renderMediaGroup() // send all media group
   * }
   * ```
   *
   * @public
   */
  async renderMediaGroup(type?: ITMediaGroupType | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptReplyPhoto | ITOptReplyVideo | ITOptReplyAudio | ITOptReplyDocument | null) {
    const med = this.templateManager.getGMedia(this.data.name, AGBaseId ?? undefined, this.from?.language_code, data ?? undefined)
    const opt = {parse_mode: `HTML`, ...(options ?? {})} as Record<string, unknown>
    if (med.type === `group` && med.mediaGroup && med.mediaGroup.length > 0) {
      const items = type ? med.mediaGroup.filter((item) => item.type === type) : med.mediaGroup
      if (items.length === 0) {
        throw new Error(`replyMediaGroup: no items of type "${type}" found in <g-media-group>`)
      }
      return await this.replyWithMediaGroup(Helper.buildMediaGroupFromItems(items, med.caption), Helper.buildMediaGroupOptions(opt))
    }
    if (!type) {
      throw new Error(`replyMediaGroup type is required when template media is not <g-media-group>`)
    }
    const srcList = med.srcList && med.srcList.length > 1 ? med.srcList : med.src ? [med.src] : []
    return await this.replyWithMediaGroup(Helper.buildMediaGroup(type, srcList, med.caption), Helper.buildMediaGroupOptions(opt))
  }

  /**
   * Sends a photo message using the page template.
   *
   * @param keyboard - Optional keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type photo (or null to use default).
   * @param options - Optional photo-specific options (or null to omit).
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   await this.renderPhoto()
   * }
   * ```
   *
   * @public
   */
  async renderPhoto(keyboard?: ITInBoKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptReplyPhoto | null) {
    return this.renderMedia(`photo`, keyboard, data, AGBaseId, options)
  }

  /**
   * Sends a photo media group using pipe-delimited `src` values from the page template.
   *
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type photo (or null to use default).
   * @param options - Optional photo-specific options (or null to omit).
   * @returns The sent media group messages.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.renderPhotoGroup()
   * }
   * ```
   *
   * @public
   */
  async renderPhotoGroup(data?: ITData | null, AGBaseId?: string | null, options?: ITOptReplyPhoto | null) {
    return this.renderMediaGroup(`photo`, data, AGBaseId, options)
  }

  /**
   * Sends a video message using the page template.
   *
   * @param keyboard - Optional keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type video (or null to use default).
   * @param options - Optional video-specific options (or null to omit).
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   await this.renderVideo()
   * }
   * ```
   *
   * @public
   */
  async renderVideo(keyboard?: ITInBoKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptReplyVideo | null) {
    return this.renderMedia(`video`, keyboard, data, AGBaseId, options)
  }

  /**
   * Sends a video media group using pipe-delimited `src` values from the page template.
   *
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type video (or null to use default).
   * @param options - Optional video-specific options (or null to omit).
   * @returns The sent media group messages.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.renderVideoGroup()
   * }
   * ```
   *
   * @public
   */
  async renderVideoGroup(data?: ITData | null, AGBaseId?: string | null, options?: ITOptReplyVideo | null) {
    return this.renderMediaGroup(`video`, data, AGBaseId, options)
  }

  /**
   * Sends an audio message using the page template.
   *
   * @param keyboard - Optional keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type audio (or null to use default).
   * @param options - Optional audio-specific options (or null to omit).
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   await this.renderAudio()
   * }
   * ```
   *
   * @public
   */
  async renderAudio(keyboard?: ITInBoKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptReplyAudio | null) {
    return this.renderMedia(`audio`, keyboard, data, AGBaseId, options)
  }

  /**
   * Sends an audio media group using pipe-delimited `src` values from the page template.
   *
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type audio (or null to use default).
   * @param options - Optional audio-specific options (or null to omit).
   * @returns The sent media group messages.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.renderAudioGroup()
   * }
   * ```
   *
   * @public
   */
  async renderAudioGroup(data?: ITData | null, AGBaseId?: string | null, options?: ITOptReplyAudio | null) {
    return this.renderMediaGroup(`audio`, data, AGBaseId, options)
  }

  /**
   * Sends a document message using the page template.
   *
   * @param keyboard - Optional keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type document (or null to use default).
   * @param options - Optional document-specific options (or null to omit).
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   await this.renderDocument()
   * }
   * ```
   *
   * @public
   */
  async renderDocument(keyboard?: ITInBoKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptReplyDocument | null) {
    return this.renderMedia(`document`, keyboard, data, AGBaseId, options)
  }

  /**
   * Sends a document media group using pipe-delimited `src` values from the page template.
   *
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type document (or null to use default).
   * @param options - Optional document-specific options (or null to omit).
   * @returns The sent media group messages.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.renderDocumentGroup()
   * }
   * ```
   *
   * @public
   */
  async renderDocumentGroup(data?: ITData | null, AGBaseId?: string | null, options?: ITOptReplyDocument | null) {
    return this.renderMediaGroup(`document`, data, AGBaseId, options)
  }

  /**
   * Sends an animation/GIF message using the page template.
   *
   * @param keyboard - Optional keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type animation (or null to use default).
   * @param options - Optional animation-specific options (or null to omit).
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   await this.renderAnimation()
   * }
   * ```
   *
   * @public
   */
  async renderAnimation(keyboard?: ITInBoKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptReplyAnimation | null) {
    return this.renderMedia(`animation`, keyboard, data, AGBaseId, options)
  }

  /**
   * Sends a voice message using the page template.
   *
   * @param keyboard - Optional keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type voice (or null to use default).
   * @param options - Optional voice-specific options (or null to omit).
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   await this.renderVoice()
   * }
   * ```
   *
   * @public
   */
  async renderVoice(keyboard?: ITInBoKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptReplyVoice | null) {
    return this.renderMedia(`voice`, keyboard, data, AGBaseId, options)
  }

  /**
   * Sends a video note (circular video) using the page template.
   *
   * @param keyboard - Optional keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type video_note (or null to use default).
   * @param options - Optional video note-specific options (or null to omit).
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   await this.renderVideoNote()
   * }
   * ```
   *
   * @public
   */
  async renderVideoNote(keyboard?: ITInBoKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptReplyVideoNote | null) {
    return this.renderMedia(`video_note`, keyboard, data, AGBaseId, options)
  }

  /**
   * Sends a sticker using the page template.
   *
   * @param keyboard - Optional keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type sticker (or null to use default).
   * @param options - Optional sticker-specific options (or null to omit).
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   await this.renderSticker()
   * }
   * ```
   *
   * @public
   */
  async renderSticker(keyboard?: ITInBoKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptReplySticker | null) {
    return this.renderMedia(`sticker`, keyboard, data, AGBaseId, options)
  }

  /**
   * Sends a location using the page template.
   *
   * @param keyboard - Optional keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type location (or null to use default).
   * @param options - Optional location-specific options (or null to omit).
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   await this.renderLocation()
   * }
   * ```
   *
   * @public
   */
  async renderLocation(keyboard?: ITInBoKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptReplyLocation | null) {
    return this.renderMedia(`location`, keyboard, data, AGBaseId, options)
  }

  /**
   * Sends a contact using the page template.
   *
   * @param keyboard - Optional keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type contact (or null to use default).
   * @param options - Optional contact-specific options (or null to omit).
   * @returns The sent message object.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   await this.renderContact()
   * }
   * ```
   *
   * @public
   */
  async renderContact(keyboard?: ITInBoKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptReplyContact | null) {
    return this.renderMedia(`contact`, keyboard, data, AGBaseId, options)
  }

  /**
   * Sends or edits a message using the page template, auto-selecting
   * between {@link (Ctx:class).render} and {@link (Ctx:class).renderEdit} based on
   * `!!this.callbackQuery`.
   *
   * @remarks
   * When a callback query is present, delegates to `renderEdit` (inline keyboard only).
   * Otherwise, delegates to `render` (inline or bottom keyboard).
   *
   * @param keyboard - Optional keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template base ID position for block message (or null to use default).
   * @param options - Optional reply/edit options (or null to omit).
   * @param fallbackEdit - Fallback when the edit fails:
   *                        `delete-reply` (default) deletes the original message and sends a new one; `reply` sends without deleting; `disable` rethrows.
   * @returns The sent or edited message object.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   const kb = this.inlineKeyboard((k) => k.text("OK", "ok"))
   *   // Auto-detect: callbackQuery exists → renderEdit
   *   await this.renderAuto(kb, {status: "updated"})
   * }
   * ```
   *
   * @public
   */
  async renderAuto(keyboard?: ITInBoKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptEdit | ITOptReply | null, fallbackEdit: ITOptFallbackEdit = `delete-reply`) {
    const edit = !!this.callbackQuery
    if (edit) {
      return await this.renderEdit(keyboard as ITInlineKb, data, AGBaseId, options as ITOptEdit, fallbackEdit)
    }
    return await this.render(keyboard, data, AGBaseId, options as ITOptReply)
  }

  /**
   * Sends or edits a media message using the page template, auto-selecting
   * between {@link (Ctx:class).renderMedia} and {@link (Ctx:class).renderEditMedia} based on
   * `!!this.callbackQuery`.
   *
   * @typeParam T - The media type (photo, video, audio, etc.)
   * @param type - The media type.
   * @param keyboard - Optional keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media (or null to use default).
   * @param options1 - Type-specific media options (or null to omit).
   * @param options2 - Additional edit options (or null to omit, send-only).
   * @param fallbackEdit - Fallback when the edit fails:
   *                        `delete-reply` (default) deletes the original message and sends a new one; `reply` sends without deleting; `disable` rethrows.
   * @returns The sent or edited message object.
   *
   * @public
   */
  async renderAutoMedia<T extends Exclude<ITMediaBlock[`type`], `group`>>(
    type: T,
    keyboard?: ITInBoKb | null,
    data?: ITData | null,
    AGBaseId?: string | null,
    options1?:
      | (T extends `photo`
          ? ITOptReplyPhoto
          : T extends `video`
            ? ITOptReplyVideo
            : T extends `audio`
              ? ITOptReplyAudio
              : T extends `document`
                ? ITOptReplyDocument
                : T extends `animation`
                  ? ITOptReplyAnimation
                  : T extends `voice`
                    ? ITOptReplyVoice
                    : T extends `video_note`
                      ? ITOptReplyVideoNote
                      : T extends `sticker`
                        ? ITOptReplySticker
                        : T extends `location`
                          ? ITOptReplyLocation
                          : T extends `contact`
                            ? ITOptReplyContact
                            : undefined)
      | null,
    options2?: ITOptEditMedia2 | null,
    fallbackEdit: ITOptFallbackEdit = `delete-reply`
  ) {
    const edit = !!this.callbackQuery
    if (edit) {
      return await this.renderEditMedia(type, keyboard as ITInlineKb, data, AGBaseId, options1 as never, options2, fallbackEdit)
    }
    return await this.renderMedia(type, keyboard, data, AGBaseId, options1)
  }

  /**
   * Sends or edits a media group message using the page template, auto-selecting
   * between {@link (Ctx:class).renderMediaGroup} and {@link (Ctx:class).renderEditMediaGroup} based on
   * `!!this.callbackQuery`.
   *
   * @param type - Optional media group type (or null for all items in `<g-media-group>`).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media (or null to use default).
   * @param options - Optional media-group send options (or null to omit).
   * @returns The sent media group messages.
   *
   * @public
   */
  async renderAutoMediaGroup(type?: ITMediaGroupType | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptReplyPhoto | ITOptReplyVideo | ITOptReplyAudio | ITOptReplyDocument | null) {
    const edit = !!this.callbackQuery
    if (edit) {
      return await this.renderEditMediaGroup(type, data, AGBaseId, options)
    }
    return await this.renderMediaGroup(type, data, AGBaseId, options)
  }

  /**
   * Edits an existing message text using the page template.
   *
   * @remarks
   * If editing fails (e.g., message too old), the fallback behavior is controlled
   * by `fallbackEdit` (default `delete-reply`: deletes the original message and
   * sends a new one — the result looks like an in-place edit).
   *
   * @param keyboardInline - Optional inline keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block message (or null to use default).
   * @param options - Optional edit options (or null to omit).
   * @param fallbackEdit - Fallback when the edit fails: `delete-reply` (default) deletes
   *                        the original message then sends a new one; `reply` sends without
   *                        deleting; `disable` rethrows the error.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   const kb = this.inlineKeyboard((k) => k.text("OK", "ok"))
   *   await this.renderEdit(kb, {status: "updated"}) // will edit message
   * }
   * ```
   *
   * @public
   */
  async renderEdit(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptEdit | null, fallbackEdit: ITOptFallbackEdit = `delete-reply`) {
    try {
      const msg = this.templateManager.getGMessage(this.data.name, AGBaseId ?? undefined, this.from?.language_code, data ?? undefined)
      return await this.editMessageText(msg, {
        parse_mode: `HTML`,
        reply_markup: keyboardInline ?? undefined,
        ...(options ?? {})
      })
    } catch (error) {
      if (fallbackEdit === `disable`) {
        throw error
      }
      if (fallbackEdit === `delete-reply`) {
        try {
          await this.deleteMessage()
        } catch {
          // delete failure (e.g. already deleted) must not block the fallback reply
        }
      }
      return await this.render(keyboardInline, data, AGBaseId, options)
    }
  }

  /**
   * Edits an existing media message with dynamic type selection.
   *
   * @remarks
   * For media types that cannot be edited (voice, video_note, sticker, location, contact),
   * the original message is deleted and a new one is sent. Multi-src media groups cannot
   * replace a single message, so supported pipe-delimited media groups also delete the
   * original message and send a new media group.
   *
   * If the edit itself fails, the fallback behavior is controlled by `fallbackEdit`
   * (default `delete-reply`: deletes the original message and re-sends the same media —
   * the result looks like an in-place edit).
   *
   * @typeParam T - The media type to edit to.
   * @param type - The media type.
   * @param keyboardInline - Optional inline keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media (or null to use default).
   * @param options1 - Type-specific media options (or null to omit).
   * @param options2 - Additional edit options (or null to omit).
   * @param fallbackEdit - Fallback when the edit fails: `delete-reply` (default) deletes
   *                        the original message then re-sends the media; `reply` sends without
   *                        deleting; `disable` rethrows the error.
   * @returns The edited/sent message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.renderEditMedia("photo")
   * }
   * ```
   *
   * @public
   */
  async renderEditMedia<T extends Exclude<ITMediaBlock[`type`], `group`>>(
    type: T,
    keyboardInline?: ITInlineKb | null,
    data?: ITData | null,
    AGBaseId?: string | null,
    options1?:
      | (T extends `voice`
          ? ITOptReplyVoice
          : T extends `video_note`
            ? ITOptReplyVideoNote
            : T extends `sticker`
              ? ITOptReplySticker
              : T extends `location`
                ? ITOptReplyLocation
                : T extends `contact`
                  ? ITOptReplyContact
                  : //
                    ITOptEditMedia1)
      | null,
    options2?: ITOptEditMedia2 | null,
    fallbackEdit: ITOptFallbackEdit = `delete-reply`
  ) {
    try {
      const med = this.templateManager.getGMedia(this.data.name, AGBaseId ?? undefined, this.from?.language_code, data ?? undefined)
      const {src, caption} = med
      if (Helper.isMediaGroupType(type) && med.srcList && med.srcList.length > 1) {
        await this.deleteMessage()
        return await this.renderMediaGroup(type, data, AGBaseId)
      }
      const commonOpt = {reply_markup: keyboardInline ?? undefined, ...(options1 ?? {})} as Record<string, unknown>
      if (type === `voice`) {
        await this.deleteMessage()
        return await this.api.sendVoice(this.chat?.id as number, src!, commonOpt)
      }
      if (type === `video_note`) {
        await this.deleteMessage()
        return await this.api.sendVideoNote(this.chat?.id as number, src!, commonOpt)
      }
      if (type === `sticker`) {
        await this.deleteMessage()
        return await this.api.sendSticker(this.chat?.id as number, src!, commonOpt)
      }
      if (type === `location`) {
        await this.deleteMessage()
        return await this.api.sendLocation(this.chat?.id as number, parseInt(med.latitude!), parseInt(med.longitude!), commonOpt)
      }
      if (type === `contact`) {
        await this.deleteMessage()
        return await this.api.sendContact(this.chat?.id as number, med.phone!, med.first_name!, {vcard: med.vcard!, ...commonOpt})
      }

      return await this.editMessageMedia(
        {
          media: src!,
          caption,
          type,
          parse_mode: `HTML`,
          ...(options1 ?? {})
        },
        {reply_markup: keyboardInline ?? undefined, ...(options2 ?? {})}
      )
    } catch (error) {
      if (fallbackEdit === `disable`) {
        throw error
      }
      if (fallbackEdit === `delete-reply`) {
        try {
          await this.deleteMessage()
        } catch {
          // delete failure (e.g. already deleted) must not block the fallback reply
        }
      }
      return await this.renderMedia(type, keyboardInline, data, AGBaseId)
    }
  }

  /**
   * Edits an existing message to show a photo.
   *
   * @param keyboardInline - Optional inline keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type photo (or null to use default).
   * @param options1 - Optional media options (or null to omit).
   * @param options2 - Optional edit options (or null to omit).
   * @param fallbackEdit - Fallback when the edit fails: `delete-reply` (default) deletes
   *                        the original message then sends a new one; `reply` sends without
   *                        deleting; `disable` rethrows the error.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.renderEditPhoto()
   * }
   * ```
   *
   * @public
   */
  async renderEditPhoto(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options1?: ITOptEditMedia1 | null, options2?: ITOptEditMedia2 | null, fallbackEdit: ITOptFallbackEdit = `delete-reply`) {
    return await this.renderEditMedia(`photo`, keyboardInline, data, AGBaseId, options1, options2, fallbackEdit)
  }

  /**
   * Edits an existing message to show a video.
   *
   * @param keyboardInline - Optional inline keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type video (or null to use default).
   * @param options1 - Optional media options (or null to omit).
   * @param options2 - Optional edit options (or null to omit).
   * @param fallbackEdit - Fallback when the edit fails: `delete-reply` (default) deletes
   *                        the original message then sends a new one; `reply` sends without
   *                        deleting; `disable` rethrows the error.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.renderEditVideo()
   * }
   * ```
   *
   * @public
   */
  async renderEditVideo(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options1?: ITOptEditMedia1 | null, options2?: ITOptEditMedia2 | null, fallbackEdit: ITOptFallbackEdit = `delete-reply`) {
    return await this.renderEditMedia(`video`, keyboardInline, data, AGBaseId, options1, options2, fallbackEdit)
  }

  /**
   * Edits an existing message to show an audio.
   *
   * @param keyboardInline - Optional inline keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type audio (or null to use default).
   * @param options1 - Optional media options (or null to omit).
   * @param options2 - Optional edit options (or null to omit).
   * @param fallbackEdit - Fallback when the edit fails: `delete-reply` (default) deletes
   *                        the original message then sends a new one; `reply` sends without
   *                        deleting; `disable` rethrows the error.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.renderEditAudio()
   * }
   * ```
   *
   * @public
   */
  async renderEditAudio(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options1?: ITOptEditMedia1 | null, options2?: ITOptEditMedia2 | null, fallbackEdit: ITOptFallbackEdit = `delete-reply`) {
    return await this.renderEditMedia(`audio`, keyboardInline, data, AGBaseId, options1, options2, fallbackEdit)
  }

  /**
   * Edits an existing message to show a document.
   *
   * @param keyboardInline - Optional inline keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type document (or null to use default).
   * @param options1 - Optional media options (or null to omit).
   * @param options2 - Optional edit options (or null to omit).
   * @param fallbackEdit - Fallback when the edit fails: `delete-reply` (default) deletes
   *                        the original message then sends a new one; `reply` sends without
   *                        deleting; `disable` rethrows the error.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.renderEditDocument()
   * }
   * ```
   *
   * @public
   */
  async renderEditDocument(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options1?: ITOptEditMedia1 | null, options2?: ITOptEditMedia2 | null, fallbackEdit: ITOptFallbackEdit = `delete-reply`) {
    return await this.renderEditMedia(`document`, keyboardInline, data, AGBaseId, options1, options2, fallbackEdit)
  }

  /**
   * Replaces the current message with a media group filtered by the given type.
   *
   * @remarks
   * Deletes the original message and sends a new media group via `replyMediaGroup`.
   * When `type` is omitted or `undefined`, all items in the `<g-media-group>` are sent.
   * For a hardcoded type, use the convenience methods (`editPhotoGroup`, `editVideoGroup`, etc.).
   *
   * @param type - Optional media type filter. All items sent when omitted.
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media (or null to use default).
   * @param options - Optional media-agnostic options (or null to omit).
   * @returns The sent media group messages.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   // send only photos
   *   await this.renderEditMediaGroup("photo")
   * }
   *
   * async handleShowAll() {
   *   // send all media-group items
   *   await this.renderEditMediaGroup()
   * }
   * ```
   *
   * @public
   */
  async renderEditMediaGroup(type?: ITMediaGroupType | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptReplyPhoto | ITOptReplyVideo | ITOptReplyAudio | ITOptReplyDocument | null) {
    try {
      await this.deleteMessage()
    } catch {
      // delete failure (e.g. already deleted) must not block sending the media group
    }
    return await this.renderMediaGroup(type, data, AGBaseId, options)
  }

  /**
   * Replaces the current message with a photo media group.
   *
   * @remarks
   * Deletes the original message and sends a new media group via `replyMediaGroup`.
   * Useful when the template uses pipe-delimited `src` values.
   *
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type photo (or null to use default).
   * @param options - Optional photo-specific options (or null to omit).
   * @returns The sent media group message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.renderEditPhotoGroup()
   * }
   * ```
   *
   * @public
   */
  async renderEditPhotoGroup(data?: ITData | null, AGBaseId?: string | null, options?: ITOptReplyPhoto | null) {
    return this.renderEditMediaGroup(`photo`, data, AGBaseId, options)
  }

  /**
   * Replaces the current message with a video media group.
   *
   * @remarks
   * Deletes the original message and sends a new media group via `replyMediaGroup`.
   * Useful when the template uses pipe-delimited `src` values.
   *
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type video (or null to use default).
   * @param options - Optional video-specific options (or null to omit).
   * @returns The sent media group message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.renderEditVideoGroup()
   * }
   * ```
   *
   * @public
   */
  async renderEditVideoGroup(data?: ITData | null, AGBaseId?: string | null, options?: ITOptReplyVideo | null) {
    return this.renderEditMediaGroup(`video`, data, AGBaseId, options)
  }

  /**
   * Replaces the current message with an audio media group.
   *
   * @remarks
   * Deletes the original message and sends a new media group via `replyMediaGroup`.
   * Useful when the template uses pipe-delimited `src` values.
   *
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type audio (or null to use default).
   * @param options - Optional audio-specific options (or null to omit).
   * @returns The sent media group message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.renderEditAudioGroup()
   * }
   * ```
   *
   * @public
   */
  async renderEditAudioGroup(data?: ITData | null, AGBaseId?: string | null, options?: ITOptReplyAudio | null) {
    return this.renderEditMediaGroup(`audio`, data, AGBaseId, options)
  }

  /**
   * Replaces the current message with a document media group.
   *
   * @remarks
   * Deletes the original message and sends a new media group via `replyMediaGroup`.
   * Useful when the template uses pipe-delimited `src` values.
   *
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type document (or null to use default).
   * @param options - Optional document-specific options (or null to omit).
   * @returns The sent media group message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.renderEditDocumentGroup()
   * }
   * ```
   *
   * @public
   */
  async renderEditDocumentGroup(data?: ITData | null, AGBaseId?: string | null, options?: ITOptReplyDocument | null) {
    return this.renderEditMediaGroup(`document`, data, AGBaseId, options)
  }

  /**
   * Edits an existing message to show an animation.
   *
   * @param keyboardInline - Optional inline keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type animation (or null to use default).
   * @param options1 - Optional media options (or null to omit).
   * @param options2 - Optional edit options (or null to omit).
   * @param fallbackEdit - Fallback when the edit fails: `delete-reply` (default) deletes
   *                        the original message then sends a new one; `reply` sends without
   *                        deleting; `disable` rethrows the error.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   await this.renderEditAnimation()
   * }
   * ```
   *
   * @public
   */
  async renderEditAnimation(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options1?: ITOptEditMedia1 | null, options2?: ITOptEditMedia2 | null, fallbackEdit: ITOptFallbackEdit = `delete-reply`) {
    return await this.renderEditMedia(`animation`, keyboardInline, data, AGBaseId, options1, options2, fallbackEdit)
  }

  /**
   * Replaces the current message with a voice message.
   *
   * @remarks
   * Voice messages cannot be edited in-place, so this deletes the original and sends a new one.
   *
   * @param keyboardInline - Optional inline keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type voice (or null to use default).
   * @param options - Optional edit options (or null to omit).
   * @param fallbackEdit - Fallback when the edit fails: `delete-reply` (default) deletes
   *                        the original message then sends a new one; `reply` sends without
   *                        deleting; `disable` rethrows the error.
   * @returns The sent message object.
   *
   * @public
   */
  async renderEditVoice(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptEditMedia2 | null, fallbackEdit: ITOptFallbackEdit = `delete-reply`) {
    return await this.renderEditMedia(`voice`, keyboardInline, data, AGBaseId, options, undefined, fallbackEdit)
  }

  /**
   * Replaces the current message with a video note.
   *
   * @remarks
   * Video notes cannot be edited in-place, so this deletes the original and sends a new one.
   *
   * @param keyboardInline - Optional inline keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type video_note (or null to use default).
   * @param options - Optional edit options (or null to omit).
   * @param fallbackEdit - Fallback when the edit fails: `delete-reply` (default) deletes
   *                        the original message then sends a new one; `reply` sends without
   *                        deleting; `disable` rethrows the error.
   * @returns The sent message object.
   *
   * @public
   */
  async renderEditVideoNote(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptEditMedia2 | null, fallbackEdit: ITOptFallbackEdit = `delete-reply`) {
    return await this.renderEditMedia(`video_note`, keyboardInline, data, AGBaseId, options, undefined, fallbackEdit)
  }

  /**
   * Replaces the current message with a sticker.
   *
   * @remarks
   * Stickers cannot be edited in-place, so this deletes the original and sends a new one.
   *
   * @param keyboardInline - Optional inline keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type sticker (or null to use default).
   * @param options - Optional edit options (or null to omit).
   * @param fallbackEdit - Fallback when the edit fails: `delete-reply` (default) deletes
   *                        the original message then sends a new one; `reply` sends without
   *                        deleting; `disable` rethrows the error.
   * @returns The sent message object.
   *
   * @public
   */
  async renderEditSticker(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptEditMedia2 | null, fallbackEdit: ITOptFallbackEdit = `delete-reply`) {
    return await this.renderEditMedia(`sticker`, keyboardInline, data, AGBaseId, options, undefined, fallbackEdit)
  }

  /**
   * Replaces the current message with a location.
   *
   * @remarks
   * Locations cannot be edited in-place, so this deletes the original and sends a new one.
   *
   * @param keyboardInline - Optional inline keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type location (or null to use default).
   * @param options - Optional edit options (or null to omit).
   * @param fallbackEdit - Fallback when the edit fails: `delete-reply` (default) deletes
   *                        the original message then sends a new one; `reply` sends without
   *                        deleting; `disable` rethrows the error.
   * @returns The sent message object.
   *
   * @public
   */
  async renderEditLocation(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptEditMedia2 | null, fallbackEdit: ITOptFallbackEdit = `delete-reply`) {
    return await this.renderEditMedia(`location`, keyboardInline, data, AGBaseId, options, undefined, fallbackEdit)
  }

  /**
   * Replaces the current message with a contact.
   *
   * @remarks
   * Contacts cannot be edited in-place, so this deletes the original and sends a new one.
   *
   * @param keyboardInline - Optional inline keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type contact (or null to use default).
   * @param options - Optional edit options (or null to omit).
   * @param fallbackEdit - Fallback when the edit fails: `delete-reply` (default) deletes
   *                        the original message then sends a new one; `reply` sends without
   *                        deleting; `disable` rethrows the error.
   * @returns The sent message object.
   *
   * @public
   */
  async renderEditContact(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptEditMedia2 | null, fallbackEdit: ITOptFallbackEdit = `delete-reply`) {
    return await this.renderEditMedia(`contact`, keyboardInline, data, AGBaseId, options, undefined, fallbackEdit)
  }

  sessionKey(): string {
    const userId = this.from?.id
    const chatId = this.chat?.id
    if (userId === undefined || userId === null) return `:${chatId ?? ``}`
    return `${userId}:${chatId ?? ``}`
  }

  /**
   * [LOW-LEVEL] Sets session data for the current user.
   *
   * @remarks
   * Low-level API. In most cases use the shorthand `setSession*` methods instead
   * (e.g. {@link (Ctx:class).setSessionFreeText}, {@link (Ctx:class).setSessionCallbackQueryData}).
   *
   * This method is only needed when:
   * - **Multi-session** — binding the same params to multiple route handlers at once:
   *   `setSession([methodSessionFreeVideo(), methodSessionFreeText()], params)`
   * - **Dynamic method name** — method string is computed at runtime
   *   rather than known at dev-time, so `methodSession*()` cannot be called.
   *
   * @param method - Route method name(s). Use `this.methodSession*()` helpers
   *   for type-safe names, not a hardcoded string.
   * @param params - The session parameters to store.
   * @param moreRoot - Additional root-level properties to merge.
   * @returns True if the session was set successfully, or null on error.
   *
   * @example
   * ```typescript
   * // ❌ Avoid — use setSessionFreeText({...}) instead
   * await this.setSession(this.methodSessionFreeText(), {step: "awaiting_name"})
   *
   * // ✅ Multi-session — bind one payload to two listeners
   * await this.setSession(
   *   [this.methodSessionFreeVideo(), this.methodSessionFreeText()],
   *   {mediaId: "abc123"}
   * )
   * ```
   *
   * @public
   */
  async setSession(method: string | string[], params?: Record<string, unknown>, moreRoot?: Record<string, unknown>) {
    try {
      const id = this.sessionKey()
      const value = {method, params, ...moreRoot}
      const result = await this.cacheSession.set(`${id}`, value)
      if (result) {
        this.temp.session = value
        this.memoization.sessionLoaded = true
        this.memoization.sessionValue = value as ITCacheRpc
      }
      return result
    } catch {
      return null
    }
  }

  /**
   * Retrieves session data for the current user.
   *
   * @remarks
   * Fetches the session from external cache and updates the local session property.
   *
   * @returns The session data, or null if not found or on error.
   *
   * @example
   * ```typescript
   *   const session = await this.getSession()
   *   if (session?.params?.step === "awaiting_name") {
   *     // Handle name input
   *   }
   * ```
   *
   * @public
   */
  async getSession(): Promise<ITCacheRpc | null> {
    if (this.memoization.sessionLoaded) return this.memoization.sessionValue
    this.memoization.sessionLoaded = true
    try {
      const id = this.sessionKey()
      const result = await this.cacheSession.get(`${id}`)
      this.memoization.sessionValue = result || null
      if (result) this.temp.session = result
      return this.memoization.sessionValue
    } catch {
      return null
    }
  }

  /**
   * Clears session data for the current user.
   *
   * @remarks
   * Removes the session from external cache and resets the local session property.
   * Uses the scoped `sessionKey()` (`user:chat`), matching `setSession`/`getSession`.
   * Sets `memoization.sessionLoaded` to `true` so a subsequent `getSession()`
   * within the same request returns `null` without re-hitting the external cache.
   *
   * @returns True if the session was cleared, or null on error.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   await this.clearSession()
   *   await this.render()
   * }
   * ```
   *
   * @public
   */
  async clearSession() {
    try {
      const userId = this.from?.id
      const chatId = this.chat?.id
      if (userId === undefined && chatId === undefined) return null
      const result = await this.cacheSession.delete(this.sessionKey())
      if (result) this.temp.session = {}
      this.memoization.sessionLoaded = true
      this.memoization.sessionValue = null
      return result
    } catch {
      return null
    }
  }

  // =============== build data
  /**
   * Creates page routing data configuration.
   *
   * @remarks
   * This method has multiple overloads:
   * - `buildData()` - Returns default page data with no args.
   * - `buildData(callbackQueryData)` - Returns intentCallbackQueryData + args.
   * - `buildData(options)` - Returns page data with custom options.
   *
   * The callback must return an array of arg values that will be joined
   * with the intent using colon separators.
   *
   * @typeParam C - The callback function type.
   * @param callbackQueryData - A function that returns arg values as an array.
   * @returns The page data configuration object.
   *
   * @example
   * ```typescript
   * class MyPage extends Ctx {
   *   // Simple callback arg
   *   static data = this.buildData((id: string) => [id])
   *
   *   // With custom intents
   *   static data = this.buildData({
   *     callbackQueryData: (action: string) => [action],
   *     intentText: "my_page",
   *     intentCommandText: "mycommand"
   *   })
   * }
   * ```
   *
   * @public
   */
  /**
   * Creates page routing data configuration with a callback function.
   *
   * @param callbackQueryData - A function that returns arg values as an array.
   * @returns The page data configuration object.
   *
   * @public
   */
  static buildData<C extends (...args: string[]) => Array<string | undefined>>(callbackQueryData: C): ITPageData<Parameters<C>>

  /**
   * Creates page routing data configuration with options.
   *
   * @param options - Configuration options (or null to use defaults). See {@link ITBuildDataOptions} for details.
   * @returns The page data configuration object.
   *
   * @public
   */
  static buildData<C extends (...args: string[]) => Array<string | undefined>>(options: ITBuildDataOptions<C> | null): ITPageData<Parameters<C>>

  /**
   * Creates page routing data configuration without a callback arg.
   *
   * @param options - Configuration options without `callbackQueryData` (or null to use defaults). See {@link ITBuildDataOptions} for details.
   * @returns The page data configuration object.
   *
   * @public
   */
  static buildData(options: ITBuildDataOptions | null): ITPageData<[]>

  /**
   * Creates default page routing data configuration.
   * @public
   */
  static buildData(): ITPageData<[]>
  static buildData(params?: unknown | null): ITPageData {
    const isFunc = typeof params === `function`
    const options = (isFunc ? {callbackQueryData: params} : (params ?? {})) as ITBuildDataOptions
    const cbd = options.callbackQueryData //as ((...args: string[]) => string) | null | undefined
    const addPld = this.prototype.addArgs.bind(this.prototype)
    const PageClass = this

    const name = options.name ?? ``

    // Normalize intentText — string or Record<string, string>
    const rawText = options.intentText ?? name
    const textIsObj = typeof rawText === `object`
    const intentText = textIsObj ? (rawText.default ?? name) : rawText
    const intentTextMap = textIsObj ? rawText : undefined

    // Normalize intentCommandText
    const rawCmdText = options.intentCommandText ?? name
    const cmdTextIsObj = typeof rawCmdText === `object`
    const intentCommandText = cmdTextIsObj ? (rawCmdText.default ?? name) : rawCmdText
    const intentCommandTextMap = cmdTextIsObj ? rawCmdText : undefined

    const data: ITPageData = {
      name,
      intentText,
      intentCommandText,
      intentCallbackQueryData: name,
      callbackQueryData: (cbd
        ? function (this: ITPageData, ...args: string[]): _KbCallbackData<typeof Ctx, string[]> {
            return {result: addPld(this.intentCallbackQueryData, `colon`, cbd(...args)), page: PageClass, args}
          }
        : function (this: ITPageData): _KbCallbackData<typeof Ctx, []> {
            return {result: this.intentCallbackQueryData, page: PageClass, args: []}
          }) as ITPageData[`callbackQueryData`],
      _positionArgText: intentText ? intentText.split(this.prototype.getSeperatorTag(`space`)).length : (undefined as unknown as number)
    }
    if (intentTextMap) data.intentTextMap = intentTextMap
    if (intentCommandTextMap) data.intentCommandTextMap = intentCommandTextMap
    return data
  }

  // =============== build keyboard
  /**
   * Helper method to arrange keyboard buttons in a grid layout.
   *
   * @remarks
   * Supports custom column configurations and special handling for the last row.
   *
   * @typeParam T - The keyboard type.
   * @param k - The keyboard instance.
   * @param l - Array of button labels.
   * @param layout - Layout format: "cols" or "cols-lastRow" (e.g., "2" or "3-2").
   * @param cb - Callback to create each button.
   * @returns The keyboard instance with buttons arranged.
   *
   * @example
   * ```typescript
   * const kb = this.keyboardCols(new InlineKeyboard(), ["A", "B", "C"], "2", (e, i) => {
   *   kb.text(e, `btn:${i}`)
   * })
   * ```
   *
   * @public
   */
  keyboardCols<T = unknown>(k: T, l: string[], layout: ITKbCols, cb: (e: string, i: number) => unknown): T {
    const [colsStr, lastRowStr] = layout.split(`-`)
    const cols = parseInt(colsStr!)
    const lastRow = lastRowStr ? parseInt(lastRowStr) : null
    const total = l.length
    const kb = k as unknown as {row: () => void}
    for (let index = 0; index < total; index++) {
      const e = l[index]!
      cb(e, index)

      // Jika tidak ada spesifikasi lastRow, pakai pola normal
      if (lastRow === null) {
        if ((index + 1) % cols === 0 && index < total - 1) {
          kb.row()
        }
      } else {
        // Ada spesifikasi lastRow
        const remainingButtons = total - (index + 1)

        // Jika sisa tombol sama dengan lastRow, row break sekarang
        if (remainingButtons === lastRow) {
          kb.row()
        }
        // Jika belum mencapai baris terakhir, pakai pola cols normal
        else if (remainingButtons > lastRow && (index + 1) % cols === 0) {
          kb.row()
        }
      }
    }
    return k
  }

  /**
   * Creates a bottom keyboard with template-based text buttons.
   *
   * @remarks
   * Shorthand for {@link (Ctx:class).bottomKeyboard} with automatic text button creation.
   *
   * @param layout - Layout format: "cols" or "cols-lastRow". Default: "1".
   * @param AGBaseId - Optional template base ID position for block keyboard. IMPORTANT: If a `<g-base id="...">` is defined in the template, you must set AGBaseId to the same value. Leaving AGBaseId as undefined in this case will cause errors (for example, keyboard bindings will not work). A common mistake is defining a g-base ID in the template but not reusing it in the keyboard configuration (or null to use default).
   * @param data - Optional template interpolation data (or null to omit).
   * @returns The bottom keyboard instance.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   const kb = this.bottomKeyboardT("2")
   *   await this.render(kb)
   * }
   * ```
   *
   * @public
   */
  bottomKeyboardT(layout: ITKbCols, AGBaseId?: string | null, data?: Record<string, unknown> | null): ITBottomKb
  bottomKeyboardT(PageDest: ITKbDest[], layout?: ITKbCols, AGBaseId?: string | null, data?: Record<string, unknown> | null): ITBottomKb
  bottomKeyboardT(PageDestOrLayout?: unknown, layout?: unknown, AGBaseId?: unknown, data?: unknown): ITBottomKb {
    // PageDest-based overload
    if (Array.isArray(PageDestOrLayout)) {
      const PageDest = PageDestOrLayout as ITKbDest[]
      const ly = (layout ?? `1`) as ITKbCols
      return this.bottomKeyboard(
        (k, a) => {
          return this.keyboardCols(k, a, ly, (_e, i) => {
            const page = PageDest[i]!
            const lang = this.from?.language_code
            if (typeof page !== `string`) {
              if (`result` in page && `page` in page && `args` in page) {
                const cb = page as unknown as _KbCallbackData
                k.text(cb.result)
              } else {
                k.text(Helper.resolvePageTextLang(page, lang))
              }
            } else {
              k.text(page)
            }
          })
        },
        {AGBaseId: (AGBaseId ?? undefined) as string | undefined, data: (data ?? undefined) as ITData | undefined}
      )
    }
    // Template-based overload (existing)
    const ly = (PageDestOrLayout ?? `1`) as ITKbCols
    return this.bottomKeyboard(
      (k, a) => {
        return this.keyboardCols(k, a, ly, (e) => k.text(e))
      },
      {AGBaseId: (AGBaseId ?? undefined) as string | undefined, data: (data ?? undefined) as ITData | undefined}
    )
  }

  /**
   * Creates an inline keyboard with template-based buttons linked to page destinations.
   *
   * @remarks
   * Shorthand for {@link (Ctx:class).inlineKeyboard} with automatic callback data from page destinations.
   *
   * @param PageDest - Array of page classes or callback data strings.
   * @param layout - Layout format: "cols" or "cols-lastRow". Default: "1".
   * @param AGBaseId - Optional template g-base ID position block keyboard. IMPORTANT: If a `<g-base id="...">` is defined in the template, you must set AGBaseId to the same value. Leaving AGBaseId as undefined in this case will cause errors (for example, keyboard bindings will not work). A common mistake is defining a base ID in the template but not reusing it in the keyboard configuration (or null to use default).
   * @param data - Optional template interpolation data (or null to omit).
   * @returns The inline keyboard instance.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   const kb = this.inlineKeyboardT([SettingsPage, HelpPage], "2")
   *   await this.render(kb)
   *
   *   // Or with arg
   *   const kb = this.inlineKeyboardT([SettingsPage.data.callbackQueryData(1), HelpPage.data.callbackQueryData(`hi`)], "2")
   *   await this.render(kb)
   *
   *   // Compare with builder for basic but not recomended because very long syntax, only use builder when needed.!
   *   this.inlineKeyboard((k, a) => k.text(SettingsPage.data.callbackQueryData(), a[0]!).text(HelpPage.data.callbackQueryData(), a[1]!))
   * }
   * ```
   *
   * @public
   */
  inlineKeyboardT(PageDest: ITKbDest[], layout: ITKbCols = `1`, AGBaseId?: string | null, data?: ITData | null) {
    return this.inlineKeyboard(
      (k, a) => {
        return this.keyboardCols(k, a, layout, (e, i) => {
          const page = PageDest[i]!
          if (typeof page !== `string`) {
            if (`result` in page && `page` in page && `args` in page) {
              const cb = page as unknown as _KbCallbackData
              k.text(e, cb.result)
              return
            }
            const PageClass = typeof page === `function` ? page : (page.constructor as typeof Ctx)
            Helper.ensurePageHasCallback(PageClass)
            const cb = (PageClass.data as unknown as {callbackQueryData: () => _KbCallbackData<typeof Ctx, []>}).callbackQueryData()
            k.text(e, cb.result)
            return
          }
          k.text(e, page)
        })
      },
      {AGBaseId: AGBaseId ?? undefined, data: data ?? undefined}
    )
  }

  /**
   * Creates an inline keyboard using a builder callback.
   *
   * @remarks
   * The callback receives the keyboard instance and an array of button labels
   * from the template. Supports optional caching for performance.
   *
   * @param callback - Builder function that receives keyboard and labels.
   * @param params - Optional parameters (or null to omit). {@link ITInlineKbParams} for details.
   * @returns The inline keyboard instance.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   const kb = this.inlineKeyboard((k, labels) => {
   *     labels.forEach((label, i) => k.text(label, `action:${i}`))
   *     return k
   *   })
   *   await this.render(kb)
   * }
   * ```
   *
   * @public
   */
  inlineKeyboard(callback: (k: ITInlineKb, l: string[]) => ITInlineKb, params?: ITInlineKbParams | null): ITInlineKb {
    const tkey = this.data.name
    if (params?.cache === true && !params?.data) {
      const key = `${tkey}:${params?.AGBaseId ?? `default`}:${this.from?.language_code ?? `default`}:i`
      const ckb = this.cacheKeyboard.get(key)
      if (!ckb) {
        const ikb = new GramstaxInlineKeyboard()
        const arr = this.templateManager.getGKeyboard(tkey, params?.AGBaseId ?? undefined, this.from?.language_code, `inline`, params?.data ?? undefined)
        const rkb = callback(ikb, arr)
        this.cacheKeyboard.set(key, rkb)
        return rkb
      }
      return ckb as ITInlineKb
    }
    const ikb = new GramstaxInlineKeyboard()
    const arr = this.templateManager.getGKeyboard(tkey, params?.AGBaseId ?? undefined, this.from?.language_code, `inline`, params?.data ?? undefined)
    const rkb = callback(ikb, arr)
    return rkb
  }

  /**
   * Creates a bottom (reply) keyboard using a builder callback.
   *
   * @remarks
   * The callback receives the keyboard instance and an array of button labels
   * from the template. Automatically applies `resized()` to the keyboard.
   *
   * @param callback - Builder function that receives keyboard and labels.
   * @param params - Optional parameters (or null to omit). {@link ITBottomKbParams} for details.
   * @returns The bottom keyboard instance.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   const kb = this.bottomKeyboard((k, labels) => {
   *     labels.forEach(label => k.text(label))
   *     return k
   *   })
   *   await this.render(kb)
   * }
   * ```
   *
   * @public
   */
  bottomKeyboard(callback: (k: ITBottomKb, l: string[]) => ITBottomKb, params?: ITBottomKbParams | null): ITBottomKb {
    const tkey = this.data.name
    if (params?.cache === true && !params?.data) {
      const key = `${tkey}:${params?.AGBaseId ?? `default`}:${this.from?.language_code ?? `default`}:b`
      const ckb = this.cacheKeyboard.get(key)
      if (!ckb) {
        const kb = new GramstaxKeyboard()
        const arr = this.templateManager.getGKeyboard(tkey, params?.AGBaseId ?? undefined, this.from?.language_code, `bottom`, params?.data ?? undefined)
        const rkb = callback(kb, arr)
        rkb.resized(true)
        this.cacheKeyboard.set(key, rkb)
        return rkb
      }
      return ckb as ITBottomKb
    }
    const kb = new GramstaxKeyboard()
    const arr = this.templateManager.getGKeyboard(tkey, params?.AGBaseId ?? undefined, this.from?.language_code, `bottom`, params?.data ?? undefined)
    const rkb = callback(kb, arr)
    rkb.resized()
    return rkb
  }

  // =============== manipulation string
  /**
   * Gets the separator character for the specified method.
   *
   * @param mtd - The separator method: "space" or "colon". Default: "space".
   * @returns The separator character (" " or ":").
   *
   * @public
   */
  getSeperatorTag(mtd: `space` | `colon` = `space`) {
    return mtd === `space` ? ` ` : `:`
  }

  /**
   * Checks if a string contains arg separators.
   *
   * @param str - The string to check.
   * @param mtd - The separator method.
   * @returns True if the string contains the separator.
   *
   * @public
   */
  haveArgs(str = ``, mtd: Parameters<typeof this.getSeperatorTag>[0]) {
    return str.includes(this.getSeperatorTag(mtd))
  }

  /**
   * Appends arg values to a string using the specified separator.
   *
   * @param str - The base string.
   * @param mtd - The separator method.
   * @param pld - Array of arg values to append.
   * @returns The string with appended args.
   *
   * @public
   */
  addArgs(str = ``, mtd: Parameters<typeof this.getSeperatorTag>[0], pld: Array<string | undefined>) {
    const sep = this.getSeperatorTag(mtd)
    let out = ``
    for (let i = 0; i < pld.length; i++) {
      const v = pld[i]
      if (v != null && v !== ``) {
        out += sep + v
      }
    }
    return str + out
  }

  /**
   * Extracts arg values from a string.
   *
   * @param str - The string containing args.
   * @param mtd - The separator method.
   * @param positionStart - Starting position for arg extraction. Default: 1.
   * @returns Array of extracted arg values.
   *
   * @public
   */
  getArgs(str = ``, mtd: Parameters<typeof this.getSeperatorTag>[0], positionStart: number = 1) {
    if (!str) return []
    const tag = this.getSeperatorTag(mtd)
    return str.split(tag).slice(positionStart)
  }

  /**
   * Extracts the intent portion from a string containing args.
   *
   * @param str - The string to extract intent from.
   * @param mtd - The separator method.
   * @param positionEnd - Number of segments to include in the intent. Default: 1.
   * @returns The intent string.
   *
   * @example
   * ```typescript
   * const intent = this.getIntent("start:123:456", "colon", 1)
   * console.log(intent) // "start"
   * ```
   *
   * @public
   */
  getIntent(str = ``, mtd: Parameters<typeof this.getSeperatorTag>[0], positionEnd: number = 1) {
    if (!str) return ``
    const tag = this.getSeperatorTag(mtd)
    const spl = str.split(tag)
    return positionEnd === 1 ? (spl[0] as string) : spl.slice(0, positionEnd).join(tag)
  }

  // =============== route function
  /**
   * Route handler for callback queries without args matching `intentCallbackQueryData`.
   *
   * @remarks Triggered by callback query data matching.
   *
   * @example this.callbackQueryData = "start".
   * ```typescript
   * async handleCallbackQueryData() {
   *    this.callbackQueryData // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCallbackQueryData?(): Promise<unknown>

  /**
   * Route handler for callback queries with args matching `intentCallbackQueryData`.
   *
   * @remarks Triggered by callback data with args.
   *
   * @example this.callbackQueryData = "start:123"
   * ```typescript
   * async handleArgsCallbackQueryData() {
   *    this.callbackQueryData // "start:123"
   *    this.callbackQueryDataArg // "123"
   *    this.callbackQueryDataArgs // ["123"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleArgsCallbackQueryData?(): Promise<unknown>

  /**
   * Route handler for text messages matching `intentText`.
   *
   * @remarks Triggered by exact text match.
   *
   * @example this.msgText = "start"
   * ```typescript
   * async handleText() {
   *    this.msgText // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleText?(): Promise<unknown>

  /**
   * Route handler for text messages with args match intent `intentText`.
   *
   * @remarks Triggered by text with space-separated args.
   *
   * @example this.msgText = "start 123 aaa"
   * ```typescript
   * async handleTextArgs() {
   *    this.msgText // "start 123 aaa"
   *    this.msgTextArg // "123"
   *    this.msgTextArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleArgsText?(): Promise<unknown>

  /**
   * Route handler for command messages match intent `intentCommandText`.
   *
   * @remarks Triggered by text with slash commands.
   *
   * @example this.msgText = "/start"
   * ```typescript
   * async handleCommandText() {
   *    this.msgText // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCommandText?(): Promise<unknown>

  /**
   * Route handler for command messages with args match intent `intentCommandText`.
   *
   * @remarks Triggered by text with commands slash with args.
   *
   * @example this.msgText = "/start 123 aaa"
   * ```typescript
   * async handleCommandTextArgs() {
   *    this.msgText // "/start 123 aaa"
   *    this.msgTextArg // "123"
   *    this.msgTextArg // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCommandArgsText?(): Promise<unknown>

  /**
   * Route handler for free-form text input.
   *
   * @remarks Triggered by any text not matching other routes, typically used with sessions.
   *
   * @example this.msgText = "hello gramstax, random: 12848s8283n183m"
   * ```typescript
   * async handleFreeText() {
   *    this.msgText // "hello gramstax, random: 12848s8283n183m"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeText?(): Promise<unknown>

  // photo
  /**
   * Route function for photoCaptio match intent `this.data.name`
   *
   * @remarks Triggered by photo with caption.
   *
   * @example this.data.name = "start" && this.msg?.photo
   * ```typescript
   * async handleCaptionPhoto() {
   *   this.msg?.photo // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionPhoto?(): Promise<unknown>

  /**
   * Route function for photoCaption with arg match intent `this.data.name`
   *
   * @remarks Triggered by photo with caption and with arg.
   *
   * @example this.data.name = "start 123 aaa" && this.msg?.photo
   * ```typescript
   * async handleCaptionArgsPhoto() {
   *   this.msg?.photo // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionArgsPhoto?(): Promise<unknown>

  /**
   * Route function for photoCaption with slash command match intent `this.data.name`
   *
   * @remarks Triggered by photo with caption command.
   *
   * @example this.data.name = "/start" && this.msg?.photo
   * ```typescript
   * async handleCommandCaptionPhoto() {
   *   this.msg?.photo // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   *
   */
  async handleCommandCaptionPhoto?(): Promise<unknown>

  /**
   * Route function for `handleCommandCaptionArgsPhoto` with slash command and arg match intent `this.data.name`
   *
   * @remarks Triggered by photo with caption command and args.
   *
   * @example this.data.name = "/start 123 aaa" && this.msg?.photo
   * ```typescript
   * async handleCommandCaptionArgsPhoto() {
   *   this.msg?.photo // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public */
  async handleCommandCaptionArgsPhoto?(): Promise<unknown>

  /**
   * Route handler for free-form photo input.
   *
   * @remarks Triggered by any photo not matching other routes, typically used with sessions.
   *
   * @example this.msg?.photo
   * ```typescript
   * async handleFreePhoto() {
   *    this.msg?.photo // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreePhoto?(): Promise<unknown>

  // video
  /**
   * Route function for videoCaption match intent `this.data.name`
   *
   * @remarks Triggered by video with caption.
   *
   * @example this.data.name = "start" && this.msg?.video
   * ```typescript
   * async handleCaptionVideo() {
   *   this.msg?.video // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionVideo?(): Promise<unknown>

  /**
   * Route function for `handleCaptionArgsVideo` with arg match intent `this.data.name`
   *
   * @remarks Triggered by video with caption and with arg.
   *
   * @example this.data.name = "start 123 aaa" && this.msg?.video
   * ```typescript
   * async handleCaptionArgsVideo() {
   *   this.msg?.video // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionArgsVideo?(): Promise<unknown>

  /**
   * Route function for videoCaption with slash command match intent `this.data.name`
   *
   * @remarks Triggered by video with caption command.
   *
   * @example this.data.name = "/start" && this.msg?.video
   * ```typescript
   * async handleCommandCaptionVideo() {
   *   this.msg?.video // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   *
   */
  async handleCommandCaptionVideo?(): Promise<unknown>

  /**
   * Route function for `handleCommandCaptionArgsVideo` with slash command and arg match intent `this.data.name`
   *
   * @remarks Triggered by video with caption command and args.
   *
   * @example this.data.name = "/start 123 aaa" && this.msg?.video
   * ```typescript
   * async handleCommandCaptionArgsVideo() {
   *   this.msg?.video // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public */
  async handleCommandCaptionArgsVideo?(): Promise<unknown>

  /**
   * Route handler for free-form video input.
   *
   * @remarks Triggered by any video not matching other routes, typically used with sessions.
   *
   * @example this.msg?.video
   * ```typescript
   * async handleFreeVideo() {
   *    this.msg?.video // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeVideo?(): Promise<unknown>

  // audio
  /**
   * Route function for audioCaption match intent `this.data.name`
   *
   * @remarks Triggered by audio with caption.
   *
   * @example this.data.name = "start" && this.msg?.audio
   * ```typescript
   * async handleCaptionAudio() {
   *   this.msg?.audio // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionAudio?(): Promise<unknown>

  /**
   * Route function for `handleCaptionArgsAudio` with arg match intent `this.data.name`
   *
   * @remarks Triggered by audio with caption and with arg.
   *
   * @example this.data.name = "start 123 aaa" && this.msg?.audio
   * ```typescript
   * async handleCaptionArgsAudio() {
   *   this.msg?.audio // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionArgsAudio?(): Promise<unknown>

  /**
   * Route function for `handleCommandCaptionAudio` with slash command match intent `this.data.name`
   *
   * @remarks Triggered by audio with caption command.
   *
   * @example this.data.name = "/start" && this.msg?.audio
   * ```typescript
   * async handleCommandCaptionAudio() {
   *   this.msg?.audio // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCommandCaptionAudio?(): Promise<unknown>

  /**
   * Route function for `handleCommandCaptionArgsAudio` with slash command and arg match intent `this.data.name`
   *
   * @remarks Triggered by audio with caption command and args.
   *
   * @example this.data.name = "/start 123 aaa" && this.msg?.audio
   * ```typescript
   * async handleCommandCaptionArgsAudio() {
   *   this.msg?.audio // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCommandCaptionArgsAudio?(): Promise<unknown>

  /**
   * Route handler for free-form audio input.
   *
   * @remarks Triggered by any audio not matching other routes, typically used with sessions.
   *
   * @example this.msg?.audio
   * ```typescript
   * async handleFreeAudio() {
   *    this.msg?.audio // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeAudio?(): Promise<unknown>

  // document
  /**
   * Route function for `handleCaptionDocument` match intent `this.data.name`
   *
   * @remarks Triggered by document with caption.
   *
   * @example this.data.name = "start" && this.msg?.document
   * ```typescript
   * async handleCaptionDocument() {
   *   this.msg?.document // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionDocument?(): Promise<unknown>

  /**
   * Route function for `handleCaptionArgsDocument` with arg match intent `this.data.name`
   *
   * @remarks Triggered by document with caption and with arg.
   *
   * @example this.data.name = "start 123 aaa" && this.msg?.document
   * ```typescript
   * async handleCaptionArgsDocument() {
   *   this.msg?.document // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionArgsDocument?(): Promise<unknown>

  /**
   * Route function for `handleCommandCaptionDocument` with slash command match intent `this.data.name`
   *
   * @remarks Triggered by document with caption command.
   *
   * @example this.data.name = "/start" && this.msg?.document
   * ```typescript
   * async handleCommandCaptionDocument() {
   *   this.msg?.document // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   *
   */
  async handleCommandCaptionDocument?(): Promise<unknown>

  /**
   * Route function for `handleCommandCaptionArgsDocument` with slash command and arg match intent `this.data.name`
   *
   * @remarks Triggered by document with caption command and args.
   *
   * @example this.data.name = "/start 123 aaa"
   * ```typescript
   * async handleCommandCaptionArgsDocument() {
   *   this.msg?.document // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public */
  async handleCommandCaptionArgsDocument?(): Promise<unknown>

  /**
   * Route handler for free-form document input.
   *
   * @remarks Triggered by any document not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async handleFreeDocument() {
   *    this.msg?.document // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeDocument?(): Promise<unknown>

  // animation
  /**
   * Route function for animationCaption match intent `this.data.name`
   *
   * @remarks Triggered by animation with caption.
   *
   * @example this.data.name = "start"
   * ```typescript
   * async handleCaptionAnimation() {
   *   this.msg?.animation // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionAnimation?(): Promise<unknown>

  /**
   * Route function for `handleCaptionArgsAnimation` with arg match intent `this.data.name`
   *
   * @remarks Triggered by animation with caption and with arg.
   *
   * @example this.data.name = "start 123 aaa"
   * ```typescript
   * async handleCaptionArgsAnimation() {
   *   this.msg?.animation // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionArgsAnimation?(): Promise<unknown>

  /**
   * Route function for animationCaption with slash command match intent `this.data.name`
   *
   * @remarks Triggered by animation with caption command.
   *
   * @example this.data.name = "/start"
   * ```typescript
   * async handleCommandCaptionAnimation() {
   *   this.msg?.animation // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   *
   */
  async handleCommandCaptionAnimation?(): Promise<unknown>

  /**
   * Route function for `handleCommandCaptionArgsAnimation` with slash command and arg match intent `this.data.name`
   *
   * @remarks Triggered by animation with caption command and args.
   *
   * @example this.data.name = "/start 123 aaa"
   * ```typescript
   * async handleCommandCaptionArgsAnimation() {
   *   this.msg?.animation // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public */
  async handleCommandCaptionArgsAnimation?(): Promise<unknown>

  /**
   * Route handler for free-form animation input.
   *
   * @remarks Triggered by any animation not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async handleFreeAnimation() {
   *    this.msg?.animation // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeAnimation?(): Promise<unknown>

  // voice
  /**
   * Route function for voiceCaption match intent `this.data.name`
   *
   * @remarks Triggered by voice with caption.
   *
   * @example this.data.name = "start"
   * ```typescript
   * async handleCaptionVoice() {
   *   this.msg?.voice // {...}
   *   this.msgCaption // "start"
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionVoice?(): Promise<unknown>

  /**
   * Route function for `handleCaptionArgsVoice` with arg match intent `this.data.name`
   *
   * @remarks Triggered by voice with caption and with arg.
   *
   * @example this.data.name = "start 123 aaa"
   * ```typescript
   * async handleCaptionArgsVoice() {
   *   this.msg?.voice // {...}
   *   this.msgCaption // "start"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCaptionArgsVoice?(): Promise<unknown>

  /**
   * Route function for voiceCaption with slash command match intent `this.data.name`
   *
   * @remarks Triggered by voice with caption command.
   *
   * @example this.data.name = "/start"
   * ```typescript
   * async voiceCommandCaption() {
   *   this.msg?.voice // {...}
   *   this.msgCaption // "/start"
   * }
   * ```
   *
   * @virtual
   * @public
   *
   */
  async handleCommandCaptionVoice?(): Promise<unknown>

  /**
   * Route function for `handleCommandCaptionArgsVoice` with slash command and arg match intent `this.data.name`
   *
   * @remarks Triggered by voice with caption command and args.
   *
   * @example this.data.name = "/start 123 aaa"
   * ```typescript
   * async handleCommandCaptionArgsVoice() {
   *   this.msg?.voice // {...}
   *   this.msgCaption // "/start 123 aaa"
   *   this.msgCaptionArg // "123"
   *   this.msgCaptionArgs // ["123", "aaa"]
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleCommandCaptionArgsVoice?(): Promise<unknown>

  /**
   * Route handler for free-form voice input.
   *
   * @remarks Triggered by any voice not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async handleFreeVoice() {
   *    this.msg?.voice // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeVoice?(): Promise<unknown>

  // video_note
  /**
   * Route handler for free-form video note input.
   * @remarks Triggered by any video note not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async handleFreeVideoNote() {
   *    this.msg?.video_note // {...}
   * }
   * ```
   * @virtual
   * @public
   */
  async handleFreeVideoNote?(): Promise<unknown>

  // sticker
  /**
   * Route handler for free-form sticker input.
   *
   * @remarks Triggered by any sticker not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async handleFreeSticker() {
   *    this.msg?.sticker // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeSticker?(): Promise<unknown>

  // location
  /**
   * Route handler for free-form location input.
   *
   * @remarks Triggered by any location not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async handleFreeLocation() {
   *    this.msg?.location // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeLocation?(): Promise<unknown>

  // contact
  /**
   * Route handler for free-form contact input.
   *
   * @remarks Triggered by any contact not matching other routes, typically used with sessions.
   *
   * @example
   * ```typescript
   * async handleFreeContact() {
   *    this.msg?.contact // {...}
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFreeContact?(): Promise<unknown>

  // all
  /**
   * Fallback route handler for any unmatched update.
   *
   * @remarks
   * Triggered when no other route handler matches the current update. Use this for
   * global fallback logic or safety responses.
   *
   * @example
   * ```typescript
   * async handleFree() {
   *   // handle unexpected updates
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleFree?(): Promise<unknown>

  // ═══════════════════════════════════════════════════════════════
  //  Chat member route handlers
  // ═══════════════════════════════════════════════════════════════
  //
  // Pages can define methods below to react to chat member status
  // transitions.  The bot must be an administrator in the group to
  // receive `chat_member` updates.
  //
  // Convention:
  //   handleChatMember{Old}{New}     — user membership changes
  //   handleMyChatMember{Old}{New}   — bot's own membership changes
  //
  // Status values (PascalCase): Out, In, Kicked, Left, Member,
  // Administrator, Creator, Restricted, Regular (myChatMember only).

  /**
   * User joins the chat (kicked/left → member/admin/creator).
   *
   * @remarks
   * Triggered when a user transitions from an "out" status (`kicked`, `left`,
   * or `restricted` with `is_member=false`) to an "in" status (`member`,
   * `administrator`, `creator`, or `restricted` with `is_member=true`).
   * Uses `chatMemberFilter("out", "in")`.
   *
   * @virtual
   * @public
   */
  async handleChatMemberOutIn?(): Promise<void>

  /**
   * Bot is added to the chat as a regular member.
   *
   * @remarks
   * Triggered when the bot's own membership changes from an "out" status to
   * `member` (non-administrator). Uses `myChatMemberFilter("out", "regular")`.
   *
   * @virtual
   * @public
   */
  async handleMyChatMemberOutRegular?(): Promise<void>

  /**
   * Bot is added to the chat as an administrator.
   *
   * @remarks
   * Triggered when the bot's own membership changes from an "out" status to
   * `administrator`/`creator`. Uses `myChatMemberFilter("out", "admin")`.
   *
   * @virtual
   * @public
   */
  async handleMyChatMemberOutAdmin?(): Promise<void>

  /**
   * Bot is promoted to administrator.
   *
   * @remarks
   * Triggered when the bot's own membership changes from `member`/`regular` to
   * `administrator`/`creator`. Uses `myChatMemberFilter("regular", "admin")`.
   *
   * @virtual
   * @public
   */
  async handleMyChatMemberRegularAdmin?(): Promise<void>

  /**
   * Bot is demoted from administrator.
   *
   * @remarks
   * Triggered when the bot's own membership changes from `administrator`/`creator`
   * back to `member`. Uses `myChatMemberFilter("admin", "regular")`.
   *
   * @virtual
   * @public
   */
  async handleMyChatMemberAdminRegular?(): Promise<void>

  // =============== handleSession* route function (session-aware)
  /**
   * Optional `handleSessionCallbackQueryData` route handler declaration.
   *
   * @remarks
   * Executed on `callbackquerydata` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCallbackQueryData} which wires
   * {@link Ctx.methodSessionCallbackQueryData} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCallbackQueryData} instead.
   *
   * @public
   */
  async handleSessionCallbackQueryData?(): Promise<unknown>
  /**
   * Optional `handleSessionArgsCallbackQueryData` route handler declaration.
   *
   * @remarks
   * Executed on `callbackquerydata` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionArgsCallbackQueryData} which wires
   * {@link Ctx.methodSessionArgsCallbackQueryData} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleArgsCallbackQueryData} instead.
   *
   * @public
   */
  async handleSessionArgsCallbackQueryData?(): Promise<unknown>
  /**
   * Optional `handleSessionText` route handler declaration.
   *
   * @remarks
   * Executed on `text` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionText} which wires
   * {@link Ctx.methodSessionText} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleText} instead.
   *
   * @public
   */
  async handleSessionText?(): Promise<unknown>
  /**
   * Optional `handleSessionArgsText` route handler declaration.
   *
   * @remarks
   * Executed on `text` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionArgsText} which wires
   * {@link Ctx.methodSessionArgsText} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleArgsText} instead.
   *
   * @public
   */
  async handleSessionArgsText?(): Promise<unknown>
  /**
   * Optional `handleSessionCommandText` route handler declaration.
   *
   * @remarks
   * Executed on `text` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCommandText} which wires
   * {@link Ctx.methodSessionCommandText} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCommandText} instead.
   *
   * @public
   */
  async handleSessionCommandText?(): Promise<unknown>
  /**
   * Optional `handleSessionCommandArgsText` route handler declaration.
   *
   * @remarks
   * Executed on `text` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCommandArgsText} which wires
   * {@link Ctx.methodSessionCommandArgsText} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCommandArgsText} instead.
   *
   * @public
   */
  async handleSessionCommandArgsText?(): Promise<unknown>
  /**
   * Optional `handleSessionFreeText` route handler declaration.
   *
   * @remarks
   * Executed on `text` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionFreeText} which wires
   * {@link Ctx.methodSessionFreeText} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleFreeText} instead.
   *
   * @public
   */
  async handleSessionFreeText?(): Promise<unknown>
  /**
   * Optional `handleSessionCaptionPhoto` route handler declaration.
   *
   * @remarks
   * Executed on `photo` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCaptionPhoto} which wires
   * {@link Ctx.methodSessionCaptionPhoto} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCaptionPhoto} instead.
   *
   * @public
   */
  async handleSessionCaptionPhoto?(): Promise<unknown>
  /**
   * Optional `handleSessionCaptionArgsPhoto` route handler declaration.
   *
   * @remarks
   * Executed on `photo` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCaptionArgsPhoto} which wires
   * {@link Ctx.methodSessionCaptionArgsPhoto} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCaptionArgsPhoto} instead.
   *
   * @public
   */
  async handleSessionCaptionArgsPhoto?(): Promise<unknown>
  /**
   * Optional `handleSessionCommandCaptionPhoto` route handler declaration.
   *
   * @remarks
   * Executed on `photo` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCommandCaptionPhoto} which wires
   * {@link Ctx.methodSessionCommandCaptionPhoto} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCommandCaptionPhoto} instead.
   *
   * @public
   */
  async handleSessionCommandCaptionPhoto?(): Promise<unknown>
  /**
   * Optional `handleSessionCommandCaptionArgsPhoto` route handler declaration.
   *
   * @remarks
   * Executed on `photo` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCommandCaptionArgsPhoto} which wires
   * {@link Ctx.methodSessionCommandCaptionArgsPhoto} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCommandCaptionArgsPhoto} instead.
   *
   * @public
   */
  async handleSessionCommandCaptionArgsPhoto?(): Promise<unknown>
  /**
   * Optional `handleSessionFreePhoto` route handler declaration.
   *
   * @remarks
   * Executed on `photo` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionFreePhoto} which wires
   * {@link Ctx.methodSessionFreePhoto} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleFreePhoto} instead.
   *
   * @public
   */
  async handleSessionFreePhoto?(): Promise<unknown>
  /**
   * Optional `handleSessionCaptionVideo` route handler declaration.
   *
   * @remarks
   * Executed on `video` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCaptionVideo} which wires
   * {@link Ctx.methodSessionCaptionVideo} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCaptionVideo} instead.
   *
   * @public
   */
  async handleSessionCaptionVideo?(): Promise<unknown>
  /**
   * Optional `handleSessionCaptionArgsVideo` route handler declaration.
   *
   * @remarks
   * Executed on `video` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCaptionArgsVideo} which wires
   * {@link Ctx.methodSessionCaptionArgsVideo} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCaptionArgsVideo} instead.
   *
   * @public
   */
  async handleSessionCaptionArgsVideo?(): Promise<unknown>
  /**
   * Optional `handleSessionCommandCaptionVideo` route handler declaration.
   *
   * @remarks
   * Executed on `video` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCommandCaptionVideo} which wires
   * {@link Ctx.methodSessionCommandCaptionVideo} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCommandCaptionVideo} instead.
   *
   * @public
   */
  async handleSessionCommandCaptionVideo?(): Promise<unknown>
  /**
   * Optional `handleSessionCommandCaptionArgsVideo` route handler declaration.
   *
   * @remarks
   * Executed on `video` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCommandCaptionArgsVideo} which wires
   * {@link Ctx.methodSessionCommandCaptionArgsVideo} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCommandCaptionArgsVideo} instead.
   *
   * @public
   */
  async handleSessionCommandCaptionArgsVideo?(): Promise<unknown>
  /**
   * Optional `handleSessionFreeVideo` route handler declaration.
   *
   * @remarks
   * Executed on `video` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionFreeVideo} which wires
   * {@link Ctx.methodSessionFreeVideo} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleFreeVideo} instead.
   *
   * @public
   */
  async handleSessionFreeVideo?(): Promise<unknown>
  /**
   * Optional `handleSessionCaptionAudio` route handler declaration.
   *
   * @remarks
   * Executed on `audio` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCaptionAudio} which wires
   * {@link Ctx.methodSessionCaptionAudio} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCaptionAudio} instead.
   *
   * @public
   */
  async handleSessionCaptionAudio?(): Promise<unknown>
  /**
   * Optional `handleSessionCaptionArgsAudio` route handler declaration.
   *
   * @remarks
   * Executed on `audio` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCaptionArgsAudio} which wires
   * {@link Ctx.methodSessionCaptionArgsAudio} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCaptionArgsAudio} instead.
   *
   * @public
   */
  async handleSessionCaptionArgsAudio?(): Promise<unknown>
  /**
   * Optional `handleSessionCommandCaptionAudio` route handler declaration.
   *
   * @remarks
   * Executed on `audio` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCommandCaptionAudio} which wires
   * {@link Ctx.methodSessionCommandCaptionAudio} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCommandCaptionAudio} instead.
   *
   * @public
   */
  async handleSessionCommandCaptionAudio?(): Promise<unknown>
  /**
   * Optional `handleSessionCommandCaptionArgsAudio` route handler declaration.
   *
   * @remarks
   * Executed on `audio` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCommandCaptionArgsAudio} which wires
   * {@link Ctx.methodSessionCommandCaptionArgsAudio} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCommandCaptionArgsAudio} instead.
   *
   * @public
   */
  async handleSessionCommandCaptionArgsAudio?(): Promise<unknown>
  /**
   * Optional `handleSessionFreeAudio` route handler declaration.
   *
   * @remarks
   * Executed on `audio` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionFreeAudio} which wires
   * {@link Ctx.methodSessionFreeAudio} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleFreeAudio} instead.
   *
   * @public
   */
  async handleSessionFreeAudio?(): Promise<unknown>
  /**
   * Optional `handleSessionCaptionDocument` route handler declaration.
   *
   * @remarks
   * Executed on `document` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCaptionDocument} which wires
   * {@link Ctx.methodSessionCaptionDocument} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCaptionDocument} instead.
   *
   * @public
   */
  async handleSessionCaptionDocument?(): Promise<unknown>
  /**
   * Optional `handleSessionCaptionArgsDocument` route handler declaration.
   *
   * @remarks
   * Executed on `document` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCaptionArgsDocument} which wires
   * {@link Ctx.methodSessionCaptionArgsDocument} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCaptionArgsDocument} instead.
   *
   * @public
   */
  async handleSessionCaptionArgsDocument?(): Promise<unknown>
  /**
   * Optional `handleSessionCommandCaptionDocument` route handler declaration.
   *
   * @remarks
   * Executed on `document` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCommandCaptionDocument} which wires
   * {@link Ctx.methodSessionCommandCaptionDocument} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCommandCaptionDocument} instead.
   *
   * @public
   */
  async handleSessionCommandCaptionDocument?(): Promise<unknown>
  /**
   * Optional `handleSessionCommandCaptionArgsDocument` route handler declaration.
   *
   * @remarks
   * Executed on `document` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCommandCaptionArgsDocument} which wires
   * {@link Ctx.methodSessionCommandCaptionArgsDocument} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCommandCaptionArgsDocument} instead.
   *
   * @public
   */
  async handleSessionCommandCaptionArgsDocument?(): Promise<unknown>
  /**
   * Optional `handleSessionFreeDocument` route handler declaration.
   *
   * @remarks
   * Executed on `document` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionFreeDocument} which wires
   * {@link Ctx.methodSessionFreeDocument} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleFreeDocument} instead.
   *
   * @public
   */
  async handleSessionFreeDocument?(): Promise<unknown>
  /**
   * Optional `handleSessionCaptionAnimation` route handler declaration.
   *
   * @remarks
   * Executed on `animation` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCaptionAnimation} which wires
   * {@link Ctx.methodSessionCaptionAnimation} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCaptionAnimation} instead.
   *
   * @public
   */
  async handleSessionCaptionAnimation?(): Promise<unknown>
  /**
   * Optional `handleSessionCaptionArgsAnimation` route handler declaration.
   *
   * @remarks
   * Executed on `animation` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCaptionArgsAnimation} which wires
   * {@link Ctx.methodSessionCaptionArgsAnimation} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCaptionArgsAnimation} instead.
   *
   * @public
   */
  async handleSessionCaptionArgsAnimation?(): Promise<unknown>
  /**
   * Optional `handleSessionCommandCaptionAnimation` route handler declaration.
   *
   * @remarks
   * Executed on `animation` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCommandCaptionAnimation} which wires
   * {@link Ctx.methodSessionCommandCaptionAnimation} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCommandCaptionAnimation} instead.
   *
   * @public
   */
  async handleSessionCommandCaptionAnimation?(): Promise<unknown>
  /**
   * Optional `handleSessionCommandCaptionArgsAnimation` route handler declaration.
   *
   * @remarks
   * Executed on `animation` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCommandCaptionArgsAnimation} which wires
   * {@link Ctx.methodSessionCommandCaptionArgsAnimation} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCommandCaptionArgsAnimation} instead.
   *
   * @public
   */
  async handleSessionCommandCaptionArgsAnimation?(): Promise<unknown>
  /**
   * Optional `handleSessionFreeAnimation` route handler declaration.
   *
   * @remarks
   * Executed on `animation` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionFreeAnimation} which wires
   * {@link Ctx.methodSessionFreeAnimation} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleFreeAnimation} instead.
   *
   * @public
   */
  async handleSessionFreeAnimation?(): Promise<unknown>
  /**
   * Optional `handleSessionCaptionVoice` route handler declaration.
   *
   * @remarks
   * Executed on `voice` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCaptionVoice} which wires
   * {@link Ctx.methodSessionCaptionVoice} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCaptionVoice} instead.
   *
   * @public
   */
  async handleSessionCaptionVoice?(): Promise<unknown>
  /**
   * Optional `handleSessionCaptionArgsVoice` route handler declaration.
   *
   * @remarks
   * Executed on `voice` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCaptionArgsVoice} which wires
   * {@link Ctx.methodSessionCaptionArgsVoice} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCaptionArgsVoice} instead.
   *
   * @public
   */
  async handleSessionCaptionArgsVoice?(): Promise<unknown>
  /**
   * Optional `handleSessionCommandCaptionVoice` route handler declaration.
   *
   * @remarks
   * Executed on `voice` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCommandCaptionVoice} which wires
   * {@link Ctx.methodSessionCommandCaptionVoice} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCommandCaptionVoice} instead.
   *
   * @public
   */
  async handleSessionCommandCaptionVoice?(): Promise<unknown>
  /**
   * Optional `handleSessionCommandCaptionArgsVoice` route handler declaration.
   *
   * @remarks
   * Executed on `voice` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionCommandCaptionArgsVoice} which wires
   * {@link Ctx.methodSessionCommandCaptionArgsVoice} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleCommandCaptionArgsVoice} instead.
   *
   * @public
   */
  async handleSessionCommandCaptionArgsVoice?(): Promise<unknown>
  /**
   * Optional `handleSessionFreeVoice` route handler declaration.
   *
   * @remarks
   * Executed on `voice` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionFreeVoice} which wires
   * {@link Ctx.methodSessionFreeVoice} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleFreeVoice} instead.
   *
   * @public
   */
  async handleSessionFreeVoice?(): Promise<unknown>
  /**
   * Optional `handleSessionFreeVideoNote` route handler declaration.
   *
   * @remarks
   * Executed on `videonote` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionFreeVideoNote} which wires
   * {@link Ctx.methodSessionFreeVideoNote} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleFreeVideoNote} instead.
   *
   * @public
   */
  async handleSessionFreeVideoNote?(): Promise<unknown>
  /**
   * Optional `handleSessionFreeSticker` route handler declaration.
   *
   * @remarks
   * Executed on `sticker` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionFreeSticker} which wires
   * {@link Ctx.methodSessionFreeSticker} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleFreeSticker} instead.
   *
   * @public
   */
  async handleSessionFreeSticker?(): Promise<unknown>
  /**
   * Optional `handleSessionFreeLocation` route handler declaration.
   *
   * @remarks
   * Executed on `location` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionFreeLocation} which wires
   * {@link Ctx.methodSessionFreeLocation} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleFreeLocation} instead.
   *
   * @public
   */
  async handleSessionFreeLocation?(): Promise<unknown>
  /**
   * Optional `handleSessionFreeContact` route handler declaration.
   *
   * @remarks
   * Executed on `contact` updates while the session is active. Routing id=1
   * (session) runs BEFORE static/intent matching (id=2-3): it reads
   * `ctx.getSession().method` — set via {@link Ctx.setSessionFreeContact} which wires
   * {@link Ctx.methodSessionFreeContact} — and dispatches this handler through
   * `new Page(ctx)`. When no session is active, the same update falls through
   * to the non-session route {@link Ctx.handleFreeContact} instead.
   *
   * @public
   */
  async handleSessionFreeContact?(): Promise<unknown>
  /**
   * Optional `handleSessionFree` route handler declaration.
   *
   * @remarks
   * Executed for updates not matched by a specific `handleSession*` route while
   * the session is active. Routing id=1 (session) runs BEFORE static/intent
   * matching (id=2-3): it reads `ctx.getSession().method` — activated via the
   * matching `setSession*` helper which wires the `methodSession*` key — and
   * dispatches this handler through `new Page(ctx)`. When no session is active,
   * updates fall through to the non-session fallback {@link Ctx.handleFree}.
   *
   * @public
   */
  async handleSessionFree?(): Promise<unknown>

  // callback
  /**
   * Session set helper methods.
   *
   * @remarks
   * These methods are shortcuts for {@link (Ctx:class).setSession} with pre-built method names.
   * Each `session*` method sets the session for the corresponding route handler.
   *
   * @example
   * ```typescript
   * async handleCallbackQueryData() {
   *   // Set session input for `handleFreeText`
   *   await this.setSessionFreeText({data: "12345"})
   *   await this.render()
   * }
   * ```
   *
   * @public
   */
  setSessionCallbackQueryData(this: Ctx & {handleSessionCallbackQueryData: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCallbackQueryData(), params)
  }
  /**
   * Set the session method for `handleSessionArgsCallbackQueryData` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionArgsCallbackQueryData} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionArgsCallbackQueryData` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionArgsCallbackQueryData(this: Ctx & {handleSessionArgsCallbackQueryData: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionArgsCallbackQueryData(), params)
  }
  // text
  /**
   * Set the session method for `handleSessionText` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionText} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionText` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionText(this: Ctx & {handleSessionText: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionText(), params)
  }
  /**
   * Set the session method for `handleSessionArgsText` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionArgsText} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionArgsText` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionArgsText(this: Ctx & {handleSessionArgsText: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionArgsText(), params)
  }
  /**
   * Set the session method for `handleSessionCommandText` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCommandText} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCommandText` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCommandText(this: Ctx & {handleSessionCommandText: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCommandText(), params)
  }
  /**
   * Set the session method for `handleSessionCommandArgsText` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCommandArgsText} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCommandArgsText` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCommandArgsText(this: Ctx & {handleSessionCommandArgsText: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCommandArgsText(), params)
  }
  /**
   * Set the session method for `handleSessionFreeText` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeText} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeText` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeText(this: Ctx & {handleSessionFreeText: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeText(), params)
  }
  // photo
  /**
   * Set the session method for `handleSessionCaptionPhoto` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCaptionPhoto} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCaptionPhoto` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCaptionPhoto(this: Ctx & {handleSessionCaptionPhoto: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCaptionPhoto(), params)
  }
  /**
   * Set the session method for `handleSessionCaptionArgsPhoto` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCaptionArgsPhoto} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCaptionArgsPhoto` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCaptionArgsPhoto(this: Ctx & {handleSessionCaptionArgsPhoto: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCaptionArgsPhoto(), params)
  }
  /**
   * Set the session method for `handleSessionCommandCaptionPhoto` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCommandCaptionPhoto} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCommandCaptionPhoto` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCommandCaptionPhoto(this: Ctx & {handleSessionCommandCaptionPhoto: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCommandCaptionPhoto(), params)
  }
  /**
   * Set the session method for `handleSessionCommandCaptionArgsPhoto` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCommandCaptionArgsPhoto} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCommandCaptionArgsPhoto` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCommandCaptionArgsPhoto(this: Ctx & {handleSessionCommandCaptionArgsPhoto: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCommandCaptionArgsPhoto(), params)
  }
  /**
   * Set the session method for `handleSessionFreePhoto` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreePhoto} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreePhoto` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreePhoto(this: Ctx & {handleSessionFreePhoto: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreePhoto(), params)
  }
  // video
  /**
   * Set the session method for `handleSessionCaptionVideo` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCaptionVideo} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCaptionVideo` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCaptionVideo(this: Ctx & {handleSessionCaptionVideo: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCaptionVideo(), params)
  }
  /**
   * Set the session method for `handleSessionCaptionArgsVideo` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCaptionArgsVideo} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCaptionArgsVideo` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCaptionArgsVideo(this: Ctx & {handleSessionCaptionArgsVideo: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCaptionArgsVideo(), params)
  }
  /**
   * Set the session method for `handleSessionCommandCaptionVideo` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCommandCaptionVideo} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCommandCaptionVideo` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCommandCaptionVideo(this: Ctx & {handleSessionCommandCaptionVideo: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCommandCaptionVideo(), params)
  }
  /**
   * Set the session method for `handleSessionCommandCaptionArgsVideo` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCommandCaptionArgsVideo} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCommandCaptionArgsVideo` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCommandCaptionArgsVideo(this: Ctx & {handleSessionCommandCaptionArgsVideo: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCommandCaptionArgsVideo(), params)
  }
  /**
   * Set the session method for `handleSessionFreeVideo` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeVideo} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeVideo` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeVideo(this: Ctx & {handleSessionFreeVideo: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeVideo(), params)
  }
  // audio
  /**
   * Set the session method for `handleSessionCaptionAudio` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCaptionAudio} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCaptionAudio` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCaptionAudio(this: Ctx & {handleSessionCaptionAudio: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCaptionAudio(), params)
  }
  /**
   * Set the session method for `handleSessionCaptionArgsAudio` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCaptionArgsAudio} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCaptionArgsAudio` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCaptionArgsAudio(this: Ctx & {handleSessionCaptionArgsAudio: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCaptionArgsAudio(), params)
  }
  /**
   * Set the session method for `handleSessionCommandCaptionAudio` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCommandCaptionAudio} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCommandCaptionAudio` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCommandCaptionAudio(this: Ctx & {handleSessionCommandCaptionAudio: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCommandCaptionAudio(), params)
  }
  /**
   * Set the session method for `handleSessionCommandCaptionArgsAudio` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCommandCaptionArgsAudio} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCommandCaptionArgsAudio` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCommandCaptionArgsAudio(this: Ctx & {handleSessionCommandCaptionArgsAudio: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCommandCaptionArgsAudio(), params)
  }
  /**
   * Set the session method for `handleSessionFreeAudio` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeAudio} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeAudio` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeAudio(this: Ctx & {handleSessionFreeAudio: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeAudio(), params)
  }
  // document
  /**
   * Set the session method for `handleSessionCaptionDocument` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCaptionDocument} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCaptionDocument` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCaptionDocument(this: Ctx & {handleSessionCaptionDocument: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCaptionDocument(), params)
  }
  /**
   * Set the session method for `handleSessionCaptionArgsDocument` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCaptionArgsDocument} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCaptionArgsDocument` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCaptionArgsDocument(this: Ctx & {handleSessionCaptionArgsDocument: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCaptionArgsDocument(), params)
  }
  /**
   * Set the session method for `handleSessionCommandCaptionDocument` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCommandCaptionDocument} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCommandCaptionDocument` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCommandCaptionDocument(this: Ctx & {handleSessionCommandCaptionDocument: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCommandCaptionDocument(), params)
  }
  /**
   * Set the session method for `handleSessionCommandCaptionArgsDocument` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCommandCaptionArgsDocument} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCommandCaptionArgsDocument` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCommandCaptionArgsDocument(this: Ctx & {handleSessionCommandCaptionArgsDocument: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCommandCaptionArgsDocument(), params)
  }
  /**
   * Set the session method for `handleSessionFreeDocument` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeDocument} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeDocument` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeDocument(this: Ctx & {handleSessionFreeDocument: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeDocument(), params)
  }
  // animation
  /**
   * Set the session method for `handleSessionCaptionAnimation` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCaptionAnimation} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCaptionAnimation` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCaptionAnimation(this: Ctx & {handleSessionCaptionAnimation: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCaptionAnimation(), params)
  }
  /**
   * Set the session method for `handleSessionCaptionArgsAnimation` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCaptionArgsAnimation} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCaptionArgsAnimation` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCaptionArgsAnimation(this: Ctx & {handleSessionCaptionArgsAnimation: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCaptionArgsAnimation(), params)
  }
  /**
   * Set the session method for `handleSessionCommandCaptionAnimation` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCommandCaptionAnimation} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCommandCaptionAnimation` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCommandCaptionAnimation(this: Ctx & {handleSessionCommandCaptionAnimation: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCommandCaptionAnimation(), params)
  }
  /**
   * Set the session method for `handleSessionCommandCaptionArgsAnimation` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCommandCaptionArgsAnimation} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCommandCaptionArgsAnimation` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCommandCaptionArgsAnimation(this: Ctx & {handleSessionCommandCaptionArgsAnimation: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCommandCaptionArgsAnimation(), params)
  }
  /**
   * Set the session method for `handleSessionFreeAnimation` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeAnimation} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeAnimation` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeAnimation(this: Ctx & {handleSessionFreeAnimation: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeAnimation(), params)
  }
  // voice
  /**
   * Set the session method for `handleSessionCaptionVoice` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCaptionVoice} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCaptionVoice` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCaptionVoice(this: Ctx & {handleSessionCaptionVoice: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCaptionVoice(), params)
  }
  /**
   * Set the session method for `handleSessionCaptionArgsVoice` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCaptionArgsVoice} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCaptionArgsVoice` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCaptionArgsVoice(this: Ctx & {handleSessionCaptionArgsVoice: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCaptionArgsVoice(), params)
  }
  /**
   * Set the session method for `handleSessionCommandCaptionVoice` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCommandCaptionVoice} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCommandCaptionVoice` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCommandCaptionVoice(this: Ctx & {handleSessionCommandCaptionVoice: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCommandCaptionVoice(), params)
  }
  /**
   * Set the session method for `handleSessionCommandCaptionArgsVoice` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionCommandCaptionArgsVoice} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionCommandCaptionArgsVoice` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionCommandCaptionArgsVoice(this: Ctx & {handleSessionCommandCaptionArgsVoice: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionCommandCaptionArgsVoice(), params)
  }
  /**
   * Set the session method for `handleSessionFreeVoice` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeVoice} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeVoice` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeVoice(this: Ctx & {handleSessionFreeVoice: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeVoice(), params)
  }
  // video note
  /**
   * Set the session method for `handleSessionFreeVideoNote` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeVideoNote} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeVideoNote` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeVideoNote(this: Ctx & {handleSessionFreeVideoNote: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeVideoNote(), params)
  }
  // sticker
  /**
   * Set the session method for `handleSessionFreeSticker` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeSticker} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeSticker` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeSticker(this: Ctx & {handleSessionFreeSticker: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeSticker(), params)
  }
  // location
  /**
   * Set the session method for `handleSessionFreeLocation` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeLocation} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeLocation` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeLocation(this: Ctx & {handleSessionFreeLocation: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeLocation(), params)
  }
  // contact
  /**
   * Set the session method for `handleSessionFreeContact` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeContact} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeContact` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeContact(this: Ctx & {handleSessionFreeContact: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeContact(), params)
  }

  // chat member
  /**
   * Set the session method for `handleSessionChatMemberOutIn` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionChatMemberOutIn} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionChatMemberOutIn` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionChatMemberOutIn(this: Ctx & {handleSessionChatMemberOutIn: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionChatMemberOutIn(), params)
  }
  /**
   * Set the session method for `handleSessionMyChatMemberOutRegular` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionMyChatMemberOutRegular} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionMyChatMemberOutRegular` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionMyChatMemberOutRegular(this: Ctx & {handleSessionMyChatMemberOutRegular: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionMyChatMemberOutRegular(), params)
  }
  /**
   * Set the session method for `handleSessionMyChatMemberOutAdmin` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionMyChatMemberOutAdmin} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionMyChatMemberOutAdmin` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionMyChatMemberOutAdmin(this: Ctx & {handleSessionMyChatMemberOutAdmin: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionMyChatMemberOutAdmin(), params)
  }
  /**
   * Set the session method for `handleSessionMyChatMemberRegularAdmin` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionMyChatMemberRegularAdmin} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionMyChatMemberRegularAdmin` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionMyChatMemberRegularAdmin(this: Ctx & {handleSessionMyChatMemberRegularAdmin: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionMyChatMemberRegularAdmin(), params)
  }
  /**
   * Set the session method for `handleSessionMyChatMemberAdminRegular` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionMyChatMemberAdminRegular} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionMyChatMemberAdminRegular` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionMyChatMemberAdminRegular(this: Ctx & {handleSessionMyChatMemberAdminRegular: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionMyChatMemberAdminRegular(), params)
  }

  /**
   * Set the session method for `handleSessionFreeChannelPost` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeChannelPost} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeChannelPost` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeChannelPost(this: Ctx & {handleSessionFreeChannelPost: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeChannelPost(), params)
  }
  /**
   * Set the session method for `handleSessionFreeEditChannelPost` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeEditChannelPost} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeEditChannelPost` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeEditChannelPost(this: Ctx & {handleSessionFreeEditChannelPost: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeEditChannelPost(), params)
  }
  /**
   * Set the session method for `handleSessionFreeEdit` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeEdit} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeEdit` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeEdit(this: Ctx & {handleSessionFreeEdit: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeEdit(), params)
  }
  /**
   * Set the session method for `handleSessionFreeReaction` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeReaction} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeReaction` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeReaction(this: Ctx & {handleSessionFreeReaction: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeReaction(), params)
  }
  /**
   * Set the session method for `handleSessionFreeInlineQuery` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeInlineQuery} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeInlineQuery` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeInlineQuery(this: Ctx & {handleSessionFreeInlineQuery: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeInlineQuery(), params)
  }
  /**
   * Set the session method for `handleSessionFreeChosenInlineResult` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeChosenInlineResult} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeChosenInlineResult` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeChosenInlineResult(this: Ctx & {handleSessionFreeChosenInlineResult: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeChosenInlineResult(), params)
  }
  /**
   * Set the session method for `handleSessionFreePreCheckoutQuery` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreePreCheckoutQuery} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreePreCheckoutQuery` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreePreCheckoutQuery(this: Ctx & {handleSessionFreePreCheckoutQuery: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreePreCheckoutQuery(), params)
  }
  /**
   * Set the session method for `handleSessionFreeShippingQuery` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeShippingQuery} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeShippingQuery` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeShippingQuery(this: Ctx & {handleSessionFreeShippingQuery: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeShippingQuery(), params)
  }
  /**
   * Set the session method for `handleSessionFreeChatJoinRequest` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeChatJoinRequest} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeChatJoinRequest` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeChatJoinRequest(this: Ctx & {handleSessionFreeChatJoinRequest: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeChatJoinRequest(), params)
  }
  /**
   * Set the session method for `handleSessionFreePoll` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreePoll} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreePoll` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreePoll(this: Ctx & {handleSessionFreePoll: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreePoll(), params)
  }
  /**
   * Set the session method for `handleSessionFreePollAnswer` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreePollAnswer} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreePollAnswer` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreePollAnswer(this: Ctx & {handleSessionFreePollAnswer: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreePollAnswer(), params)
  }
  /**
   * Set the session method for `handleSessionFreeNewChatMembers` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeNewChatMembers} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeNewChatMembers` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeNewChatMembers(this: Ctx & {handleSessionFreeNewChatMembers: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeNewChatMembers(), params)
  }
  /**
   * Set the session method for `handleSessionFreeLeftChatMember` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeLeftChatMember} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeLeftChatMember` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeLeftChatMember(this: Ctx & {handleSessionFreeLeftChatMember: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeLeftChatMember(), params)
  }
  /**
   * Set the session method for `handleSessionFreeBusinessConnection` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeBusinessConnection} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeBusinessConnection` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeBusinessConnection(this: Ctx & {handleSessionFreeBusinessConnection: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeBusinessConnection(), params)
  }
  /**
   * Set the session method for `handleSessionFreeBusinessMessage` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeBusinessMessage} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeBusinessMessage` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeBusinessMessage(this: Ctx & {handleSessionFreeBusinessMessage: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeBusinessMessage(), params)
  }
  /**
   * Set the session method for `handleSessionFreeEditedBusinessMessage` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeEditedBusinessMessage} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeEditedBusinessMessage` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeEditedBusinessMessage(this: Ctx & {handleSessionFreeEditedBusinessMessage: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeEditedBusinessMessage(), params)
  }
  /**
   * Set the session method for `handleSessionFreeDeletedBusinessMessages` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeDeletedBusinessMessages} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeDeletedBusinessMessages` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeDeletedBusinessMessages(this: Ctx & {handleSessionFreeDeletedBusinessMessages: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeDeletedBusinessMessages(), params)
  }
  /**
   * Set the session method for `handleSessionFreeMessageReactionCount` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeMessageReactionCount} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeMessageReactionCount` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeMessageReactionCount(this: Ctx & {handleSessionFreeMessageReactionCount: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeMessageReactionCount(), params)
  }
  /**
   * Set the session method for `handleSessionFreeChatBoost` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeChatBoost} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeChatBoost` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeChatBoost(this: Ctx & {handleSessionFreeChatBoost: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeChatBoost(), params)
  }
  /**
   * Set the session method for `handleSessionFreeRemovedChatBoost` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeRemovedChatBoost} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeRemovedChatBoost` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeRemovedChatBoost(this: Ctx & {handleSessionFreeRemovedChatBoost: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeRemovedChatBoost(), params)
  }
  /**
   * Set the session method for `handleSessionFreeSuccessfulPayment` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeSuccessfulPayment} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeSuccessfulPayment` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeSuccessfulPayment(this: Ctx & {handleSessionFreeSuccessfulPayment: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeSuccessfulPayment(), params)
  }
  /**
   * Set the session method for `handleSessionFreeRefundedPayment` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeRefundedPayment} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeRefundedPayment` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeRefundedPayment(this: Ctx & {handleSessionFreeRefundedPayment: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeRefundedPayment(), params)
  }
  /**
   * Set the session method for `handleSessionFreeGroupChatCreated` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeGroupChatCreated} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeGroupChatCreated` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeGroupChatCreated(this: Ctx & {handleSessionFreeGroupChatCreated: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeGroupChatCreated(), params)
  }
  /**
   * Set the session method for `handleSessionFreeSupergroupChatCreated` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeSupergroupChatCreated} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeSupergroupChatCreated` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeSupergroupChatCreated(this: Ctx & {handleSessionFreeSupergroupChatCreated: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeSupergroupChatCreated(), params)
  }
  /**
   * Set the session method for `handleSessionFreeChannelChatCreated` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeChannelChatCreated} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeChannelChatCreated` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeChannelChatCreated(this: Ctx & {handleSessionFreeChannelChatCreated: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeChannelChatCreated(), params)
  }
  /**
   * Set the session method for `handleSessionFreeVideoChatStarted` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeVideoChatStarted} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeVideoChatStarted` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeVideoChatStarted(this: Ctx & {handleSessionFreeVideoChatStarted: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeVideoChatStarted(), params)
  }
  /**
   * Set the session method for `handleSessionFreeVideoChatScheduled` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeVideoChatScheduled} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeVideoChatScheduled` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeVideoChatScheduled(this: Ctx & {handleSessionFreeVideoChatScheduled: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeVideoChatScheduled(), params)
  }
  /**
   * Set the session method for `handleSessionFreeVideoChatEnded` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeVideoChatEnded} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeVideoChatEnded` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeVideoChatEnded(this: Ctx & {handleSessionFreeVideoChatEnded: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeVideoChatEnded(), params)
  }
  /**
   * Set the session method for `handleSessionFreeVideoChatParticipantsInvited` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeVideoChatParticipantsInvited} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeVideoChatParticipantsInvited` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeVideoChatParticipantsInvited(this: Ctx & {handleSessionFreeVideoChatParticipantsInvited: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeVideoChatParticipantsInvited(), params)
  }
  /**
   * Set the session method for `handleSessionFreeUserShared` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeUserShared} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeUserShared` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeUserShared(this: Ctx & {handleSessionFreeUserShared: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeUserShared(), params)
  }
  /**
   * Set the session method for `handleSessionFreeChatShared` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeChatShared} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeChatShared` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeChatShared(this: Ctx & {handleSessionFreeChatShared: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeChatShared(), params)
  }
  /**
   * Set the session method for `handleSessionFreeWebAppData` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeWebAppData} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeWebAppData` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeWebAppData(this: Ctx & {handleSessionFreeWebAppData: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeWebAppData(), params)
  }
  /**
   * Set the session method for `handleSessionFreeGiveaway` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeGiveaway} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeGiveaway` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeGiveaway(this: Ctx & {handleSessionFreeGiveaway: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeGiveaway(), params)
  }
  /**
   * Set the session method for `handleSessionFreeGiveawayCreated` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeGiveawayCreated} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeGiveawayCreated` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeGiveawayCreated(this: Ctx & {handleSessionFreeGiveawayCreated: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeGiveawayCreated(), params)
  }
  /**
   * Set the session method for `handleSessionFreeGiveawayWinners` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeGiveawayWinners} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeGiveawayWinners` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeGiveawayWinners(this: Ctx & {handleSessionFreeGiveawayWinners: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeGiveawayWinners(), params)
  }
  /**
   * Set the session method for `handleSessionFreeGiveawayCompleted` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeGiveawayCompleted} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeGiveawayCompleted` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeGiveawayCompleted(this: Ctx & {handleSessionFreeGiveawayCompleted: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeGiveawayCompleted(), params)
  }
  /**
   * Set the session method for `handleSessionFreePinMessage` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreePinMessage} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreePinMessage` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreePinMessage(this: Ctx & {handleSessionFreePinMessage: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreePinMessage(), params)
  }
  /**
   * Set the session method for `handleSessionFreeForumTopicCreated` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeForumTopicCreated} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeForumTopicCreated` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeForumTopicCreated(this: Ctx & {handleSessionFreeForumTopicCreated: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeForumTopicCreated(), params)
  }
  /**
   * Set the session method for `handleSessionFreeForumTopicEdited` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeForumTopicEdited} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeForumTopicEdited` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeForumTopicEdited(this: Ctx & {handleSessionFreeForumTopicEdited: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeForumTopicEdited(), params)
  }
  /**
   * Set the session method for `handleSessionFreeForumTopicClosed` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeForumTopicClosed} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeForumTopicClosed` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeForumTopicClosed(this: Ctx & {handleSessionFreeForumTopicClosed: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeForumTopicClosed(), params)
  }
  /**
   * Set the session method for `handleSessionFreeForumTopicReopened` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeForumTopicReopened} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeForumTopicReopened` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeForumTopicReopened(this: Ctx & {handleSessionFreeForumTopicReopened: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeForumTopicReopened(), params)
  }
  /**
   * Set the session method for `handleSessionFreeGeneralForumTopicHidden` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeGeneralForumTopicHidden} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeGeneralForumTopicHidden` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeGeneralForumTopicHidden(this: Ctx & {handleSessionFreeGeneralForumTopicHidden: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeGeneralForumTopicHidden(), params)
  }
  /**
   * Set the session method for `handleSessionFreeGeneralForumTopicUnhidden` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeGeneralForumTopicUnhidden} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeGeneralForumTopicUnhidden` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeGeneralForumTopicUnhidden(this: Ctx & {handleSessionFreeGeneralForumTopicUnhidden: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeGeneralForumTopicUnhidden(), params)
  }
  /**
   * Set the session method for `handleSessionFreeProximityAlertTriggered` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeProximityAlertTriggered} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeProximityAlertTriggered` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeProximityAlertTriggered(this: Ctx & {handleSessionFreeProximityAlertTriggered: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeProximityAlertTriggered(), params)
  }
  /**
   * Set the session method for `handleSessionFreeConnectedWebsite` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeConnectedWebsite} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeConnectedWebsite` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeConnectedWebsite(this: Ctx & {handleSessionFreeConnectedWebsite: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeConnectedWebsite(), params)
  }
  /**
   * Set the session method for `handleSessionFreePassportData` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreePassportData} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreePassportData` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreePassportData(this: Ctx & {handleSessionFreePassportData: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreePassportData(), params)
  }
  /**
   * Set the session method for `handleSessionFreeMessageAutoDeleteTimerChanged` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeMessageAutoDeleteTimerChanged} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeMessageAutoDeleteTimerChanged` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeMessageAutoDeleteTimerChanged(this: Ctx & {handleSessionFreeMessageAutoDeleteTimerChanged: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeMessageAutoDeleteTimerChanged(), params)
  }
  /**
   * Set the session method for `handleSessionFreeChatBackgroundSet` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeChatBackgroundSet} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeChatBackgroundSet` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeChatBackgroundSet(this: Ctx & {handleSessionFreeChatBackgroundSet: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeChatBackgroundSet(), params)
  }
  /**
   * Set the session method for `handleSessionFreeNewChatTitle` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeNewChatTitle} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeNewChatTitle` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeNewChatTitle(this: Ctx & {handleSessionFreeNewChatTitle: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeNewChatTitle(), params)
  }
  /**
   * Set the session method for `handleSessionFreeNewChatPhoto` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeNewChatPhoto} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeNewChatPhoto` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeNewChatPhoto(this: Ctx & {handleSessionFreeNewChatPhoto: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeNewChatPhoto(), params)
  }
  /**
   * Set the session method for `handleSessionFreeDeleteChatPhoto` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeDeleteChatPhoto} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeDeleteChatPhoto` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeDeleteChatPhoto(this: Ctx & {handleSessionFreeDeleteChatPhoto: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeDeleteChatPhoto(), params)
  }
  /**
   * Set the session method for `handleSessionFreeWriteAccessAllowed` routing.
   *
   * @remarks
   * Stores the key from {@link Ctx.methodSessionFreeWriteAccessAllowed} via {@link Ctx.setSession}.
   * Subsequent updates of the matching listener type dispatch to the page's
   * `handleSessionFreeWriteAccessAllowed` handler (routing id=1) until the session is cleared.
   *
   * @param params - Optional session parameters stored alongside the method.
   * @returns The `setSession` result, or null when no user/chat id is available.
   *
   * @public
   */
  setSessionFreeWriteAccessAllowed(this: Ctx & {handleSessionFreeWriteAccessAllowed: (...args: unknown[]) => unknown}, params?: Record<string, unknown>) {
    return this.setSession(this.methodSessionFreeWriteAccessAllowed(), params)
  }

  /**
   * [LOW-LEVEL] Session method name builders.
   *
   * @remarks
   * Low-level API. You rarely need to call these directly — the
   * {@link (Ctx:class).setSessionFreeText} (and siblings) already wire them internally.
   *
   * These methods generate unique session method identifiers used by
   * {@link (Ctx:class).setSession} and validation methods. Each `methodSession*`
   * returns a prefixed string like `"1-PageName"`.
   *
   * When you DO need to call them (multi-session with `setSession(array, ...)`),
   * always use the typed helpers — never hardcode the prefix:
   *
   * @example
   * ```typescript
   * // ✅ Correct
   * await this.setSession([this.methodSessionFreeText(), this.methodSessionFreeVideo()], {})
   *
   * // ❌ Fragile — prefix `7` depends on the listener order
   * await this.setSession(["7-PageName", "8-PageName"], {})
   * ```
   *
   * @public
   */
  methodSession(prefix: string, name: string | undefined) {
    return `${prefix}-${name || this.data.name}`
  }
  /**
   * Session method key builder for `handleSessionCallbackQueryData`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCallbackQueryData} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCallbackQueryData`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCallbackQueryData(name?: string) {
    return this.methodSession(`1`, name)
  }
  /**
   * Session method key builder for `handleSessionArgsCallbackQueryData`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionArgsCallbackQueryData} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionArgsCallbackQueryData`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionArgsCallbackQueryData(name?: string) {
    return this.methodSession(`2`, name)
  }
  // text method
  /**
   * Session method key builder for `handleSessionText`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionText} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionText`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionText(name?: string) {
    return this.methodSession(`3`, name)
  }
  /**
   * Session method key builder for `handleSessionArgsText`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionArgsText} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionArgsText`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionArgsText(name?: string) {
    return this.methodSession(`4`, name)
  }
  /**
   * Session method key builder for `handleSessionCommandText`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCommandText} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCommandText`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCommandText(name?: string) {
    return this.methodSession(`5`, name)
  }
  /**
   * Session method key builder for `handleSessionCommandArgsText`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCommandArgsText} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCommandArgsText`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCommandArgsText(name?: string) {
    return this.methodSession(`6`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeText`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeText} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeText`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeText(name?: string) {
    return this.methodSession(`7`, name)
  }
  // photo method
  /**
   * Session method key builder for `handleSessionCaptionPhoto`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCaptionPhoto} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCaptionPhoto`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCaptionPhoto(name?: string) {
    return this.methodSession(`8`, name)
  }
  /**
   * Session method key builder for `handleSessionCaptionArgsPhoto`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCaptionArgsPhoto} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCaptionArgsPhoto`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCaptionArgsPhoto(name?: string) {
    return this.methodSession(`9`, name)
  }
  /**
   * Session method key builder for `handleSessionCommandCaptionPhoto`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCommandCaptionPhoto} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCommandCaptionPhoto`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCommandCaptionPhoto(name?: string) {
    return this.methodSession(`10`, name)
  }
  /**
   * Session method key builder for `handleSessionCommandCaptionArgsPhoto`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCommandCaptionArgsPhoto} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCommandCaptionArgsPhoto`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCommandCaptionArgsPhoto(name?: string) {
    return this.methodSession(`11`, name)
  }
  /**
   * Session method key builder for `handleSessionFreePhoto`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreePhoto} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreePhoto`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreePhoto(name?: string) {
    return this.methodSession(`12`, name)
  }
  // video method
  /**
   * Session method key builder for `handleSessionCaptionVideo`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCaptionVideo} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCaptionVideo`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCaptionVideo(name?: string) {
    return this.methodSession(`13`, name)
  }
  /**
   * Session method key builder for `handleSessionCaptionArgsVideo`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCaptionArgsVideo} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCaptionArgsVideo`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCaptionArgsVideo(name?: string) {
    return this.methodSession(`14`, name)
  }
  /**
   * Session method key builder for `handleSessionCommandCaptionVideo`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCommandCaptionVideo} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCommandCaptionVideo`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCommandCaptionVideo(name?: string) {
    return this.methodSession(`15`, name)
  }
  /**
   * Session method key builder for `handleSessionCommandCaptionArgsVideo`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCommandCaptionArgsVideo} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCommandCaptionArgsVideo`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCommandCaptionArgsVideo(name?: string) {
    return this.methodSession(`16`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeVideo`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeVideo} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeVideo`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeVideo(name?: string) {
    return this.methodSession(`17`, name)
  }
  // audio method
  /**
   * Session method key builder for `handleSessionCaptionAudio`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCaptionAudio} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCaptionAudio`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCaptionAudio(name?: string) {
    return this.methodSession(`18`, name)
  }
  /**
   * Session method key builder for `handleSessionCaptionArgsAudio`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCaptionArgsAudio} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCaptionArgsAudio`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCaptionArgsAudio(name?: string) {
    return this.methodSession(`19`, name)
  }
  /**
   * Session method key builder for `handleSessionCommandCaptionAudio`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCommandCaptionAudio} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCommandCaptionAudio`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCommandCaptionAudio(name?: string) {
    return this.methodSession(`20`, name)
  }
  /**
   * Session method key builder for `handleSessionCommandCaptionArgsAudio`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCommandCaptionArgsAudio} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCommandCaptionArgsAudio`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCommandCaptionArgsAudio(name?: string) {
    return this.methodSession(`21`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeAudio`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeAudio} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeAudio`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeAudio(name?: string) {
    return this.methodSession(`22`, name)
  }
  // document method
  /**
   * Session method key builder for `handleSessionCaptionDocument`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCaptionDocument} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCaptionDocument`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCaptionDocument(name?: string) {
    return this.methodSession(`23`, name)
  }
  /**
   * Session method key builder for `handleSessionCaptionArgsDocument`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCaptionArgsDocument} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCaptionArgsDocument`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCaptionArgsDocument(name?: string) {
    return this.methodSession(`24`, name)
  }
  /**
   * Session method key builder for `handleSessionCommandCaptionDocument`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCommandCaptionDocument} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCommandCaptionDocument`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCommandCaptionDocument(name?: string) {
    return this.methodSession(`25`, name)
  }
  /**
   * Session method key builder for `handleSessionCommandCaptionArgsDocument`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCommandCaptionArgsDocument} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCommandCaptionArgsDocument`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCommandCaptionArgsDocument(name?: string) {
    return this.methodSession(`26`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeDocument`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeDocument} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeDocument`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeDocument(name?: string) {
    return this.methodSession(`27`, name)
  }
  // animation method
  /**
   * Session method key builder for `handleSessionCaptionAnimation`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCaptionAnimation} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCaptionAnimation`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCaptionAnimation(name?: string) {
    return this.methodSession(`28`, name)
  }
  /**
   * Session method key builder for `handleSessionCaptionArgsAnimation`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCaptionArgsAnimation} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCaptionArgsAnimation`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCaptionArgsAnimation(name?: string) {
    return this.methodSession(`29`, name)
  }
  /**
   * Session method key builder for `handleSessionCommandCaptionAnimation`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCommandCaptionAnimation} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCommandCaptionAnimation`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCommandCaptionAnimation(name?: string) {
    return this.methodSession(`30`, name)
  }
  /**
   * Session method key builder for `handleSessionCommandCaptionArgsAnimation`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCommandCaptionArgsAnimation} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCommandCaptionArgsAnimation`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCommandCaptionArgsAnimation(name?: string) {
    return this.methodSession(`31`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeAnimation`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeAnimation} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeAnimation`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeAnimation(name?: string) {
    return this.methodSession(`32`, name)
  }
  // voice method
  /**
   * Session method key builder for `handleSessionCaptionVoice`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCaptionVoice} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCaptionVoice`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCaptionVoice(name?: string) {
    return this.methodSession(`33`, name)
  }
  /**
   * Session method key builder for `handleSessionCaptionArgsVoice`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCaptionArgsVoice} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCaptionArgsVoice`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCaptionArgsVoice(name?: string) {
    return this.methodSession(`34`, name)
  }
  /**
   * Session method key builder for `handleSessionCommandCaptionVoice`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCommandCaptionVoice} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCommandCaptionVoice`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCommandCaptionVoice(name?: string) {
    return this.methodSession(`35`, name)
  }
  /**
   * Session method key builder for `handleSessionCommandCaptionArgsVoice`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionCommandCaptionArgsVoice} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionCommandCaptionArgsVoice`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionCommandCaptionArgsVoice(name?: string) {
    return this.methodSession(`36`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeVoice`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeVoice} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeVoice`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeVoice(name?: string) {
    return this.methodSession(`37`, name)
  }
  // video note method
  /**
   * Session method key builder for `handleSessionFreeVideoNote`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeVideoNote} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeVideoNote`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeVideoNote(name?: string) {
    return this.methodSession(`38`, name)
  }
  // sticker method
  /**
   * Session method key builder for `handleSessionFreeSticker`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeSticker} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeSticker`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeSticker(name?: string) {
    return this.methodSession(`39`, name)
  }
  // location method
  /**
   * Session method key builder for `handleSessionFreeLocation`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeLocation} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeLocation`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeLocation(name?: string) {
    return this.methodSession(`40`, name)
  }
  // contact method
  /**
   * Session method key builder for `handleSessionFreeContact`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeContact} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeContact`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeContact(name?: string) {
    return this.methodSession(`41`, name)
  }

  // chat member method
  /**
   * Session method key builder for `handleSessionChatMemberOutIn`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionChatMemberOutIn} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionChatMemberOutIn`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionChatMemberOutIn(name?: string) {
    return this.methodSession(`42`, name)
  }
  /**
   * Session method key builder for `handleSessionMyChatMemberOutRegular`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionMyChatMemberOutRegular} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionMyChatMemberOutRegular`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionMyChatMemberOutRegular(name?: string) {
    return this.methodSession(`43`, name)
  }
  /**
   * Session method key builder for `handleSessionMyChatMemberOutAdmin`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionMyChatMemberOutAdmin} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionMyChatMemberOutAdmin`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionMyChatMemberOutAdmin(name?: string) {
    return this.methodSession(`44`, name)
  }
  /**
   * Session method key builder for `handleSessionMyChatMemberRegularAdmin`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionMyChatMemberRegularAdmin} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionMyChatMemberRegularAdmin`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionMyChatMemberRegularAdmin(name?: string) {
    return this.methodSession(`45`, name)
  }
  /**
   * Session method key builder for `handleSessionMyChatMemberAdminRegular`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionMyChatMemberAdminRegular} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionMyChatMemberAdminRegular`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionMyChatMemberAdminRegular(name?: string) {
    return this.methodSession(`46`, name)
  }

  /**
   * Session method key builder for `handleSessionFreeChannelPost`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeChannelPost} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeChannelPost`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeChannelPost(name?: string) {
    return this.methodSession(`47`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeEditChannelPost`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeEditChannelPost} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeEditChannelPost`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeEditChannelPost(name?: string) {
    return this.methodSession(`48`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeEdit`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeEdit} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeEdit`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeEdit(name?: string) {
    return this.methodSession(`49`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeReaction`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeReaction} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeReaction`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeReaction(name?: string) {
    return this.methodSession(`50`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeInlineQuery`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeInlineQuery} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeInlineQuery`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeInlineQuery(name?: string) {
    return this.methodSession(`51`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeChosenInlineResult`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeChosenInlineResult} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeChosenInlineResult`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeChosenInlineResult(name?: string) {
    return this.methodSession(`52`, name)
  }
  /**
   * Session method key builder for `handleSessionFreePreCheckoutQuery`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreePreCheckoutQuery} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreePreCheckoutQuery`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreePreCheckoutQuery(name?: string) {
    return this.methodSession(`53`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeShippingQuery`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeShippingQuery} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeShippingQuery`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeShippingQuery(name?: string) {
    return this.methodSession(`54`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeChatJoinRequest`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeChatJoinRequest} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeChatJoinRequest`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeChatJoinRequest(name?: string) {
    return this.methodSession(`55`, name)
  }
  /**
   * Session method key builder for `handleSessionFreePoll`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreePoll} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreePoll`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreePoll(name?: string) {
    return this.methodSession(`56`, name)
  }
  /**
   * Session method key builder for `handleSessionFreePollAnswer`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreePollAnswer} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreePollAnswer`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreePollAnswer(name?: string) {
    return this.methodSession(`57`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeNewChatMembers`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeNewChatMembers} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeNewChatMembers`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeNewChatMembers(name?: string) {
    return this.methodSession(`58`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeLeftChatMember`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeLeftChatMember} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeLeftChatMember`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeLeftChatMember(name?: string) {
    return this.methodSession(`59`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeBusinessConnection`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeBusinessConnection} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeBusinessConnection`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeBusinessConnection(name?: string) {
    return this.methodSession(`60`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeBusinessMessage`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeBusinessMessage} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeBusinessMessage`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeBusinessMessage(name?: string) {
    return this.methodSession(`61`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeEditedBusinessMessage`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeEditedBusinessMessage} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeEditedBusinessMessage`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeEditedBusinessMessage(name?: string) {
    return this.methodSession(`62`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeDeletedBusinessMessages`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeDeletedBusinessMessages} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeDeletedBusinessMessages`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeDeletedBusinessMessages(name?: string) {
    return this.methodSession(`63`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeMessageReactionCount`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeMessageReactionCount} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeMessageReactionCount`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeMessageReactionCount(name?: string) {
    return this.methodSession(`64`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeChatBoost`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeChatBoost} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeChatBoost`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeChatBoost(name?: string) {
    return this.methodSession(`65`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeRemovedChatBoost`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeRemovedChatBoost} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeRemovedChatBoost`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeRemovedChatBoost(name?: string) {
    return this.methodSession(`66`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeSuccessfulPayment`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeSuccessfulPayment} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeSuccessfulPayment`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeSuccessfulPayment(name?: string) {
    return this.methodSession(`67`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeRefundedPayment`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeRefundedPayment} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeRefundedPayment`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeRefundedPayment(name?: string) {
    return this.methodSession(`68`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeGroupChatCreated`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeGroupChatCreated} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeGroupChatCreated`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeGroupChatCreated(name?: string) {
    return this.methodSession(`69`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeSupergroupChatCreated`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeSupergroupChatCreated} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeSupergroupChatCreated`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeSupergroupChatCreated(name?: string) {
    return this.methodSession(`70`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeChannelChatCreated`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeChannelChatCreated} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeChannelChatCreated`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeChannelChatCreated(name?: string) {
    return this.methodSession(`71`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeVideoChatStarted`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeVideoChatStarted} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeVideoChatStarted`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeVideoChatStarted(name?: string) {
    return this.methodSession(`72`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeVideoChatScheduled`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeVideoChatScheduled} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeVideoChatScheduled`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeVideoChatScheduled(name?: string) {
    return this.methodSession(`73`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeVideoChatEnded`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeVideoChatEnded} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeVideoChatEnded`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeVideoChatEnded(name?: string) {
    return this.methodSession(`74`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeVideoChatParticipantsInvited`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeVideoChatParticipantsInvited} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeVideoChatParticipantsInvited`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeVideoChatParticipantsInvited(name?: string) {
    return this.methodSession(`75`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeUserShared`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeUserShared} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeUserShared`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeUserShared(name?: string) {
    return this.methodSession(`76`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeChatShared`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeChatShared} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeChatShared`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeChatShared(name?: string) {
    return this.methodSession(`77`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeWebAppData`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeWebAppData} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeWebAppData`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeWebAppData(name?: string) {
    return this.methodSession(`78`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeGiveaway`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeGiveaway} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeGiveaway`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeGiveaway(name?: string) {
    return this.methodSession(`79`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeGiveawayCreated`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeGiveawayCreated} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeGiveawayCreated`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeGiveawayCreated(name?: string) {
    return this.methodSession(`80`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeGiveawayWinners`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeGiveawayWinners} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeGiveawayWinners`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeGiveawayWinners(name?: string) {
    return this.methodSession(`81`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeGiveawayCompleted`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeGiveawayCompleted} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeGiveawayCompleted`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeGiveawayCompleted(name?: string) {
    return this.methodSession(`82`, name)
  }
  /**
   * Session method key builder for `handleSessionFreePinMessage`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreePinMessage} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreePinMessage`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreePinMessage(name?: string) {
    return this.methodSession(`83`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeForumTopicCreated`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeForumTopicCreated} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeForumTopicCreated`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeForumTopicCreated(name?: string) {
    return this.methodSession(`84`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeForumTopicEdited`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeForumTopicEdited} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeForumTopicEdited`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeForumTopicEdited(name?: string) {
    return this.methodSession(`85`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeForumTopicClosed`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeForumTopicClosed} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeForumTopicClosed`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeForumTopicClosed(name?: string) {
    return this.methodSession(`86`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeForumTopicReopened`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeForumTopicReopened} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeForumTopicReopened`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeForumTopicReopened(name?: string) {
    return this.methodSession(`87`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeGeneralForumTopicHidden`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeGeneralForumTopicHidden} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeGeneralForumTopicHidden`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeGeneralForumTopicHidden(name?: string) {
    return this.methodSession(`88`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeGeneralForumTopicUnhidden`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeGeneralForumTopicUnhidden} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeGeneralForumTopicUnhidden`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeGeneralForumTopicUnhidden(name?: string) {
    return this.methodSession(`89`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeProximityAlertTriggered`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeProximityAlertTriggered} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeProximityAlertTriggered`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeProximityAlertTriggered(name?: string) {
    return this.methodSession(`90`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeConnectedWebsite`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeConnectedWebsite} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeConnectedWebsite`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeConnectedWebsite(name?: string) {
    return this.methodSession(`91`, name)
  }
  /**
   * Session method key builder for `handleSessionFreePassportData`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreePassportData} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreePassportData`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreePassportData(name?: string) {
    return this.methodSession(`92`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeMessageAutoDeleteTimerChanged`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeMessageAutoDeleteTimerChanged} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeMessageAutoDeleteTimerChanged`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeMessageAutoDeleteTimerChanged(name?: string) {
    return this.methodSession(`93`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeChatBackgroundSet`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeChatBackgroundSet} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeChatBackgroundSet`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeChatBackgroundSet(name?: string) {
    return this.methodSession(`94`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeNewChatTitle`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeNewChatTitle} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeNewChatTitle`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeNewChatTitle(name?: string) {
    return this.methodSession(`95`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeNewChatPhoto`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeNewChatPhoto} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeNewChatPhoto`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeNewChatPhoto(name?: string) {
    return this.methodSession(`96`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeDeleteChatPhoto`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeDeleteChatPhoto} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeDeleteChatPhoto`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeDeleteChatPhoto(name?: string) {
    return this.methodSession(`97`, name)
  }
  /**
   * Session method key builder for `handleSessionFreeWriteAccessAllowed`.
   *
   * @remarks
   * Low-level: prefer the typed {@link Ctx.setSessionFreeWriteAccessAllowed} helper. Used by
   * session routing (id=1) to look up the active page for `handleSessionFreeWriteAccessAllowed`.
   *
   * @param name - Optional page name override (defaults to the page data name).
   * @returns The prefixed session method key (e.g. `1-PageName`).
   *
   * @public
   */
  methodSessionFreeWriteAccessAllowed(name?: string) {
    return this.methodSession(`98`, name)
  }
}
