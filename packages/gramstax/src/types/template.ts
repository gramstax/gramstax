import type {ChokidarOptions} from "chokidar"
import type {InputFile} from "grammy"
import type {TemplateEngine} from "~/template/engine"

/**
 * Media block configuration for Telegram messages.
 *
 * @remarks
 * Declared with `<g-media>` blocks. Covers file-based media (photo, video,
 * audio, document, animation, voice, video_note, sticker), location, contact,
 * and the `group` placeholder that resolves through `mediaGroup`.
 * Pipe-delimited `src` values such as `a.jpg|b.jpg` are also exposed as
 * `srcList` for Telegram media groups. `<g-media-group>` blocks are exposed as
 * `mediaGroup` items and may mix photo/video items. Telegram media groups
 * support up to 10 items and only for photo, video, audio, and document media.
 *
 * @example
 * ```typescript
 * const photoMedia: IMediaBlock = {
 *   type: `photo`,
 *   src: `path/to/image.jpg`,
 *   caption: `A beautiful sunset`
 * }
 *
 * const albumMedia: IMediaBlock = {
 *   type: `photo`,
 *   src: `one.jpg|two.jpg`,
 *   srcList: [`one.jpg`, `two.jpg`],
 *   caption: `Photo album`
 * }
 *
 * const locationMedia: IMediaBlock = {
 *   type: `location`,
 *   latitude: `37.7749`,
 *   longitude: `-122.4194`
 * }
 *
 * const contactMedia: IMediaBlock = {
 *   type: `contact`,
 *   phone: `+1234567890`,
 *   first_name: `John`,
 *   last_name: `Doe`
 * }
 * ```
 *
 * @public
 */
