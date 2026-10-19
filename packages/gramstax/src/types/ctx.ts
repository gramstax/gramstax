import type {StreamFlavor} from "@grammyjs/stream"
import type {Context, InlineKeyboard, InputFile, Keyboard, Middleware} from "grammy"
import type {InlineQueryResult} from "grammy/types"

export type {StreamFlavor}

import type {CacheExternal} from "~/cache/external"
import type {Ctx} from "~/core/ctx"
import type {LoggingHelper} from "~/helpers/log"
import type {TemplateManager} from "~/template/manager"
import type {ICacheRpc} from "./cache"
import type {IMediaBlock} from "./template"

/**
 * Page class/instance that defines `handleCallbackQueryData`.
 *
 * @remarks
 * Same constraint as {@link IKbDest}: pages that don't override
 * `handleCallbackQueryData` cause a compile error when used here.
 *
 * @public
 */
export type IKbPageLike = (typeof Ctx & IKbDestHasCallback) | (Ctx & IKbDestHasCallback[`prototype`])

/**
 * grammY button object whose `text` may also be a page class/instance.
 *
 * @remarks
 * `{text: SomePage, style: "danger"}` — the page resolves to its
 * `intentText` label; the page must define `handleCallbackQueryData`.
 *
 * @public
 */
export type IKbButtonWithPageText = Omit<Extract<Parameters<InlineKeyboard[`text`]>[0], object>, `text`> & {text: string | IKbPageLike}

/**
 * Inline keyboard whose `.text()` also accepts a page class/instance as
 * callback data — calls `page.data.callbackQueryData()` automatically.
 *
 * @example
 * ```ts
 * k.text(`Settings`, SettingsPage)
 * // equivalent to: k.text(`Settings`, SettingsPage.data.callbackQueryData())
 * ```
 *
 * @public
 */
export interface IInlineKbWithCtx extends InlineKeyboard {
  /**
   * Add a callback button. `text` and/or `data` can be a page (class/instance)
   * or string. A page passed as `text` resolves to its `intentText` label; a
   * page passed as `data` resolves to its `callbackQueryData()`.
   *
   * When `data` is a callback data object (`Page.data.callbackQueryData(...)`),
   * the destination page must define `handleCallbackQueryData` (no args) or
   * `handleArgsCallbackQueryData` (with args) — enforced at compile time.
   *
   * @param text - string, grammY button object (or with page text), or class Page (resolves to intentText)
   * @param data - string callback_data, grammY button object, class Page, or callback data object from `page.data.callbackQueryData(...)`
   */
  text<D extends IKbCallbackData<typeof Ctx, Array<string | undefined>>>(text: Parameters<InlineKeyboard[`text`]>[0] | IKbPageLike | IKbButtonWithPageText, data: D & IKbCallbackDataCheck<D>): this
  text(text: Parameters<InlineKeyboard[`text`]>[0] | IKbPageLike | IKbButtonWithPageText, data?: Parameters<InlineKeyboard[`text`]>[1] | IKbPageLike): this
}

/**
 * Reply keyboard whose `.text()` also accepts a page class/instance as the
 * button text — resolves to `page.data.intentText` automatically.
 *
 * @example
 * ```ts
 * k.text(BalancePage)
 * // equivalent to: k.text(BalancePage.data.intentText)
 * ```
 *
 * @public
 */
export interface IBottomKbWithCtx extends Keyboard {
  /**
   * Add a text button. `text` is a page (class/instance) or string.
   *
   * @param text - string or class Page
   * @param options - for styling
   */
  text(text: string | typeof Ctx | Ctx, options?: Parameters<Keyboard[`text`]>[1]): this
}

/**
 * Inline keyboard whose `.text()` also accepts a page class/instance as the
 * callback data — resolves to `page.data.callbackQueryData()` automatically.
 *
 * @public
 */
export type IInlineKb = IInlineKbWithCtx

/**
 * Reply keyboard whose `.text()` also accepts a page class/instance as the
 * button text — resolves to `page.data.intentText` automatically.
 *
 * @public
 */
export type IBottomKb = IBottomKbWithCtx

/**
 * Union type for both inline and reply keyboards.
 *
 * @remarks
 * Allows methods to accept either keyboard type.
 *
 * @public
 */
export type IInBoKb = IBottomKb | IInlineKb

/**
 * Type alias for Context.
 *
 * @remarks
 * The main context object containing update information and bot methods.
 *
 * @public
 */
export type ICt = Context

/**
 * Type alias for Middleware.
 *
 * @remarks
 * Middleware used to handle updates.
 *
 * @public
 */
export type ICtMiddleware<C extends ICt = ICt> = Middleware<C>

/**
 * Options tuple mirroring `Context.replyWithRichMessage`.
 *
 * @public
 */
export type IOptReplyRich = Parameters<Context[`replyWithRichMessage`]>

/**
 * Poll send options — `Ctx.replyWithPoll` argument index `[2]` (the `other` bag
 * of `sendPoll`).
 *
 * @public
 */
export type IOptPoll = Parameters<Ctx[`replyWithPoll`]>[2]

/**
 * Invoice send options — `Ctx.replyWithInvoice` argument index `[5]` (the
 * `other` bag of `sendInvoice`). `provider_token` is deliberately NOT part of
 * this type: the payment provider secret is content, not a call option, and
 * rides on the invoice params' own `provider_token` field.
 *
 * @public
 */
export type IOptInvoice = Parameters<Ctx[`replyWithInvoice`]>[5]

/**
 * Paid-media send options — `Ctx.replyWithPaidMedia` argument index `[2]` (the
 * `other` bag of `sendPaidMedia`).
 *
 * @public
 */
export type IOptPaidMedia = Parameters<Ctx[`replyWithPaidMedia`]>[2]

/**
 * Venue send options — `Ctx.replyWithVenue` argument index `[4]` (the `other`
 * bag of `sendVenue`).
 *
 * @public
 */
export type IOptVenue = Parameters<Ctx[`replyWithVenue`]>[4]

/**
 * Dice send options — `Ctx.replyWithDice` argument index `[1]` (the `other` bag
 * of `sendDice`).
 *
 * @public
 */
export type IOptDice = Parameters<Ctx[`replyWithDice`]>[1]

/**
 * Options parameter mirroring `Context.reply`.
 *
 * @public
 */
export type IOptReply = Parameters<Context[`reply`]>[1]

/**
 * Options parameter mirroring `Context.replyWithPhoto`.
 *
 * @public
 */
export type IOptReplyPhoto = Parameters<Context[`replyWithPhoto`]>[1]

/**
 * Options parameter mirroring `Context.replyWithVideo`.
 *
 * @public
 */
export type IOptReplyVideo = Parameters<Context[`replyWithVideo`]>[1]

/**
 * Options parameter mirroring `Context.replyWithAudio`.
 *
 * @public
 */
export type IOptReplyAudio = Parameters<Context[`replyWithAudio`]>[1]

/**
 * Options parameter mirroring `Context.replyWithDocument`.
 *
 * @public
 */
export type IOptReplyDocument = Parameters<Context[`replyWithDocument`]>[1]

/**
 * Options parameter mirroring `Context.replyWithAnimation`.
 *
 * @public
 */
export type IOptReplyAnimation = Parameters<Context[`replyWithAnimation`]>[1]

/**
 * Options parameter mirroring `Context.replyWithVoice`.
 *
 * @public
 */
export type IOptReplyVoice = Parameters<Context[`replyWithVoice`]>[1]

/**
 * Options parameter mirroring `Context.replyWithVideoNote`.
 *
 * @public
 */
export type IOptReplyVideoNote = Parameters<Context[`replyWithVideoNote`]>[1]

/**
 * Options parameter mirroring `Context.replyWithSticker`.
 *
 * @public
 */
export type IOptReplySticker = Parameters<Context[`replyWithSticker`]>[1]

/**
 * Options parameter mirroring `Context.replyWithLocation`.
 *
 * @public
 */
export type IOptReplyLocation = Parameters<Context[`replyWithLocation`]>[2]

/**
 * Options parameter mirroring `Context.replyWithContact`.
 *
 * @public
 */
export type IOptReplyContact = Parameters<Context[`replyWithContact`]>[2]

/**
 * Options parameter mirroring `Context.editMessageText`.
 *
 * @public
 */
export type IOptEdit = Parameters<Context[`editMessageText`]>[1]

/**
 * Route-completeness marker: fields this route never reads.
 *
 * @remarks
 * The render params types are disjoint unions over their runtime routes.
 * Declaring an unread field as `never` is load-bearing: merely omitting the
 * field from that member still lets TypeScript accept it (its
 * excess-property check treats a property as known when ANY union member
 * declares it), so `never` is what turns "silently ignored" into a compile
 * error.
 *
 * @public
 */
export type INeverFields<K extends PropertyKey> = {[P in K]?: never}

/**
 * Rich-edit options — fields legal on BOTH the rich send and the rich edit.
 *
 * @remarks
 * `NonNullable<IOptReplyRich[1]> & IOptEdit`: a key that only
 * `replyWithRichMessage` accepts cannot reach `editMessageText`. The old
 * `[payload, options?]` tuple is gone — the `InputRichMessage` payload rides on
 * the route atoms' `rich` field and these options on their `richOptions`
 * field, so neither is a tuple anymore.
 *
 * @public
 */
export type IOptRich = NonNullable<IOptReplyRich[1]> & IOptEdit

/**
 * Rich-send options — the options bag of `replyWithRichMessage` alone.
 *
 * @remarks
 * The narrow counterpart of {@link IOptRich}, for routes that can only ever make
 * the rich SEND: reply, chunked and broadcast-send. Without it those routes
 * would have no field for the rich call's options at all, and the runtime would
 * have to drop them.
 *
 * @public
 */
export type IOptRichSend = NonNullable<IOptReplyRich[1]>

/**
 * Route atom: runtime-decided single message.
 *
 * @remarks
 * `auto` edits when the update carries a `callbackQuery`, otherwise replies —
 * so `keyboard` may be inline OR bottom (the runtime picks the call). It is the
 * only atom that reads every one of the ten universal route keys: `options`
 * feeds the reply, `editOptions` the edit, `fallbackOptions` the resend after a
 * failed edit, and `rich`/`richOptions` the rich payload and its
 * edit-legal options.
 *
 * @public
 */
