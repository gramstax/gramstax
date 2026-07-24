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
import {TemplateManager} from "~/template/manager"
import {Context, InlineKeyboard, InputMediaBuilder, Keyboard} from "grammy"
import type {InputMediaAudio, InputMediaDocument, InputMediaPhoto, InputMediaVideo} from "grammy/types"
import {CacheExternal, ITCacheRpc} from "~/cache/external"
import type {ITMediaBlock} from "~/template/engine"
import type {
  ITInBoKb,
  ITData,
  ITOptEdit,
  ITBottomKb,
  ITInlineKb,
  ITOptReply,
  ITOptReplyVoice,
  ITOptReplyVideo,
  ITOptEditMedia1,
  ITOptEditMedia2,
  ITOptReplyAudio,
  ITOptReplyPhoto,
  ITOptReplyContact,
  ITOptReplySticker,
  ITOptReplyDocument,
  ITOptReplyLocation,
  ITOptReplyAnimation,
  ITOptReplyVideoNote,
  ITBottomKbParams,
  ITInlineKbParams,
  ITBuildDataOptions,
  ITTemp,
  ITPageData,
  ITKbCols,
  ITKbDest,
  ITCtxParams,
  ITOptReplyRich
} from "~/types/t.ctx"

type ITMediaGroupType = Extract<ITMediaBlock[`type`], `photo` | `video` | `audio` | `document`>
type ITMediaGroupInput = InputMediaAudio | InputMediaDocument | InputMediaPhoto | InputMediaVideo
type ITMediaGroupItem = NonNullable<ITMediaBlock[`mediaGroup`]>[number]

class Dynamic {
  static MEDIA_GROUP_TYPES = new Set<ITMediaBlock[`type`]>([`photo`, `video`, `audio`, `document`])
}

