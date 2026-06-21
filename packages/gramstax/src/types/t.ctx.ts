import type {Keyboard, Context, InlineKeyboard, Middleware} from "grammy"
import type {CacheExternal, ITCacheRpc} from "~/cache/external"
import type {Ctx} from "~/core/ctx"
import type {TemplateManager} from "~/template/manager"

/**
 * Type alias for grammY InlineKeyboard.
 *
 * @remarks
 * Used to create inline keyboards that appear below messages with callback buttons.
 *
 * @public
 */
export type ITInlineKb = InlineKeyboard

/**
 * Type alias for grammY Keyboard (reply keyboard).
 *
 * @remarks
 * Used to create reply keyboards that replace the user's device keyboard.
 *
 * @public
 */
export type ITBottomKb = Keyboard

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
 * Type alias for grammY Context.
 *
 * @remarks
 * The main context object containing update information and bot methods.
 *
 * @public
 */
export type ITCt = Context

/**
 * Type alias for grammY Middleware.
 *
 * @remarks
 * Middleware from grammy.
 *
 * @public
 */
// export type ITCtMiddleware = Middleware<ITCt>
export type ITCtMiddleware<C extends ITCt = ITCt> = Middleware<C>

/**
 * Options for sending text rich messages.
 *
 * @remarks
 * Extracted from grammY's `Context.replyWithRichMessage()` method options parameter.
 *
 * @public
 */
export type ITOptReplyRich = Parameters<Context[`replyWithRichMessage`]>

/**
 * Options for sending text messages.
 *
 * @remarks
 * Extracted from grammY's `Context.reply()` method options parameter.
 *
 * @public
 */
export type ITOptReply = Parameters<Context[`reply`]>[1]

/**
 * Options for sending photo messages.
 *
 * @remarks
 * Extracted from grammY's `Context.replyWithPhoto()` method options parameter.
 *
 * @public
 */
export type ITOptReplyPhoto = Parameters<Context[`replyWithPhoto`]>[1]

/**
 * Options for sending video messages.
 *
 * @remarks
 * Extracted from grammY's `Context.replyWithVideo()` method options parameter.
 *
 * @public
 */
export type ITOptReplyVideo = Parameters<Context[`replyWithVideo`]>[1]

/**
 * Options for sending audio messages.
 *
 * @remarks
 * Extracted from grammY's `Context.replyWithAudio()` method options parameter.
 *
 * @public
 */
export type ITOptReplyAudio = Parameters<Context[`replyWithAudio`]>[1]

/**
 * Options for sending document messages.
 *
 * @remarks
 * Extracted from grammY's `Context.replyWithDocument()` method options parameter.
 *
 * @public
 */
export type ITOptReplyDocument = Parameters<Context[`replyWithDocument`]>[1]

/**
 * Options for sending animation (GIF) messages.
 *
 * @remarks
 * Extracted from grammY's `Context.replyWithAnimation()` method options parameter.
 *
 * @public
 */
export type ITOptReplyAnimation = Parameters<Context[`replyWithAnimation`]>[1]

/**
 * Options for sending voice messages.
 *
 * @remarks
 * Extracted from grammY's `Context.replyWithVoice()` method options parameter.
 *
 * @public
 */
export type ITOptReplyVoice = Parameters<Context[`replyWithVoice`]>[1]

/**
 * Options for sending video note messages.
 *
 * @remarks
 * Extracted from grammY's `Context.replyWithVideoNote()` method options parameter.
 *
 * @public
 */
export type ITOptReplyVideoNote = Parameters<Context[`replyWithVideoNote`]>[1]

/**
 * Options for sending sticker messages.
 *
 * @remarks
 * Extracted from grammY's `Context.replyWithSticker()` method options parameter.
 *
 * @public
 */
export type ITOptReplySticker = Parameters<Context[`replyWithSticker`]>[1]

/**
 * Options for sending location messages.
 *
 * @remarks
 * Extracted from grammY's `Context.replyWithLocation()` method options parameter.
 *
 * @public
 */
export type ITOptReplyLocation = Parameters<Context[`replyWithLocation`]>[2]

/**
 * Options for sending contact messages.
 *
 * @remarks
 * Extracted from grammY's `Context.replyWithContact()` method options parameter.
 *
 * @public
 */
export type ITOptReplyContact = Parameters<Context[`replyWithContact`]>[2]