export type IRouteAuto = {
  /**
   * Send-versus-edit resolution, decided at runtime from the update.
   *
   * @defaultValue `auto`
   */
  mode?: `auto`
  /**
   * Optional keyboard markup from `inlineKeyboard`/`bottomKeyboard` (or null to
   * omit).
   *
   * @remarks
   * Routes that can send accept a bottom keyboard as well. Routes that always
   * reach `editMessageText` narrow this to inline markup — see `IRouteEdit`.
   *
   * @defaultValue `null` (no keyboard)
   */
  keyboard?: IInBoKb | null
  /**
   * Optional `InputRichMessage` payload for a rich template.
   *
   * @remarks
   * Rich-versus-plain content is decided at COMPILE time by the `<g-message>`
   * block contents, not by these params: a route carries both `options` (plain
   * text) and `rich` (rich payload), and the block decides which one is read.
   * Passing the other one logs a one-time `log.warn` and is ignored — never a
   * throw, since a `--watch` hot reload can flip a page rich↔plain in one
   * process.
   *
   * @defaultValue `null` (plain template)
   */
  rich?: IOptReplyRich[0] | null
  /**
   * Optional rich-edit options: fields legal on both the rich send and the rich
   * edit, so no key reaches a call that cannot honour it.
   *
   * @defaultValue `null` (no extra options)
   */
  richOptions?: IOptRich | null
  /**
   * Optional plain-text reply/send options, spread into the reply call.
   *
   * @defaultValue `null` (no extra options)
   */
  options?: IOptReply | null
  /**
   * Optional plain-text edit options, spread into the `editMessageText` call.
   *
   * @defaultValue `null` (no extra options)
   */
  editOptions?: IOptEdit | null
  /**
   * Optional reply options for the fallback resend, used when the edit fails
   * and `fallback` resends instead of rethrowing.
   *
   * @defaultValue `null` (no extra options)
   */
  fallbackOptions?: IOptReply | null
  /**
   * Fallback when the edit fails.
   *
   * @defaultValue `delete-reply`
   */
  fallback?: IOptFallbackEdit
  /**
   * Never read on this route — omit (or pass `null`) for a single-chat
   * send/edit.
   */
  broadcast?: null | undefined
  /**
   * Never read on this route — omit (or pass `null`) for a single message.
   */
  chunkSize?: null | undefined
}

/**
 * Route atom: forced single-message send.
 *
 * @remarks
 * `mode: 'reply'` always sends a new message, even from a callback query, so no
 * edit can happen: the edit-only keys (`editOptions`, `fallbackOptions`) and
 * `fallback` are never read — a forced reply never edits, so there is no edit to
 * fall back from. `richOptions` stays live here because the rich SEND still
 * happens; only the rich EDIT is unreachable.
 *
 * @public
 */
export type IRouteReply = INeverFields<`editOptions` | `fallbackOptions` | `fallback`> & {
  /**
   * Forces a new message even from a callback query.
   */
  mode: `reply`
  /**
   * Optional keyboard markup from `inlineKeyboard`/`bottomKeyboard` (or null to
   * omit).
   *
   * @defaultValue `null` (no keyboard)
   */
  keyboard?: IInBoKb | null
  /**
   * Optional `InputRichMessage` payload for a rich template. The block decides
   * rich-versus-plain at compile time — see `IRouteAuto`.
   *
   * @defaultValue `null` (plain template)
   */
  rich?: IOptReplyRich[0] | null
  /**
   * Optional options for the rich send (`replyWithRichMessage`). The block
   * decides rich-versus-plain at compile time — see `IRouteAuto`.
   *
   * @defaultValue `null` (no extra options)
   */
  richOptions?: IOptRichSend | null
  /**
   * Optional plain-text reply options.
   *
   * @defaultValue `null` (no extra options)
   */
  options?: IOptReply | null
  /**
   * Never read on this route — omit (or pass `null`) for a single-chat send.
   */
  broadcast?: null | undefined
  /**
   * Never read on this route — omit (or pass `null`) for a single message.
   */
  chunkSize?: null | undefined
}

/**
 * Route atom: forced reply for a method whose ONLY route is a send.
 *
 * @remarks
 * Identical to {@link IRouteReply} except that `mode` is optional. On a method
 * with a single route there is nothing for `mode` to discriminate, so requiring
 * it would force every call site to write a value that carries no information —
 * `renderDice({mode: 'reply'})` says nothing the method name has not already
 * said. `mode` stays in the key set and keeps its single legal value, so an
 * explicit `mode: 'reply'` is still accepted and anything else is a compile
 * error.
 *
 * @public
 */
export type IRouteForcedReply = INeverFields<`editOptions` | `fallbackOptions` | `fallback`> & {
  /**
   * The only mode this method supports; optional because there is no second
   * route to choose between.
   *
   * @defaultValue `reply`
   */
  mode?: `reply`
  /**
   * Optional keyboard markup from `inlineKeyboard`/`bottomKeyboard` (or null to
   * omit).
   *
   * @defaultValue `null` (no keyboard)
   */
  keyboard?: IInBoKb | null
  /**
   * Optional `InputRichMessage` payload for a rich template. The block decides
   * rich-versus-plain at compile time — see {@link IRouteAuto}.
   *
   * @defaultValue `null` (plain template)
   */
  rich?: IOptReplyRich[0] | null
  /**
   * Optional options for the rich send (`replyWithRichMessage`). The block
   * decides rich-versus-plain at compile time — see `IRouteAuto`.
   *
   * @defaultValue `null` (no extra options)
   */
  richOptions?: IOptRichSend | null
  /**
   * Optional plain-text reply options.
   *
   * @defaultValue `null` (no extra options)
   */
  options?: IOptReply | null
  /**
   * Never read on this route — omit (or pass `null`) for a single-chat send.
   */
  broadcast?: null | undefined
  /**
   * Never read on this route — omit (or pass `null`) for a single message.
   */
  chunkSize?: null | undefined
}

/**
 * Route atom: forced edit of the message tied to the update.
 *
 * @remarks
 * The call always reaches `editMessageText`, so there is no send slot at all:
 * `options` is never read, and the fallback resend draws its reply options from
 * `fallbackOptions`.
 *
 * @public
 */
export type IRouteEdit = INeverFields<`options`> & {
  /**
   * Always edits, even when the update carries no `callbackQuery`.
   */
  mode: `edit`
  /**
   * Inline keyboard markup from `inlineKeyboard` (or null to omit).
   *
   * @remarks
   * `editMessageText` rejects a bottom keyboard, so only inline markup is
   * accepted on a route that always edits. A bottom keyboard stays legal on the
   * runtime-decided route (`mode: 'auto'`), where it is guarded at runtime
   * instead of being rejected by the compiler.
   *
   * @defaultValue `null` (no keyboard)
   */
  keyboard?: IInlineKb | null
  /**
   * Optional `InputRichMessage` payload for a rich template. The block decides
   * rich-versus-plain at compile time — see `IRouteAuto`.
   *
   * @defaultValue `null` (plain template)
   */
  rich?: IOptReplyRich[0] | null
  /**
   * Optional rich-edit options: fields legal on both the rich send and the rich
   * edit, so no key reaches the `editMessageText` call that cannot honour it.
   *
   * @defaultValue `null` (no extra options)
   */
  richOptions?: IOptRich | null
  /**
   * Optional plain-text edit options, spread into the `editMessageText` call.
   *
   * @defaultValue `null` (no extra options)
   */
  editOptions?: IOptEdit | null
  /**
   * Optional reply options for the fallback resend, used when the edit fails
   * and `fallback` resends instead of rethrowing.
   *
   * @defaultValue `null` (no extra options)
   */
  fallbackOptions?: IOptReply | null
  /**
   * Fallback when the edit fails.
   *
   * @defaultValue `delete-reply`
   */
  fallback?: IOptFallbackEdit
  /**
   * Never read on this route — omit (or pass `null`) for a single-chat edit.
   */
  broadcast?: null | undefined
  /**
   * Never read on this route — omit (or pass `null`) for a single message.
   */
  chunkSize?: null | undefined
}

/**
 * Route atom: chunked reply.
 *
 * @remarks
 * A present (not `undefined`/`null`) `chunkSize` selects the chunked path: the
 * fully-rendered block is sent as sequential reply chunks. The block is rendered
 * fully FIRST (placeholders never split), then split deterministically: the last
 * `\n\n` in a `chunkSize`-char window wins, then the last `\n`, then the last
 * space, then a hard cut; each piece is trimmed and empties are skipped. The
 * keyboard is sent ONLY on the last chunk, and every chunk carries
 * `parse_mode: HTML` (rich templates send each chunk through
 * `replyWithRichMessage`). Values are sanitised on read:
 * `Number.isFinite(chunkSize) && chunkSize > 0 ? Math.floor(chunkSize) : 4096`.
 * Telegram cannot edit a multi-message split, so the edit-only keys
 * (`editOptions`, `fallbackOptions`) and `fallback` are never read.
 * `richOptions` stays live — every chunk still goes out through the rich send.
 *
 * @public
 */
export type IRouteChunked = INeverFields<`editOptions` | `fallbackOptions` | `fallback`> & {
  /**
   * The only mode the chunked path can honour (the chunked reply wins whenever
   * `chunkSize` is present).
   *
   * @remarks
   * Optional: `chunkSize` is required and is what discriminates this route from
   * {@link IRouteReply}, so there is nothing for `mode` to decide here.
   *
   * @defaultValue `reply`
   */
  mode?: `reply`
  /**
   * Max characters per chunk, selecting the chunked reply path.
   */
  chunkSize: number
  /**
   * Optional keyboard markup from `inlineKeyboard`/`bottomKeyboard` (or null to
   * omit) — sent on the LAST chunk only.
   *
   * @defaultValue `null` (no keyboard)
   */
  keyboard?: IInBoKb | null
  /**
   * Optional `InputRichMessage` payload for a rich template, sent chunk by
   * chunk. The block decides rich-versus-plain at compile time — see
   * `IRouteAuto`.
   *
   * @defaultValue `null` (plain template)
   */
  rich?: IOptReplyRich[0] | null
  /**
   * Optional options for the rich send (`replyWithRichMessage`), spread on every
   * chunk. The block decides rich-versus-plain at compile time — see
   * `IRouteAuto`.
   *
   * @defaultValue `null` (no extra options)
   */
  richOptions?: IOptRichSend | null
  /**
   * Optional plain-text reply options, spread on every chunk.
   *
   * @defaultValue `null` (no extra options)
   */
  options?: IOptReply | null
  /**
   * Never read on this route — omit (or pass `null`) for a single-chat send.
   */
  broadcast?: null | undefined
}

/**
 * Route atom: broadcast send.
 *
 * @remarks
 * The fully-rendered block is SENT (never edited) to every entry of
 * `broadcast.ids` with its own language code from `broadcast.languageCode`;
 * `keyboard`, `data`, `AGBaseId`, `options`, and `rich` are forwarded. The
 * fan-out pacing uses `broadcast.chunkSize`/`broadcast.chunkDelayMs`, so the
 * top-level `chunkSize` is never read — and `mode`, the edit-only keys, and
 * `fallback` are never read either, since nothing edits.
 *
 * @public
 */
export type IRouteBroadcastSend = INeverFields<`mode` | `editOptions` | `fallbackOptions` | `fallback` | `chunkSize`> & {
  /**
   * Broadcast fan-out (see {@link IBroadcastSendParams}): rich templates go
   * through `api.sendRichMessage`, plain templates keep `api.sendMessage` with
   * `parse_mode: HTML`.
   */
  broadcast: IBroadcastSendParams
  /**
   * Optional keyboard markup from `inlineKeyboard`/`bottomKeyboard` (or null to
   * omit).
   *
   * @defaultValue `null` (no keyboard)
   */
  keyboard?: IInBoKb | null
  /**
   * Optional `InputRichMessage` payload for a rich template. The per-recipient
   * template decides rich-versus-plain at compile time — see `IRouteAuto`.
   *
   * @defaultValue `null` (plain template)
   */
  rich?: IOptReplyRich[0] | null
  /**
   * Optional options for the rich send (`sendRichMessage`). The per-recipient
   * template decides rich-versus-plain at compile time — see `IRouteAuto`.
   *
   * @defaultValue `null` (no extra options)
   */
  richOptions?: IOptRichSend | null
  /**
   * Optional plain-text send options (read for plain templates).
   *
   * @defaultValue `null` (no extra options)
   */
  options?: IOptReply | null
}