class Helper {
  static isMediaGroupType(type: ITMediaBlock[`type`]): type is ITMediaGroupType {
    return Dynamic.MEDIA_GROUP_TYPES.has(type)
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

  private static readonly ANSWER_API_METHODS = new Set([
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
    `answerCallbackQuery`,
    `answerInlineQuery`,
    `answerWebAppQuery`,
    `answerShippingQuery`,
    `answerPreCheckoutQuery`,
    `editMessageText`,
    `editMessageCaption`,
    `editMessageMedia`,
    `editMessageReplyMarkup`,
    `editMessageLiveLocation`,
    `stopMessageLiveLocation`,
    `deleteMessage`,
    `deleteMessages`,
    `forwardMessage`,
    `copyMessage`,
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
   * @public
   */
  static data: ITPageData<any>

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
  data = (this.constructor as Record<any, any>).data as ITPageData<any>

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
  cacheKeyboard: Map<any, any>

  /**
   * Template manager for message rendering.
   *
   * @public
   */
  templateManager: TemplateManager

  /**
   * Temporary state storage for the current request.
   *
   * @public
   */
  temp: ITTemp

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
  /** Tracks per-request Api instances where the answer guard transformer has already been installed */
  private static readonly _answerApiGuard = new WeakSet<object>()

  constructor(params: ITCtxParams) {
    const ct = params.ct ?? params
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
   * @param options - Optional grammY send options (or null to omit).
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
  async renderBroadcast(ids: number[], languageCode: string[], keyboard?: ITInBoKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptReply | null, throwError: boolean | null = false) {
    const res = {successCount: 0, failedCount: 0, totalCount: 0}
    res.totalCount = ids.length
    try {
      const limitFree = 30
      const msgs = languageCode.map((it) => this.templateManager.getGMessage(this.data.name, AGBaseId ?? undefined, it, data ?? undefined))
      for (let index = 0; index < ids.length; index++) {
        const id = ids[index]
        const msg = msgs[index]
        await this.api.sendMessage(id!, msg!, {
          parse_mode: `HTML`,
          reply_markup: keyboard ?? undefined,
          ...(options ?? {})
        })

        res.successCount += 1
        if (index + 1 == limitFree) {
          await setTimeout(1200)
        }
      }
    } catch (err) {
      res.failedCount += 1
      if (throwError) {
        throw {...res, err}
      }
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
   * @param options - Optional grammY send options for the inferred media type (or null to omit).
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
    throwError: boolean | null = false
  ) {
    const res = {successCount: 0, failedCount: 0, totalCount: 0}
    res.totalCount = ids.length
    try {
      const limitFree = 30
      const medias = languageCode.map((it) => this.templateManager.getGMedia(this.data.name, AGBaseId ?? undefined, it, data ?? undefined))

      for (let index = 0; index < ids.length; index++) {
        const id = ids[index]
        const med = medias[index]
        if (!med) {
          continue
        }
        const opt = {parse_mode: `HTML`, reply_markup: keyboard ?? undefined, ...(options ?? {})} as Record<any, any>

        if (med.type === `group` && med.mediaGroup && med.mediaGroup.length > 0) {
          await this.api.sendMediaGroup(id!, Helper.buildMediaGroupFromItems(med.mediaGroup, med.caption), Helper.buildMediaGroupOptions(opt))
          res.successCount += 1
          if (index + 1 == limitFree) {
            await setTimeout(1200)
          }
          continue
        }

        if (Helper.isMediaGroupType(med.type) && med.srcList && med.srcList.length > 1) {
          await this.api.sendMediaGroup(id!, Helper.buildMediaGroup(med.type, med.srcList, med.caption), Helper.buildMediaGroupOptions(opt))
          res.successCount += 1
          if (index + 1 == limitFree) {
            await setTimeout(1200)
          }
          continue
        }

        if (med.type == `photo`) await this.api.sendPhoto(id!, med.src!, {caption: med.caption!, ...opt})
        if (med.type == `video`) await this.api.sendVideo(id!, med.src!, {caption: med.caption!, ...opt})
        if (med.type == `audio`) await this.api.sendAudio(id!, med.src!, {caption: med.caption!, ...opt})
        if (med.type == `document`) await this.api.sendDocument(id!, med.src!, {caption: med.caption!, ...opt})
        if (med.type == `animation`) await this.api.sendAnimation(id!, med.src!, {caption: med.caption!, ...opt})
        if (med.type == `voice`) await this.api.sendVoice(id!, med.src!, opt)
        if (med.type == `video_note`) await this.api.sendVideoNote(id!, med.src!, opt)
        if (med.type == `sticker`) await this.api.sendSticker(id!, med.src!, opt)
        if (med.type == `location`) await this.api.sendLocation(id!, parseInt(med.latitude!), parseInt(med.longitude!), opt)
        if (med.type == `contact`) await this.api.sendContact(id!, med.phone!, med.first_name!, {vcard: med.vcard!, ...opt})

        res.successCount += 1
        if (index + 1 == limitFree) {
          await setTimeout(1200)
        }
      }
    } catch (err) {
      res.failedCount += 1
      if (throwError) {
        throw {...res, err}
      }
    }
    return res
  }

  /**
   * Sends a text message reply using the page template.
   *
   * @param keyboard - Optional keyboard markup from {@link (Ctx:class).inlineKeyboard} or {@link (Ctx:class).bottomKeyboard} (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template base ID position for block message (or null to use default).
   * @param options - Optional grammY reply options (or null to omit).
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
   * Sends a rich message reply using the page template.
   *
   * @remarks
   * Uses `replyWithRichMessage` (Telegram Bot API {@link TemplateEngine.BOT_API_VERSION})
   * to send structured rich text with headings, lists, tables, media, block
   * quotations, collapsible blocks, footnotes, and formulas.
   *
   * The page template's `<g-message>` HTML content is passed as the `html` field
   * of `InputRichMessage`. Use the Bot API 10.1 Rich HTML tags in your template
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
   * @param options2 - Optional grammY send options (or null to omit).
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
   * between {@link (Ctx:class).renderRich} and {@link (Ctx:class).renderEditRich} based on
   * the `isEdit` flag.
   *
   * @param keyboard - Optional keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template base ID (or null to use default).
   * @param options1 - Optional `InputRichMessage` fields (or null to omit).
   * @param options2 - Optional grammY send/edit options (or null to omit).
   * @param isEdit - If true, edits existing message; if false, sends new.
   *                 Defaults to `!!this.callbackQuery` (auto-detected).
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
  async renderAutoRich(keyboard?: ITInBoKb | null, data?: ITData | null, AGBaseId?: string | null, options1?: ITOptReplyRich[0] | null, options2?: ITOptReplyRich[1] | ITOptEdit | null, isEdit?: boolean | null) {
    const edit = isEdit ?? !!this.callbackQuery
    if (edit) {
      return await this.renderEditRich(keyboard as ITInlineKb, data, AGBaseId, options1, options2 as unknown as ITOptEdit)
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
   * If editing fails (e.g. message too old) and `fallbackReply` is true,
   * a new rich message reply is sent instead.
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
   * @param options2 - Optional grammY edit options (or null to omit).
   * @param fallbackReply - If true, sends a rich reply if edit fails. Default: false.
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
  async renderEditRich(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options1?: ITOptReplyRich[0] | null, options2?: ITOptEdit | null, fallbackReply: boolean | null = false) {
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
      if (fallbackReply) {
        await this.renderRich(keyboardInline, data, AGBaseId, options1, options2)
      } else {
        throw error
      }
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
    options?: (T extends `photo`
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
                        : undefined) | null
  ) {
    const med = this.templateManager.getGMedia(this.data.name, AGBaseId ?? undefined, this.from?.language_code, data ?? undefined)
    const opt = {parse_mode: `HTML`, reply_markup: keyboard ?? undefined, ...(options ?? {})} as Record<any, any>

    if (type == `photo`) return await this.replyWithPhoto(med.src!, {caption: med.caption!, ...opt})
    if (type == `video`) return await this.replyWithVideo(med.src!, {caption: med.caption!, ...opt})
    if (type == `audio`) return await this.replyWithAudio(med.src!, {caption: med.caption!, ...opt})
    if (type == `document`) return await this.replyWithDocument(med.src!, {caption: med.caption!, ...opt})
    if (type == `animation`) return await this.replyWithAnimation(med.src!, {caption: med.caption!, ...opt})
    if (type == `voice`) return await this.replyWithVoice(med.src!, opt)
    if (type == `video_note`) return await this.replyWithVideoNote(med.src!, opt)
    if (type == `sticker`) return await this.replyWithSticker(med.src!, opt)
    if (type == `location`) return await this.replyWithLocation(parseInt(med.latitude!), parseInt(med.longitude!), opt)
    if (type == `contact`) return await this.replyWithContact(med.phone!, med.first_name!, {vcard: med.vcard!, ...opt})
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
   *   await this.renderMediaGroup("photo")
   * }
   * ```
   *
   * @public
   */
  async renderMediaGroup(type?: ITMediaGroupType | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptReplyPhoto | ITOptReplyVideo | ITOptReplyAudio | ITOptReplyDocument | null) {
    const med = this.templateManager.getGMedia(this.data.name, AGBaseId ?? undefined, this.from?.language_code, data ?? undefined)
    const opt = {parse_mode: `HTML`, ...(options ?? {})} as Record<any, any>
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

  /** Sends a photo media group using pipe-delimited `src` values from the page template. */
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

  /** Sends a video media group using pipe-delimited `src` values from the page template. */
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

  /** Sends an audio media group using pipe-delimited `src` values from the page template. */
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

  /** Sends a document media group using pipe-delimited `src` values from the page template. */
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
   * between {@link (Ctx:class).render} and {@link (Ctx:class).renderEdit} based on the
   * `isEdit` flag.
   *
   * @remarks
   * When `isEdit` is `true`, delegates to `renderEdit` (inline keyboard only).
   * When `false`, delegates to `render` (inline or bottom keyboard).
   *
   * @param keyboard - Optional keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template base ID position for block message (or null to use default).
   * @param options - Optional grammY reply/edit options (or null to omit).
   * @param isEdit - If `true`, edits the existing message; if `false`, sends a new one.
   *                 Defaults to `!!this.callbackQuery` (auto-detected).
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
  async renderAuto(keyboard?: ITInBoKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptEdit | ITOptReply | null, isEdit?: boolean | null) {
    const edit = isEdit ?? !!this.callbackQuery
    if (edit) {
      return await this.renderEdit(keyboard as ITInlineKb, data, AGBaseId, options as ITOptEdit)
    }
    return await this.render(keyboard, data, AGBaseId, options as ITOptReply)
  }

  /**
   * Edits an existing message text using the page template.
   *
   * @remarks
   * If editing fails (e.g., message too old), falls back to sending a new reply
   * unless `fallbackReply` is set to false.
   *
   * @param keyboardInline - Optional inline keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block message (or null to use default).
   * @param options - Optional grammY edit options (or null to omit).
   * @param fallbackReply - If true, sends a reply if edit fails. Default: false.
   * @returns The edited message object.
   *
   * @example
   * ```typescript
   * async handleArgsCallback() {
   *   const kb = this.inlineKeyboard((k) => k.text("OK", "ok"))
   *   await this.renderEdit(kb, {status: "updated"})
   * }
   * ```
   *
   * @public
   */
  async renderEdit(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptEdit | null, fallbackReply: boolean | null = false) {
    try {
      const msg = this.templateManager.getGMessage(this.data.name, AGBaseId ?? undefined, this.from?.language_code, data ?? undefined)
      return await this.editMessageText(msg, {
        parse_mode: `HTML`,
        reply_markup: keyboardInline ?? undefined,
        ...(options ?? {})
      })
    } catch (error) {
      if (fallbackReply) {
        await this.render(keyboardInline, data, AGBaseId, options)
      } else {
        throw error
      }
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
   * @typeParam T - The media type to edit to.
   * @param type - The media type.
   * @param keyboardInline - Optional inline keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media (or null to use default).
   * @param options1 - Type-specific media options (or null to omit).
   * @param options2 - Additional edit options (or null to omit).
   * @param fallbackReply - If true, sends a reply if edit fails. Default: false.
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
    options1?: (T extends `voice`
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
                ITOptEditMedia1) | null,
    options2?: ITOptEditMedia2 | null,
    fallbackReply: boolean | null = false
  ) {
    try {
      const med = this.templateManager.getGMedia(this.data.name, AGBaseId ?? undefined, this.from?.language_code, data ?? undefined)
      const {src, caption} = med
      if (Helper.isMediaGroupType(type) && med.srcList && med.srcList.length > 1) {
        await this.deleteMessage()
        return await this.renderMediaGroup(type, data, AGBaseId)
      }
      if (type == `voice`) {
        await this.deleteMessage()
        return await this.renderVoice(keyboardInline, data, AGBaseId, options1)
      }
      if (type == `video_note`) {
        await this.deleteMessage()
        return await this.renderVoice(keyboardInline, data, AGBaseId, options1)
      }
      if (type == `sticker`) {
        await this.deleteMessage()
        return await this.renderSticker(keyboardInline, data, AGBaseId, options1 as Record<any, any>)
      }
      if (type == `location`) {
        await this.deleteMessage()
        return await this.renderLocation(keyboardInline, data, AGBaseId, options1 as Record<any, any>)
      }
      if (type == `contact`) {
        await this.deleteMessage()
        return await this.renderContact(keyboardInline, data, AGBaseId, options1 as Record<any, any>)
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
      if (fallbackReply === true) {
        await this.render(keyboardInline, data, AGBaseId, options2)
      } else {
        throw error
      }
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
  async renderEditPhoto(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options1?: ITOptEditMedia1 | null, options2?: ITOptEditMedia2 | null) {
    return await this.renderEditMedia(`photo`, keyboardInline, data, AGBaseId, options1, options2)
  }

  /**
   * Edits an existing message to show a video.
   *
   * @param keyboardInline - Optional inline keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type video (or null to use default).
   * @param options1 - Optional media options (or null to omit).
   * @param options2 - Optional edit options (or null to omit).
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
  async renderEditVideo(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options1?: ITOptEditMedia1 | null, options2?: ITOptEditMedia2 | null) {
    return await this.renderEditMedia(`video`, keyboardInline, data, AGBaseId, options1, options2)
  }

  /**
   * Edits an existing message to show an audio.
   *
   * @param keyboardInline - Optional inline keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type audio (or null to use default).
   * @param options1 - Optional media options (or null to omit).
   * @param options2 - Optional edit options (or null to omit).
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
  async renderEditAudio(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options1?: ITOptEditMedia1 | null, options2?: ITOptEditMedia2 | null) {
    return await this.renderEditMedia(`audio`, keyboardInline, data, AGBaseId, options1, options2)
  }

  /**
   * Edits an existing message to show a document.
   *
   * @param keyboardInline - Optional inline keyboard markup (or null to omit).
   * @param data - Optional template interpolation data (or null to omit).
   * @param AGBaseId - Optional template g-base ID position for block media type document (or null to use default).
   * @param options1 - Optional media options (or null to omit).
   * @param options2 - Optional edit options (or null to omit).
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
  async renderEditDocument(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options1?: ITOptEditMedia1 | null, options2?: ITOptEditMedia2 | null) {
    return await this.renderEditMedia(`document`, keyboardInline, data, AGBaseId, options1, options2)
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
    await this.deleteMessage()
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
  async renderEditAnimation(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options1?: ITOptEditMedia1 | null, options2?: ITOptEditMedia2 | null) {
    return await this.renderEditMedia(`animation`, keyboardInline, data, AGBaseId, options1, options2)
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
   * @returns The sent message object.
   *
   * @public
   */
  async renderEditVoice(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptEditMedia2 | null) {
    return await this.renderEditMedia(`voice`, keyboardInline, data, AGBaseId, options)
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
   * @returns The sent message object.
   *
   * @public
   */
  async renderEditVideoNote(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptEditMedia2 | null) {
    return await this.renderEditMedia(`video_note`, keyboardInline, data, AGBaseId, options)
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
   * @returns The sent message object.
   *
   * @public
   */
  async renderEditSticker(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptEditMedia2 | null) {
    return await this.renderEditMedia(`sticker`, keyboardInline, data, AGBaseId, options)
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
   * @returns The sent message object.
   *
   * @public
   */
  async renderEditLocation(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptEditMedia2 | null) {
    return await this.renderEditMedia(`location`, keyboardInline, data, AGBaseId, options)
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
   * @returns The sent message object.
   *
   * @public
   */
  async renderEditContact(keyboardInline?: ITInlineKb | null, data?: ITData | null, AGBaseId?: string | null, options?: ITOptEditMedia2 | null) {
    return await this.renderEditMedia(`contact`, keyboardInline, data, AGBaseId, options)
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
  async setSession(method: string | string[], params: any, moreRoot?: Record<any, any>) {
    try {
      const value = {method, params, ...moreRoot}
      const result = await this.cacheSession.set(`${this.from?.id}`, value)
      if (result) {
        this.temp.session = value
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
    try {
      const result = await this.cacheSession.get(`${this.from?.id}`)
      if (result) this.temp.session = result
      return result || null
    } catch {
      return null
    }
  }

  /**
   * Clears session data for the current user.
   *
   * @remarks
   * Removes the session from external cache and resets the local session property.
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
      const result = await this.cacheSession.delete(`${this.from?.id}`)
      if (result) this.temp.session = {}
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
  static buildData<C extends (...args: any[]) => any>(callbackQueryData: C): ITPageData<Parameters<C>>

  /**
   * Creates page routing data configuration with options.
   *
   * @param options - Configuration options (or null to use defaults). See {@link ITBuildDataOptions} for details.
   * @returns The page data configuration object.
   *
   * @public
   */
  static buildData<C extends (...args: any[]) => any>(options: ITBuildDataOptions | null): ITPageData<Parameters<C>>

  /**
   * Creates page routing data configuration with options (no type inference).
   *
   * @param options - Configuration options (or null to use defaults). See {@link ITBuildDataOptions} for details.
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
  static buildData(params?: any | null): ITPageData<any> {
    const isFunc = typeof params === `function`
    const options = isFunc ? {callbackQueryData: params} : (params ?? {})
    const cbd = options.callbackQueryData
    const addPld = this.prototype.addArgs.bind(this.prototype)

    const name = options.name ?? ``
    const data: ITPageData<any> = {
      name,
      intentText: options.intentText ?? name,
      intentCommandText: options.intentCommandText ?? name,
      intentCallbackQueryData: name,
      callbackQueryData: cbd
        ? function (this: {intentCallbackQueryData: string}, ...args: any[]): string {
            return addPld(this.intentCallbackQueryData, `colon`, cbd(...args))
          }
        : function (this: {intentCallbackQueryData: string}): string {
            return this?.intentCallbackQueryData
          },
      _positionArgText: options.intentText ? options.intentText.split(this.prototype.getSeperatorTag(`space`)).length : (undefined as any)
    }
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
  keyboardCols<T = any>(k: T, l: string[], layout: ITKbCols, cb: (e: string, i: number) => any): T {
    const [colsStr, lastRowStr] = layout.split(`-`)
    const cols = parseInt(colsStr!)
    const lastRow = lastRowStr ? parseInt(lastRowStr) : null
    const total = l.length
    const kb = k as any
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
  bottomKeyboardT(layout: ITKbCols = `1`, AGBaseId?: string | null, data?: Record<any, any> | null) {
    return this.bottomKeyboard(
      (k, a) => {
        return this.keyboardCols(k, a, layout, (e) => k.text(e))
      },
      {AGBaseId: AGBaseId ?? undefined, data: data ?? undefined}
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
          const data = typeof page == `string` ? page : page.data.callbackQueryData()
          k.text(e, data)
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
    if (params?.cache === true) {
      const key = `${tkey}:${this.from?.language_code}:i`
      const ckb = this.cacheKeyboard.get(key)
      if (!ckb) {
        const ikb = new InlineKeyboard()
        const arr = this.templateManager.getGKeyboard(tkey, params?.AGBaseId ?? undefined, this.from?.language_code, `inline`, params?.data ?? undefined)
        const rkb = callback(ikb, arr)
        this.cacheKeyboard.set(key, rkb)
        return rkb
      }
      return ckb
    }
    const ikb = new InlineKeyboard()
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
    if (params?.cache === true) {
      const key = `${tkey}:${this.from?.language_code}:b`
      const ckb = this.cacheKeyboard.get(key)
      if (!ckb) {
        const kb = new Keyboard()
        const arr = this.templateManager.getGKeyboard(tkey, params?.AGBaseId ?? undefined, this.from?.language_code, `bottom`, params?.data ?? undefined)
        const rkb = callback(kb, arr)
        rkb.resized(true)
        this.cacheKeyboard.set(key, rkb)
        return rkb
      }
      return ckb
    }
    const kb = new Keyboard()
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
    return mtd == `space` ? ` ` : `:`
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
  addArgs(str = ``, mtd: Parameters<typeof this.getSeperatorTag>[0], pld: (string | undefined)[]) {
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
    return positionEnd == 1 ? (spl[0] as string) : spl.slice(0, positionEnd).join(tag)
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
  async handleCallbackQueryData?(): Promise<any>

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
  async handleArgsCallbackQueryData?(): Promise<any>

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
  async handleText?(): Promise<any>

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
  async handleArgsText?(): Promise<any>

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
  async handleCommandText?(): Promise<any>

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
  async handleCommandArgsText?(): Promise<any>

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
  async handleFreeText?(): Promise<any>

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
  async handleCaptionPhoto?(): Promise<any>

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
  async handleCaptionArgsPhoto?(): Promise<any>

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
  async handleCommandCaptionPhoto?(): Promise<any>

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
  async handleCommandCaptionArgsPhoto?(): Promise<any>

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
  async handleFreePhoto?(): Promise<any>

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
  async handleCaptionVideo?(): Promise<any>

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
  async handleCaptionArgsVideo?(): Promise<any>

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
  async handleCommandCaptionVideo?(): Promise<any>

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
  async handleCommandCaptionArgsVideo?(): Promise<any>

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
  async handleFreeVideo?(): Promise<any>

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
  async handleCaptionAudio?(): Promise<any>

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
  async handleCaptionArgsAudio?(): Promise<any>

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
  async handleCommandCaptionAudio?(): Promise<any>

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
  async handleCommandCaptionArgsAudio?(): Promise<any>

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
  async handleFreeAudio?(): Promise<any>

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
  async handleCaptionDocument?(): Promise<any>

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
  async handleCaptionArgsDocument?(): Promise<any>

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
  async handleCommandCaptionDocument?(): Promise<any>

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
  async handleCommandCaptionArgsDocument?(): Promise<any>

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
  async handleFreeDocument?(): Promise<any>

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
  async handleCaptionAnimation?(): Promise<any>

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
  async handleCaptionArgsAnimation?(): Promise<any>

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
  async handleCommandCaptionAnimation?(): Promise<any>

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
  async handleCommandCaptionArgsAnimation?(): Promise<any>

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
  async handleFreeAnimation?(): Promise<any>

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
  async handleCaptionVoice?(): Promise<any>

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
  async handleCaptionArgsVoice?(): Promise<any>

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
  async handleCommandCaptionVoice?(): Promise<any>

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
  async handleCommandCaptionArgsVoice?(): Promise<any>

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
  async handleFreeVoice?(): Promise<any>

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
  async handleFreeVideoNote?(): Promise<any>

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
  async handleFreeSticker?(): Promise<any>

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
  async handleFreeLocation?(): Promise<any>

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
  async handleFreeContact?(): Promise<any>

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
  async handleFree?(): Promise<any>

  // =============== handleSession* route function (session-aware)
  /**
   * Session-aware route handler for callback queries without args.
   *
   * @remarks
   * Mirrors the corresponding `handle*` method. Dispatched automatically by
   * `_pageRoutes` id=1 (session routing) when:
   *   1. The user has an active session (`session.method` is set)
   *   2. `session.method` matches the method key registered for this route
   *      (computed by the corresponding `methodSession*()`)
   *   3. The route name ends with `fromListener` — ensuring only the correct
   *      update type triggers it (callback queries match `*CallbackQueryData` only;
   *      text matches `*Text` only; etc.)
   *
   * Define `handleSession*` to handle session flows separately from normal
   * flows. The regular `handle*` will only be called for non-session flows
   * because id=1 dispatches before id=2 ever runs.
   *
   * Works with ALL route types: CallbackQueryData, ArgsCallbackQueryData, Text,
   * CommandText, FreeText, CaptionPhoto, etc.
   *
   * @example
   * ```typescript
   * // handle* — invoked via id=2 (static) when no session matches in id=1
   * async handleCallbackQueryData() {
   *   await this.editMessageText(`normal flow: ${this.callbackQueryData}`)
   * }
   *
   * // handleSession* — invoked via id=1 (session) when session.method matches
   * async handleSessionCallbackQueryData() {
   *   const {inputText} = this.temp.session.params
   *   await this.editMessageText(`session-active: ${inputText}`)
   * }
   * ```

   * @example
   * ```typescript
   * async handleArgsCallbackQueryData() {
   *   await this.editMessageText(`normal: ${this.callbackQueryData}`)
   * }
   * async handleSessionArgsCallbackQueryData() {
   *   const {inputText} = this.temp.session.params
   *   await this.editMessageText(`session: ${this.callbackQueryData}, params: ${inputText}`)
   * }
   * ```
   *
   * @virtual
   * @public
   */
  async handleSessionCallbackQueryData?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionArgsCallbackQueryData?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionText?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionArgsText?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCommandText?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCommandArgsText?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionFreeText?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCaptionPhoto?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCaptionArgsPhoto?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCommandCaptionPhoto?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCommandCaptionArgsPhoto?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionFreePhoto?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCaptionVideo?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCaptionArgsVideo?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCommandCaptionVideo?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCommandCaptionArgsVideo?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionFreeVideo?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCaptionAudio?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCaptionArgsAudio?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCommandCaptionAudio?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCommandCaptionArgsAudio?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionFreeAudio?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCaptionDocument?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCaptionArgsDocument?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCommandCaptionDocument?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCommandCaptionArgsDocument?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionFreeDocument?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCaptionAnimation?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCaptionArgsAnimation?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCommandCaptionAnimation?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCommandCaptionArgsAnimation?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionFreeAnimation?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCaptionVoice?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCaptionArgsVoice?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCommandCaptionVoice?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionCommandCaptionArgsVoice?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionFreeVoice?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionFreeVideoNote?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionFreeSticker?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionFreeLocation?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionFreeContact?(): Promise<any>
  /** {@inheritDoc Ctx.handleSessionCallbackQueryData} */
  async handleSessionFree?(): Promise<any>

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
  setSessionCallbackQueryData(params?: any) {
    return this.setSession(this.methodSessionCallbackQueryData(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionArgsCallbackQueryData(params?: any) {
    return this.setSession(this.methodSessionArgsCallbackQueryData(), params)
  }
  // text
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionText(params?: any) {
    return this.setSession(this.methodSessionText(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionArgsText(params?: any) {
    return this.setSession(this.methodSessionArgsText(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCommandText(params?: any) {
    return this.setSession(this.methodSessionCommandText(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCommandArgsText(params?: any) {
    return this.setSession(this.methodSessionCommandArgsText(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionFreeText(params?: any) {
    return this.setSession(this.methodSessionFreeText(), params)
  }
  // photo
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCaptionPhoto(params?: any) {
    return this.setSession(this.methodSessionCaptionPhoto(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCaptionArgsPhoto(params?: any) {
    return this.setSession(this.methodSessionCaptionArgsPhoto(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCommandCaptionPhoto(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionPhoto(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCommandCaptionArgsPhoto(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionArgsPhoto(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionFreePhoto(params?: any) {
    return this.setSession(this.methodSessionFreePhoto(), params)
  }
  // video
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCaptionVideo(params?: any) {
    return this.setSession(this.methodSessionCaptionVideo(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCaptionArgsVideo(params?: any) {
    return this.setSession(this.methodSessionCaptionArgsVideo(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCommandCaptionVideo(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionVideo(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCommandCaptionArgsVideo(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionArgsVideo(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionFreeVideo(params?: any) {
    return this.setSession(this.methodSessionFreeVideo(), params)
  }
  // audio
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCaptionAudio(params?: any) {
    return this.setSession(this.methodSessionCaptionAudio(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCaptionArgsAudio(params?: any) {
    return this.setSession(this.methodSessionCaptionArgsAudio(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCommandCaptionAudio(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionAudio(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCommandCaptionArgsAudio(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionArgsAudio(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionFreeAudio(params?: any) {
    return this.setSession(this.methodSessionFreeAudio(), params)
  }
  // document
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCaptionDocument(params?: any) {
    return this.setSession(this.methodSessionCaptionDocument(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCaptionArgsDocument(params?: any) {
    return this.setSession(this.methodSessionCaptionArgsDocument(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCommandCaptionDocument(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionDocument(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCommandCaptionArgsDocument(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionArgsDocument(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionFreeDocument(params?: any) {
    return this.setSession(this.methodSessionFreeDocument(), params)
  }
  // animation
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCaptionAnimation(params?: any) {
    return this.setSession(this.methodSessionCaptionAnimation(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCaptionArgsAnimation(params?: any) {
    return this.setSession(this.methodSessionCaptionArgsAnimation(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCommandCaptionAnimation(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionAnimation(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCommandCaptionArgsAnimation(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionArgsAnimation(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionFreeAnimation(params?: any) {
    return this.setSession(this.methodSessionFreeAnimation(), params)
  }
  // voice
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCaptionVoice(params?: any) {
    return this.setSession(this.methodSessionCaptionVoice(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCaptionArgsVoice(params?: any) {
    return this.setSession(this.methodSessionCaptionArgsVoice(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCommandCaptionVoice(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionVoice(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionCommandCaptionArgsVoice(params?: any) {
    return this.setSession(this.methodSessionCommandCaptionArgsVoice(), params)
  }
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionFreeVoice(params?: any) {
    return this.setSession(this.methodSessionFreeVoice(), params)
  }
  // video note
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionFreeVideoNote(params?: any) {
    return this.setSession(this.methodSessionFreeVideoNote(), params)
  }
  // sticker
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionFreeSticker(params?: any) {
    return this.setSession(this.methodSessionFreeSticker(), params)
  }
  // location
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionFreeLocation(params?: any) {
    return this.setSession(this.methodSessionFreeLocation(), params)
  }
  // contact
  /** {@inheritDoc Ctx.setSessionCallbackQueryData} */
  setSessionFreeContact(params?: any) {
    return this.setSession(this.methodSessionFreeContact(), params)
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
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCallbackQueryData(name?: string) {
    return this.methodSession(`1`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionArgsCallbackQueryData(name?: string) {
    return this.methodSession(`2`, name)
  }
  // text method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionText(name?: string) {
    return this.methodSession(`3`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionArgsText(name?: string) {
    return this.methodSession(`4`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandText(name?: string) {
    return this.methodSession(`5`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandArgsText(name?: string) {
    return this.methodSession(`6`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeText(name?: string) {
    return this.methodSession(`7`, name)
  }
  // photo method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionPhoto(name?: string) {
    return this.methodSession(`8`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionArgsPhoto(name?: string) {
    return this.methodSession(`9`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionPhoto(name?: string) {
    return this.methodSession(`10`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionArgsPhoto(name?: string) {
    return this.methodSession(`11`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreePhoto(name?: string) {
    return this.methodSession(`12`, name)
  }
  // video method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionVideo(name?: string) {
    return this.methodSession(`13`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionArgsVideo(name?: string) {
    return this.methodSession(`14`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionVideo(name?: string) {
    return this.methodSession(`15`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionArgsVideo(name?: string) {
    return this.methodSession(`16`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeVideo(name?: string) {
    return this.methodSession(`17`, name)
  }
  // audio method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionAudio(name?: string) {
    return this.methodSession(`18`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionArgsAudio(name?: string) {
    return this.methodSession(`19`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionAudio(name?: string) {
    return this.methodSession(`20`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionArgsAudio(name?: string) {
    return this.methodSession(`21`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeAudio(name?: string) {
    return this.methodSession(`22`, name)
  }
  // document method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionDocument(name?: string) {
    return this.methodSession(`23`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionArgsDocument(name?: string) {
    return this.methodSession(`24`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionDocument(name?: string) {
    return this.methodSession(`25`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionArgsDocument(name?: string) {
    return this.methodSession(`26`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeDocument(name?: string) {
    return this.methodSession(`27`, name)
  }
  // animation method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionAnimation(name?: string) {
    return this.methodSession(`28`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionArgsAnimation(name?: string) {
    return this.methodSession(`29`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionAnimation(name?: string) {
    return this.methodSession(`30`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionArgsAnimation(name?: string) {
    return this.methodSession(`31`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeAnimation(name?: string) {
    return this.methodSession(`32`, name)
  }
  // voice method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionVoice(name?: string) {
    return this.methodSession(`33`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCaptionArgsVoice(name?: string) {
    return this.methodSession(`34`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionVoice(name?: string) {
    return this.methodSession(`35`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionCommandCaptionArgsVoice(name?: string) {
    return this.methodSession(`36`, name)
  }
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeVoice(name?: string) {
    return this.methodSession(`37`, name)
  }
  // video note method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeVideoNote(name?: string) {
    return this.methodSession(`38`, name)
  }
  // sticker method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeSticker(name?: string) {
    return this.methodSession(`39`, name)
  }
  // location method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeLocation(name?: string) {
    return this.methodSession(`40`, name)
  }
  // contact method
  /** {@inheritDoc Ctx.methodSession} */
  methodSessionFreeContact(name?: string) {
    return this.methodSession(`41`, name)
  }
}

/** @internal */
export interface Ctx {
  replyWithStream(stream: Iterable<string | {text: string; entities?: any[]}> | AsyncIterable<string | {text: string; entities?: any[]}>, otherMessageDraft?: any, otherMessage?: any, signal?: AbortSignal): Promise<any>
  replyWithMarkdownStream(stream: Iterable<string> | AsyncIterable<string>, otherRichMessageDraft?: any, otherRichMessage?: any, baseInputRichMessage?: any, signal?: AbortSignal): Promise<any>
  replyWithHtmlStream(stream: Iterable<string> | AsyncIterable<string>, otherRichMessageDraft?: any, otherRichMessage?: any, baseInputRichMessage?: any, signal?: AbortSignal): Promise<any>
}