export type IMediaBlock = {
  /**
   * Media kind from the `<g-media type>` attribute.
   *
   * @remarks
   * Accepted values: `photo`, `video`, `audio`, `document`, `animation`,
   * `voice`, `video_note`, `sticker`, `location`, `contact`, `group`.
   * File kinds render via `src`; `location` renders via
   * `latitude`/`longitude`; `contact` renders via `phone`/`first_name`;
   * `group` resolves through `mediaGroup`.
   */
  type: `photo` | `video` | `audio` | `document` | `animation` | `voice` | `video_note` | `sticker` | `location` | `contact` | `group`
  /**
   * Media source — file_id, HTTP URL, local path, or binary payload.
   *
   * @remarks
   * Accepted values: `string` (file_id, `http(s)://` URL, or local path),
   * `InputFile`, `Buffer`, `Uint8Array`. Pipe-delimited strings
   * (`a.jpg|b.jpg`) additionally populate `srcList` at render time.
   * Supports the same `{{var|filter}}` interpolation pipeline as captions.
   *
   * @example
   * ```typescript
   * const block: IMediaBlock = {type: `photo`, src: `a.jpg|b.jpg`}
   * ```
   */
  src?: string | InputFile | Buffer | Uint8Array
  /**
   * Split view of a pipe-delimited `src`.
   *
   * @remarks
   * Populated at render time by `_splitMediaSrcList` when `src` contains a
   * `|` separator. Single-source blocks omit this field.
   *
   * @example
   * ```typescript
   * const list = block.srcList ?? [block.src]
   * ```
   */
  srcList?: string[]
  /**
   * Explicit `<g-media-group>` items backing a `group` block.
   *
   * @remarks
   * Each item holds a photo/video/audio/document entry with its own `src`
   * and optional `caption`. Telegram `sendMediaGroup` accepts at most 10
   * items; excess items are truncated at compile time and rejected at
   * validation time.
   *
   * @example
   * ```typescript
   * const group: IMediaBlock = {
   *   type: `group`,
   *   mediaGroup: [{type: `photo`, src: `a.jpg`, caption: `First`}]
   * }
   * ```
   */
  mediaGroup?: Array<{
    /**
     * Group item kind.
     *
     * @remarks
     * Accepted values: `photo`, `video`, `audio`, `document` only — other
     * `IMediaBlock` kinds are rejected for media groups.
     */
    type: `photo` | `video` | `audio` | `document`
    /**
     * Item source — file_id, HTTP URL, local path, or binary payload.
     *
     * @remarks
     * Accepted values: `string`, `InputFile`, `Buffer`, `Uint8Array`.
     * Supports `{{var|filter}}` interpolation; embedded via
     * `JSON.stringify` so hostile characters stay inert strings.
     */
    src: string | InputFile | Buffer | Uint8Array
    /**
     * Optional per-item caption.
     *
     * @remarks
     * Supports `{{var|filter}}` interpolation. Length-checked at runtime
     * (at most 1024 chars) before any API call.
     */
    caption?: string
  }>
  /**
   * Optional caption rendered alongside the media.
   *
   * @remarks
   * Supports the same `{{var|filter}}` interpolation pipeline as poll
   * questions. Falls back to the first `mediaGroup` item caption when no
   * explicit caption is set.
   *
   * @example
   * ```typescript
   * const block: IMediaBlock = {type: `photo`, src: `a.jpg`, caption: `Halo {{name}}`}
   * ```
   */
  caption?: string
  /**
   * Filename hint used when uploading binary `src` payloads.
   *
   * @remarks
   * Passed through to `resolveMediaInput` for `Buffer`/`Uint8Array` sources
   * so Telegram derives a file name. Ignored for string file_id/URL sources.
   */
  filename?: string
  /**
   * Latitude for `type: "location"` blocks.
   *
   * @remarks
   * String form of a decimal degree in [-90, 90]. Supports
   * `{{var|filter}}` interpolation; validated at runtime by
   * `Ctx.assertLocation` before any API call.
   *
   * @example
   * ```typescript
   * const block: IMediaBlock = {type: `location`, latitude: `-6.2`, longitude: `106.8`}
   * ```
   */
  latitude?: string
  /**
   * Longitude for `type: "location"` blocks.
   *
   * @remarks
   * String form of a decimal degree in [-180, 180]. Supports
   * `{{var|filter}}` interpolation; validated at runtime by
   * `Ctx.assertLocation` before any API call.
   */
  longitude?: string
  /**
   * Live-location lifetime hint for `type: "location"` blocks.
   *
   * @remarks
   * String form of the live period in seconds, as authored in the template.
   * Omitted for static venues.
   */
  live?: string
  /**
   * Phone number for `type: "contact"` blocks.
   *
   * @remarks
   * E.164-style digits such as `+1234567890`. Supports
   * `{{var|filter}}` interpolation.
   */
  phone?: string
  /**
   * Contact first name for `type: "contact"` blocks.
   *
   * @remarks
   * Required alongside `phone` for contact messages. Supports
   * `{{var|filter}}` interpolation.
   */
  first_name?: string
  /**
   * Contact last name for `type: "contact"` blocks.
   *
   * @remarks
   * Optional trailing name part. Supports `{{var|filter}}` interpolation.
   */
  last_name?: string
  /**
   * Contact vCard payload for `type: "contact"` blocks.
   *
   * @remarks
   * Raw vCard string attached to the contact. Omitted when the template
   * declares no `vcard` attribute.
   */
  vcard?: string
}

/**
 * Poll block configuration for Telegram polls.
 *
 * @remarks
 * Declared with `<g-poll>` blocks. The question and options support the same
 * `{{var|filter}}` interpolation pipeline as media captions; the compiled
 * strings are length-checked at runtime before any API call (question
 * 1–300 chars, each option 1–100 chars, 2–10 options, `correct` within
 * range, explanation at most 200 chars).
 *
 * @example
 * ```typescript
 * const quiz: IPollBlock = {
 *   type: `quiz`,
 *   question: `What is 2+2?`,
 *   options: [`3`, `4`],
 *   correct: 1,
 *   explanation: `Basic arithmetic`,
 *   anonymous: true
 * }
 * ```
 *
 * @public
 */