/**
 * Media parameter mirroring `Context.editMessageMedia` first parameter.
 *
 * @public
 */
export type IOptEditMedia1 = Parameters<Context[`editMessageMedia`]>[0]

/**
 * Options parameter mirroring `Context.editMessageMedia` second parameter.
 *
 * @public
 */
export type IOptEditMedia2 = Parameters<Context[`editMessageMedia`]>[1]

/**
 * Options parameter mirroring `Context.editMessageCaption`.
 *
 * @public
 */
export type IOptEditCaption = Parameters<Context[`editMessageCaption`]>[1]

/**
 * Options parameter mirroring `Context.editMessageReplyMarkup`.
 *
 * @public
 */
export type IOptEditKeyboard = Parameters<Context[`editMessageReplyMarkup`]>[1]

/**
 * Options parameter mirroring `Context.replyWithGift`.
 *
 * @public
 */
export type IOptGift = Parameters<Context[`replyWithGift`]>[1]

/**
 * Options parameter mirroring `Context.answerCallbackQuery`.
 *
 * @public
 */
export type IOptCallbackAnswer = Parameters<Context[`answerCallbackQuery`]>[0]

/**
 * Options parameter mirroring `Context.answerPreCheckoutQuery`.
 *
 * @public
 */
export type IOptPreCheckout = Parameters<Context[`answerPreCheckoutQuery`]>[1]

/**
 * Options parameter mirroring `Context.answerShippingQuery`.
 *
 * @public
 */
export type IOptShipping = Parameters<Context[`answerShippingQuery`]>[1]

/**
 * Options parameter mirroring `Context.answerInlineQuery`.
 *
 * @public
 */
export type IOptInlineAnswer = Parameters<Context[`answerInlineQuery`]>[1]

/**
 * Options parameter mirroring `Context.answerGuestQuery`.
 *
 * @public
 */
export type IOptGuestAnswer = Parameters<Context[`answerGuestQuery`]>[1]

/**
 * Options parameter mirroring `Context.api.answerWebAppQuery` argument index
 * `[2]` — the abort signal of the answer call. `Context` has no
 * `answerWebAppQuery` convenience method, so the alias reaches the method
 * through `Context.api`, keeping the `Context[...]` style of the sibling answer
 * aliases.
 *
 * @public
 */
export type IOptWebAppAnswer = Parameters<Context[`api`][`answerWebAppQuery`]>[2]

/**
 * Action parameter mirroring `Context.replyWithChatAction`.
 *
 * @remarks
 * Used to show typing indicators, upload status, etc.
 *
 * @public
 */
export type IReplyAction = Parameters<Context[`replyWithChatAction`]>[0]

/**
 * Generic data object for template interpolation.
 *
 * @remarks
 * Used throughout Gramstax for passing dynamic data to templates and methods.
 * Accepts any key-value pairs.
 *
 * @example
 * ```ts
 * const data: IData = {name: `John`, count: 3}
 * await this.renderText({data})
 * ```
 *
 * @public
 */
export type IData = Record<string, unknown>

/**
 * Parameters for bottom keyboard configuration.
 *
 * @public
 */
export type IBottomKbParams = {
  /**
   * Template base ID.
   *
   * @remarks
   * IMPORTANT: If a `<g-base id="...">` is defined in the template, you must set AGBaseId
   * to the same value. Leaving AGBaseId as undefined in this case will cause errors
   * (for example, keyboard bindings will not work). A common mistake is defining
   * a base ID in the template but not reusing it in the keyboard configuration.
   *
   * @defaultValue `null` (default base)
   */
  AGBaseId?: string | null

  /**
   * Template interpolation data.
   *
   * @remarks
   * Passed to the keyboard block renderer for placeholder substitution.
   *
   * @defaultValue `null` (no data)
   */
  data?: IData | null

  /**
   * If true, caches the keyboard by language.
   *
   * @remarks
   * Cached keyboards skip re-rendering on repeat sends for the same locale.
   *
   * @defaultValue `false`
   */
  cache?: boolean
}

/**
 * Parameters for inline keyboard configuration.
 *
 * @public
 */
export type IInlineKbParams = {
  /**
   * Template base ID.
   *
   * @remarks
   * IMPORTANT: If a `<g-base id="...">` is defined in the template, you must set AGBaseId
   * to the same value. Leaving AGBaseId as undefined in this case will cause errors
   * (for example, keyboard bindings will not work). A common mistake is defining
   * a base ID in the template but not reusing it in the keyboard configuration.
   *
   * @defaultValue `null` (default base)
   */
  AGBaseId?: string | null

  /**
   * Template interpolation data.
   *
   * @remarks
   * Passed to the keyboard block renderer for placeholder substitution.
   *
   * @defaultValue `null` (no data)
   */
  data?: IData | null

  /**
   * If true, caches the keyboard by language.
   *
   * @remarks
   * Cached keyboards skip re-rendering on repeat sends for the same locale.
   *
   * @defaultValue `false`
   */
  cache?: boolean
}

/**
 * Options for building page routing data configuration.
 *
 * @public
 */
export type IBuildDataOptions<C extends (...args: string[]) => Array<string | undefined> = (...args: string[]) => Array<string | undefined>> = {
  /**
   * Optional page name override.
   *
   * @remarks
   * If not provided, the page name will be inferred from the route definition.
   *
   * @defaultValue `null` (infer from route)
   */
  name?: string | null

  /**
   * Definitions of how callback args are processed.
   *
   * @remarks
   * **This is the DEFINITION side** — pass this to `Ctx.buildData()` to tell the
   * system how to encode positional args into the callback query data string.
   *
   * When the consumer calls {@link IPageData.callbackQueryData}  with arguments at runtime,
   * this function is invoked. The returned array is joined with the intent using
   * colon separators.
   *
   * **Example — definition side (in buildData):**
   * ```typescript
   * static data = this.buildData({
   *   callbackQueryData: (id: string) => [id]
   * })
   * ```
   *
   * **Result — consumption side (IPageData.callbackQueryData):**
   * ```typescript
   * MyPage.data.callbackQueryData(`42`)  // → `myPageName:42`
   * ```
   *
   * @see {@link IPageData.callbackQueryData} for the consumption side.
   *
   * @defaultValue `null` (zero-arg callback data)
   */
  callbackQueryData?: C | null

  /**
   * Optional. override intent trigger for `handle*Text`.
   *
   * @remarks
   * Single string: `"Balance"` — exact match.
   * Record: `{default: "Balance", id: "Saldo", ja: "Baranse"}` — multi-language.
   *   Uses `default` as fallback when user language not found.
   *
   * @defaultValue `null` (falls back to page name)
   */
  intentText?: string | Record<string, string> | null

  /**
   * Optional. override intent trigger for `handleCommand*Text`.
   *
   * @remarks
   * Single string: `"balance"` → command `/balance`.
   * Record: `{default: "balance", id: "saldo"}` → commands `/balance` & `/saldo`.
   *
   * @defaultValue `null` (falls back to page name)
   */
  intentCommandText?: string | Record<string, string> | null
}

/**
 * Constructor type of a page instance type (`typeof Ctx` statics + the
 * instance's prototype), used to carry the page class in `_KbCallbackData`.
 *
 * @internal
 */
export type ICtorOf<P extends Ctx> = typeof Ctx & {prototype: P}

/**
 * Callback data produced by `Page.data.callbackQueryData(...)`.
 *
 * @remarks
 * Object format `{result, page, args}`: `result` is the string sent to Telegram,
 * `page` is the destination page class, `args` is the arg tuple passed at call time.
 *
 * @public
 */
export type IKbCallbackData<P extends typeof Ctx = typeof Ctx, A extends Array<string | undefined> = []> = {
  /**
   * Callback data string sent to Telegram (`intent:arg1:arg2:…`, or bare intent).
   */
  result: string
  /**
   * Destination page class this data routes to.
   */
  page: P
  /**
   * Arg tuple passed at call time (empty `[]` when none).
   */
  args: A
}

/**
 * Validates a callback data object against the destination page's routes.
 *
 * @remarks
 * Resolves to `D` when the page defines the route required by the configured
 * args: empty tuple → `handleCallbackQueryData`; non-empty with a required
 * first arg → `handleArgsCallbackQueryData` (or session/free variants);
 * optional/unbounded args are ambiguous → always allowed.
 * Pages typed as bare `typeof Ctx` (no explicit page) are allowed through —
 * their route is verified at runtime instead.
 *
 * @internal
 */
export type IKbCallbackDataCheck<D extends IKbCallbackData<typeof Ctx, Array<string | undefined>>> = D[`args`] extends readonly []
  ? D[`page`] extends typeof Ctx & IKbDestHasCallback
    ? D
    : typeof Ctx extends D[`page`]
      ? D
      : never
  : D[`args`] extends readonly [infer A, ...unknown[]]
    ? undefined extends A
      ? D
      : D[`page`] extends typeof Ctx & IKbDestHasArgsCallback
        ? D
        : typeof Ctx extends D[`page`]
          ? D
          : never
    : D

/**
 * Destination for an inline keyboard button — a page class, instance,
 * or a literal callback data string.
 *
 * @public
 */
/** Page class/instance that defines handleCallbackQueryData. */
type IKbDestHasCallback = {prototype: {handleCallbackQueryData: (...args: never[]) => unknown}}

/** Page class that defines a route handling callback query data with args. */
type IKbDestHasArgsCallback = {
  prototype: {handleArgsCallbackQueryData: (...args: never[]) => unknown} | {handleSessionArgsCallbackQueryData: (...args: never[]) => unknown} | {handleFreeCallbackQueryData: (...args: never[]) => unknown}
}

/**
 * Destination for an inline keyboard button — a page (class or instance)
 * that defines `handleCallbackQueryData`, or a literal callback data string.
 *
 * @remarks
 * Pages that don't override `handleCallbackQueryData` will cause a
 * compile error when referenced here.
 *
 * @public
 */
export type IKbDest = (typeof Ctx & IKbDestHasCallback) | (Ctx & IKbDestHasCallback[`prototype`]) | string | IKbCallbackData<typeof Ctx, Array<string | undefined>>

/**
 * Keyboard column configuration.
 *
 * @remarks
 * Defines the number of columns for keyboard button layout.
 * Can be:
 * - Single number: `"1"` to `"6"` - All buttons in that many columns
 * - Range format: `"min-max"` - Responsive columns between min and max (e.g., `"2-4"`)
 *
 * @example
 * ```typescript
 * // Fixed 3 columns
 * const cols1: IKbCols = `3`
 *
 * // Responsive 2-4 columns
 * const cols2: IKbCols = `2-4`
 * ```
 *
 * @public
 */
export type IKbCols = `${1 | 2 | 3 | 4 | 5 | 6}` | `${1 | 2 | 3 | 4 | 5 | 6}-${1 | 2 | 3 | 4 | 5 | 6}`

