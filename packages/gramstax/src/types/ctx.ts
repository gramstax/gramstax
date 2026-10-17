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
 * Options parameter mirroring `Api.answerWebAppQuery`.
 *
 * @public
 */
export type IOptWebAppAnswer = Parameters<Ctx[`api`][`answerWebAppQuery`]>[2]

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
 * Used as the static type for `Ctx.data`. Pages that do NOT define
 * `static data = this.buildData(...)` will NOT have `callbackQueryData`
 * available, preventing accidental usage without proper setup.
 * Pages that define `buildData(...)` via {@link IPageData} get fully
 * typed `callbackQueryData` with the configured args (no extra overloads).
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
 * await ctx.edit({fallbackEdit: `reply`})
 * ```
 *
 * @public
 */
export type IOptFallbackEdit = `delete-reply` | `reply` | `disable`

/**
 * Send-versus-edit resolution for a render call.
 *
 * @remarks
 * - `auto` (default): edits when the update carries a `callbackQuery`,
 *   otherwise replies.
 * - `reply`: always sends a new message.
 * - `edit`: always edits the message tied to the update.
 *
 * @public
 */
export type IRenderMode = `auto` | `reply` | `edit`

/**
 * Parameters for `renderText` — the single text send/edit method.
 *
 * @remarks
 * All fields are optional. Rich-versus-plain content is decided at COMPILE time
 * by the `<g-message>` block contents, not by these params; `richOptions` only
 * shape the rich payload. `fallbackEdit` mirrors {@link IOptFallbackEdit} and
 * defaults to `delete-reply`.
 *
 * @public
 */
export type RenderTextParams = {
  /**
   * Optional keyboard markup from `inlineKeyboard`/`bottomKeyboard` (or null to
   * omit). Edits accept inline keyboards only.
   *
   * @defaultValue `null` (no keyboard)
   */
  keyboard?: IInBoKb | null
  /**
   * Optional template interpolation data.
   *
   * @defaultValue `null` (no data)
   */
  data?: IData | null
  /**
   * Optional template base ID position for block message.
   *
   * @defaultValue `null` (default base)
   */
  AGBaseId?: string | null
  /**
   * Send-versus-edit resolution.
   *
   * @defaultValue `auto`
   */
  mode?: IRenderMode
  /**
   * Optional plain-text reply/edit options.
   *
   * @remarks
   * Used by the reply branch and the non-rich edit branch; rich branches read
   * their options from `richOptions` instead.
   *
   * @defaultValue `null` (no extra options)
   */
  options?: IOptReply | IOptEdit | null
  /**
   * Optional `InputRichMessage` fields plus rich send options.
   *
   * @remarks
   * Tuple mirroring `replyWithRichMessage`: `[0]` is merged into the
   * `InputRichMessage` payload, `[1]` into the send/edit options.
   *
   * @defaultValue `null` (no extra options)
   */
  richOptions?: IOptReplyRich | null
  /**
   * Fallback when an edit fails.
   *
   * @defaultValue `delete-reply`
   */
  fallbackEdit?: IOptFallbackEdit
  /**
   * Max characters per chunk. When present (not `undefined`/`null`), the
   * rendered `<g-message>` block is sent as sequential reply chunks instead
   * of a single message.
   *
   * @remarks
   * The block is rendered fully FIRST (placeholders never split), then split
   * deterministically: the last `\n\n` in a `chunkSize`-char window wins,
   * then the last `\n`, then the last space, then a hard cut; each piece is
   * trimmed and empties are skipped. The keyboard is sent ONLY on the last
   * chunk, and every chunk carries `parse_mode: HTML` (rich templates send
   * each chunk through `replyWithRichMessage`).
   *
   * The chunked path is a REPLY path: Telegram has no in-place edit for a
   * multi-message split, so `mode` does not apply to it — when both
   * `chunkSize` and a `mode` are passed, the chunked reply wins. Values are
   * sanitised on read: `Number.isFinite(chunkSize) && chunkSize > 0 ? Math.floor(chunkSize) : 4096`.
   *
   * @defaultValue `null` (single message)
   */
  chunkSize?: number | null
  /**
   * Optional broadcast fan-out (see {@link BroadcastSendParams}).
   *
   * @remarks
   * When present, the fully-rendered `<g-message>` block is SENT (never
   * edited) to every entry of `broadcast.ids` with its own language code
   * from `broadcast.languageCode`; rich templates go through
   * `api.sendRichMessage`, plain templates keep `api.sendMessage` with
   * `parse_mode: HTML`. `mode`, `fallbackEdit`, and `chunkSize` do not
   * apply on this path.
   *
   * @defaultValue `null` (single-chat send/edit)
   */
  broadcast?: BroadcastSendParams | null
}

/**
 * Broadcast-send controls for the `broadcast` field of `renderText`,
 * `renderPoll`, and `renderMedia`.
 *
 * @remarks
 * Checkpoint-first by design (anti-spam over speed): `startFrom` resumes
 * without resending, `chunkSize`/`chunkDelayMs` pace the loop with
 * `onProgress` checkpoints, and `excludeIds` counts skips without sending.
 * The send content itself comes from the host method params (`keyboard`,
 * `data`, `AGBaseId`, `options`/`richOptions`).
 *
 * @public
 */
export type BroadcastSendParams = {
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
 * Reads no template block — it operates on stored message ids. Same
 * checkpoint-first controls as the revise fan-out (`renderMedia` with
 * `broadcast.targets`) via `broadcastOpts`; a
 * failed delete has no text fallback by design, since there is no
 * replacement content to deliver.
 *
 * @public
 */
export type RenderBroadcastDeleteParams = {
  /**
   * Stored `{chatId, messageId}` rows to delete, in stable order (checkpoint
   * index = array index).
   */
  targets: IBroadcastEditTarget[]
  /**
   * Optional broadcast controls (`onProgress`, `startFrom`, `concurrency`,
   * `chunkSize`, `chunkDelayMs`).
   *
   * @defaultValue `null` (defaults; `fallbackEdit` is accepted but ignored — deletes have no resend)
   */
  broadcastOpts?: IBroadcastEditOpts | null
}

/**
 * Broadcast revise selector for the `broadcast` field of `renderMedia`.
 *
 * @remarks
 * `photo`, `video`, `audio`, `document`, and `animation` edit in place via
 * `editMessageMedia`; the remaining types cannot be edited, so the old
 * message is deleted and a new one is sent. `broadcastOpts.fallbackEdit`
 * applies per recipient when the primary edit/resend fails.
 *
 * @public
 */
export type BroadcastReviseParams = {
  /**
   * Stored `{chatId, messageId}` rows to edit, in stable order (checkpoint
   * index = array index).
   */
  targets: IBroadcastEditTarget[]
  /**
   * Optional broadcast controls (`onProgress`, `startFrom`, `concurrency`,
   * `chunkSize`, `chunkDelayMs`, `fallbackEdit`).
   *
   * @defaultValue `null` (defaults)
   */
  broadcastOpts?: IBroadcastEditOpts | null
}

/**
 * Parameters for `renderGift`.
 *
 * @remarks
 * `target` (user id) is explicit because gifts do not always go to the
 * active chat — unlike every other render method. A failed gift never
 * degrades into sending the card as plain text.
 *
 * @public
 */
export type RenderGiftParams = {
  /**
   * Gift recipient user id.
   */
  target: number
  /**
   * Telegram gift identifier.
   */
  giftId: string
  /**
   * Must stay null/omitted — `sendGift` carries no reply markup, so a
   * non-null keyboard throws before any API call.
   *
   * @defaultValue `null` (no keyboard)
   */
  keyboard?: IInlineKb | null
  /**
   * Optional template interpolation data.
   *
   * @defaultValue `null` (no data)
   */
  data?: IData | null
  /**
   * Template base ID position for block message.
   */
  AGBaseId: string
  /**
   * Optional gift options.
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
export type RenderCallbackAnswerParams = {
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
   * Template base ID position for the notification text.
   */
  AGBaseId: string
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
export type RenderPreCheckoutParams = {
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
   * Template base ID position for the error message.
   */
  AGBaseId: string
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
export type RenderShippingParams = {
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
   * Template base ID position for the error message.
   */
  AGBaseId: string
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
export type RenderInlineAnswerParams = {
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
   * Template base ID position for the button text.
   */
  AGBaseId: string
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
export type RenderGuestAnswerParams = {
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
   * Template base ID position, resolved for validation.
   */
  AGBaseId: string
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
export type RenderWebAppAnswerParams = {
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
   * Template base ID position, resolved for validation.
   */
  AGBaseId: string
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
 * The poll is send-only: the Bot API offers no edit for polls (only
 * `stopPoll`), so there is no `mode` and no fallback content.
 *
 * @public
 */
export type RenderPollParams = {
  /**
   * Optional keyboard markup from {@link (Ctx:class).inlineKeyboard} or
   * {@link (Ctx:class).bottomKeyboard}.
   *
   * @defaultValue `null` (no keyboard)
   */
  keyboard?: IInBoKb | null
  /**
   * Optional template interpolation data.
   *
   * @defaultValue `null` (no data)
   */
  data?: IData | null
  /**
   * Optional template base ID position for block poll.
   *
   * @defaultValue `null` (use default)
   */
  AGBaseId?: string | null
  /**
   * Optional extra `sendPoll` fields.
   *
   * @defaultValue `null` (no extra options)
   */
  options?: Parameters<Ctx[`replyWithPoll`]>[2] | null
  /**
   * Optional broadcast fan-out (see {@link BroadcastSendParams}).
   *
   * @remarks
   * When present, the compiled `<g-poll>` block is sent to every entry of
   * `broadcast.ids` with its own language code from
   * `broadcast.languageCode`; `Ctx.assertPoll` runs for every recipient
   * BEFORE the loop and `mode`/`fallbackEdit` do not apply (polls are
   * send-only).
   *
   * @defaultValue `null` (single-chat send)
   */
  broadcast?: BroadcastSendParams | null
}

/**
 * Parameters for `renderInvoice`.
 *
 * @remarks
 * Provider tokens are security-critical and NEVER come from templates: the
 * validator rejects a `provider_token` attribute outright, so `options` is
 * the only way to supply one.
 *
 * @public
 */
export type RenderInvoiceParams = {
  /**
   * Optional inline keyboard markup from {@link (Ctx:class).inlineKeyboard} —
   * only inline keyboards are accepted, the Bot API `sendInvoice` reply
   * markup is `InlineKeyboardMarkup`.
   *
   * @defaultValue `null` (no keyboard)
   */
  keyboard?: IInlineKb | null
  /**
   * Optional template interpolation data.
   *
   * @defaultValue `null` (no data)
   */
  data?: IData | null
  /**
   * Optional template base ID position for block invoice.
   *
   * @defaultValue `null` (use default)
   */
  AGBaseId?: string | null
  /**
   * Optional extra `sendInvoice` fields, where `provider_token` is the ONLY
   * way to supply the payment provider secret.
   *
   * @defaultValue `null` (no extra options)
   */
  options?: (Parameters<Ctx[`replyWithInvoice`]>[5] & {provider_token?: string}) | null
}

/**
 * Parameters for `renderPaidMedia`.
 *
 * @remarks
 * Each item `src` is resolved through the instance media jail (local files
 * become `InputFile` uploads, URLs and `file_id` values pass through) and
 * sent with its caption as HTML. There is no degraded fallback content for
 * paywalls.
 *
 * @public
 */
export type RenderPaidMediaParams = {
  /**
   * Optional inline keyboard markup from {@link (Ctx:class).inlineKeyboard}.
   *
   * @defaultValue `null` (no keyboard)
   */
  keyboard?: IInlineKb | null
  /**
   * Optional template interpolation data.
   *
   * @defaultValue `null` (no data)
   */
  data?: IData | null
  /**
   * Optional template base ID position for block paid media.
   *
   * @defaultValue `null` (use default)
   */
  AGBaseId?: string | null
  /**
   * Optional extra `sendPaidMedia` fields.
   *
   * @defaultValue `null` (no extra options)
   */
  options?: Parameters<Ctx[`replyWithPaidMedia`]>[2] | null
}

/**
 * Parameters for `renderVenue`.
 *
 * @remarks
 * Fail-fast validation (`Ctx.assertVenue`: non-empty title/address plus
 * `Ctx.assertLocation` range checks) runs on the COMPILED strings BEFORE any
 * API call.
 *
 * @public
 */
export type RenderVenueParams = {
  /**
   * Optional keyboard markup from {@link (Ctx:class).inlineKeyboard} or
   * {@link (Ctx:class).bottomKeyboard}.
   *
   * @defaultValue `null` (no keyboard)
   */
  keyboard?: IInBoKb | null
  /**
   * Optional template interpolation data.
   *
   * @defaultValue `null` (no data)
   */
  data?: IData | null
  /**
   * Optional template base ID position for block venue.
   *
   * @defaultValue `null` (use default)
   */
  AGBaseId?: string | null
  /**
   * Optional extra `sendVenue` fields such as `foursquare_id`.
   *
   * @defaultValue `null` (no extra options)
   */
  options?: Parameters<Ctx[`replyWithVenue`]>[4] | null
}

/**
 * Parameters for `renderDice`.
 *
 * @remarks
 * The emoji comes from the COMPILED block (`🎲` default when the attribute
 * is absent) and is checked by `Ctx.assertDiceEmoji` BEFORE any API call.
 *
 * @public
 */
export type RenderDiceParams = {
  /**
   * Optional keyboard markup from {@link (Ctx:class).inlineKeyboard} or
   * {@link (Ctx:class).bottomKeyboard}.
   *
   * @defaultValue `null` (no keyboard)
   */
  keyboard?: IInBoKb | null
  /**
   * Optional template interpolation data.
   *
   * @defaultValue `null` (no data)
   */
  data?: IData | null
  /**
   * Optional template base ID position for block dice.
   *
   * @defaultValue `null` (use default)
   */
  AGBaseId?: string | null
  /**
   * Optional extra `sendDice` fields.
   *
   * @defaultValue `null` (no extra options)
   */
  options?: Parameters<Ctx[`replyWithDice`]>[1] | null
}

/**
 * Parameters for `renderEditCaption`.
 *
 * @remarks
 * Caption text comes from the `<g-base id>` block via `getGMessage` and is
 * sent via `editMessageCaption`. Fallback modes mirror `renderEdit`:
 * `delete-reply`/`reply` resend the caption as plain text, `disable` throws.
 *
 * @public
 */
export type RenderEditCaptionParams = {
  /**
   * Optional inline keyboard markup.
   *
   * @defaultValue `null` (no keyboard)
   */
  keyboardInline?: IInlineKb | null
  /**
   * Optional template interpolation data.
   *
   * @defaultValue `null` (no data)
   */
  data?: IData | null
  /**
   * Template base ID position for block message.
   */
  AGBaseId: string
  /**
   * Optional abort signal for the edit call.
   *
   * @defaultValue `null` (no extra options)
   */
  options?: IOptEditCaption | null
  /**
   * Fallback when the edit fails — `delete-reply` (default) deletes the
   * original message then sends a new one; `reply` sends without deleting;
   * `disable` rethrows the error.
   *
   * @defaultValue `delete-reply`
   */
  fallbackEdit?: IOptFallbackEdit
}

/**
 * Parameters for `renderEditKeyboard`.
 *
 * @remarks
 * Sent via `editMessageReplyMarkup` — never touches message text. When
 * `keyboardInline` is null, the markup resolves from the `<g-keyboard>`
 * block of the given `AGBaseId` itself, which is what makes `AGBaseId`
 * meaningful here.
 *
 * @public
 */
export type RenderEditKeyboardParams = {
  /**
   * Optional inline keyboard markup, or null to resolve it from the block.
   *
   * @defaultValue `null` (resolve from the block)
   */
  keyboardInline?: IInlineKb | null
  /**
   * Optional template interpolation data.
   *
   * @defaultValue `null` (no data)
   */
  data?: IData | null
  /**
   * Template base ID position for block keyboard.
   */
  AGBaseId: string
  /**
   * Optional abort signal for the edit call.
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
 * `renderMedia` fields shared by every call shape.
 *
 * @remarks
 * Generic over the media kind so `options`/`optionsEdit1` resolve to the
 * right per-type union member in each branch of {@link RenderMediaParams}.
 *
 * @internal
 */
type RenderMediaCommon<T extends Exclude<IMediaBlock[`type`], `group`>> = {
  /**
   * Optional keyboard markup from `inlineKeyboard`/`bottomKeyboard` (or null to
   * omit). Edits accept inline keyboards only.
   *
   * @defaultValue `null` (no keyboard)
   */
  keyboard?: IInBoKb | null
  /**
   * Optional template interpolation data.
   *
   * @defaultValue `null` (no data)
   */
  data?: IData | null
  /**
   * Optional template base ID position for block media.
   *
   * @defaultValue `null` (default base)
   */
  AGBaseId?: string | null
  /**
   * Send-versus-edit resolution.
   *
   * @defaultValue `auto`
   */
  mode?: IRenderMode
  /**
   * Optional type-specific reply options.
   *
   * @remarks
   * Used by the reply branch; resolve the right union member through `type`.
   *
   * @defaultValue `null` (no extra options)
   */
  options?:
    | (T extends `photo`
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
                          : undefined)
    | null
  /**
   * Optional edit payload / non-editable-type reply options.
   *
   * @remarks
   * For `photo`/`video`/`audio`/`document`/`animation` this is the
   * `editMessageMedia` input saved for the edit branch; for `voice`,
   * `video_note`, `sticker`, `location`, and `contact` (which cannot be
   * edited in place) it supplies the delete-then-resend reply options.
   *
   * @defaultValue `null` (no extra options)
   */
  optionsEdit1?:
    | (T extends `voice`
        ? IOptReplyVoice
        : T extends `video_note`
          ? IOptReplyVideoNote
          : T extends `sticker`
            ? IOptReplySticker
            : T extends `location`
              ? IOptReplyLocation
              : T extends `contact`
                ? IOptReplyContact
                : //
                  IOptEditMedia1)
    | null
  /**
   * Optional extra `editMessageMedia` call options.
   *
   * @defaultValue `null` (no extra options)
   */
  optionsEdit2?: IOptEditMedia2 | null
  /**
   * Fallback when an edit fails.
   *
   * @defaultValue `delete-reply`
   */
  fallbackEdit?: IOptFallbackEdit
}

/**
 * Single-chat `renderMedia` shape — `type` is required and `broadcast` is
 * absent/null.
 *
 * @internal
 */
type RenderMediaSingle<T extends Exclude<IMediaBlock[`type`], `group`>> = RenderMediaCommon<T> & {
  /**
   * The media type (photo, video, audio, document, animation, voice, video_note, sticker, location, contact).
   */
  type: T
  /**
   * Broadcast fan-out selector.
   *
   * @defaultValue `null` (single-chat send/edit)
   */
  broadcast?: null | undefined
}

/**
 * Broadcast-send `renderMedia` shape — fans out to `broadcast.ids` without
 * requiring an explicit `type`; the media kind is read from the template
 * `<g-media>` block instead (never defaulted).
 *
 * @internal
 */
type RenderMediaBroadcastSend<T extends Exclude<IMediaBlock[`type`], `group`>> = RenderMediaCommon<T> & {
  /**
   * The media type (photo, video, audio, document, animation, voice, video_note, sticker, location, contact).
   *
   * @remarks
   * Optional on this path and IGNORED when supplied: the kind is read from
   * the template `<g-media>` block (never defaulted to `photo` or anything
   * else).
   *
   * @defaultValue `null` (read from the template)
   */
  type?: T
  /**
   * Broadcast-send fan-out (see {@link BroadcastSendParams}).
   */
  broadcast: BroadcastSendParams
}

/**
 * Broadcast-revise `renderMedia` shape — edits stored messages to `type`.
 *
 * @internal
 */
type RenderMediaBroadcastRevise<T extends Exclude<IMediaBlock[`type`], `group`>> = RenderMediaCommon<T> & {
  /**
   * The media type (photo, video, audio, document, animation, voice, video_note, sticker, location, contact).
   */
  type: T
  /**
   * Broadcast revise fan-out (see {@link BroadcastReviseParams}).
   */
  broadcast: BroadcastReviseParams
}

/**
 * Parameters for `renderMedia` — the single media send/edit method.
 *
 * @remarks
 * All fields except `type` are optional. `mode` resolves the send-versus-edit
 * decision exactly like {@link RenderTextParams}: `auto` (default) edits when
 * the update carries a `callbackQuery`, `reply` always sends, `edit` always
 * edits. `options` feeds the reply branch and the `editMessageMedia` error
 * state; `optionsEdit1`/`optionsEdit2` feed the edit branch only and are
 * DROPPED by the fallback re-send (edit options do not map to reply options).
 * `fallbackEdit` mirrors {@link IOptFallbackEdit} and defaults to
 * `delete-reply`.
 *
 * `broadcast` switches to multi-recipient fan-out: `broadcast.ids` runs the
 * send loop (`type` optional — the kind is read from the template), and
 * `broadcast.targets` runs the revise loop (`type` required). `mode`,
 * `fallbackEdit`, and the `options*` fields do not apply to the send loop.
 *
 * @typeParam T - The media type (photo, video, audio, document, animation, voice, video_note, sticker, location, contact).
 *
 * @public
 */
export type RenderMediaParams<T extends Exclude<IMediaBlock[`type`], `group`>> = RenderMediaSingle<T> | RenderMediaBroadcastSend<T> | RenderMediaBroadcastRevise<T>

/**
 * `RenderMediaParams` for one media kind — the per-kind wrappers
 * (`renderPhoto`, `renderVideo`, …) accept this shape and supply `type`.
 *
 * @public
 */
export type RenderMediaKindParams<T extends Exclude<IMediaBlock[`type`], `group`>> = RenderMediaParams<T> extends infer P ? (P extends unknown ? Omit<P, `type`> : never) : never

/**
 * Parameters for `renderMediaGroup` — the single media-group send/edit method.
 *
 * @remarks
 * `options` feeds both the direct reply branch and the delete-then-resend
 * branches (media groups have no in-place edit). `mode` resolves the
 * send-versus-edit decision exactly like {@link RenderMediaParams}: `auto`
 * (default) edits when the update carries a `callbackQuery`. Group edits and
 * the `delete-reply` fallback delete the original message first.
 *
 * @public
 */
export type RenderMediaGroupParams = {
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
  /**
   * Optional template interpolation data.
   *
   * @defaultValue `null` (no data)
   */
  data?: IData | null
  /**
   * Optional template base ID position for block media.
   *
   * @defaultValue `null` (default base)
   */
  AGBaseId?: string | null
  /**
   * Send-versus-edit resolution.
   *
   * @defaultValue `auto`
   */
  mode?: IRenderMode
  /**
   * Optional media-group send options.
   *
   * @defaultValue `null` (no extra options)
   */
  options?: IOptReplyPhoto | IOptReplyVideo | IOptReplyAudio | IOptReplyDocument | null
  /**
   * Fallback when an edit fails.
   *
   * @defaultValue `delete-reply`
   */
  fallbackEdit?: IOptFallbackEdit
}

/**
 * `RenderMediaGroupParams` for one group kind — the per-kind group wrappers
 * (`renderPhotoGroup`, `renderVideoGroup`, …) accept this shape and supply
 * `type`.
 *
 * @public
 */
export type RenderMediaGroupKindParams = Omit<RenderMediaGroupParams, `type`>

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
   * Messages per pacing chunk before a sleep plus progress tick.
   *
   * @remarks
   * Ignored when null or non-positive; the 30-message free-limit sleep
   * always applies regardless.
   *
   * @defaultValue `null` (free-limit pacing only)
   */
  chunkSize?: number | null
  /**
   * Sleep in milliseconds after each `chunkSize` chunk.
   *
   * @remarks
   * Only read when `chunkSize` triggers a chunk sleep.
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
  fallbackEdit?: IOptFallbackEdit | null
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