export type IPollBlock = {
  /**
   * Poll mode from the `<g-poll type>` attribute.
   *
   * @remarks
   * Accepted values: `regular` (opinion poll), `quiz` (exactly one correct
   * answer via `correct`). Quiz polls require `correct` and accept an
   * optional `explanation`.
   */
  type: `regular` | `quiz`
  /**
   * Poll question text.
   *
   * @remarks
   * Supports `{{var|filter}}` interpolation. Length-checked at runtime:
   * 1–300 chars.
   *
   * @example
   * ```typescript
   * const block: IPollBlock = {type: `regular`, question: `Pilih {{item}}`, options: [`A`, `B`]}
   * ```
   */
  question: string
  /**
   * Poll answer options.
   *
   * @remarks
   * Each entry supports `{{var|filter}}` interpolation. Requires 2–10
   * options; each option 1–100 chars.
   */
  options: string[]
  /**
   * Zero-based index of the correct option for `quiz` polls.
   *
   * @remarks
   * Must fall within `options` range. Omitted for `regular` polls.
   * @defaultValue `undefined`
   */
  correct?: number
  /**
   * Explanation shown after a `quiz` answer.
   *
   * @remarks
   * Supports `{{var|filter}}` interpolation. At most 200 chars.
   * @defaultValue `undefined`
   */
  explanation?: string
  /**
   * Whether the poll hides voter identities.
   *
   * @remarks
   * Maps the template `anonymous` flag.
   * @defaultValue `undefined` (Telegram server default applies)
   */
  anonymous?: boolean
  /**
   * Whether `regular` polls accept multiple answers.
   *
   * @remarks
   * Maps the template `multiple` flag. Ignored for `quiz` polls.
   * @defaultValue `undefined` (Telegram server default applies)
   */
  multiple?: boolean
}

/**
 * Invoice block configuration for Telegram payments.
 *
 * @remarks
 * Declared with `<g-invoice>` blocks. The title, description, payload, and
 * price labels support the same `{{var|filter}}` interpolation pipeline as
 * poll questions; the compiled strings are length-checked at runtime before
 * any API call (title 1–32 chars, description 1–255 chars, payload 1–128
 * bytes per the Bot API `sendInvoice` limits). `currency` is a 3-letter code
 * (`XTR` for Telegram Stars, otherwise an ISO 4217 fiat code). `prices`
 * holds 1 or more line items with positive integer `amount` values in the
 * smallest currency units. Provider tokens are NEVER part of this type — they
 * must come from `renderInvoice` options, never templates.
 *
 * @example
 * ```typescript
 * const stars: IInvoiceBlock = {
 *   title: `VIP 30 hari`,
 *   description: `Akses semua konten`,
 *   payload: `order-1`,
 *   currency: `XTR`,
 *   prices: [{label: `VIP 30 hari`, amount: 100}]
 * }
 * ```
 *
 * @public
 */
export type IInvoiceBlock = {
  /**
   * Invoice title.
   *
   * @remarks
   * Supports `{{var|filter}}` interpolation. Length-checked at runtime:
   * 1–32 chars.
   */
  title: string
  /**
   * Invoice description.
   *
   * @remarks
   * Supports `{{var|filter}}` interpolation. Length-checked at runtime:
   * 1–255 chars.
   */
  description: string
  /**
   * Opaque payload echoed back in payment updates.
   *
   * @remarks
   * Supports `{{var|filter}}` interpolation. Length-checked at runtime:
   * 1–128 bytes.
   *
   * @example
   * ```typescript
   * const block: IInvoiceBlock = {title: `T`, description: `D`, payload: `order-1`, currency: `XTR`, prices: [{label: `L`, amount: 1}]}
   * ```
   */
  payload: string
  /**
   * Three-letter currency code.
   *
   * @remarks
   * Accepted values: `XTR` for Telegram Stars, otherwise an ISO 4217 fiat
   * code such as `USD`, `EUR`, `IDR`.
   */
  currency: string
  /**
   * Price breakdown — one or more line items.
   *
   * @remarks
   * Requires at least 1 item. Each `label` supports `{{var|filter}}`
   * interpolation; each `amount` is a positive integer in the smallest
   * currency units (cents for fiat, Stars units for `XTR`).
   */
  prices: Array<{
    /**
     * Line-item label.
     *
     * @remarks
     * Supports `{{var|filter}}` interpolation.
     */
    label: string
    /**
     * Line-item amount in the smallest currency units.
     *
     * @remarks
     * Must be a positive integer (cents for fiat, Stars for `XTR`).
     */
    amount: number
  }>
}