/**
 * Base page routing data — core properties only, no callbackQueryData.
 *
 * @remarks
 * The static type of `Ctx.data`. The instance field is assigned through a cast
 * to {@link IPageData} in `core/ctx.ts`, so `callbackQueryData` typechecks even
 * on a page that omits `static data`; there the value is `undefined` at runtime.
 * Pages that define `buildData(...)` get a real implementation with the
 * configured args.
 *
 * @public
 */
export type IPageDataBase = {
  /**
   * Page name used as the default intent for text, command, and callback routes.
   */
  name: string

  /**
   * `handle*Text` intent pattern for matching incoming text messages.
   *
   * @remarks
   * Overrides intent value used to trigger the route function `handle*Text` (besides the `handleFree*`).
   * This is typically used when you want to trigger the route using a space-separated command,
   * for example "X Start" or "🏠 Home", with a maximum of one space.
   *
   * **Default:** `this.data.name`
   *
   * **IMPORTANT:** Leave this unset unless explicitly needed.
   */
  intentText: string

  /**
   * `handleCommand*Text` intent pattern for matching incoming command messages.
   *
   * @remarks
   * Overrides intent value used to trigger the route function `handleCommand*Text` (besides the `handleFree*`).
   * This is usually required when `this.data.name` includes a hyphen ("-"), which may interfere
   * with default routing behavior.
   *
   * **Default:** `this.data.name`
   *
   * **IMPORTANT:** Leave this unset unless explicitly needed.
   */
  intentCommandText: string

  /**
   * Position index for arg extraction from text messages.
   *
   * @remarks
   * An internal value that specifies the arg position for the route function "handle*Text" and "handle*ArgsText".
   * The maximum allowed value is "2", which means only single spaces are supported,
   * for example:
   * ```ts
   *  // - "1" -> intent:"Home", args:"123 aaa", raw:"Home 123 aaa"
   *  // - "2" -> intent:"🏠 Home", args:"123 aaa", raw:"🏠 Home 123 aaa"
   *  // - (NOT WORKING) "3" -> intent:"🏠 Home Land", args:"123 aaa", raw:"🏠 Home Land 123 aaa"
   * ```
   *
   * **Default:** `1`
   *
   * **IMPORTANT:** Do not set this manually. Let the system handle it.
   */
  _positionArgText: number

  /**
   * `handle*CallbackQueryData` intent pattern for matching callback query data.
   *
   * @remarks
   * Internal intent value used to trigger route function `handle*CallbackQueryData` (besides the `handleFree*`).
   * If `constructorParams.shortCallbackQueryData` is set to true, a numeric index value will be
   * used instead.
   *
   * **Default:** `this.data.name`
   *
   * **IMPORTANT:** Do not set this manually. Let the system handle it.
   */
  intentCallbackQueryData: string

  /**
   * Multi-language intents for `handle*Text`.
   *
   * @remarks
   * Present only when `buildData({intentText: {default: "...", id: "..."}})` is used.
   * Keys are language codes, values are the text intents.
   *
   * @internal
   */
  intentTextMap?: Record<string, string>

  /**
   * Multi-language intents for `handleCommand*Text`.
   *
   * @remarks
   * Present only when `buildData({intentCommandText: {default: "...", id: "..."}})` is used.
   *
   * @internal
   */
  intentCommandTextMap?: Record<string, string>
}

/**
 * Page routing data configuration.
 *
 * @remarks
 * Full page data with typed `callbackQueryData` according to the args
 * configured via `buildData`. Every page SHOULD define `static data`
 * via `buildData(...)` to enable callback query routing.
 *
 * - `buildData()` (no args) → `callbackQueryData(): {result, page, args: []}` — 0 args only
 * - `buildData((a: string, b: string) => ...)` → `callbackQueryData(a, b): {result, page, args: [a, b]}`
 * - `buildData((a?: string) => ...)` → `callbackQueryData(a?): {result, page, args}` (optional still supported)
 *
 * The page class is NOT carried by `static data` (TS cannot infer it without
 * a circular annotation) — pass it explicitly when you want route validation:
 * `Page.data.callbackQueryData<Page>("42")` is compile-error checked
 * against `handleArgsCallbackQueryData`; without the type argument the object
 * is accepted as-is and the route is only resolved at runtime.
 *
 * @typeParam T - Tuple type representing the callback arg parameters.
 *
 * @public
 */
export type IPageData<T extends Array<string | undefined> = string[]> = IPageDataBase & {
  /**
   * **Consumption.** Generate the callback query data object for inline keyboard buttons.
   *
   * @remarks
   * Call this method to produce the actual callback data that Telegram sends
   * when a user taps an inline keyboard button. This is the **consumption** side —
   * you call it at runtime, typically when building a keyboard:
   *
   * ```typescript
   * keyboard.text(`Detail`, DetailPage.data.callbackQueryData(`42`))
   * ```
   *
   * Returns an object `{result, page, args}`:
   * - `result` — the callback data string (`intentCallbackQueryData:arg1:arg2:…`, or the
   *   bare intent when no args are passed).
   * - `page` — the page class this data routes to (used for route validation).
   * - `args` — the actual args tuple passed at call time (empty `[]` when none).
   *
   * How args are encoded is defined at build time via
   * {@link IBuildDataOptions.callbackQueryData}  (the **definition** side).
   *
   * @typeParam P - The page class (pass `Page`, not `typeof Page`). Omit for
   *   no route validation, or pass the class to make `InlineKeyboard.text()`/
   *   `inlineKeyboardT` verify the page defines the matching route
   *   (`handleCallbackQueryData` without args,
   *   `handleArgsCallbackQueryData`/`handleSessionArgsCallbackQueryData`/`handleFreeCallbackQueryData` with args).
   * @param args - Positional args to append to the intent string.
   * @returns A callback data object ready for use in `InlineKeyboard.text()`.
   *
   * @see {@link IBuildDataOptions.callbackQueryData} for the definition side.
   */
  callbackQueryData<P extends Ctx = Ctx>(...args: T): IKbCallbackData<ICtorOf<P>, T>
}

/**
 * Temporary per-update state carried on every `Ctx` instance.
 *
 * @remarks
 * Flow pages read and write `temp` during dispatch; `isAnswer` marks whether
 * the current step already produced a reply, `session` carries the decoded
 * session RPC envelope, and `data` carries the decoded page-data envelope.
 * Extra keys are free-form scratch space for handlers.
 *
 * @example
 * ```ts
 * ctx.temp.isAnswer = true
 * ctx.temp[`attempt`] = 2
 * ```
 *
 * @public
 */
export type ITemp = {
  /**
   * Whether the current step already produced a reply.
   */
  isAnswer: boolean
  /**
   * Decoded session RPC envelope for the active update.
   */
  session: Partial<ICacheRpc>
  /**
   * Decoded page-data envelope for the active update.
   */
  data: Partial<IPageData>
  /**
   * Free-form scratch space for handlers.
   */
  [key: string]: unknown
}

/**
 * Fallback behavior when an edit operation fails.
 *
 * @remarks
 * - `delete-reply` (default): deletes the original message, then sends a new
 *   one — the result looks like an in-place edit.
 * - `reply`: sends a new message without deleting the original.
 * - `disable`: rethrows the edit error (no fallback).
 *
 * @example
 * ```ts
 * await ctx.edit({fallback: `reply`})
 * ```
 *
 * @public
 */
export type IOptFallbackEdit = `delete-reply` | `reply` | `disable`

/* ---------------------------------------------------------------------------
 * Media and media-group route atoms.
 *
 * A media send is not `sendMessage` — it is `replyWithPhoto`, `replyWithVideo`,
 * … — and a media group is `sendMediaGroup`, which takes no reply markup at
 * all. The text atoms therefore do not fit these methods: their `options` slot is
 * the `sendMessage` bag and would sit there unread, and their edit slot is
 * `editMessageText`, which neither call makes. Six more atoms state the real
 * call graph instead of forcing the text one onto it.
 *
 * `keyboard` is deliberately NOT narrowed to inline markup anywhere in the media
 * family: the kinds that cannot be edited in place (voice, video_note, sticker,
 * location, contact) are deleted and re-SENT, and a send accepts either type.
 *
 * Every atom still declares all ten universal route keys, so the key set stays
 * uniform across every method that sends a message.
 * ------------------------------------------------------------------------- */

/**
 * Media route atom: runtime-decided single media message.
 *
 * @remarks
 * `auto` edits when the update carries a `callbackQuery`, otherwise sends; `edit`
 * always edits. Both reach the same kind-specific calls, so they share one
 * member — narrowing `keyboard` per mode is not possible here anyway, because
 * the delete-and-resend path is a send.
 *
 * @typeParam T - The media type.
 *
 * @public
 */
export type IRouteMediaAuto<T extends IMediaKind> = INeverFields<`options` | `editOptions` | `rich` | `richOptions` | `captionOptions`> & {
  /**
   * Send-versus-edit resolution. `edit` always edits; absent or `auto` lets the
   * runtime decide from the update.
   *
   * @defaultValue `auto`
   */
  mode?: `auto` | `edit`
  /**
   * Keyboard markup from `inlineKeyboard`/`bottomKeyboard` (or null to omit).
   *
   * @remarks
   * Not narrowed: the kinds that cannot be edited in place are deleted and
   * re-sent, and a send accepts either keyboard type.
   *
   * @defaultValue `null` (no keyboard)
   */
  keyboard?: IInBoKb | null
  /**
   * Optional `editMessageMedia` payload merged into the edit call's media input
   * (resolved to `never` for the kinds that cannot be edited in place).
   *
   * @defaultValue `null` (no extra payload)
   */
  media?: IMediaEditOpt1<T> | null
  /**
   * Optional extra `editMessageMedia` call options (the call's `other` bag).
   *
   * @defaultValue `null` (no extra options)
   */
  mediaOptions?: IOptEditMedia2 | null
  /**
   * Optional options for the delete-then-resend path — the primary path of the
   * kinds that cannot be edited in place.
   *
   * @defaultValue `null` (no extra options)
   */
  resendOptions?: IMediaReplyOpt<T> | null
  /**
   * Fallback when the edit fails.
   *
   * @defaultValue `delete-reply`
   */
  fallback?: IOptFallbackEdit
  /**
   * Optional send options for the fallback resend after a failed edit.
   *
   * @defaultValue `null` (no extra options)
   */
  fallbackOptions?: IMediaReplyOpt<T> | null
  /**
   * Never read on this route — omit (or pass `null`) for a single-chat send.
   */
  broadcast?: null | undefined
  /**
   * Never read on this route — omit (or pass `null`) for a single message.
   */
  chunkSize?: null | undefined
}

/**
 * Media route atom: forced single-media send.
 *
 * @remarks
 * A forced send never edits, so every edit-only key is unread.
 *
 * @typeParam T - The media type.
 *
 * @public
 */
