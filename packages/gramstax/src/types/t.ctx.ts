import type {StreamFlavor} from "@grammyjs/stream"
import type {Context, InlineKeyboard, Keyboard, Middleware} from "grammy"

export type {StreamFlavor}

import type {CacheExternal, ITCacheRpc} from "~/cache/external"
import type {Ctx} from "~/core/ctx"
import type {LoggingHelper} from "~/helpers/log"
import type {TemplateManager} from "~/template/manager"

/**
 * Page class/instance that defines `handleCallbackQueryData`.
 *
 * @remarks
 * Same constraint as {@link ITKbDest}: pages that don't override
 * `handleCallbackQueryData` cause a compile error when used here.
 *
 * @public
 */
export type _KbPageLike = (typeof Ctx & _KbDestHasCallback) | (Ctx & _KbDestHasCallback[`prototype`])

/**
 * grammY button object whose `text` may also be a page class/instance.
 *
 * @remarks
 * `{text: SomePage, style: "danger"}` — the page resolves to its
 * `intentText` label; the page must define `handleCallbackQueryData`.
 *
 * @public
 */
export type _KbButtonWithPageText = Omit<Extract<Parameters<InlineKeyboard[`text`]>[0], object>, `text`> & {text: string | _KbPageLike}

/**
 * Inline keyboard whose `.text()` also accepts a page class/instance as
 * callback data — calls `page.data.callbackQueryData()` automatically.
 *
 * @example
 * ```ts
 * k.text("Settings", SettingsPage)
 * // equivalent to: k.text("Settings", SettingsPage.data.callbackQueryData())
 * ```
 *
 * @public
 */