/**
 * Stars paid-media block for Telegram paywalls.
 *
 * @remarks
 * Declared with `<g-paid-media>` blocks. `stars` is the Stars price unlocking
 * the content (1–25000 per the Bot API `sendPaidMedia` limit); `media` holds
 * 1–10 items of type `photo` or `video` only. Item `src` and `caption`
 * support the same `{{var|filter}}` interpolation pipeline as media
 * captions; the compiled strings are length-checked at runtime before any
 * API call (non-empty `src`, caption at most 1024 chars).
 *
 * @example
 * ```typescript
 * const paywall: IPaidMediaBlock = {
 *   stars: 100,
 *   media: [{type: `photo`, src: `teaser.jpg`, caption: `Bayar untuk membuka`}]
 * }
 * ```
 *
 * @public
 */
export type IPaidMediaBlock = {
  /**
   * Stars price unlocking the content.
   *
   * @remarks
   * Accepted values: integer 1–25000 per the Bot API `sendPaidMedia`
   * `star_count` limit. Static values above this are rejected at validation
   * time; compiled values are re-checked at runtime by
   * `Ctx.assertPaidMedia`.
   */
  stars: number
  /**
   * Paywalled media items — 1 to 10 entries.
   *
   * @remarks
   * Each item `type` must be `photo` or `video`; `src` must be non-empty
   * and supports `{{var|filter}}` interpolation; `caption` is optional and
   * at most 1024 chars.
   */
  media: Array<{
    /**
     * Paywalled item kind.
     *
     * @remarks
     * Accepted values: `photo`, `video` only.
     */
    type: `photo` | `video`
    /**
     * Item source — file_id, HTTP URL, or local path.
     *
     * @remarks
     * Must be non-empty. Supports `{{var|filter}}` interpolation.
     */
    src: string
    /**
     * Optional per-item caption.
     *
     * @remarks
     * Supports `{{var|filter}}` interpolation. At most 1024 chars.
     * @defaultValue `undefined`
     */
    caption?: string
  }>
}

/**
 * Venue block configuration for Telegram venues.
 *
 * @remarks
 * Declared with `<g-venue>` blocks. All four fields support the same
 * `{{var|filter}}` interpolation pipeline as poll questions; the compiled
 * strings are validated at runtime before any API call (non-empty
 * title/address plus `Ctx.assertLocation` range checks on the coordinates).
 *
 * @example
 * ```typescript
 * const venue: IVenueBlock = {
 *   title: `Cafe {{name}}`,
 *   address: `Jl. Merdeka 1`,
 *   latitude: `-6.2`,
 *   longitude: `106.8`
 * }
 * ```
 *
 * @public
 */
export type IVenueBlock = {
  /**
   * Venue title.
   *
   * @remarks
   * Supports `{{var|filter}}` interpolation. Must be non-empty.
   */
  title: string
  /**
   * Venue street address.
   *
   * @remarks
   * Supports `{{var|filter}}` interpolation. Must be non-empty.
   */
  address: string
  /**
   * Venue latitude as a decimal-degree string.
   *
   * @remarks
   * Range-checked at runtime by `Ctx.assertLocation` ([-90, 90]).
   * Supports `{{var|filter}}` interpolation.
   *
   * @example
   * ```typescript
   * const block: IVenueBlock = {title: `Cafe`, address: `Jl. Merdeka 1`, latitude: `-6.2`, longitude: `106.8`}
   * ```
   */
  latitude: string
  /**
   * Venue longitude as a decimal-degree string.
   *
   * @remarks
   * Range-checked at runtime by `Ctx.assertLocation` ([-180, 180]).
   * Supports `{{var|filter}}` interpolation.
   */
  longitude: string
}

/**
 * Dice block configuration for Telegram dice animations.
 *
 * @remarks
 * Declared with `<g-dice>` blocks. `emoji` supports the same
 * `{{var|filter}}` interpolation pipeline as poll questions and defaults to
 * `🎲` when the attribute is absent; the compiled value is checked at runtime
 * by `Ctx.assertDiceEmoji` before any API call.
 *
 * @example
 * ```typescript
 * const dice: IDiceBlock = {
 *   emoji: `🎯`
 * }
 * ```
 *
 * @public
 */
export type IDiceBlock = {
  /**
   * Dice emoji selecting the animation.
   *
   * @remarks
   * Accepted values: exactly the six `sendDice` emoji (`🎲🎯🏀⚽🎳🎰`)
   * shared with `TemplateEngine.DICE_EMOJI`. Defaults to `🎲` when the
   * template omits the attribute.
   * @defaultValue `🎲`
   */
  emoji: string
}