export type IRouteMediaReply<T extends IMediaKind> = INeverFields<`options` | `editOptions` | `rich` | `richOptions` | `fallback` | `fallbackOptions` | `media` | `mediaOptions` | `resendOptions`> & {
  /**
   * Forces a new message even from a callback query.
   */
  mode: `reply`
  /**
   * Keyboard markup from `inlineKeyboard`/`bottomKeyboard` (or null to omit).
   *
   * @defaultValue `null` (no keyboard)
   */
  keyboard?: IInBoKb | null
  /**
   * Optional options for the kind's caption-bearing send call
   * (`replyWithPhoto`, …) — the single call this route makes.
   *
   * @defaultValue `null` (no extra options)
   */
  captionOptions?: IMediaReplyOpt<T> | null
  /**
   * Never read on this route — omit (or pass `null`) for a single-chat send.
   */
  broadcast?: null | undefined
  /**
   * Never read on this route — omit (or pass `null`) for a single message.
   */
  chunkSize?: null | undefined
}

/**
 * Media route atom: broadcast send fan-out.
 *
 * @remarks
 * The kind is read from the `<g-media>` block, not from `type`, because the same
 * fan-out loop serves every kind — so `type` is unread here even on `renderMedia`
 * where it is otherwise required.
 *
 * @typeParam T - The media type.
 *
 * @public
 */
export type IRouteMediaBroadcastSend<T extends IMediaKind> = INeverFields<`mode` | `options` | `editOptions` | `rich` | `richOptions` | `fallback` | `fallbackOptions` | `media` | `mediaOptions` | `resendOptions` | `chunkSize` | `type`> & {
  /**
   * Broadcast fan-out (see {@link IBroadcastSendParams}).
   */
  broadcast: IBroadcastSendParams
  /**
   * Never read on this route — the kind comes from the `<g-media>` block.
   */
  type?: never
  /**
   * Keyboard markup from `inlineKeyboard`/`bottomKeyboard` (or null to omit).
   *
   * @defaultValue `null` (no keyboard)
   */
  keyboard?: IInBoKb | null
  /**
   * Optional options for the kind's caption-bearing send call.
   *
   * @defaultValue `null` (no extra options)
   */
  captionOptions?: IMediaReplyOpt<T> | null
}

/**
 * Media route atom: broadcast revise fan-out.
 *
 * @remarks
 * Revises stored messages in place where the kind allows it, and deletes then
 * re-sends where it does not — which is why the keyboard stays wide and
 * `resendOptions` is live.
 *
 * `type` is deliberately NOT declared here. On `renderMedia` it comes from
 * `IMediaKindContent`, which is what makes it REQUIRED there; on the per-kind
 * wrappers the method name already fixes the kind, so the key is absent
 * altogether and passing it is an excess-property error — the same behaviour as
 * before.
 *
 * @typeParam T - The media type.
 *
 * @public
 */
export type IRouteMediaBroadcastRevise<T extends IMediaKind> = INeverFields<`mode` | `options` | `editOptions` | `rich` | `richOptions` | `fallbackOptions` | `captionOptions` | `chunkSize`> & {
  /**
   * Broadcast-revise fan-out (see {@link IBroadcastReviseParams}).
   */
  broadcast: IBroadcastReviseParams
  /**
   * Keyboard markup from `inlineKeyboard`/`bottomKeyboard` (or null to omit).
   *
   * @remarks
   * Not narrowed: kinds that cannot be edited in place are deleted and re-sent.
   *
   * @defaultValue `null` (no keyboard)
   */
  keyboard?: IInBoKb | null
  /**
   * Optional `editMessageMedia` payload merged into the revise call.
   *
   * @defaultValue `null` (no extra payload)
   */
  media?: IMediaEditOpt1<T> | null
  /**
   * Optional extra `editMessageMedia` call options.
   *
   * @defaultValue `null` (no extra options)
   */
  mediaOptions?: IOptEditMedia2 | null
  /**
   * Optional options for the delete-then-resend path.
   *
   * @defaultValue `null` (no extra options)
   */
  resendOptions?: IMediaReplyOpt<T> | null
  /**
   * Fallback when the per-recipient revise (or its delete) fails.
   *
   * @defaultValue `delete-reply`
   */
  fallback?: IOptFallbackEdit
}

/**
 * Media-group route atom: runtime-decided group send.
 *
 * @remarks
 * `sendMediaGroup` takes no reply markup, so `keyboard` is unread on every
 * group route. A group also never carries a rich message payload.
 *
 * @public
 */
export type IRouteGroupAuto = INeverFields<`editOptions` | `rich` | `richOptions` | `fallbackOptions`> & {
  /**
   * Send-versus-edit resolution.
   *
   * @defaultValue `auto`
   */
  mode?: `auto` | `edit`
  /**
   * Never read — Telegram's `sendMediaGroup` carries no reply markup.
   */
  keyboard?: never
  /**
   * Optional group-send options.
   *
   * @remarks
   * Read on this route too: the edit path deletes the original and re-sends the
   * group, and that re-send is a send, so it takes the same options bag.
   *
   * @defaultValue `null` (no extra options)
   */
  options?: IOptReply | null
  /**
   * Fallback when the edit fails.
   *
   * @defaultValue `delete-reply`
   */
  fallback?: IOptFallbackEdit
  /**
   * Never read — a group has no in-place edit: the edit path deletes the
   * original and re-SENDS the group, and its `catch` re-runs that very same
   * send. One call means one options bag, which is `options`.
   */
  fallbackOptions?: never
  /**
   * Never read on this route — omit (or pass `null`) for a single-chat send.
   */
  broadcast?: null | undefined
  /**
   * Never read on this route — omit (or pass `null`) for a single message.
   */
  chunkSize?: null | undefined
}

/**
 * Media-group route atom: forced group send.
 *
 * @public
 */
export type IRouteGroupReply = INeverFields<`rich` | `richOptions` | `editOptions` | `fallback` | `fallbackOptions`> & {
  /**
   * Forces a new group even from a callback query.
   */
  mode: `reply`
  /**
   * Never read — Telegram's `sendMediaGroup` carries no reply markup.
   */
  keyboard?: never
  /**
   * Optional group-send options.
   *
   * @defaultValue `null` (no extra options)
   */
  options?: IOptReply | null
  /**
   * Never read on this route — omit (or pass `null`) for a single-chat send.
   */
  broadcast?: null | undefined
  /**
   * Never read on this route — omit (or pass `null`) for a single message.
   */
  chunkSize?: null | undefined
}

/**
 * Template content shared by every render method: what to render.
 *
 * @remarks
 * `params = CONTENT & ROUTE`: the content half names the template fields
 * (`data`, `AGBaseId`), the route atoms say how the rendered block is delivered
 * (send, edit, chunked, broadcast). A method with a richer content body (media
 * kind, gift target, template-backed answer) intersects its own fields on top.
 *
 * @public
 */
export type IContent = {
  /**
   * Optional template interpolation data.
   *
   * @defaultValue `null` (no data)
   */
  data?: IData | null
  /**
   * Optional template base ID position for the rendered block.
   *
   * @remarks
   * IMPORTANT: If a `<g-base id="...">` is defined in the template, you must set
   * AGBaseId to the same value. Leaving AGBaseId as undefined in this case will
   * cause errors (for example, keyboard bindings will not work). A common
   * mistake is defining a base ID in the template but not reusing it here.
   *
   * @defaultValue `null` (default base)
   */
  AGBaseId?: string | null
}

/**
 * Parameters for `renderText` — the single text send/edit method.
 *
 * @remarks
 * `params = CONTENT & ROUTE`: the shared template content (`data`, `AGBaseId`)
 * intersected with the five delivery routes this method resolves to — the
 * runtime-decided `IRouteAuto` (default), the forced `IRouteEdit`, the forced
 * `IRouteReply`, the chunked `IRouteChunked`, and the `IRouteBroadcastSend`
 * fan-out. Every route declares all ten universal route keys — with a real type
 * where the route reads the key, and `never` (or `null | undefined` where an
 * explicit `null` must stay legal) where it does not — so combinations such as
 * `{mode: 'edit', broadcast: {...}}` are compile errors instead of silently
 * dropped fields.
 *
 * Rich-versus-plain content is decided at COMPILE time by the `<g-message>`
 * block contents, not by these params: each route carries both `options` (plain
 * text) and `rich` (rich payload), and the block decides which one is read.
 * Passing the other one logs a one-time `log.warn` and is ignored — never a
 * throw, since a `--watch` hot reload can flip a page rich↔plain in one process.
 *
 * @public
 */
export type IRenderTextParams = IContent & (IRouteAuto | IRouteEdit | IRouteReply | IRouteChunked | IRouteBroadcastSend)

/**
 * Broadcast-send controls for the `broadcast` field of `renderText`,
 * `renderPoll`, and `renderMedia`.
 *
 * @remarks
 * Checkpoint-first by design (anti-spam over speed): `startFrom` resumes
 * without resending, `chunkSize`/`chunkDelayMs` pace the loop with
 * `onProgress` checkpoints, and `excludeIds` counts skips without sending.
 * The send content itself comes from the host method params (`keyboard`,
 * `data`, `AGBaseId`, `options`/`rich`).
 *
 * @public
 */
export type IBroadcastSendParams = {
  /**
   * Recipient user IDs, in stable order (checkpoint index = array index).
   */
  ids: number[]
  /**
   * Parallel language codes, one per recipient.
   */
  languageCode: string[]
  /**
   * If true, throws errors instead of swallowing them.
   *
   * @defaultValue `false`
   */
  throwError?: boolean | null
  /**
   * Optional custom chunk size for pacing sleeps.
   *
   * @defaultValue `null` (free-limit pacing only)
   */
  chunkSize?: number | null
  /**
   * Optional delay in ms after each `chunkSize` chunk.
   *
   * @defaultValue `null` (→ `500`)
   */
  chunkDelayMs?: number | null
  /**
   * Optional user IDs to skip, counted as skipped.
   *
   * @defaultValue `null` (send to all)
   */
  excludeIds?: number[] | null
  /**
   * Optional checkpoint callback `(done, total)` fired after every pacing
   * chunk and once at completion.
   *
   * @defaultValue `null` (no callback)
   */
  onProgress?: ((done: number, total: number) => void | Promise<void>) | null
  /**
   * Optional absolute recipient index to resume from; indexes below count as
   * skipped and are never resent.
   *
   * @defaultValue `null` (start at `0`)
   */
  startFrom?: number | null
  /**
   * Optional parallel send workers; `1` keeps the sequential loop, floored
   * at `1`, capped at `10`, non-finite becomes `1`.
   *
   * @defaultValue `null` (→ `1`)
   */
  concurrency?: number | null
}

/**
 * Parameters for `renderBroadcastDelete` — the expiry-cleanup delete fan-out.
 *
 * @remarks
 * Reads no template block and renders nothing: it operates on stored message
 * ids, so it has no CONTENT half (`data`/`AGBaseId`) and no route layer at all.
 * Same checkpoint-first controls as the revise fan-out (`renderMedia` with
 * `broadcast.targets`) via `reviseOptions`; a failed delete has no text fallback
 * by design, since there is no replacement content to deliver.
 *
 * @public
 */
export type IRenderBroadcastDeleteParams = {
  /**
   * Stored `{chatId, messageId}` rows to delete, in stable order (checkpoint
   * index = array index).
   */
  targets: IBroadcastEditTarget[]
  /**
   * Optional broadcast controls (`onProgress`, `startFrom`, `concurrency`,
   * `batchSize`, `chunkDelayMs`).
   *
   * @remarks
   * `fallback` is omitted from the type: deletes have no resend to fall back
   * to, so the field would be accepted only to be ignored.
   *
   * @defaultValue `null` (defaults)
   */
  reviseOptions?: Omit<IBroadcastEditOpts, `fallback`> | null
}