/**
 * Options for editing text messages.
 *
 * @remarks
 * Extracted from grammY's `Context.editMessageText()` method options parameter.
 *
 * @public
 */
export type ITOptEdit = Parameters<Context[`editMessageText`]>[1]

/**
 * Media parameter for editing message media.
 *
 * @remarks
 * Extracted from grammY's `Context.editMessageMedia()` method first parameter.
 *
 * @public
 */
export type ITOptEditMedia1 = Parameters<Context[`editMessageMedia`]>[0]

/**
 * Options parameter for editing message media.
 *
 * @remarks
 * Extracted from grammY's `Context.editMessageMedia()` method second parameter.
 *
 * @public
 */
export type ITOptEditMedia2 = Parameters<Context[`editMessageMedia`]>[1]

/**
 * Type of chat action to send.
 *
 * @remarks
 * Extracted from grammY's `Context.replyWithChatAction()` method parameter.
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
export type ITData = Record<string, any>

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
  AGBaseId?: string

  /** Template interpolation data. */
  data?: ITData

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
  AGBaseId?: string

  /** Template interpolation data. */
  data?: ITData

  /** If true, caches the keyboard by language. */
  cache?: boolean
}

/**
 * Options for building page routing data configuration.
 *
 * @public
 */
export type ITBuildDataOptions<C extends (...args: any[]) => any = any> = {
  /**
   * Optional page name override.
   *
   * @remarks
   * If not provided, the page name will be inferred from the route definition.
   */
  name?: string

  /**
   * Optional callback function for args.
   *
   * @remarks
   * Used to define the callback handler for this page route.
   */
  callbackData?: C

  /**
   * Optional. override intent trigger for `handle*Text`.
   *
   * @remarks
   * Overrides the default `handle*Text` intent matching for this page.
   */
  intentText?: string

  /**
   * Optional. override intent trigger for `handleCommand*Text`.
   *
   * @remarks
   * Overrides the default `handleCommand*Text` intent matching for this page.
   */
  intentTextCommand?: string
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
export type ITKbDest = typeof Ctx | Ctx | string

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
 * Page routing data configuration.
 *
 * @remarks
 * Contains all routing metadata and handlers for a page in the Gramstax framework.
 * This type defines the internal structure used by the routing system to match
 * incoming updates to the appropriate page handlers.
 *
 * @typeParam T - Tuple type representing the callback arg parameters.
 *
 * @public
 */
export type ITPageData<T extends any[] = any[]> = {
  /**
   * The unique name identifier for this page route.
   *
   * @remarks
   * Internal value derived from the file name. This value is used as the default intent.
   *
   * **IMPORTANT:** Do not set this manually. Let the system handle it.
   */
  name: string

  /**
   * Callback function that processes args and returns route data.
   *
   * @remarks
   * Add args to `intentCallbackData`, will trigger only to route function "handle*Callback*" (besides the "handleFree*").
   * This is usually used when you want to insert a arg into it.
   *
   * **Note:** Return value should use ARRAY only if there is a arg so that the background
   * system can process it into a string.
   *
   * **Default:** `this.data.name`
   *
   * **IMPORTANT:** Leave this unset unless explicitly needed.
   *
   * @param args - The args parameters passed to the callback.
   * @returns Route data string.
   */
  callbackData: (...args: T) => string

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
   * `handle*CallbackData` intent pattern for matching callback query data.
   *
   * @remarks
   * Internal intent value used to trigger route function `handle*CallbackData` (besides the `handleFree*`).
   * If `constructorParams.shortCallbackData` is set to true, a numeric index value will be
   * used instead.
   *
   * **Default:** `this.data.name`
   *
   * **IMPORTANT:** Do not set this manually. Let the system handle it.
   */
  intentCallbackData: string
}

/**
 * Temporary state for flow page
 *
 * @public
 */
export type ITTemp = {isAnswer: boolean; session: Partial<ITCacheRpc>; data: Partial<ITPageData<any>>; [key: string]: any}

/**
 * Parameters for Ctx instance initialization.
 *
 * @public
 */
export type ITCtxParams = {
  /**
   * The grammY context object.
   *
   * @remarks
   * See {@link ITCt} for the context type definition.
   */
  ct: ITCt

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
  cacheKeyboard: Map<any, any>

  /**
   * Template manager instance.
   *
   * @remarks
   * See {@link ITGramstaxParams.templateManager} for details.
   */
  templateManager: TemplateManager

  /**
   * Temporary state object.
   */
  temp: ITTemp
}