/**
 * Callback-answer block for Telegram inline-button feedback.
 *
 * @remarks
 * Declared with `<g-callback-answer>` blocks. `text` supports the same
 * `{{var|filter}}` interpolation pipeline as poll questions; the compiled
 * value is length-checked at runtime before any API call (toast text at
 * most 200 chars, plain text without HTML per the Bot API
 * `answerCallbackQuery` limits).
 *
 * @example
 * ```typescript
 * const answer: ICallbackAnswerBlock = {
 *   text: `Pesanan {{orderId}} diproses`
 * }
 * ```
 *
 * @public
 */
export type ICallbackAnswerBlock = {
  /**
   * Toast/alert text shown for the callback query.
   *
   * @remarks
   * Supports `{{var|filter}}` interpolation. Plain text without HTML, at
   * most 200 chars per the Bot API `answerCallbackQuery` limits.
   */
  text: string
}

/**
 * Pre-checkout error block for Telegram payments.
 *
 * @remarks
 * Declared with `<g-precheckout-error>` blocks. `text` supports the same
 * `{{var|filter}}` interpolation pipeline as poll questions and becomes
 * the `error_message` shown when payment is declined (plain text without
 * HTML per the Bot API `answerPreCheckoutQuery` limits).
 *
 * @example
 * ```typescript
 * const declined: IPrecheckoutErrorBlock = {
 *   text: `Stok {{item}} habis`
 * }
 * ```
 *
 * @public
 */
export type IPrecheckoutErrorBlock = {
  /**
   * Error message shown when payment is declined.
   *
   * @remarks
   * Supports `{{var|filter}}` interpolation. Plain text without HTML per
   * the Bot API `answerPreCheckoutQuery` limits.
   */
  text: string
}

/**
 * Shipping error block for Telegram payments.
 *
 * @remarks
 * Declared with `<g-shipping-error>` blocks. `text` supports the same
 * `{{var|filter}}` interpolation pipeline as poll questions and becomes
 * the `error_message` shown when the address is rejected (plain text
 * without HTML per the Bot API `answerShippingQuery` limits).
 *
 * @example
 * ```typescript
 * const rejected: IShippingErrorBlock = {
 *   text: `Di luar zona {{city}}`
 * }
 * ```
 *
 * @public
 */
export type IShippingErrorBlock = {
  /**
   * Error message shown when the shipping address is rejected.
   *
   * @remarks
   * Supports `{{var|filter}}` interpolation. Plain text without HTML per
   * the Bot API `answerShippingQuery` limits.
   */
  text: string
}

/**
 * Inline-button block for Telegram inline query answers.
 *
 * @remarks
 * Declared with `<g-inline-button>` blocks. `text` supports the same
 * `{{var|filter}}` interpolation pipeline as poll questions and becomes
 * the `button.text` label; `startParameter` maps the `start-parameter`
 * attribute and follows the Bot API deep-link format (`[A-Za-z0-9_-]`,
 * at most 64 chars).
 *
 * @example
 * ```typescript
 * const button: IInlineButtonBlock = {
 *   text: `Lihat detail`,
 *   startParameter: `start=1`
 * }
 * ```
 *
 * @public
 */
export type IInlineButtonBlock = {
  /**
   * Button label text.
   *
   * @remarks
   * Supports `{{var|filter}}` interpolation. Becomes `button.text` in the
   * inline query answer.
   */
  text: string
  /**
   * Deep-link start parameter mapping `start-parameter`.
   *
   * @remarks
   * Accepted values: Bot API deep-link format (`[A-Za-z0-9_-]`, at most 64
   * chars). Omitted when the template declares no `start-parameter`.
   * @defaultValue `undefined`
   *
   * @example
   * ```typescript
   * const button: IInlineButtonBlock = {text: `Lihat`, startParameter: `detail_1`}
   * ```
   */
  startParameter?: string
}

/**
 * Answer-note block for query answers without template content.
 *
 * @remarks
 * Declared with `<g-answer-note>` blocks. Guest and web app answers carry
 * caller-built results, so the block exists only as fail-fast validation
 * that the template provides the required `AGBaseId` (plus a future content
 * slot). `text` supports the same `{{var|filter}}` interpolation pipeline as
 * poll questions.
 *
 * @example
 * ```typescript
 * const note: IAnswerNoteBlock = {
 *   text: `Guest answer`
 * }
 * ```
 *
 * @public
 */