/**
 * Broadcast revise selector for the `broadcast` field of `renderMedia`.
 *
 * @remarks
 * `photo`, `video`, `audio`, `document`, and `animation` edit in place via
 * `editMessageMedia`; the remaining types cannot be edited, so the old
 * message is deleted and a new one is sent. `reviseOptions.fallback`
 * applies per recipient when the primary edit/resend fails.
 *
 * @public
 */
export type IBroadcastReviseParams = {
  /**
   * Stored `{chatId, messageId}` rows to edit, in stable order (checkpoint
   * index = array index).
   */
  targets: IBroadcastEditTarget[]
  /**
   * Optional broadcast controls (`onProgress`, `startFrom`, `concurrency`,
   * `batchSize`, `chunkDelayMs`, `fallback`).
   *
   * @defaultValue `null` (defaults)
   */
  reviseOptions?: IBroadcastEditOpts | null
}

/**
 * Parameters for `renderGift` — a single gift send.
 *
 * @remarks
 * `params = CONTENT & ROUTE`: the gift content (`target`, `giftId`, `data`,
 * `AGBaseId`) on the forced-send route (`IRouteReply`), with the option slot
 * narrowed to the `sendGift` call (`IOptGift`). `target` (user id) is explicit
 * because gifts do not always go to the active chat — unlike every other render
 * method. A failed gift never degrades into sending the card as plain text.
 *
 * @public
 */
export type IRenderGiftParams = IContent &
  Omit<IRouteForcedReply, `options`> & {
    /**
     * Gift recipient user id.
     */
    target: number
    /**
     * Telegram gift identifier.
     */
    giftId: string
    /**
     * Never read — `sendGift` carries no reply markup, so any keyboard value
     * throws before any API call.
     */
    keyboard?: never
    /**
     * Optional `sendGift` options.
     *
     * @defaultValue `null` (no extra options)
     */
    options?: IOptGift | null
  }

/**
 * Parameters for `renderCallbackAnswer`.
 *
 * @remarks
 * Template-backed counterpart to answering inline-button taps: the
 * `<g-callback-answer>` block supplies the notification text. There is no
 * message to send, so this takes no keyboard and never falls back to a
 * reply. Toast text is limited by Telegram to 200 characters.
 *
 * @public
 */
export type IRenderCallbackAnswerParams = {
  /**
   * Whether to show an alert instead of a toast notification.
   */
  showAlert: boolean
  /**
   * Optional template interpolation data.
   *
   * @defaultValue `null` (no data)
   */
  data?: IData | null
  /**
   * Optional template base ID position for the notification text.
   *
   * @defaultValue `null` (default base)
   */
  AGBaseId?: string | null
  /**
   * Optional answer options such as `cache_time`.
   *
   * @defaultValue `null` (no extra options)
   */
  options?: IOptCallbackAnswer | null
}

/**
 * Parameters for `renderPreCheckout`.
 *
 * @remarks
 * Template-backed counterpart to {@link (Ctx:class).answerPreCheckout}: the
 * `<g-precheckout-error>` block supplies the `error_message` shown when
 * payment is declined. Telegram requires the answer within 10 seconds of
 * the query.
 *
 * @public
 */
export type IRenderPreCheckoutParams = {
  /**
   * Whether to approve the checkout.
   */
  ok: boolean
  /**
   * Optional template interpolation data.
   *
   * @defaultValue `null` (no data)
   */
  data?: IData | null
  /**
   * Optional template base ID position for the error message.
   *
   * @defaultValue `null` (default base)
   */
  AGBaseId?: string | null
  /**
   * Optional answer options, or a string overriding the error message.
   *
   * @defaultValue `null` (no extra options)
   */
  options?: IOptPreCheckout | null
}

/**
 * Parameters for `renderShipping`.
 *
 * @remarks
 * The `<g-shipping-error>` block supplies the `error_message` shown when the
 * shipping address is rejected (multilang via `data`).
 *
 * @public
 */
export type IRenderShippingParams = {
  /**
   * Whether the shipping address is acceptable.
   */
  ok: boolean
  /**
   * Optional template interpolation data.
   *
   * @defaultValue `null` (no data)
   */
  data?: IData | null
  /**
   * Optional template base ID position for the error message.
   *
   * @defaultValue `null` (default base)
   */
  AGBaseId?: string | null
  /**
   * Optional answer options such as `shipping_options`.
   *
   * @defaultValue `null` (no extra options)
   */
  options?: IOptShipping | null
}

/**
 * Parameters for `renderInlineAnswer`.
 *
 * @remarks
 * Result contents are built by the caller from `data` (multilang payloads);
 * the `<g-inline-button>` block supplies the default `button.text` label and
 * `start_parameter`. Telegram caps answers at 50 results.
 *
 * @public
 */
export type IRenderInlineAnswerParams = {
  /**
   * Inline results built by the caller, up to Telegram's 50-result cap.
   */
  results: readonly InlineQueryResult[]
  /**
   * Optional template interpolation data.
   *
   * @defaultValue `null` (no data)
   */
  data?: IData | null
  /**
   * Optional template base ID position for the button text.
   *
   * @defaultValue `null` (default base)
   */
  AGBaseId?: string | null
  /**
   * Optional answer options.
   *
   * @defaultValue `null` (no extra options)
   */
  options?: IOptInlineAnswer | null
  /**
   * Optional deep-link start parameter, enabling the block-text button.
   *
   * @defaultValue `null` (no start parameter)
   */
  buttonStartParameter?: string | null
}

/**
 * Parameters for `renderGuestAnswer`.
 *
 * @remarks
 * The result content is built by the caller from `data` (multilang
 * payloads); the `<g-answer-note>` block is resolved as fail-fast validation
 * that the template exists.
 *
 * @public
 */
export type IRenderGuestAnswerParams = {
  /**
   * Inline result built by the caller.
   */
  result: InlineQueryResult
  /**
   * Optional template interpolation data.
   *
   * @defaultValue `null` (no data)
   */
  data?: IData | null
  /**
   * Optional template base ID position, resolved for validation.
   *
   * @defaultValue `null` (default base)
   */
  AGBaseId?: string | null
  /**
   * Optional abort signal.
   *
   * @defaultValue `null` (no extra options)
   */
  options?: IOptGuestAnswer | null
}

/**
 * Parameters for `renderWebAppAnswer`.
 *
 * @remarks
 * Unlike the other answers this carries an explicit query id (there is no
 * context-aware alias — web app queries arrive without an answerable
 * update), mirroring `renderGift`'s explicit target.
 *
 * @public
 */
export type IRenderWebAppAnswerParams = {
  /**
   * Unique identifier for the query to answer.
   */
  webAppQueryId: string
  /**
   * Inline result built by the caller.
   */
  result: InlineQueryResult
  /**
   * Optional template interpolation data.
   *
   * @defaultValue `null` (no data)
   */
  data?: IData | null
  /**
   * Optional template base ID position, resolved for validation.
   *
   * @defaultValue `null` (default base)
   */
  AGBaseId?: string | null
  /**
   * Optional abort signal.
   *
   * @defaultValue `null` (no extra options)
   */
  options?: IOptWebAppAnswer | null
}

/**
 * Parameters for `renderPoll`.
 *
 * @remarks
 * `params = CONTENT & ROUTE`: the shared template content (`data`, `AGBaseId`,
 * read from the `<g-poll>` block) on the send-only routes — the runtime-decided
 * `IRouteAuto`, the forced `IRouteReply`, and the `IRouteBroadcastSend`
 * fan-out. The Bot API offers no edit for polls (only `stopPoll`), so there is
 * no edit route and no fallback content, and the option slot is narrowed to the
 * `sendPoll` call (`IOptPoll`).
 *
 * On the broadcast-send route the compiled `<g-poll>` block is fanned out to
 * every entry of `broadcast.ids` with its own language code;
 * `Ctx.assertPoll` runs for every recipient BEFORE the loop and the route's
 * `mode`/`fallback` are never read (polls are send-only).
 *
 * @public
 */
export type IRenderPollParams = IContent &
  (Omit<IRouteAuto, `options`> | Omit<IRouteReply, `options`> | Omit<IRouteBroadcastSend, `options`>) & {
    /**
     * Optional extra `sendPoll` fields.
     *
     * @defaultValue `null` (no extra options)
     */
    options?: IOptPoll | null
  }

/**
 * Parameters for `renderInvoice`.
 *
 * @remarks
 * `params = CONTENT & ROUTE`: the shared template content (`data`, `AGBaseId`,
 * read from the `<g-invoice>` block) plus `provider_token`, on the forced-send
 * route (`IRouteReply`), with the option slot narrowed to the `sendInvoice`
 * call (`IOptInvoice`).
 *
 * Provider tokens are security-critical and NEVER come from templates: the
 * validator rejects a `provider_token` attribute outright, so the params' own
 * `provider_token` field is the only way to supply one.
 *
 * @public
 */
export type IRenderInvoiceParams = IContent &
  Omit<IRouteForcedReply, `keyboard` | `options`> & {
    /**
     * Payment provider secret for this send.
     *
     * @remarks
     * Security-critical and never template-sourced — the validator rejects a
     * `provider_token` attribute outright.
     *
     * @defaultValue `null` (no provider token)
     */
    provider_token?: string | null
    /**
     * Optional inline keyboard markup from {@link (Ctx:class).inlineKeyboard} —
     * only inline keyboards are accepted, the Bot API `sendInvoice` reply
     * markup is `InlineKeyboardMarkup`.
     *
     * @defaultValue `null` (no keyboard)
     */
    keyboard?: IInlineKb | null
    /**
     * Optional extra `sendInvoice` fields.
     *
     * @defaultValue `null` (no extra options)
     */
    options?: IOptInvoice | null
  }

/**
 * Parameters for `renderPaidMedia`.
 *
 * @remarks
 * `params = CONTENT & ROUTE`: the shared template content (`data`, `AGBaseId`,
 * read from the `<g-paid-media>` block) on the forced-send route
 * (`IRouteReply`), with the option slot narrowed to the `sendPaidMedia` call
 * (`IOptPaidMedia`) and `keyboard` kept inline-only.
 *
 * Each item `src` is resolved through the instance media jail (local files
 * become `InputFile` uploads, URLs and `file_id` values pass through) and
 * sent with its caption as HTML. There is no degraded fallback content for
 * paywalls.
 *
 * @public
 */
export type IRenderPaidMediaParams = IContent &
  Omit<IRouteForcedReply, `keyboard` | `options`> & {
    /**
     * Optional inline keyboard markup from {@link (Ctx:class).inlineKeyboard}.
     *
     * @defaultValue `null` (no keyboard)
     */
    keyboard?: IInlineKb | null
    /**
     * Optional extra `sendPaidMedia` fields.
     *
     * @defaultValue `null` (no extra options)
     */
    options?: IOptPaidMedia | null
  }