export interface _InlineKbWithCtx extends InlineKeyboard {
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
  text<D extends _KbCallbackData<typeof Ctx, Array<string | undefined>>>(text: Parameters<InlineKeyboard[`text`]>[0] | _KbPageLike | _KbButtonWithPageText, data: D & _KbCallbackDataCheck<D>): this
  text(text: Parameters<InlineKeyboard[`text`]>[0] | _KbPageLike | _KbButtonWithPageText, data?: Parameters<InlineKeyboard[`text`]>[1] | _KbPageLike): this
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
export interface _BottomKbWithCtx extends Keyboard {
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
export type ITInlineKb = _InlineKbWithCtx

/**
 * Reply keyboard whose `.text()` also accepts a page class/instance as the
 * button text — resolves to `page.data.intentText` automatically.
 *
 * @public
 */
export type ITBottomKb = _BottomKbWithCtx

/**
 * Union type for both inline and reply keyboards.
 *
 * @remarks
 * Allows methods to accept either keyboard type.
 *
 * @public
 */
export type ITInBoKb = ITBottomKb | ITInlineKb

/**
 * Type alias for Context.
 *
 * @remarks
 * The main context object containing update information and bot methods.
 *
 * @public
 */
export type ITCt = Context

/**
 * Type alias for Middleware.
 *
 * @remarks
 * Middleware used to handle updates.
 *
 * @public
 */
// export type ITCtMiddleware = Middleware<ITCt>
export type ITCtMiddleware<C extends ITCt = ITCt> = Middleware<C>

/**
 * Options for sending text rich messages.
 *
 * @remarks
 * Extracted from `Context.replyWithRichMessage()` method options parameter.
 *
 * @public
 */
export type ITOptReplyRich = Parameters<Context[`replyWithRichMessage`]>

/**
 * Options for sending text messages.
 *
 * @remarks
 * Extracted from `Context.reply()` method options parameter.
 *
 * @public
 */
export type ITOptReply = Parameters<Context[`reply`]>[1]

/**
 * Options for sending photo messages.
 *
 * @remarks
 * Extracted from `Context.replyWithPhoto()` method options parameter.
 *
 * @public
 */
export type ITOptReplyPhoto = Parameters<Context[`replyWithPhoto`]>[1]

/**
 * Options for sending video messages.
 *
 * @remarks
 * Extracted from `Context.replyWithVideo()` method options parameter.
 *
 * @public
 */
export type ITOptReplyVideo = Parameters<Context[`replyWithVideo`]>[1]

/**
 * Options for sending audio messages.
 *
 * @remarks
 * Extracted from `Context.replyWithAudio()` method options parameter.
 *
 * @public
 */
export type ITOptReplyAudio = Parameters<Context[`replyWithAudio`]>[1]

/**
 * Options for sending document messages.
 *
 * @remarks
 * Extracted from `Context.replyWithDocument()` method options parameter.
 *
 * @public
 */
export type ITOptReplyDocument = Parameters<Context[`replyWithDocument`]>[1]

/**
 * Options for sending animation (GIF) messages.
 *
 * @remarks
 * Extracted from `Context.replyWithAnimation()` method options parameter.
 *
 * @public
 */
export type ITOptReplyAnimation = Parameters<Context[`replyWithAnimation`]>[1]

/**
 * Options for sending voice messages.
 *
 * @remarks
 * Extracted from `Context.replyWithVoice()` method options parameter.
 *
 * @public
 */
export type ITOptReplyVoice = Parameters<Context[`replyWithVoice`]>[1]

/**
 * Options for sending video note messages.
 *
 * @remarks
 * Extracted from `Context.replyWithVideoNote()` method options parameter.
 *
 * @public
 */
export type ITOptReplyVideoNote = Parameters<Context[`replyWithVideoNote`]>[1]

/**
 * Options for sending sticker messages.
 *
 * @remarks
 * Extracted from `Context.replyWithSticker()` method options parameter.
 *
 * @public
 */
export type ITOptReplySticker = Parameters<Context[`replyWithSticker`]>[1]

/**
 * Options for sending location messages.
 *
 * @remarks
 * Extracted from `Context.replyWithLocation()` method options parameter.
 *
 * @public
 */
export type ITOptReplyLocation = Parameters<Context[`replyWithLocation`]>[2]

/**
 * Options for sending contact messages.
 *
 * @remarks
 * Extracted from `Context.replyWithContact()` method options parameter.
 *
 * @public
 */
export type ITOptReplyContact = Parameters<Context[`replyWithContact`]>[2]

/**
 * Options for editing text messages.
 *
 * @remarks
 * Extracted from `Context.editMessageText()` method options parameter.
 *
 * @public
 */
export type ITOptEdit = Parameters<Context[`editMessageText`]>[1]

/**
 * Media parameter for editing message media.
 *
 * @remarks
 * Extracted from `Context.editMessageMedia()` method first parameter.
 *
 * @public
 */
export type ITOptEditMedia1 = Parameters<Context[`editMessageMedia`]>[0]

/**
 * Options parameter for editing message media.
 *
 * @remarks
 * Extracted from `Context.editMessageMedia()` method second parameter.
 *
 * @public
 */
export type ITOptEditMedia2 = Parameters<Context[`editMessageMedia`]>[1]

/**
 * Signal for editing message captions.
 *
 * @remarks
 * Extracted from `Context.editMessageCaption()` method signal parameter.
 *
 * @public
 */
export type ITOptEditCaption = Parameters<Context[`editMessageCaption`]>[1]

/**
 * Signal for editing message reply markup (inline keyboard only).
 *
 * @remarks
 * Extracted from `Context.editMessageReplyMarkup()` method signal parameter.
 *
 * @public
 */
export type ITOptEditKeyboard = Parameters<Context[`editMessageReplyMarkup`]>[1]

/**
 * Options for sending a Telegram gift.
 *
 * @remarks
 * Extracted from `Context.replyWithGift()` method options parameter.
 *
 * @public
 */
export type ITOptGift = Parameters<Context[`replyWithGift`]>[1]

/**
 * Type of chat action to send.
 *
 * @remarks
 * Extracted from `Context.replyWithChatAction()` method parameter.
 * Used to show typing indicators, upload status, etc.
 *
 * @public
 */
export type ITReplyAction = Parameters<Context[`replyWithChatAction`]>[0]

/**
 * Generic data object for template interpolation.
 *
 * @remarks
 * Used throughout Gramstax for passing dynamic data to templates and methods.
 * Accepts any key-value pairs.
 *
 * @public
 */
export type ITData = Record<string, unknown>

/**
 * Parameters for bottom keyboard configuration.
 *
 * @public
 */
export type ITBottomKbParams = {
  /**
   * Template base ID.
   *
   * @remarks
   * IMPORTANT: If a `<g-base id="...">` is defined in the template, you must set AGBaseId
   * to the same value. Leaving AGBaseId as undefined in this case will cause errors
   * (for example, keyboard bindings will not work). A common mistake is defining
   * a base ID in the template but not reusing it in the keyboard configuration.
   */
  AGBaseId?: string | null

  /** Template interpolation data. */
  data?: ITData | null

  /** If true, caches the keyboard by language. */
  cache?: boolean
}

/**
 * Parameters for inline keyboard configuration.
 *
 * @public
 */
export type ITInlineKbParams = {
  /**
   * Template base ID.
   *
   * @remarks
   * IMPORTANT: If a `<g-base id="...">` is defined in the template, you must set AGBaseId
   * to the same value. Leaving AGBaseId as undefined in this case will cause errors
   * (for example, keyboard bindings will not work). A common mistake is defining
   * a base ID in the template but not reusing it in the keyboard configuration.
   */
  AGBaseId?: string | null

  /** Template interpolation data. */
  data?: ITData | null

  /** If true, caches the keyboard by language. */
  cache?: boolean
}

/**
 * Options for building page routing data configuration.
 *
 * @public
 */
export type ITBuildDataOptions<C extends (...args: string[]) => Array<string | undefined> = (...args: string[]) => Array<string | undefined>> = {
  /**
   * Optional page name override.
   *
   * @remarks
   * If not provided, the page name will be inferred from the route definition.
   */
  name?: string | null

  /**
   * Definitions of how callback args are processed.
   *
   * @remarks
   * **This is the DEFINITION side** — pass this to `Ctx.buildData()` to tell the
   * system how to encode positional args into the callback query data string.
   *
   * When the consumer calls {@link ITPageData.callbackQueryData}  with arguments at runtime,
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
   * **Result — consumption side (ITPageData.callbackQueryData):**
   * ```typescript
   * MyPage.data.callbackQueryData("42")  // → "myPageName:42"
   * ```
   *
   * @see {@link ITPageData.callbackQueryData} for the consumption side.
   */
  callbackQueryData?: C | null

  /**
   * Optional. override intent trigger for `handle*Text`.
   *
   * @remarks
   * Single string: `"Balance"` — exact match.
   * Record: `{default: "Balance", id: "Saldo", ja: "Baranse"}` — multi-language.
   *   Uses `default` as fallback when user language not found.
   */
  intentText?: string | Record<string, string> | null

  /**
   * Optional. override intent trigger for `handleCommand*Text`.
   *
   * @remarks
   * Single string: `"balance"` → command `/balance`.
   * Record: `{default: "balance", id: "saldo"}` → commands `/balance` & `/saldo`.
   */
  intentCommandText?: string | Record<string, string> | null
}

/**
 * Keyboard column configuration pattern.
 *
 * @remarks
 * Defines the button distribution pattern per row in the keyboard layout.
 * Can be:
 * - Single number: `"1"` to `"6"` - All rows have this many buttons (e.g., `"3"` = 3 buttons per row)
 * - Pattern format: `"x-y"` - First rows have x buttons, last row has y buttons
 *
 * @example
 * ```typescript
 * // All rows with 3 buttons each
 * const cols1: IKbCols = "3"
 *
 * // First rows with 1 button, last row with 2 buttons
 * const cols2: IKbCols = "1-2"
 *
 * // First rows with 2 buttons, last row with 4 buttons
 * const cols3: IKbCols = "2-4"
 * ```
 *
 * @public
 */
/**
 * Constructor type of a page instance type (`typeof Ctx` statics + the
 * instance's prototype), used to carry the page class in `_KbCallbackData`.
 *
 * @internal
 */
export type _CtorOf<P extends Ctx> = typeof Ctx & {prototype: P}

/**
 * Callback data produced by `Page.data.callbackQueryData(...)`.
 *
 * @remarks
 * Object format `{result, page, args}`: `result` is the string sent to Telegram,
 * `page` is the destination page class, `args` is the arg tuple passed at call time.
 *
 * @public
 */
export type _KbCallbackData<P extends typeof Ctx = typeof Ctx, A extends Array<string | undefined> = []> = {
  result: string
  page: P
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
export type _KbCallbackDataCheck<D extends _KbCallbackData<typeof Ctx, Array<string | undefined>>> = D[`args`] extends readonly []
  ? D[`page`] extends typeof Ctx & _KbDestHasCallback
    ? D
    : typeof Ctx extends D[`page`]
      ? D
      : never
  : D[`args`] extends readonly [infer A, ...unknown[]]
    ? undefined extends A
      ? D
      : D[`page`] extends typeof Ctx & _KbDestHasArgsCallback
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
type _KbDestHasCallback = {prototype: {handleCallbackQueryData: (...args: never[]) => unknown}}

/** Page class that defines a route handling callback query data with args. */
type _KbDestHasArgsCallback = {
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
export type ITKbDest = (typeof Ctx & _KbDestHasCallback) | (Ctx & _KbDestHasCallback[`prototype`]) | string | _KbCallbackData<typeof Ctx, Array<string | undefined>>

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
 * const cols1: IKbCols = "3"
 *
 * // Responsive 2-4 columns
 * const cols2: IKbCols = "2-4"
 * ```
 *
 * @public
 */
export type ITKbCols = `${1 | 2 | 3 | 4 | 5 | 6}` | `${1 | 2 | 3 | 4 | 5 | 6}-${1 | 2 | 3 | 4 | 5 | 6}`

/**
 * Base page routing data — core properties only, no callbackQueryData.
 *
 * @remarks
 * Used as the static type for `Ctx.data`. Pages that do NOT define
 * `static data = this.buildData(...)` will NOT have `callbackQueryData`
 * available, preventing accidental usage without proper setup.
 * Pages that define `buildData(...)` via {@link ITPageData} get fully
 * typed `callbackQueryData` with the configured args (no extra overloads).
 *
 * @public
 */
export type ITPageDataBase = {
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
export type ITPageData<T extends Array<string | undefined> = string[]> = ITPageDataBase & {
  /**
   * **Consumption.** Generate the callback query data object for inline keyboard buttons.
   *
   * @remarks
   * Call this method to produce the actual callback data that Telegram sends
   * when a user taps an inline keyboard button. This is the **consumption** side —
   * you call it at runtime, typically when building a keyboard:
   *
   * ```typescript
   * keyboard.text("Detail", DetailPage.data.callbackQueryData("42"))
   * ```
   *
   * Returns an object `{result, page, args}`:
   * - `result` — the callback data string (`intentCallbackQueryData:arg1:arg2:…`, or the
   *   bare intent when no args are passed).
   * - `page` — the page class this data routes to (used for route validation).
   * - `args` — the actual args tuple passed at call time (empty `[]` when none).
   *
   * How args are encoded is defined at build time via
   * {@link ITBuildDataOptions.callbackQueryData}  (the **definition** side).
   *
   * @typeParam P - The page class (pass `Page`, not `typeof Page`). Omit for
   *   no route validation, or pass the class to make `InlineKeyboard.text()`/
   *   `inlineKeyboardT` verify the page defines the matching route
   *   (`handleCallbackQueryData` without args,
   *   `handleArgsCallbackQueryData`/`handleSessionArgsCallbackQueryData`/`handleFreeCallbackQueryData` with args).
   * @param args - Positional args to append to the intent string.
   * @returns A callback data object ready for use in `InlineKeyboard.text()`.
   *
   * @see {@link ITBuildDataOptions.callbackQueryData} for the definition side.
   */
  callbackQueryData<P extends Ctx = Ctx>(...args: T): _KbCallbackData<_CtorOf<P>, T>
}

/**
 * Temporary state for flow page
 *
 * @public
 */
export type ITTemp = {isAnswer: boolean; session: Partial<ITCacheRpc>; data: Partial<ITPageData>; [key: string]: unknown}

/**
 * Fallback behavior when an edit operation fails.
 *
 * @remarks
 * - `delete-reply` (default): deletes the original message, then sends a new
 *   one — the result looks like an in-place edit.
 * - `reply`: sends a new message without deleting the original.
 * - `disable`: rethrows the edit error (no fallback).
 *
 * @public
 */
export type ITOptFallbackEdit = `delete-reply` | `reply` | `disable`

/**
 * Send-error event delivered to {@link ITCtxParams.onSendError}.
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
export type ITSendErrorInfo = {
  page: string
  kind: `fallback-text` | `retryable`
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
export type ITSendErrorHook = (err: unknown, info: ITSendErrorInfo) => void

/**
 * Parameters for creating a new {@link Ctx} instance.
 *
 * @public
 */
export type ITCtxParams = {
  /**
   * The underlying grammy context object.
   *
   * @remarks
   * Optional: when constructing a `Ctx` from another `Ctx` (the
   * `new SomePage(this)` pattern), this may be omitted — the page
   * instance itself is used as the context since it extends `Context`,
   * and the stream API methods are read from `this.api`.
   *
   * See {@link ITCt} for the context type definition.
   */
  ct?: ITCt

  /**
   * External session cache.
   *
   * @remarks
   * See {@link ITGramstaxParams.cacheSession} for details.
   */
  cacheSession: CacheExternal

  /**
   * Keyboard cache map.
   *
   * @remarks
   * See {@link ITGramstaxParams.cacheKeyboard} for details.
   */
  cacheKeyboard: Map<string, unknown>

  /**
   * Template manager instance.
   *
   * @remarks
   * See {@link ITGramstaxParams.templateManager} for details.
   */
  templateManager: TemplateManager

  /**
   * Logger instance from Gramstax, for emitting runtime warnings.
   */
  log?: LoggingHelper | null

  /**
   * Opt-in local-path jail for media uploads.
   *
   * @remarks
   * Mirrors the `log` config channel: `ITGramstaxParams.mediaRoots` flows
   * through `Gramstax` into every `Ctx` via `createCtx`, and survives the
   * `new SomePage(this)` pattern because the `Ctx` constructor copies it
   * from the source instance. `null`/empty means free (current behavior
   * unchanged); when set, a local file path uploads only when its resolved
   * absolute form sits under one of the resolved roots.
   */
  mediaRoots?: string[] | null

  /**
   * Best-effort send-error hook.
   *
   * @remarks
   * Mirrors the `log` config channel. See {@link ITSendErrorHook}.
   */
  onSendError?: ITSendErrorHook | null

  /**
   * Temporary state object.
   */
  temp: ITTemp
}