export type IAnswerNoteBlock = {
  /**
   * Marker note text.
   *
   * @remarks
   * Supports `{{var|filter}}` interpolation. Carries no rendered content —
   * validation-only marker for the required `AGBaseId`.
   */
  text: string
}

/**
 * Gift block for Telegram gifts.
 *
 * @remarks
 * Declared with `<g-gift>` blocks. `text` supports the same
 * `{{var|filter}}` interpolation pipeline as poll questions including
 * HTML markup (`renderGift` sends with `text_parse_mode: HTML`).
 *
 * @example
 * ```typescript
 * const gift: IGiftBlock = {
 *   text: `Hadiah <b>{{item}}</b> untukmu!`
 * }
 * ```
 *
 * @public
 */
export type IGiftBlock = {
  /**
   * Gift card text, HTML markup allowed.
   *
   * @remarks
   * Supports `{{var|filter}}` interpolation including HTML tags. Sent with
   * `text_parse_mode: HTML` by `renderGift`.
   */
  text: string
}

/**
 * Compiled template structure containing all parsed template components.
 *
 * @remarks
 * This type represents the cached result of template compilation.
 * Each property holds compiled functions for different template sections.
 *
 * @public
 */
export type ICompiledTemplate = {
  /**
   * Compiled media blocks indexed by base ID and language.
   *
   * @remarks
   * Produced by `TemplateEngine.compileBlockGMedia`. Each leaf resolves an
   * `IMediaBlock` for the given render data.
   */
  media: ReturnType<typeof TemplateEngine.compileBlockGMedia>
  /**
   * Compiled poll blocks indexed by base ID and language.
   *
   * @remarks
   * Produced by `TemplateEngine.compileBlockGPoll`. Each leaf resolves an
   * `IPollBlock` for the given render data.
   */
  poll: ReturnType<typeof TemplateEngine.compileBlockGPoll>
  /**
   * Compiled venue blocks indexed by base ID and language.
   *
   * @remarks
   * Produced by `TemplateEngine.compileBlockGVenue`. Each leaf resolves an
   * `IVenueBlock` for the given render data.
   */
  venue: ReturnType<typeof TemplateEngine.compileBlockGVenue>
  /**
   * Compiled dice blocks indexed by base ID and language.
   *
   * @remarks
   * Produced by `TemplateEngine.compileBlockGDice`. Each leaf resolves an
   * `IDiceBlock` for the given render data.
   */
  dice: ReturnType<typeof TemplateEngine.compileBlockGDice>
  /**
   * Compiled callback-answer blocks indexed by base ID and language.
   *
   * @remarks
   * Produced by `TemplateEngine.compileBlockGCallbackAnswer`. Each leaf
   * resolves an `ICallbackAnswerBlock` for the given render data.
   */
  callbackAnswer: ReturnType<typeof TemplateEngine.compileBlockGCallbackAnswer>
  /**
   * Compiled precheckout-error blocks indexed by base ID and language.
   *
   * @remarks
   * Produced by `TemplateEngine.compileBlockGPrecheckoutError`. Each leaf
   * resolves an `IPrecheckoutErrorBlock` for the given render data.
   */
  precheckoutError: ReturnType<typeof TemplateEngine.compileBlockGPrecheckoutError>
  /**
   * Compiled shipping-error blocks indexed by base ID and language.
   *
   * @remarks
   * Produced by `TemplateEngine.compileBlockGShippingError`. Each leaf
   * resolves an `IShippingErrorBlock` for the given render data.
   */
  shippingError: ReturnType<typeof TemplateEngine.compileBlockGShippingError>
  /**
   * Compiled inline-button blocks indexed by base ID and language.
   *
   * @remarks
   * Produced by `TemplateEngine.compileBlockGInlineButton`. Each leaf
   * resolves an `IInlineButtonBlock` for the given render data.
   */
  inlineButton: ReturnType<typeof TemplateEngine.compileBlockGInlineButton>
  /**
   * Compiled answer-note blocks indexed by base ID and language.
   *
   * @remarks
   * Produced by `TemplateEngine.compileBlockGAnswerNote`. Each leaf resolves
   * an `IAnswerNoteBlock` for the given render data.
   */
  answerNote: ReturnType<typeof TemplateEngine.compileBlockGAnswerNote>
  /**
   * Compiled gift blocks indexed by base ID and language.
   *
   * @remarks
   * Produced by `TemplateEngine.compileBlockGGift`. Each leaf resolves an
   * `IGiftBlock` for the given render data.
   */
  gift: ReturnType<typeof TemplateEngine.compileBlockGGift>
  /**
   * Compiled invoice blocks indexed by base ID and language.
   *
   * @remarks
   * Produced by `TemplateEngine.compileBlockGInvoice`. Each leaf resolves an
   * `IInvoiceBlock` for the given render data.
   */
  invoice: ReturnType<typeof TemplateEngine.compileBlockGInvoice>
  /**
   * Compiled Stars paid-media blocks indexed by base ID and language.
   *
   * @remarks
   * Produced by `TemplateEngine.compileBlockGPaidMedia`. Each leaf resolves
   * an `IPaidMediaBlock` for the given render data.
   */
  paidMedia: ReturnType<typeof TemplateEngine.compileBlockGPaidMedia>
  /**
   * Compiled message blocks indexed by base ID and language.
   *
   * @remarks
   * Produced by `TemplateEngine.compileBlockGMessage`. Each leaf renders the
   * message HTML string for the given render data.
   */
  message: ReturnType<typeof TemplateEngine.compileBlockGMessage>
  /**
   * Compiled keyboard blocks indexed by base ID, language, and type.
   *
   * @remarks
   * Produced by `TemplateEngine.compileBlockGKeyboards`. Each leaf renders
   * the inline/bottom keyboard layout for the given render data.
   */
  keyboard: ReturnType<typeof TemplateEngine.compileBlockGKeyboards>
  /**
   * Compiled description blocks indexed by base ID, scope, and language.
   *
   * @remarks
   * Produced by `TemplateEngine.compileBlockGDescription`. Each leaf renders
   * the description string for the given render data.
   */
  description: ReturnType<typeof TemplateEngine.compileBlockGDescription>
}