/**
 * Parameters for `renderVenue`.
 *
 * @remarks
 * `params = CONTENT & ROUTE`: the shared template content (`data`, `AGBaseId`,
 * read from the `<g-venue>` block) on the forced-send route (`IRouteReply`),
 * with the option slot narrowed to the `sendVenue` call (`IOptVenue`).
 *
 * Fail-fast validation (`Ctx.assertVenue`: non-empty title/address plus
 * `Ctx.assertLocation` range checks) runs on the COMPILED strings BEFORE any
 * API call.
 *
 * @public
 */
export type IRenderVenueParams = IContent &
  Omit<IRouteForcedReply, `options`> & {
    /**
     * Optional extra `sendVenue` fields such as `foursquare_id`.
     *
     * @defaultValue `null` (no extra options)
     */
    options?: IOptVenue | null
  }

/**
 * Parameters for `renderDice`.
 *
 * @remarks
 * `params = CONTENT & ROUTE`: the shared template content (`data`, `AGBaseId`,
 * read from the `<g-dice>` block) on the forced-send route (`IRouteReply`),
 * with the option slot narrowed to the `sendDice` call (`IOptDice`).
 *
 * The emoji comes from the COMPILED block (`🎲` default when the attribute
 * is absent) and is checked by `Ctx.assertDiceEmoji` BEFORE any API call.
 *
 * @public
 */
export type IRenderDiceParams = IContent &
  Omit<IRouteForcedReply, `options`> & {
    /**
     * Optional extra `sendDice` fields.
     *
     * @defaultValue `null` (no extra options)
     */
    options?: IOptDice | null
  }

/**
 * Parameters for `renderEditCaption`.
 *
 * @remarks
 * `params = CONTENT & ROUTE`: the shared template content (`data`, `AGBaseId`)
 * on the forced-edit route (`IRouteEdit`), with `mode` declared `never` — this
 * method always edits, the mode is not a choice. Caption text comes from the
 * `<g-base id>` block via `getGMessage` and is sent via `editMessageCaption`,
 * which rejects a bottom keyboard, so the `keyboard` slot stays inline-only.
 * Fallback modes mirror `renderEdit`: `delete-reply`/`reply` resend the caption
 * as plain text, `disable` throws.
 *
 * @public
 */
export type IRenderEditCaptionParams = IContent &
  Omit<IRouteEdit, `mode` | `options`> & {
    /**
     * Always edits — declared `never` on the edit-only methods.
     */
    mode?: never
    /**
     * Optional abort signal for the `editMessageCaption` call.
     *
     * @defaultValue `null` (no extra options)
     */
    options?: IOptEditCaption | null
  }

/**
 * Parameters for `renderEditKeyboard`.
 *
 * @remarks
 * `params = CONTENT & ROUTE`: the shared template content (`data`, `AGBaseId`)
 * on the forced-edit route (`IRouteEdit`), with `mode` declared `never` — this
 * method always edits, the mode is not a choice. Sent via
 * `editMessageReplyMarkup` and never touching message text; when `keyboard` is
 * null, the markup resolves from the `<g-keyboard>` block of the given
 * `AGBaseId` itself, which is what makes `AGBaseId` meaningful here. The
 * `keyboard` slot stays inline-only, because `editMessageReplyMarkup` rejects a
 * bottom keyboard.
 *
 * @public
 */
export type IRenderEditKeyboardParams = IContent &
  Omit<IRouteEdit, `mode` | `options`> & {
    /**
     * Always edits — declared `never` on the edit-only methods.
     */
    mode?: never
    /**
     * Optional abort signal for the `editMessageReplyMarkup` call.
     *
     * @defaultValue `null` (no extra options)
     */
    options?: IOptEditKeyboard | null
  }

/**
 * Media group kinds supported by Telegram media groups.
 *
 * @internal
 */
type IMediaGroupType = Extract<IMediaBlock[`type`], `photo` | `video` | `audio` | `document`>

/**
 * Media kinds handled by `renderMedia` — every `<g-media>` type except the
 * `group` container.
 *
 * @internal
 */
type IMediaKind = Exclude<IMediaBlock[`type`], `group`>

/**
 * Optional type-specific media reply options, resolved through the media kind.
 *
 * @internal
 */
type IMediaReplyOpt<T extends IMediaKind> =
  T extends `photo`
    ? IOptReplyPhoto
    : T extends `video`
      ? IOptReplyVideo
      : T extends `audio`
        ? IOptReplyAudio
        : T extends `document`
          ? IOptReplyDocument
          : T extends `animation`
            ? IOptReplyAnimation
            : T extends `voice`
              ? IOptReplyVoice
              : T extends `video_note`
                ? IOptReplyVideoNote
                : T extends `sticker`
                  ? IOptReplySticker
                  : T extends `location`
                    ? IOptReplyLocation
                    : T extends `contact`
                      ? IOptReplyContact
                      : undefined

/**
 * Type-specific `editMessageMedia` payload, resolved through the media kind.
 *
 * @remarks
 * `photo`, `video`, `audio`, `document`, and `animation` edit in place, so the
 * `media` slot accepts the `editMessageMedia` media input for them. `voice`,
 * `video_note`, `sticker`, `location`, and `contact` cannot be edited in place
 * — their edit route deletes the old message and resends — so the slot resolves
 * to `never` there, and the delete-then-resend options ride on `resendOptions`
 * instead.
 *
 * @internal
 */
type IMediaEditOpt1<T extends IMediaKind> = T extends `voice` | `video_note` | `sticker` | `location` | `contact` ? never : IOptEditMedia1

/**
 * `renderMedia` content: the media kind selector on top of {@link IContent}.
 *
 * @remarks
 * The optional `editMessageMedia` payload rides on the route atoms as `media`
 * rather than here: a forced send never reads it, so it has to be readable only
 * on the routes that actually call the edit.
 *
 * @internal
 */
type IMediaKindContent<T extends IMediaKind> = IContent & {
  /**
   * The media type (photo, video, audio, document, animation, voice,
   * video_note, sticker, location, contact).
   */
  type: T
}

/**
 * Parameters for `renderMedia` — the single media send/edit method.
 *
 * @remarks
 * `params = CONTENT & ROUTE`. The content is the media kind (`type`) plus the
 * shared template fields (`data`, `AGBaseId`); the routes are the media atoms —
 * `IRouteMediaAuto` (default; also carries `mode: 'edit'`), `IRouteMediaReply`,
 * `IRouteMediaBroadcastSend` and `IRouteMediaBroadcastRevise`. The kind-specific
 * call options (`media`, `captionOptions`, `mediaOptions`, `resendOptions`) ride
 * on those atoms rather than on a shared slots type, because a forced send reads
 * none of them. Every route declares all ten universal route keys, so
 * combinations such as `{mode: 'reply', broadcast: {…}}` are compile errors
 * instead of silently dropped fields.
 *
 * `broadcast` switches to multi-recipient fan-out: `broadcast.ids` runs the
 * send loop (kind read from the template), and `broadcast.targets` runs the
 * revise loop (`type` required). The per-kind wrappers accept the single-chat
 * and revise routes — see {@link IRenderMediaKindParams}.
 *
 * @typeParam T - The media type (photo, video, audio, document, animation, voice, video_note, sticker, location, contact).
 *
 * @public
 */
export type IRenderMediaParams<T extends IMediaKind> =
  | (IMediaKindContent<T> & IRouteMediaAuto<T>)
  | (IMediaKindContent<T> & IRouteMediaReply<T>)
  | (IContent & IRouteMediaBroadcastSend<T>)
  | (IMediaKindContent<T> & IRouteMediaBroadcastRevise<T>)

/**
 * `IRenderMediaParams` for one media kind — the per-kind wrappers
 * (`renderPhoto`, `renderVideo`, …) accept this shape and supply `type`.
 *
 * @remarks
 * The broadcast-SEND route is deliberately EXCLUDED. On that loop
 * `renderMedia` never forwards `params.type` to `_broadcastSendMedia` — the
 * kind is read from the `<g-media>` block — so a wrapper whose whole purpose is
 * to fix the kind would fix nothing: `renderPhoto({broadcast: {ids}})` would
 * send whatever the block holds while the method name said photo. That route is
 * rejected at the type level; use `renderMedia` for it.
 *
 * The broadcast-REVISE route IS kept, because that loop forwards `type` and
 * therefore honours the wrapper's fixed kind. The kind rides on the content
 * type, so dropping `type` here drops it from every route at once.
 *
 * @typeParam T - The media type (photo, video, audio, document, animation, voice, video_note, sticker, location, contact).
 *
 * @public
 */
export type IRenderMediaKindParams<T extends IMediaKind> = IContent & (IRouteMediaAuto<T> | IRouteMediaReply<T> | IRouteMediaBroadcastRevise<T>)

/**
 * Media-group content shared by `renderMediaGroup` and its per-kind wrappers:
 * the optional group-kind filter on top of the shared template content.
 *
 * @internal
 */
type IGroupContent = IContent & {
  /**
   * Optional media type filter for a `<g-media-group>` block.
   *
   * @remarks
   * When set, only items matching this type are included. When omitted, all
   * items are sent; a non-group template then requires `type`.
   *
   * @defaultValue `null` (all items)
   */
  type?: IMediaGroupType | null
}

/**
 * Parameters for `renderMediaGroup` — the single media-group send/edit method.
 *
 * @remarks
 * `params = CONTENT & ROUTE`: the group content (`type` as a FILTER, `data`,
 * `AGBaseId`) on the `IRouteAuto` and `IRouteReply` routes — `auto` (default)
 * edits when the update carries a `callbackQuery`, `reply` always sends. Media
 * groups have no in-place edit, so every edit route deletes the original
 * message first and the `delete-reply` fallback deletes again before
 * re-sending; `options` feeds the direct reply branch and the delete-then-resend
 * branches alike. Telegram media groups carry no reply markup.
 *
 * @public
 */
export type IRenderMediaGroupParams = IGroupContent & (IRouteGroupAuto | IRouteGroupReply)

/**
 * `IRenderMediaGroupParams` for one group kind — the per-kind group wrappers
 * (`renderPhotoGroup`, `renderVideoGroup`, …) accept this shape and supply
 * `type`.
 *
 * @remarks
 * The kind filter rides on the content type, so dropping `type` here drops it
 * from every route at once.
 *
 * @public
 */
export type IRenderMediaGroupKindParams = IContent & (IRouteGroupAuto | IRouteGroupReply)

/**
 * Send-error event delivered to `ICtxParams.onSendError`.
 *
 * @remarks
 * `page` is the template page name (`this.data.name`), `kind` is the
 * `Ctx.classifySendError` outcome (`fallback-text` or `retryable`), and
 * `chatId` is the target recipient when known (broadcast recipient id or
 * the current chat id; `undefined` when the update carries no chat).
 * Never carries file contents or full template data.
 *
 * @public
 */
export type ISendErrorInfo = {
  /**
   * Template page name (`this.data.name`) that was being sent.
   */
  page: string
  /**
   * `Ctx.classifySendError` outcome for the failure.
   */
  kind: `fallback-text` | `retryable`
  /**
   * Target recipient when known, else `undefined`.
   */
  chatId?: number
}

/**
 * Best-effort send-error hook.
 *
 * @remarks
 * Invoked at every site where a send error is classified via
 * `Ctx.classifySendError` — both `fallback-text` and `retryable` outcomes.
 * Pre-upload validation throws are programmer errors and stay hook-free.
 * A throwing hook is swallowed and never breaks the send flow.
 *
 * @public
 */
