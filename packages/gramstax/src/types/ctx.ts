import type {StreamFlavor} from "@grammyjs/stream"
import type {Context, InlineKeyboard, InputFile, Keyboard, Middleware} from "grammy"

export type {StreamFlavor}

import type {CacheExternal} from "~/cache/external"
import type {Ctx} from "~/core/ctx"
import type {LoggingHelper} from "~/helpers/log"
import type {TemplateManager} from "~/template/manager"
import type {ICacheRpc} from "./cache"

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
 * await this.render(null, data)
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
 * per content code): list stored rows and pass them back to
 * `renderBroadcastEdit` / `renderBroadcastDelete`.
 *
 * @example
 * ```ts
 * const sent = await this.db.sentRepo.listByCode(`vip-drop-7`)
 * await this.renderBroadcastEdit(sent, `photo`, null, {price: `99`})
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
 * Broadcast controls shared by `renderBroadcastEdit` and `renderBroadcastDelete`.
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