/**
 * Configuration options for TemplateManager initialization.
 *
 * @remarks
 * Pass this object to the TemplateManager constructor to configure
 * template paths, hot-reloading, and watcher behavior.
 *
 * @example
 * ```typescript
 * const options = {
 *   path: [join(process.cwd(), `src`, `pages`)],
 *   enableWatch: true,
 *   watchOptions: {ignored: /node_modules/}
 * }
 * ```
 *
 * @public
 */
export type ITemplateOptions = {
  /**
   * Directory paths scanned for template files.
   *
   * @remarks
   * Accepted values: one or more absolute or workspace-relative directory
   * paths. Every entry is watched when `enableWatch` is true.
   *
   * @example
   * ```typescript
   * const options: ITemplateOptions = {path: [`./src/pages`]}
   * ```
   */
  path: string[]
  /**
   * Enable file watching for hot-reloading during development.
   *
   * @remarks
   * When true, the manager watches `path` via chokidar and recompiles on
   * change. Keep false in production.
   *
   * @defaultValue `false`
   */
  enableWatch?: boolean
  /**
   * Chokidar watcher options passed to the file watcher.
   *
   * @remarks
   * See {@link https://github.com/paulmillr/chokidar#persistence | Chokidar WatchOptions}.
   * Only read when `enableWatch` is true.
   *
   * @defaultValue `undefined`
   *
   * @example
   * ```typescript
   * const options: ITemplateOptions = {path: [`./src/pages`], enableWatch: true, watchOptions: {ignored: /node_modules/}}
   * ```
   */
  watchOptions?: ChokidarOptions
  /**
   * Hook invoked after a template file is (re)compiled.
   *
   * @remarks
   * Fires on initial load and on watch reloads. Users typically clear
   * dependent caches here (e.g. the bot's keyboard cache).
   *
   * @defaultValue `undefined`
   *
   * @example
   * ```typescript
   * const options: ITemplateOptions = {path: [`./src/pages`], onReload: () => console.log(`reloaded`)}
   * ```
   */
  onReload?: () => void
}