export type ISendErrorHook = (err: unknown, info: ISendErrorInfo) => void

/**
 * Parameters for creating a new {@link Ctx} instance.
 *
 * @public
 */
export type ICtxParams = {
  /**
   * The underlying grammy context object.
   *
   * @remarks
   * Optional: when constructing a `Ctx` from another `Ctx` (the
   * `new SomePage(this)` pattern), this may be omitted — the page
   * instance itself is used as the context since it extends `Context`,
   * and the stream API methods are read from `this.api`.
   *
   * See {@link ICt} for the context type definition.
   */
  ct?: ICt

  /**
   * External session cache.
   *
   * @remarks
   * See {@link IGramstaxParams.cacheSession} for details.
   */
  cacheSession: CacheExternal

  /**
   * Keyboard cache map.
   *
   * @remarks
   * See {@link IGramstaxParams.cacheKeyboard} for details.
   */
  cacheKeyboard: Map<string, unknown>

  /**
   * Template manager instance.
   *
   * @remarks
   * See {@link IGramstaxParams.templateManager} for details.
   */
  templateManager: TemplateManager

  /**
   * Logger instance from Gramstax, for emitting runtime warnings.
   *
   * @remarks
   * Null disables logging; when omitted no logger is attached.
   *
   * @defaultValue `null`
   */
  log?: LoggingHelper | null

  /**
   * Opt-in local-path jail for media uploads.
   *
   * @remarks
   * Mirrors the `log` config channel: `IGramstaxParams.mediaRoots` flows
   * through `Gramstax` into every `Ctx` via `createCtx`, and survives the
   * `new SomePage(this)` pattern because the `Ctx` constructor copies it
   * from the source instance. `null`/empty means free (current behavior
   * unchanged); when set, a local file path uploads only when its resolved
   * absolute form sits under one of the resolved roots.
   *
   * @defaultValue `null` (no jail)
   */
  mediaRoots?: string[] | null

  /**
   * Best-effort send-error hook.
   *
   * @remarks
   * Mirrors the `log` config channel. See {@link ISendErrorHook}.
   *
   * @defaultValue `null` (no hook)
   */
  onSendError?: ISendErrorHook | null

  /**
   * Temporary per-update state carried on the instance.
   *
   * @remarks
   * Flow pages read and write this object during dispatch.
   * See {@link ITemp}.
   */
  temp: ITemp
}

/**
 * One already-sent message to revise or remove in bulk.
 *
 * @remarks
 * Matches the downstream `SentRepository` row shape (`chatId` + `messageId`
 * per content code): list stored rows and pass them back to `renderMedia`
 * (with `broadcast.targets`) / `renderBroadcastDelete`.
 *
 * @example
 * ```ts
 * const sent = await this.db.sentRepo.listByCode(`vip-drop-7`)
 * await this.renderMedia({type: `photo`, data: {price: `99`}, broadcast: {targets: sent}})
 * ```
 *
 * @public
 */
export type IBroadcastEditTarget = {
  /**
   * Recipient chat id holding the sent message.
   */
  chatId: number
  /**
   * Message id of the already-sent message to revise or remove.
   */
  messageId: number
}

/**
 * Broadcast controls shared by the `broadcast.targets` revise fan-out of
 * `renderMedia` and by `renderBroadcastDelete`.
 *
 * @remarks
 * All fields are optional: defaults mirror broadcast-send behavior
 * (sequential pool, `delete-reply` edit fallback). Checkpoint-first —
 * `startFrom` resumes after a restart without re-editing (indexes below
 * count as skipped).
 *
 * @public
 */
export type IBroadcastEditOpts = {
  /**
   * Progress callback invoked per pacing sleep and at completion.
   *
   * @remarks
   * Receives `(done, total)` where `done` is completed attempts so far.
   * May be async; null disables progress reporting.
   *
   * @defaultValue `null`
   */
  onProgress?: ((done: number, total: number) => void | Promise<void>) | null
  /**
   * Checkpoint index to resume from (array index into `targets`).
   *
   * @remarks
   * Indexes below this count as skipped without re-editing.
   *
   * @defaultValue `null` (start at 0)
   */
  startFrom?: number | null
  /**
   * Bounded-concurrency stride lanes for parallel delivery.
   *
   * @remarks
   * Clamped to the range 1-10; non-finite values fall back to 1.
   *
   * @defaultValue `null` (sequential, 1 lane)
   */
  concurrency?: number | null
  /**
   * Messages per pacing batch before a sleep plus progress tick.
   *
   * @remarks
   * Broadcast pacing — NOT the message-splitting `chunkSize` of the render
   * params (that one caps characters per split chunk). Ignored when null or
   * non-positive; the 30-message free-limit sleep always applies regardless.
   *
   * @defaultValue `null` (free-limit pacing only)
   */
  batchSize?: number | null
  /**
   * Sleep in milliseconds after each `batchSize` batch.
   *
   * @remarks
   * Only read when `batchSize` triggers a batch sleep.
   *
   * @defaultValue `500`
   */
  chunkDelayMs?: number | null
  /**
   * Fallback when the in-place edit fails.
   *
   * @remarks
   * Accepted but ignored by `renderBroadcastDelete` (deletes have no resend).
   * See {@link IOptFallbackEdit}.
   *
   * @defaultValue `delete-reply`
   */
  fallback?: IOptFallbackEdit | null
}

/**
 * Bulk edit/delete result with a re-drive list.
 *
 * @remarks
 * Mirrors the broadcast-send result shape: counts plus `retryable[]`
 * (absolute `index` + `chatId` + `messageId` + `error`, completion order)
 * for a fresh retry pass, and `skippedCount` for resumed indexes.
 *
 * @public
 */
export type IBroadcastEditResult = {
  /**
   * Count of targets edited or deleted successfully.
   */
  successCount: number
  /**
   * Count of targets that failed (retryable plus fallback-text).
   */
  failedCount: number
  /**
   * Total targets attempted (`targets.length`).
   */
  totalCount: number
  /**
   * Count of checkpoint-resumed indexes skipped via `startFrom`.
   */
  skippedCount: number
  /**
   * Retryable failures in completion order for a fresh retry pass.
   *
   * @remarks
   * Each entry carries the absolute `index` into the original `targets`
   * array plus `chatId`, `messageId`, and the raw `error`.
   */
  retryable: Array<{
    index: number
    chatId: number
    messageId: number
    error: unknown
  }>
}

/**
 * Bulk send result with a re-drive list.
 *
 * @remarks
 * Broadcast-send counterpart of {@link IBroadcastEditResult}: counts plus
 * `retryable[]` (absolute `index` + recipient `id` + `error`, completion
 * order) for a fresh retry pass, and `skippedCount` for
 * `startFrom`-resumed or `excludeIds`-skipped recipients. Returned by the
 * `broadcast.ids` paths of {@link (Ctx:class).renderText},
 * {@link (Ctx:class).renderPoll}, and {@link (Ctx:class).renderMedia}.
 *
 * @public
 */
export type IBroadcastSendResult = {
  /**
   * Count of recipients the block was delivered to successfully.
   */
  successCount: number
  /**
   * Count of recipients that failed (retryable plus fallback-text).
   */
  failedCount: number
  /**
   * Total recipients attempted (`ids.length`).
   */
  totalCount: number
  /**
   * Count of checkpoint-resumed or `excludeIds`-excluded recipients skipped.
   */
  skippedCount: number
  /**
   * Retryable failures in completion order for a fresh retry pass.
   *
   * @remarks
   * Each entry carries the absolute `index` into the original `ids` array
   * plus the recipient `id` and the raw `error`.
   */
  retryable: Array<{
    index: number
    id: number
    error: unknown
  }>
}

/**
 * Giveaway params accepted by {@link (Ctx:class).startGiveaway}.
 *
 * @remarks
 * Data-driven by design: `sendGiveaway` carries no
 * `parse_mode`, so a template block would add surface without value.
 *
 * @public
 */
export type IGiveawayParams = {
  /**
   * Channel chats hosting the giveaway.
   *
   * @remarks
   * Single channel id/username or a list; validated to at least one chat id.
   * The first channel receives the giveaway message.
   *
   * @example
   * ```ts
   * await this.startGiveaway({channels: `@mychannel`, date: 1893456000, winners: 2, prize: `iPhone 16`})
   * ```
   */
  channels: Array<number | string> | string
  /**
   * Giveaway draw date as a future unix timestamp (seconds).
   *
   * @remarks
   * Must be an integer strictly after the current time.
   */
  date: number
  /**
   * Winner count drawn at `date`.
   *
   * @remarks
   * Must be a positive integer.
   */
  winners: number
  /**
   * Prize description shown to participants.
   *
   * @remarks
   * Must be a non-empty string.
   */
  prize: string
}

/**
 * Optional giveaway flags accepted by {@link (Ctx:class).startGiveaway}.
 *
 * @remarks
 * Passthrough for the remaining `sendGiveaway` flags; combination rules
 * (for example `prizeStarCount` versus `premiumMonths`) are adjudicated by
 * the Bot API, not validated here.
 *
 * @public
 */
export type IGiveawayOptions = {
  /**
   * Whether only new members are eligible.
   *
   * @defaultValue `null` (Bot API default)
   */
  onlyNewMembers?: boolean | null
  /**
   * Whether winners are announced publicly.
   *
   * @defaultValue `null` (Bot API default)
   */
  hasPublicWinners?: boolean | null
  /**
   * Star prize count for the giveaway.
   *
   * @remarks
   * Mutually constrained with `premiumMonths` by the Bot API.
   *
   * @defaultValue `null` (no star prize)
   */
  prizeStarCount?: number | null
  /**
   * Premium subscription months awarded to winners.
   *
   * @remarks
   * Mutually constrained with `prizeStarCount` by the Bot API.
   *
   * @defaultValue `null` (no premium prize)
   */
  premiumMonths?: number | null
}

/**
 * Story content accepted by {@link (Ctx:class).postBusinessStory} and {@link (Ctx:class).editBusinessStory}.
 *
 * @remarks
 * Photo or video only; `src` resolves through {@link (Ctx:class).resolveMedia}
 * then converts to an upload (`InputFile` as-is, URLs via `{url}`); residual
 * strings are `file_id` values the Bot API resolves server-side (the
 * installed typings only model uploads, hence one narrow documented cast).
 * Areas and captions ride on `options`; duration rules beyond presence are
 * adjudicated by the Bot API.
 *
 * @public
 */
export type IStoryContent = {
  /**
   * Story media kind (photo or video only).
   */
  type: `photo` | `video`
  /**
   * Media source resolved via `resolveMedia`.
   *
   * @remarks
   * Upload (`InputFile` as-is), remote URL (`{url}`), local path under
   * `mediaRoots`, or a `file_id` the Bot API resolves server-side.
   *
   * @example
   * ```ts
   * await this.postBusinessStory(conn, {type: `photo`, src: `https://example.com/pic.jpg`})
   * ```
   */
  src: string | InputFile | Buffer | Uint8Array
  /**
   * Video duration in seconds (video stories only).
   *
   * @remarks
   * Omitted for photo stories; null equals omitted.
   *
   * @defaultValue `null` (Bot API default)
   */
  duration?: number | null
}
