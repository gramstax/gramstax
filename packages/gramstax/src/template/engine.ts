import type {InputFile} from "grammy"
import type {IDiceBlock, IInlineButtonBlock, IInvoiceBlock, IMediaBlock, IPaidMediaBlock, IPollBlock, IVenueBlock} from "~/types/template"

type ITemplateData = Record<string, unknown>

type ITemplateRenderer<T extends boolean> = T extends true ? (data?: ITemplateData) => string[] : (data?: ITemplateData) => string

/**
 * A whitelisted post-processing function applied to a `{{var|filter:arg}}` expression.
 *
 * @remarks
 * Filters are pure functions: the first argument is the resolved value, the
 * remaining arguments are compile-time string constants from the template.
 *
 * @public
 */
type ITemplateFilter = (value: unknown, ...args: string[]) => unknown

/**
 * Built-in `{{var|filter}}` pipes. Unknown filter names render empty and
 * log a warning deduplicated per compile call (whitelist enforced — templates
 * cannot execute arbitrary code through filters). `number` renders empty for
 * non-numeric input; `default` applies only to undefined/null/empty (0 and
 * false pass through).
 *
 * @public
 */
export const DEFAULT_FILTERS: Record<string, ITemplateFilter> = {
  upper: (value) => String(value ?? ``).toUpperCase(),
  lower: (value) => String(value ?? ``).toLowerCase(),
  // Non-numeric input renders empty (never "NaN").
  number: (value, decimals) => {
    const n = Number(value ?? 0)
    if (!Number.isFinite(n)) return ``
    return n.toFixed(decimals === undefined || decimals === `` ? 0 : Number(decimals))
  },
  date: (value, format) => {
    const d = new Date(String(value))
    if (Number.isNaN(d.getTime())) {
      return ``
    }
    const f = format ?? `YYYY-MM-DD`
    return f
      .replace(/YYYY/g, String(d.getUTCFullYear()))
      .replace(/MM/g, String(d.getUTCMonth() + 1).padStart(2, `0`))
      .replace(/DD/g, String(d.getUTCDate()).padStart(2, `0`))
      .replace(/HH/g, String(d.getUTCHours()).padStart(2, `0`))
      .replace(/mm/g, String(d.getUTCMinutes()).padStart(2, `0`))
      .replace(/ss/g, String(d.getUTCSeconds()).padStart(2, `0`))
  },
  plural: (value, both) => {
    const [one = ``, ...rest] = String(both ?? ``).split(`:`)
    const many = rest.join(`:`)
    return Number(value) === 1 ? one : many
  },
  default: (value, fallback) => (value === undefined || value === null || value === `` ? (fallback ?? ``) : value)
}

/**
 * Static utility class for parsing and compiling HTML-like templates.
 *
 * @remarks
 * The `TemplateEngine` provides methods for parsing HTML-like template syntax
 * with custom blocks (base, message, keyboard, media, description, etc.) and
 * compiling them into executable functions. It supports variable interpolation,
 * conditional rendering, array mapping, script execution, and template imports.
 *
 * Templates are typically organized into `<g-base>` blocks containing various
 * content blocks like `<g-message>`, `<g-keyboard>`, `<g-media>`, and `<g-description>`.
 * Each block supports a `lang` attribute for internationalization.
 *
 * @example
 * ```typescript
 * import { TemplateEngine } from 'gramstax';
 *
 * const template = `
 *   <g-base>
 *     <g-keyboard>Back, Next</g-keyboard>
 *     <g-message>Welcome {{name}}!</g-message>
 *   </g-base>
 * `;
 *
 * const messages = TemplateEngine.compileBlockGMessages(template);
 * const keyboards = TemplateEngine.compileBlockGKeyboards(template);
 *
 * const msg = messages.default?.default?.({ name: 'John' });
 * // Result: {text: 'Welcome John!', rich: false}
 * ```
 *
 * @public
 */
export class TemplateEngine {
  /**
   * Maximum items in a single Telegram media group.
   *
   * @remarks
   * Applies to both authoring paths: pipe-delimited `src`
   * (`<g-media type="photo" src="a|b|c">`) and `<g-media-group>` blocks.
   * Excess items are truncated at compile time (`_splitMediaSources`,
   * `_processGMediaGroupBlocks`) and rejected at validation time
   * (`_validateMediaGroupItems`). Matches the Telegram Bot API
   * `sendMediaGroup` limit of 10 items.
   *
   * @public
   */
  static MAX_MEDIA_GROUP_ITEMS = 10

  /**
   * Maximum Stars price for a `<g-paid-media>` paywall.
   *
   * @remarks
   * The Bot API `sendPaidMedia` `star_count` accepts 1–25000 Stars per
   * purchase (source: `https://core.telegram.org/bots/api#sendpaidmedia`).
   * Static values above this are rejected at validation time; compiled
   * values are re-checked at runtime by `Ctx.assertPaidMedia`.
   *
   * @public
   */
  static MAX_PAID_MEDIA_STARS = 25000

  /**
   * Maximum items in a single `<g-paid-media>` block.
   *
   * @remarks
   * Matches the Bot API `sendPaidMedia` `media` limit of 10 items
   * (source: `https://core.telegram.org/bots/api#sendpaidmedia`).
   * Blocks need 1–10 `<g-media>` items of type `photo`/`video`.
   *
   * @public
   */
  static MAX_PAID_MEDIA_ITEMS = 10

  /**
   * Telegram Bot API version supported by this release.
   *
   * @remarks
   * Updated with each gramstax release to reflect the latest supported
   * Telegram Bot API version.
   */
  static BOT_API_VERSION = `10.3`
  /**
   * Bot API dice emoji values accepted by `<g-dice emoji>`.
   *
   * @remarks
   * Single source of truth shared by the `g-dice` validators and
   * `Ctx.DICE_EMOJI`/`Ctx.assertDiceEmoji`: exactly the six `sendDice`
   * emoji (`🎲🎯🏀⚽🎳🎰`).
   *
   * @public
   */
  static DICE_EMOJI: ReadonlySet<string> = new Set([`🎲`, `🎯`, `🏀`, `⚽`, `🎳`, `🎰`])
  /**
   * Telegram HTML-mode tags from the pre-Rich spec (`parse_mode="HTML"`).
   *
   * @remarks
   * The original 9-tag set: `b`, `i`, `u`, `s`, `code`, `pre`, `a`,
   * `blockquote`, `blockquote expandable`. Combined with
   * {@link TemplateEngine.ALLOWED_BLOCKS_TELEGRAM_RICH} into
   * {@link TemplateEngine.ALLOWED_BLOCKS_TELEGRAM}, which feeds the
   * validator allowlist (`validateTemplate`) and the passthrough tag
   * extraction (`_extractBlockNames`).
   *
   * @public
   */
  static ALLOWED_BLOCKS_TELEGRAM_LEGACY: ReadonlySet<string> = new Set([
    // Original Telegram HTML mode tags (parse_mode="HTML", pre-Rich spec)
    `<b>`,
    `<i>`,
    `<u>`,
    `<s>`,
    `<code>`,
    `<pre>`,
    `<a>`,
    `<blockquote>`,
    `<blockquote expandable>`
  ])
  /**
   * Telegram Rich HTML tags passed through to the message `html` field.
   *
   * @remarks
   * 45 tags in 5 categories — inline (9), block/structural (21),
   * Telegram-specific (8), media (6), forms (1) — following the Telegram
   * Bot API Rich Message Formatting spec (`BOT_API_VERSION`). Excludes the
   * legacy set ({@link TemplateEngine.ALLOWED_BLOCKS_TELEGRAM_LEGACY});
   * both combine into {@link TemplateEngine.ALLOWED_BLOCKS_TELEGRAM}.
   * Coverage is locked by `telegram-rich-coverage.test.ts` and
   * `telegram-rich-matrix.test.ts`.
   *
   * @public
   */
  static ALLOWED_BLOCKS_TELEGRAM_RICH: ReadonlySet<string> = new Set([
    // Telegram Rich HTML (passed through to message `html` field)
    // New tags added by the Rich HTML spec (excludes legacy)
    // Inline formatting
    `<del>`,
    `<em>`,
    `<ins>`,
    `<mark>`,
    `<strike>`,
    `<strong>`,
    `<sub>`,
    `<sup>`,
    `<tg-spoiler>`,
    // Block/structural
    `<aside>`,
    `<br/>`,
    `<details>`,
    `<footer>`,
    `<h1>`,
    `<h2>`,
    `<h3>`,
    `<h4>`,
    `<h5>`,
    `<h6>`,
    `<hr/>`,
    `<li>`,
    `<ol>`,
    `<p>`,
    `<summary>`,
    `<table>`,
    `<caption>`,
    `<td>`,
    `<th>`,
    `<tr>`,
    `<ul>`,
    // Telegram-specific
    `<tg-collage>`,
    `<tg-emoji>`,
    `<tg-map/>`,
    `<tg-math>`,
    `<tg-math-block>`,
    `<tg-reference>`,
    `<tg-slideshow>`,
    `<tg-time>`,
    // Media
    `<audio>`,
    `<cite>`,
    `<figcaption>`,
    `<figure>`,
    `<img/>`,
    `<video>`,
    // Forms
    `<input/>`
  ])
  /**
   * Combined Telegram tag allowlist: legacy (9) + Rich HTML (45) = 54 tags.
   *
   * @remarks
   * Single source of truth for Telegram-side validation
   * (`validateTemplate` required-attribute, value-format, and
   * unknown-attribute steps) and passthrough extraction
   * (`_extractBlockNames`). See {@link TemplateEngine.ALLOWED_BLOCKS}
   * for the full registry including PAGE blocks.
   *
   * @public
   */
  static ALLOWED_BLOCKS_TELEGRAM: ReadonlySet<string> = new Set([...TemplateEngine.ALLOWED_BLOCKS_TELEGRAM_LEGACY, ...TemplateEngine.ALLOWED_BLOCKS_TELEGRAM_RICH])
  /**
   * Gramstax `<g-*>` PAGE block allowlist.
   *
   * @remarks
   * Content blocks (`g-base`, `g-message`, `g-keyboard`, `g-media`,
   * `g-media-group`, `g-description`), logic blocks (`g-script`,
   * `g-switch`, `g-case`, `g-default`, `g-map`, `g-div`), and utility
   * blocks (`g-import`, `g-space`). Validated by `validateTemplate`
   * (per-block `validateBlockG*Attributes` methods plus the centralized
   * `_PAGE_REQUIRED_ATTRS` / `_PAGE_ATTR_VALUE_VALIDATORS` specs).
   * Combined with {@link TemplateEngine.ALLOWED_BLOCKS_TELEGRAM} into
   * {@link TemplateEngine.ALLOWED_BLOCKS}.
   *
   * @public
   */
  static ALLOWED_BLOCKS_PAGE: ReadonlySet<string> = new Set([
    // Content blocks
    `<g-base>`,
    `<g-message>`,
    `<g-keyboard>`,
    `<g-media>`,
    `<g-media-group>`,
    `<g-poll>`,
    `<g-question>`,
    `<g-option>`,
    `<g-invoice>`,
    `<g-price>`,
    `<g-paid-media>`,
    `<g-venue>`,
    `<g-dice>`,
    `<g-description>`,
    `<g-callback-answer>`,
    `<g-precheckout-error>`,
    `<g-shipping-error>`,
    `<g-inline-button>`,
    `<g-answer-note>`,
    `<g-gift>`,
    // Logic blocks
    `<g-script>`,
    `<g-ifelse>`,
    `<g-switch>`,
    `<g-case>`,
    `<g-default>`,
    `<g-map>`,
    `<g-div>`,
    // Utility blocks
    `<g-import/>`,
    `<g-space/>`
  ])

  /**
   * Registry of all supported template block tags.
   *
   * @remarks
   * These are the actual XML-like tags recognized by `TemplateEngine`.
   * Each corresponds to a `<tagName>` element in template strings.
   *
   * **Content blocks:** `g-base`, `g-message`, `g-keyboard`, `g-media`, `g-description`
   * **Logic blocks:** `g-script`, `g-switch`, `g-case`, `g-default`, `g-map`, `g-div`
   * **Utility blocks:** `import`, `space`
   *
   * **Telegram Rich HTML (passed through to `html` field):**
   * - *Inline:* `a`, `b`, `code`, `del`, `em`, `i`, `ins`, `mark`, `s`, `strike`, `strong`, `sub`, `sup`, `tg-spoiler`, `u`
   * - *Block/structural:* `aside`, `blockquote`, `blockquote expandable`, `br`, `caption`, `details`, `footer`, `h1`-`h6`, `hr`, `li`, `ol`, `p`, `pre`, `summary`, `table`, `td`, `th`, `tr`, `ul`
   * - *Telegram-specific:* `tg-collage`, `tg-emoji`, `tg-map`, `tg-math`, `tg-math-block`, `tg-reference`, `tg-slideshow`, `tg-time`
   * - *Media:* `audio`, `cite`, `figcaption`, `figure`, `img`, `video`
   * - *Forms:* `input`
   */
  static ALLOWED_BLOCKS: ReadonlySet<string> = new Set([...this.ALLOWED_BLOCKS_PAGE, ...this.ALLOWED_BLOCKS_TELEGRAM])

  /**
   * Extracts lowercase block tag names from an iterable of tag literals.
   *
   * @remarks
   * Strips leading `</` or `<`, any trailing `>`, any attributes that follow
   * a space, and lowercases the result. Self-closing tags like `<g-import/>`
   * are normalised to their bare name. Entries with attributes after a space
   * (e.g. `<blockquote expandable>`) are returned with the attribute suffix
   * preserved.
   *
   * @param blocks - Iterable of tag literals (e.g. `["<g-base>", "<message/>", "<blockquote expandable>"]`)
   * @returns Set of normalized lowercase block names
   *
   * @example
   * ```typescript
   * const names = TemplateEngine._extractBlockNames([
   *   "<g-base>",
   *   "<g-import/>",
   *   "<BLOCKQUOTE expandable>"
   * ]);
   * // => Set { "g-base", "g-import", "blockquote expandable" }
   * ```
   *
   * @public
   */
  static _extractBlockNames(blocks: Iterable<string>): Set<string> {
    return new Set(
      [...blocks].map((block) =>
        block
          .replace(/^<\/?/, ``)
          .replace(/\s.*?>$/, ``)
          .replace(/\/?>$/, ``)
          .toLowerCase()
      )
    )
  }
  /**
   * Required-attribute specification for Telegram Rich HTML tags.
   *
   * @remarks
   * Per-tag table mapping tag name to the attribute(s) it must have. Two shapes
   * are supported:
   * - `string[]` — every entry must be present
   * - `{ oneOf: string[][] }` — at least one of the listed sets must be fully
   *   present (used for `<a>` which can be either a link or an anchor)
   *
   * Tags not listed here have no required attributes.
   *
   * @example
   * ```typescript
   * TemplateEngine._TELEGRAM_REQUIRED_ATTRS["a"]       // => { oneOf: [["href"], ["name"]] }
   * TemplateEngine._TELEGRAM_REQUIRED_ATTRS["tg-time"] // => ["unix"]  (format is optional, value-validated when present)
   * ```
   *
   * @public
   */
  static _TELEGRAM_REQUIRED_ATTRS: Record<string, string[] | {oneOf: string[][]}> = {
    a: {oneOf: [[`href`], [`name`]]},
    img: [`src`],
    video: [`src`],
    audio: [`src`],
    "tg-emoji": [`emoji-id`],
    "tg-time": [`unix`],
    "tg-map": [`lat`, `long`, `zoom`],
    "tg-reference": [`name`],
    input: [`type`]
  }
  /**
   * Attribute value validators for Telegram Rich HTML tags.
   *
   * @remarks
   * Per-tag, per-attribute map of validators. Each validator receives the
   * raw attribute value (after quote-stripping) and returns either `null`
   * (valid) or a descriptive error string. The value validation runs after
   * the required-attribute check, so missing attributes are reported
   * separately by {@link TemplateEngine._TELEGRAM_REQUIRED_ATTRS}.
   *
   * Value rules follow the Telegram Bot API 10.3 Rich Message Formatting
   * Options spec (see `BOT_API_VERSION`). `{{placeholder}}` values and
   * boolean attributes (no `=value`) are skipped by the caller.
   *
   * @example
   * ```typescript
   * TemplateEngine._TELEGRAM_ATTR_VALUE_VALIDATORS["tg-time"].unix("1647531900") // => null
   * TemplateEngine._TELEGRAM_ATTR_VALUE_VALIDATORS["tg-time"].unix("abc")       // => "unix must be a positive integer (got \"abc\")"
   * ```
   *
   * @public
   */
  static _TELEGRAM_ATTR_VALUE_VALIDATORS: Record<string, Record<string, (value: string) => string | null>> = {
    "tg-time": {
      unix: (v) => (/^[1-9]\d*$/.test(v) ? null : `unix must be a positive integer (got "${v}")`),
      // format is optional (not in REQUIRED_ATTRS); when present must match r|w?[dD]?[tT]? (e.g. t, r, wDT)
      format: (v) => (v.length > 0 && /^(r|w?[dD]?[tT]?)$/.test(v) ? null : `format must match r, or an optional weekday/date/time combo like wDT (got "${v}")`)
    },
    "tg-map": {
      lat: (v) => {
        const n = Number(v)
        return !Number.isNaN(n) && n >= -90 && n <= 90 ? null : `lat must be a number between -90 and 90 (got "${v}")`
      },
      long: (v) => {
        const n = Number(v)
        return !Number.isNaN(n) && n >= -180 && n <= 180 ? null : `long must be a number between -180 and 180 (got "${v}")`
      },
      // Bot API 10.3 rich map zoom range (13-20)
      zoom: (v) => (/^\d+$/.test(v) && Number(v) >= 13 && Number(v) <= 20 ? null : `zoom must be an integer between 13 and 20 (got "${v}")`)
    },
    "tg-emoji": {
      "emoji-id": (v) => (/^\d+$/.test(v) ? null : `emoji-id must be a numeric string (got "${v}")`)
    },
    a: {
      href: (v) => (/^(https?:\/\/|mailto:|tel:|tg:\/\/user\?id=|#)/i.test(v) ? null : `href must use http(s)://, mailto:, tel:, tg://user?id=, or # scheme (got "${v}")`),
      name: (v) => (v.length > 0 ? null : `name must not be empty`)
    },
    img: {
      src: (v) => (/^(https?:\/\/|tg:\/\/emoji\?id=\d+|tg:\/\/photo\?id=\d+|tg:\/\/document\?id=\d+)/i.test(v) ? null : `src must be an http(s) URL, or a tg://emoji/photo/document reference (got "${v}")`),
      alt: (v) => (v.length > 0 ? null : `alt must not be empty`),
      "tg-spoiler": () => null
    },
    video: {
      src: (v) => (/^(https?:\/\/|tg:\/\/video\?id=\d+|tg:\/\/document\?id=\d+)/i.test(v) ? null : `src must be an http(s) URL or a tg://video/document reference (got "${v}")`),
      "tg-spoiler": () => null
    },
    audio: {
      src: (v) => (/^(https?:\/\/|tg:\/\/audio\?id=\d+|tg:\/\/document\?id=\d+)/i.test(v) ? null : `src must be an http(s) URL or a tg://audio/document reference (got "${v}")`)
    },
    input: {
      // Bot API 10.3 rich messages: only <input type="checkbox"> is supported (checklists)
      type: (v) => (v === `checkbox` ? null : `type must be "checkbox" (got "${v}")`),
      checked: () => null
    },
    ol: {
      start: (v) => (/^\d+$/.test(v) ? null : `start must be a non-negative integer (got "${v}")`),
      type: (v) => ([`1`, `a`, `A`, `i`, `I`].includes(v) ? null : `type must be one of: 1, a, A, i, I (got "${v}")`),
      reversed: () => null
    },
    li: {
      value: (v) => (/^\d+$/.test(v) ? null : `value must be a non-negative integer (got "${v}")`),
      type: (v) => ([`1`, `a`, `A`, `i`, `I`, `checkbox`].includes(v) ? null : `type must be one of: 1, a, A, i, I, checkbox (got "${v}")`),
      checkbox: () => null,
      checked: () => null
    },
    table: {
      bordered: () => null,
      striped: () => null,
      is_compact: () => null
    },
    td: {
      colspan: (v) => (/^\d+$/.test(v) && Number(v) >= 1 ? null : `colspan must be a positive integer (got "${v}")`),
      rowspan: (v) => (/^\d+$/.test(v) && Number(v) >= 1 ? null : `rowspan must be a positive integer (got "${v}")`),
      align: (v) => ([`left`, `center`, `right`].includes(v) ? null : `align must be left, center or right (got "${v}")`),
      valign: (v) => ([`top`, `middle`, `bottom`].includes(v) ? null : `valign must be top, middle or bottom (got "${v}")`)
    },
    th: {
      colspan: (v) => (/^\d+$/.test(v) && Number(v) >= 1 ? null : `colspan must be a positive integer (got "${v}")`),
      rowspan: (v) => (/^\d+$/.test(v) && Number(v) >= 1 ? null : `rowspan must be a positive integer (got "${v}")`),
      align: (v) => ([`left`, `center`, `right`].includes(v) ? null : `align must be left, center or right (got "${v}")`),
      valign: (v) => ([`top`, `middle`, `bottom`].includes(v) ? null : `valign must be top, middle or bottom (got "${v}")`)
    },
    blockquote: {
      cite: (v) => (/^https?:\/\//i.test(v) ? null : `cite must be an http(s) URL (got "${v}")`),
      expandable: () => null
    },
    aside: {
      cite: (v) => (/^https?:\/\//i.test(v) ? null : `cite must be an http(s) URL (got "${v}")`)
    },
    details: {
      open: () => null
    },
    "tg-reference": {
      name: (v) => (v.length > 0 ? null : `name must not be empty`)
    },
    code: {
      class: (v) => (/^language-[\w+-]+$/.test(v) ? null : `class must be a language-* token (got "${v}")`)
    }
  }
  /**
   * Per-tag allowlist of attribute names for Telegram Rich HTML tags.
   *
   * @remarks
   * Single source of truth for the unknown-attribute validation pass
   * ({@link TemplateEngine._validateTelegramTagUnknownAttributes}). Built from
   * the official Telegram Bot API 10.3 rich HTML style examples
   * (core.telegram.org/bots/api#rich-html-style) unioned with legacy
   * parse_mode HTML attributes still tolerated (blockquote expandable,
   * cite attributes, li checkbox/checked). Tags with an empty array allow
   * NO attributes — any attribute on them is an error.
   *
   * `{{placeholder}}` is only valid as an attribute VALUE, never as a name.
   * Generic HTML attributes (style, id, data-*) are not supported by the
   * spec and are NOT whitelisted.
   *
   * @example
   * ```typescript
   * TemplateEngine._TELEGRAM_ALLOWED_ATTRS["table"] // => ["bordered", "striped"]
   * TemplateEngine._TELEGRAM_ALLOWED_ATTRS["b"]     // => [] (no attributes)
   * ```
   *
   * @public
   */
  static _TELEGRAM_ALLOWED_ATTRS: Record<string, readonly string[]> = {
    a: [`href`, `name`],
    b: [],
    code: [`class`],
    del: [],
    em: [],
    i: [],
    ins: [],
    mark: [],
    s: [],
    strike: [],
    strong: [],
    sub: [],
    sup: [],
    "tg-spoiler": [],
    u: [],
    aside: [`cite`],
    blockquote: [`cite`, `expandable`],
    br: [],
    details: [`open`],
    footer: [],
    h1: [],
    h2: [],
    h3: [],
    h4: [],
    h5: [],
    h6: [],
    hr: [],
    li: [`value`, `type`, `checkbox`, `checked`],
    ol: [`start`, `type`, `reversed`],
    p: [],
    pre: [],
    summary: [],
    table: [`bordered`, `striped`, `is_compact`],
    td: [`colspan`, `rowspan`, `align`, `valign`],
    th: [`colspan`, `rowspan`, `align`, `valign`],
    tr: [],
    ul: [],
    "tg-collage": [],
    "tg-emoji": [`emoji-id`],
    "tg-map": [`lat`, `long`, `zoom`],
    "tg-math": [],
    "tg-math-block": [],
    "tg-reference": [`name`],
    "tg-slideshow": [],
    "tg-time": [`unix`, `format`],
    audio: [`src`],
    cite: [],
    figcaption: [],
    figure: [],
    img: [`src`, `alt`, `tg-spoiler`],
    video: [`src`, `tg-spoiler`],
    input: [`type`, `checked`],
    caption: []
  }
  /**
   * Required-attribute specification for `<g-*>` PAGE blocks.
   *
   * @remarks
   * Most PAGE block attributes are optional — there are no strictly required
   * attributes. This spec is reserved for future use (e.g. context-dependent
   * requirements). The shape mirrors {@link TemplateEngine._TELEGRAM_REQUIRED_ATTRS}:
   * - `string[]` — every entry must be present
   * - `{ oneOf: string[][] }` — at least one of the listed sets must be fully present
   *
   * @example
   * ```typescript
   * TemplateEngine._PAGE_REQUIRED_ATTRS  // => {} (no strictly required attrs yet)
   * ```
   *
   * @public
   */
  static _PAGE_REQUIRED_ATTRS: Record<string, string[] | {oneOf: string[][]}> = {}
  /**
   * Attribute value validators for `<g-*>` PAGE blocks.
   *
   * @remarks
   * Per-tag, per-attribute map of validators. Each validator receives the
   * raw attribute value (after quote-stripping) and returns either `null`
   * (valid) or a descriptive error string. The value validation runs after
   * the per-block attribute validation, so unknown attributes are reported
   * separately by `validateBlockG*Attributes` methods.
   *
   * Currently covers:
   * - `<g-base id>` — must not be empty
   * - `<g-keyboard type>` — must be `inline` or `bottom`
   * - `<g-media type>` — must be one of: photo, video, audio, document, animation, voice, video_note, sticker, location, contact
   * - `<g-media shared>` — must be `true` or `false`
   * - `<g-media filename>` — any string, always valid
   * - `<g-poll type>` — must be `regular` or `quiz`
   * - `<g-poll correct>` — must be a non-negative option index
   * - `<g-poll explanation>` — any string, always valid
   * - `<g-poll anonymous>` / `<g-poll multiple>` — must be `true` or `false`
   * - `<g-venue title>` / `<g-venue address>` — any string, always valid
   * - `<g-venue latitude>` — must be a number between -90 and 90; `{{}}` values skip the static check (runtime-enforced)
   * - `<g-venue longitude>` — must be a number between -180 and 180; `{{}}` values skip the static check (runtime-enforced)
   * - `<g-dice emoji>` — must be one of 🎲🎯🏀⚽🎳🎰; `{{}}` values skip the static check (runtime-enforced)
   * - `<g-invoice currency>` — must be a 3-letter code (`XTR` or fiat); `{{}}` values skip the static check (runtime-enforced)
   * - `<g-price amount>` — must be a positive integer in smallest currency units
   * - `<g-paid-media stars>` — must be a positive integer 1–25000; `{{}}` values skip the static check (runtime-enforced)
   *
   * Validators are intentionally lenient — they catch obvious bugs (wrong
   * type, invalid value) but do not enforce every framework-level constraint.
   *
   * @example
   * ```typescript
   * TemplateEngine._PAGE_ATTR_VALUE_VALIDATORS["g-keyboard"].type("inline")   // => null
   * TemplateEngine._PAGE_ATTR_VALUE_VALIDATORS["g-keyboard"].type("sidebar") // => "Attribute \"type\" on <g-keyboard> must be \"inline\" or \"bottom\", got \"sidebar\""
   * ```
   *
   * @public
   */
  static _PAGE_ATTR_VALUE_VALIDATORS: Record<string, Record<string, (value: string) => string | null>> = {
    "g-base": {
      id: (v) => (v ? null : `Attribute "id" on <g-base> must not be empty`)
    },
    "g-keyboard": {
      type: (v) => (v === `inline` || v === `bottom` ? null : `Attribute "type" on <g-keyboard> must be "inline" or "bottom", got "${v}"`)
    },
    "g-media": {
      type: (v) => {
        const validTypes = new Set([`photo`, `video`, `audio`, `document`, `animation`, `voice`, `video_note`, `sticker`, `location`, `contact`])
        return validTypes.has(v) ? null : `Attribute "type" on <g-media> must be one of: ${[...validTypes].join(`, `)}, got "${v}"`
      },
      shared: (v) => (v === `true` || v === `false` ? null : `Attribute "shared" on <g-media> must be "true" or "false", got "${v}"`),
      filename: () => null,
      live: (v) => (/^[1-9]\d*$/.test(v) ? null : `Attribute "live" on <g-media> must be a positive integer in seconds (got "${v}")`)
    },
    "g-poll": {
      type: (v) => (v === `regular` || v === `quiz` ? null : `Attribute "type" on <g-poll> must be "regular" or "quiz", got "${v}"`),
      correct: (v) => (/^\d+$/.test(v) ? null : `Attribute "correct" on <g-poll> must be a non-negative option index, got "${v}"`),
      explanation: () => null,
      anonymous: (v) => (v === `true` || v === `false` ? null : `Attribute "anonymous" on <g-poll> must be "true" or "false", got "${v}"`),
      multiple: (v) => (v === `true` || v === `false` ? null : `Attribute "multiple" on <g-poll> must be "true" or "false", got "${v}"`)
    },
    "g-invoice": {
      currency: (v) => (v.includes(`{{`) || v.includes(`{~`) ? null : /^[A-Z]{3}$/.test(v) ? null : `Attribute "currency" on <g-invoice> must be a 3-letter code (got "${v}")`)
    },
    "g-price": {
      amount: (v) => (/^[1-9]\d*$/.test(v) ? null : `Attribute "amount" on <g-price> must be a positive integer in smallest units (got "${v}")`)
    },
    "g-paid-media": {
      stars: (v) => (v.includes(`{{`) || v.includes(`{~`) ? null : /^[1-9]\d*$/.test(v) && Number(v) <= 25000 ? null : `Attribute "stars" on <g-paid-media> must be a positive integer 1-25000 (got "${v}")`)
    },
    "g-venue": {
      title: () => null,
      address: () => null,
      latitude: (v) => {
        if (v.includes(`{{`) || v.includes(`{~`)) return null
        const n = Number(v)
        return v.trim() !== `` && Number.isFinite(n) && n >= -90 && n <= 90 ? null : `Attribute "latitude" on <g-venue> must be a number between -90 and 90 (got "${v}")`
      },
      longitude: (v) => {
        if (v.includes(`{{`) || v.includes(`{~`)) return null
        const n = Number(v)
        return v.trim() !== `` && Number.isFinite(n) && n >= -180 && n <= 180 ? null : `Attribute "longitude" on <g-venue> must be a number between -180 and 180 (got "${v}")`
      }
    },
    "g-dice": {
      emoji: (v) => {
        if (v === `` || v.includes(`{{`) || v.includes(`{~`)) return null
        return TemplateEngine.DICE_EMOJI.has(v) ? null : `Attribute "emoji" on <g-dice> must be one of 🎲🎯🏀⚽🎳🎰 (got "${v}")`
      }
    }
  }
  /**
   * Registry of supported scope interpolation syntaxes.
   *
   * @remarks
   * These are the variable/expression delimiters recognized within template content.
   * Each entry represents a pair of opening/closing delimiters that trigger a specific
   * interpolation behavior at compile time.
   *
   * **Supported scopes:**
   * - `{{}}` — Mustache-style variable interpolation. Placeholders like `{{name}}` are
   *   replaced with the corresponding value from the `data` object at render time.
   *   Nullish values produce an empty string.
   * - `{~~}` — Inline execution blocks. Expressions like `{~ status ? "Success" : "Failed" ~}` are
   *   evaluated as JavaScript expressions with access to the `data` object.
   *
   * This array is used for reference/documentation purposes; the actual parsing is
   * handled by `_processScopeVariables` (for `{{}}`) and `_processScopeExec` (for `{~~}`).
   *
   * @example
   * ```typescript
   * console.log(TemplateEngine.ALLOWED_SCOPE)
   * // Result: ['{{}}', '{~~}']
   * ```
   *
   * @public
   */
  static ALLOWED_SCOPE: ReadonlySet<string> = new Set([`{{}}`, `{~~}`])
  /**
   * Identifiers that `<g-ifelse>` never rewrites to `data?.x`.
   *
   * @remarks
   * Three groups: reserved words that cannot be references, the parameter names every
   * compiled template body already has in scope (`data`, `__esc`, `FILTERS`), and the
   * standard globals a template author may legitimately call.
   */
  static _IFELSE_PASSTHROUGH = new Set([
    `async`, `await`, `break`, `case`, `catch`, `class`, `const`, `continue`, `debugger`, `default`, `delete`, `do`, `else`, `enum`, `export`, `extends`, `false`, `finally`, `for`, `function`, `if`, `implements`, `import`, `in`, `instanceof`, `interface`, `let`, `new`, `null`, `of`, `package`, `private`, `protected`, `public`, `return`, `static`, `super`, `switch`, `this`, `throw`, `true`, `try`, `typeof`, `var`, `void`, `while`, `with`, `yield`,
    `data`, `__esc`, `FILTERS`,
    `Array`, `BigInt`, `Boolean`, `Date`, `Error`, `Intl`, `JSON`, `Map`, `Math`, `Number`, `Object`, `Promise`, `RangeError`, `ReferenceError`, `RegExp`, `Set`, `String`, `Symbol`, `SyntaxError`, `TypeError`, `WeakMap`, `WeakSet`,
    `console`, `decodeURI`, `decodeURIComponent`, `encodeURI`, `encodeURIComponent`, `globalThis`, `isFinite`, `isNaN`, `parseFloat`, `parseInt`
  ])

  /**
   * Escapes special characters in a string for safe use in template literals.
   *
   * @remarks
   * This internal method escapes backslashes, backticks, and `${` sequences to
   * prevent static template text from breaking out of template literal syntax
   * during compilation. Applied to static segments before they are embedded in
   * generated code (`_compileToFunction` builds concatenation, never raw
   * backtick-wrapped statics; block processors escape embedded content).
   *
   * @param str - The input string to escape
   * @returns The escaped string with backslashes and backticks properly escaped
   *
   * @example
   * ```typescript
   * const escaped = TemplateEngine._escape('Hello `world`');
   * // Result: 'Hello \\`world\\`'
   * ```
   *
   * @public
   */
  static _escape(str: string): string {
    return str.replace(/\\/g, `\\\\`).replace(/`/g, `\\\``).replace(/\$\{/g, `\\\${`)
  }

  /**
   * Escapes static template text while preserving template syntax spans.
   *
   * @remarks
   * Walks `content` char-by-char: `{{{...}}}`, `{{...}}`, and `{~...~}`
   * spans pass through untouched (they are converted to generated code
   * later). A balanced `${...}` span is preserved live only when its inner
   * code passes {@link TemplateEngine._isGeneratedCode} — i.e. it was
   * produced by an inner block processor (nested `<g-map>` bodies carry
   * `${(() => ...)}` / `${__esc(...)}` spans through outer escaping).
   * Any other `${` sequence (untrusted/static text, unterminated spans)
   * is neutralized via {@link TemplateEngine._escape}, consistent with
   * top-level static text. Every other character goes through
   * {@link TemplateEngine._escape}, neutralizing breakout payloads
   * (backticks, backslashes) in untrusted static text. Used by
   * `_processGSwitchBlocks` and `_processGMapBlocks` for case/default and
   * loop bodies.
   *
   * @param content - Raw static block content to escape.
   * @returns The content with non-syntax characters escaped.
   * @public
   */
  static _escapeStaticExceptInterpolation(content: string): string {
    let out = ``
    let i = 0
    const tick = String.fromCharCode(96)
    while (i < content.length) {
      if (content.startsWith(`{{{`, i)) {
        const end = content.indexOf(`}}}`, i + 3)
        const stop = end < 0 ? content.length : end + 3
        out += content.slice(i, stop)
        i = stop
      } else if (content.startsWith(`{{`, i)) {
        const end = content.indexOf(`}}`, i + 2)
        const stop = end < 0 ? content.length : end + 2
        out += content.slice(i, stop)
        i = stop
      } else if (content.startsWith(`{~`, i)) {
        const end = content.indexOf(`~}`, i + 2)
        const stop = end < 0 ? content.length : end + 2
        out += content.slice(i, stop)
        i = stop
      } else if (content[i] === `$` && content[i + 1] === `{`) {
        let j = i + 2
        let depth = 1
        let quote: string | null = null
        let escaped = false
        while (j < content.length && depth > 0) {
          const ch = content[j]!
          if (quote !== null) {
            if (escaped) escaped = false
            else if (ch === `\\`) escaped = true
            else if (ch === quote) quote = null
          } else if (ch === `'` || ch === `"` || ch === tick) {
            quote = ch
          } else if (ch === `{`) {
            depth++
          } else if (ch === `}`) {
            depth--
          }
          j++
        }
        const span = content.slice(i, j)
        if (depth === 0 && this._isGeneratedCode(content.slice(i + 2, j - 1))) {
          out += span
        } else {
          out += this._escape(span)
        }
        i = j
      } else {
        out += this._escape(content[i]!)
        i++
      }
    }
    return out
  }

  /**
   * Scope: `{{}}`
   * Converts `{{variable}}` placeholders to JavaScript template literal expressions.
   *
   * @remarks
   * This internal method transforms Mustache-like variable syntax into JavaScript
   * template literal interpolation. `{{key}}` is HTML-escaped at runtime; `{{{key}}}`
   * is inserted raw. Variables are accessed from the `data` object, with nullish
   * coalescing to empty string when undefined. Surrounding whitespace inside the
   * braces is trimmed. Each filter segment splits its name on the first `:` only;
   * the remainder is passed as one combined argument (so `date:HH:mm:ss` stays
   * whole; `plural` splits its combined `one:many` argument itself). Filter
   * arguments are embedded via `JSON.stringify`, never raw backticks. Unknown
   * filter warnings are deduplicated per compile call; other expressions in the
   * same template still render (unknown one renders empty).
   *
   * @param template - The template string containing `{{variable}}` placeholders
   * @returns The processed template with placeholders converted to `${data["key"]}` syntax
   *
   * @example
   * ```typescript
   * const processed = TemplateEngine._processScopeVariables('Hello {{name}}!');
   * // Result: 'Hello ${__esc((data && data["name"]) ?? "")}!'
   * ```
   *
   * @public
   */
  /**
   * Applies `|filter:arg` pipes to an already-resolved head expression.
   *
   * @remarks
   * Split out of {@link TemplateEngine._processScopeVariables} so `<g-map>` can run the
   * same whitelist over its own loop variables instead of re-deriving the pipe grammar.
   * The caller resolves the head — a `data` path or a loop variable — and passes the whole
   * expression; the leading segment is dropped because it is already baked into `access`.
   *
   * @param access - JavaScript expression for the head, e.g. `(data?.user)` or `(e.name)`
   * @param expr - The full expression including its head segment, used for the warning text
   * @param warned - Filter names already reported, so each unknown filter warns once
   * @returns The chained call, or `""` when a filter is not on the whitelist
   */
  static _compileFilterChain(access: string, expr: string, warned: Set<string>): string {
    const segments = expr.split(`|`)
    segments.shift()
    let chained = access
    for (const segment of segments) {
      const colon = segment.indexOf(`:`)
      const name = (colon < 0 ? segment : segment.slice(0, colon)).trim()
      const rest = colon < 0 ? `` : segment.slice(colon + 1)
      if (DEFAULT_FILTERS[name] === undefined) {
        if (!warned.has(name)) {
          warned.add(name)
          console.warn(`Unknown template filter "${name}" in {{${expr}}} — renders empty`)
        }
        return `""`
      }
      chained = rest === `` ? `FILTERS.${name}(${chained})` : `FILTERS.${name}(${chained}, ${JSON.stringify(rest)})`
    }
    return chained
  }

  /**
   * Scope: `{{}}`
   * Converts `{{variable}}` placeholders to JavaScript template literal expressions.
   *
   * @remarks
   * This internal method transforms Mustache-like variable syntax into JavaScript
   * template literal interpolation. `{{key}}` is HTML-escaped at runtime; `{{{key}}}`
   * is inserted raw. Variables are accessed from the `data` object, with nullish
   * coalescing to empty string when undefined. Surrounding whitespace inside the
   * braces is trimmed. Each filter segment splits its name on the first `:` only;
   * the remainder is passed as one combined argument (so `date:HH:mm:ss` stays
   * whole; `plural` splits its combined `one:many` argument itself). Filter
   * arguments are embedded via `JSON.stringify`, never raw backticks. Unknown
   * filter warnings are deduplicated per compile call; other expressions in the
   * same template still render (unknown one renders empty).
   *
   * @param template - The template string containing `{{variable}}` placeholders
   * @returns The processed template with placeholders converted to `${data["key"]}` syntax
   *
   * @example
   * ```typescript
   * const processed = TemplateEngine._processScopeVariables('Hello {{name}}!');
   * // Result: 'Hello ${__esc((data && data["name"]) ?? "")}!'
   * ```
   *
   * @public
   */
  static _processScopeVariables(template: string) {
    const toAccess = (key: string) =>
      key
        .split(`.`)
        .map((k: string) => `?.${k}`)
        .join(``)
    const warnedLocal = new Set<string>()
    const toFilterChain = (expr: string): string => this._compileFilterChain(`(data${toAccess((expr.split(`|`, 1)[0] ?? ``).trim())})`, expr, warnedLocal)
    return template.replace(/\{\{\{\s*([^{}]+?)\s*\}\}\}/g, (_, expr) => `\${${toFilterChain(expr.trim())} ?? ""}`).replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (_, expr) => `\${__esc(${toFilterChain(expr.trim())} ?? "")}`)
  }

  /**
   * HTML-escapes a runtime value for safe interpolation into rich-HTML messages.
   *
   * @remarks
   * Non-string values are stringified; `null`/`undefined` become empty string.
   * Escaped code points: `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`.
   * Scope: text-node interpolation via `{{}}` only. Attribute values and
   * `{{{}}}` raw output are intentionally not HTML-escaped.
   *
   * @param value - The runtime value to escape.
   * @returns The escaped string.
   *
   * @public
   */
  static _escapeData(value: unknown): string {
    if (typeof value !== `string`) {
      return value === null || value === undefined ? `` : String(value)
    }
    return value.replace(/&/g, `&amp;`).replace(/</g, `&lt;`).replace(/>/g, `&gt;`)
  }

  /**
   * Scope: `{~~}`
   * Transforms inline execution blocks `{~ jscode ~}` into JavaScript expressions.
   *
   * @remarks
   * This internal method converts inline execution syntax into self-invoking
   * JavaScript expressions. It first attempts direct execution, then falls back
   * to `with(data)` scope. Returns an empty string on any error.
   * By design this executes developer-authored template code (templates are
   * code, only `data` values are untrusted input); no strict/no-script mode
   * is provided.
   *
   * @param template - The template string containing `{~ code ~}` expressions
   * @returns The template with inline execution blocks converted to executable expressions
   *
   * @example
   * ```typescript
   * const template = 'Total: {~ data?.count ?? 0 ~}';
   * const processed = TemplateEngine._processExec(template);
   * // Result: 'Total: ${(() => { try { return data?.count ?? 0 } catch(e) { try { with(data || {}) { return data?.count ?? 0 } } catch(ee) { return '' } } })()}'
   * ```
   *
   * @public
   */
  static _processScopeExec(template: string) {
    return template.replace(/{~\s*([\s\S]*?)\s*~}/g, (_, code) => `\${(() => { try { return ${code} } catch(e) { try { with(data || {}) { return ${code} } } catch(ee) { return '' } } })()}`)
  }

  /**
   * Block: g-base
   * Extracts and parses `<g-base>` blocks from a template string.
   *
   * @remarks
   * This internal method identifies all `<g-base>` blocks in the template and extracts
   * their content, organizing them by their `id` attribute. Blocks without an `id`
   * are stored under the key `"default"`. Leading whitespace and surrounding
   * newlines are trimmed from the inner content.
   *
   * **Attributes:**
   *   - `id` (optional): Identifier for the base block. If not specified,
   *                      defaults to `"default"`. Used to reference specific base blocks when compiling
   *                      templates or extracting content.
   *
   * @param template - The raw template string containing `<g-base>` blocks
   * @returns An object mapping base IDs to their cleaned inner content
   *
   * @example
   * ```typescript
   * const template = `
   *   <g-base id="main">
   *     <g-message>Hello World</g-message>
   *   </g-base>
   *   <g-base id="error">
   *     <g-message>Error occurred</g-message>
   *   </g-base>
   *   <g-base>
   *     <g-message>Default block</g-message>
   *   </g-base>
   * `;
   * const bases = TemplateEngine._processGBaseBlocks(template);
   * // Result: {
   * //   main: '<g-message>Hello World</g-message>',
   * //   error: '<g-message>Error occurred</g-message>',
   * //   default: '<g-message>Default block</g-message>'
   * // }
   * ```
   *
   * @public
   */
  static _processGBaseBlocks(template: string) {
    const baseRegex = /<g-base\b[^>]*?(?:\sid=(["']?)([^"'\s>]+)\1)?[^>]*?>([\s\S]*?)<\/g-base>/g
    const result: {
      [AGBaseId: string]: string
    } = {}

    for (const match of template.matchAll(baseRegex)) {
      const idValue = match[2] ?? `default`
      const inner = match[3] ?? ``
      const cleaned = inner
        .replace(/^[\t ]+/gm, ``)
        .replace(/^\n+/, ``)
        .replace(/\n+$/, ``)
        .trim()

      result[idValue] = cleaned
    }
    return result
  }

  /**
   * Block: g-script
   * Transforms `<g-script>` blocks into executable JavaScript expressions.
   *
   * @remarks
   * This internal method converts `<g-script>` blocks into self-invoking functions
   * that execute with access to the `data` object via `with(data)`. If the script
   * throws an error or `data` is undefined, an empty string is returned.
   * By design this executes developer-authored template code (templates are
   * code, only `data` values are untrusted input); no strict/no-script mode
   * is provided.
   *
   * **Attributes:**
   *   - none
   *
   * @param template - The template string containing `<g-script>` blocks
   * @returns The template with `<g-script>` blocks converted to executable expressions
   *
   * @example
   * ```typescript
   * const template = '<g-script>return name ? `Hello ${name}` : `Hello`;</g-script>';
   * const processed = TemplateEngine._processGScriptBlocks(template);
   * // Result: '${(() => { if (!data) return ''; try { with(data) { return name ? `Hello ${name}` : `Hello`; } } catch(e) { return '' } })()}'
   * ```
   *
   * @public
   */
  static _processGScriptBlocks(template: string) {
    return template.replace(/<g-script\b[^>]*>([\s\S]*?)<\/g-script>/gi, (_, rawCode: string) => {
      const innerCode = rawCode.trim()
      if (!innerCode) return ``

      return `\${(() => { if (!data) return ''; try { with(data) { ${innerCode} } } catch(e) { return '' } })()}`
    })
  }

  /**
   * Splits a `<g-ifelse>` body into tokens so identifiers can be rewritten without a
   * JavaScript parser dependency.
   *
   * @remarks
   * Token types: `word`, `number`, `string`, `template`, `regex`, `punct`. Whitespace and
   * comments are dropped — spacing is not preserved because the output is re-emitted source.
   *
   * Two constructs are tokenized as opaque single tokens and therefore never rewritten:
   * regex literals, and template literals (so `${...}` inside them cannot be silently
   * reinterpreted). Template literals that do carry `${` interpolation are rejected by
   * {@link TemplateEngine.validateBlockGIfElseBody} rather than mis-rewritten here.
   *
   * A `/` is read as division when the previous token can end a value (word, number, string,
   * template, `)`, `]`, `++`, `--`) and as a regex literal otherwise. This is the standard
   * heuristic and is ambiguous for `if (x) /re/.test(s)`; it resolves toward division, which
   * is the common case in a template conditional.
   *
   * @param expr - The raw `<g-ifelse>` body
   * @returns The token list
   */
  static _tokenizeExpression(expr: string): Array<{type: string; value: string}> {
    const tokens: Array<{type: string; value: string}> = []
    const push = (type: string, value: string): void => {
      tokens.push({type, value})
    }
    const endsValue = (token: {type: string; value: string} | undefined): boolean =>
      token !== undefined && (token.type === `word` || token.type === `number` || token.type === `string` || token.type === `template` || (token.type === `punct` && (token.value === `)` || token.value === `]` || token.value === `++` || token.value === `--`)))

    let i = 0
    while (i < expr.length) {
      const ch = expr[i]!

      if (ch === ` ` || ch === `\t` || ch === `\n` || ch === `\r`) {
        i++
        continue
      }
      if (ch === `/` && expr[i + 1] === `/`) {
        const end = expr.indexOf(`\n`, i)
        i = end < 0 ? expr.length : end + 1
        continue
      }
      if (ch === `/` && expr[i + 1] === `*`) {
        const end = expr.indexOf(`*/`, i + 2)
        i = end < 0 ? expr.length : end + 2
        continue
      }
      if (ch === `'` || ch === `"`) {
        let j = i + 1
        while (j < expr.length) {
          if (expr[j] === `\\`) {
            j += 2
            continue
          }
          if (expr[j] === ch) {
            j++
            break
          }
          j++
        }
        push(`string`, expr.slice(i, j))
        i = j
        continue
      }
      if (ch === `\``) {
        let j = i + 1
        let depth = 0
        while (j < expr.length) {
          if (expr[j] === `\\`) {
            j += 2
            continue
          }
          if (expr[j] === `\`` && depth === 0) {
            j++
            break
          }
          if (expr[j] === `$` && expr[j + 1] === `{` && depth === 0) {
            depth++
            j += 2
            continue
          }
          if (depth > 0) {
            if (expr[j] === `{`) depth++
            else if (expr[j] === `}`) depth--
          }
          j++
        }
        push(`template`, expr.slice(i, j))
        i = j
        continue
      }
      if (/[0-9]/.test(ch) || (ch === `.` && /[0-9]/.test(expr[i + 1] ?? ``))) {
        let j = i
        while (j < expr.length && /[0-9a-fA-F._nxXoObBeE]/.test(expr[j]!)) j++
        push(`number`, expr.slice(i, j))
        i = j
        continue
      }
      if (/[A-Za-z_$]/.test(ch)) {
        let j = i
        while (j < expr.length && /[\w$]/.test(expr[j]!)) j++
        push(`word`, expr.slice(i, j))
        i = j
        continue
      }

      const three = expr.slice(i, i + 3)
      if (three === `===` || three === `!==`) {
        push(`punct`, three)
        i += 3
        continue
      }
      const two = expr.slice(i, i + 2)
      if (two === `&&` || two === `||` || two === `??` || two === `?.` || two === `=>` || two === `==` || two === `!=` || two === `<=` || two === `>=` || two === `++` || two === `--` || two === `**`) {
        push(`punct`, two)
        i += 2
        continue
      }

      if (ch === `/`) {
        if (endsValue(tokens[tokens.length - 1])) {
          push(`punct`, `/`)
          i++
          continue
        }
        let j = i + 1
        let inClass = false
        while (j < expr.length) {
          const c = expr[j]!
          if (c === `\\`) {
            j += 2
            continue
          }
          if (c === `[`) inClass = true
          else if (c === `]`) inClass = false
          else if (c === `/` && !inClass) {
            j++
            break
          } else if (c === `\n`) break
          j++
        }
        while (j < expr.length && /[a-z]/.test(expr[j]!)) j++
        push(`regex`, expr.slice(i, j))
        i = j
        continue
      }

      push(`punct`, ch)
      i++
    }
    return tokens
  }

  /**
   * Collects the parameter names introduced by every arrow function in a token list.
   *
   * @remarks
   * A conditional body may contain `items.filter((item) => item.on).length > 0`. Those
   * parameters are locals, not scope reads, and must survive the rewrite untouched.
   *
   * @param tokens - Output of {@link TemplateEngine._tokenizeExpression}
   * @returns The local names, valid for the whole expression
   */
  static _ifelseArrowLocals(tokens: Array<{type: string; value: string}>): Set<string> {
    const locals = new Set<string>()
    for (let k = 0; k < tokens.length; k++) {
      if (tokens[k]!.type !== `punct` || tokens[k]!.value !== `=>`) continue

      const prev = tokens[k - 1]
      if (prev === undefined) continue
      if (prev.type === `word`) {
        locals.add(prev.value)
        continue
      }
      if (prev.type !== `punct` || prev.value !== `)`) continue

      let depth = 0
      for (let j = k - 1; j >= 0; j--) {
        const token = tokens[j]!
        if (token.type !== `punct`) continue
        if (token.value === `)`) depth++
        else if (token.value === `(`) {
          depth--
          if (depth !== 0) continue
          for (let m = j + 1; m < k - 1; m++) {
            const inner = tokens[m]!
            if (inner.type === `word` && !TemplateEngine._IFELSE_PASSTHROUGH.has(inner.value)) locals.add(inner.value)
          }
          break
        }
      }
    }
    return locals
  }

  /**
   * Decides whether a `{` opens an object literal (keys are not scope reads) or a block.
   *
   * @param tokens - Output of {@link TemplateEngine._tokenizeExpression}
   * @param index - Index of the `{` token
   * @returns True when the brace opens an object literal
   */
  static _isObjectLiteralBrace(tokens: Array<{type: string; value: string}>, index: number): boolean {
    const prev = tokens[index - 1]
    if (prev === undefined) return true
    if (prev.type === `punct`) return prev.value !== `)` && prev.value !== `]` && prev.value !== `}`
    return prev.value === `return` || prev.value === `typeof` || prev.value === `in` || prev.value === `of` || prev.value === `case` || prev.value === `do` || prev.value === `else` || prev.value === `yield` || prev.value === `await`
  }

  /**
   * Rewrites bare identifiers in a `<g-ifelse>` body to optional `data` reads.
   *
   * @remarks
   * `user.name` becomes `data?.user?.name` — an optional chain, so a missing branch never
   * throws — rather than `(data?.user).name`, which would. A member chain is consumed as a
   * unit so the whole chain stays optional. Identifiers already qualified by `.`/`?.`,
   * object-literal keys, arrow-function parameters, reserved words, and the standard globals
   * are left alone; shorthand object properties are expanded so they keep reading from `data`.
   *
   * @param expr - The raw `<g-ifelse>` body
   * @returns Source with every scope read anchored to `data`
   *
   * @example
   * ```typescript
   * TemplateEngine._rewriteScopeIdentifiers(`user.isAdmin ? "admin" : "user"`);
   * // Result: 'data?.user?.isAdmin ? "admin" : "user"'
   * ```
   */
  static _rewriteScopeIdentifiers(expr: string): string {
    const tokens = this._tokenizeExpression(expr)
    const locals = this._ifelseArrowLocals(tokens)
    const braces: boolean[] = []
    let out = ``

    for (let k = 0; k < tokens.length; k++) {
      const token = tokens[k]!
      if (token.type === `punct`) {
        if (token.value === `{`) braces.push(this._isObjectLiteralBrace(tokens, k))
        else if (token.value === `}`) braces.pop()
        out += token.value
        continue
      }
      if (token.type !== `word`) {
        out += token.value
        continue
      }

      const name = token.value
      if (this._IFELSE_PASSTHROUGH.has(name) || locals.has(name)) {
        // Whitespace is dropped by the tokenizer, so a keyword prefix (`typeof`, `return`,
        // `void`, …) needs its separator restored or it would fuse with the operand.
        const next = tokens[k + 1]
        const needsSpace = next !== undefined && (next.type === `word` || next.type === `number` || next.type === `string` || next.type === `template`)
        out += needsSpace ? `${name} ` : name
        continue
      }
      const prev = tokens[k - 1]
      if (prev !== undefined && prev.type === `punct` && (prev.value === `.` || prev.value === `?.`)) {
        out += name
        continue
      }

      const next = tokens[k + 1]
      const inObjectLiteral = braces.length > 0 && braces[braces.length - 1] === true
      if (inObjectLiteral && next !== undefined && next.type === `punct` && next.value === `:`) {
        out += name
        continue
      }
      if (inObjectLiteral && next !== undefined && next.type === `punct` && (next.value === `,` || next.value === `}`)) {
        out += `${name}: data?.${name}`
        continue
      }

      let chain = `data?.${name}`
      let j = k
      while (j + 1 < tokens.length) {
        const open = tokens[j + 1]!
        if (open.type !== `punct`) break

        if (open.value === `?.`) {
          const member = tokens[j + 2]
          if (member === undefined || member.type !== `word`) break
          chain += `?.${member.value}`
          j += 2
          continue
        }
        if (open.value === `.`) {
          const member = tokens[j + 2]
          if (member === undefined || member.type !== `word`) break
          chain += this._IFELSE_PASSTHROUGH.has(member.value) ? `.${member.value}` : `?.${member.value}`
          j += 2
          continue
        }
        if (open.value === `[`) {
          let depth = 0
          let close = -1
          for (let m = j + 1; m < tokens.length; m++) {
            const token2 = tokens[m]!
            if (token2.type !== `punct`) continue
            if (token2.value === `[`) depth++
            else if (token2.value === `]`) {
              depth--
              if (depth === 0) {
                close = m
                break
              }
            }
          }
          if (close < 0) break
          let inner = ``
          for (let m = j + 2; m < close; m++) {
            const token2 = tokens[m]!
            const before = m > j + 1 ? tokens[m - 1]! : undefined
            const isProperty = before !== undefined && before.type === `punct` && (before.value === `.` || before.value === `?.`)
            const isWordValue = token2.type === `word` && !this._IFELSE_PASSTHROUGH.has(token2.value) && !isProperty && !locals.has(token2.value)
            if (isWordValue) {
              inner += `data?.${token2.value}`
              continue
            }
            const needsSpace = inner !== `` && (token2.type === `word` || token2.type === `number`) && (tokens[m - 1]!.type === `word` || tokens[m - 1]!.type === `number`)
            inner += `${needsSpace ? ` ` : ``}${token2.value}`
          }
          chain += `?.[${inner}]`
          j = close
          continue
        }
        break
      }

      out += chain
      k = j
    }
    return out
  }

  /**
   * Reports whether a `<g-ifelse>` body actually branches.
   *
   * @remarks
   * `<g-ifelse>` exists for conditionals only, so a body with no ternary and no
   * short-circuit operator is rejected rather than silently becoming an `{~~}` clone.
   *
   * @param tokens - Output of {@link TemplateEngine._tokenizeExpression}
   * @returns True when the body contains `?:`, `&&`, `||`, or `??`
   */
  static _isConditionalExpression(tokens: Array<{type: string; value: string}>): boolean {
    return tokens.some((token) => token.type === `punct` && (token.value === `?` || token.value === `&&` || token.value === `||` || token.value === `??`))
  }

  /**
   * Block: g-ifelse
   * Evaluates a conditional expression and inlines the chosen value.
   *
   * @remarks
   * Unlike `{~~}`, this block never emits `with`, so the compiled body is valid in an ESM
   * strict-mode module and survives the AOT `with(` guard. Bare identifiers are rewritten to
   * optional `data` reads by {@link TemplateEngine._rewriteScopeIdentifiers}.
   *
   * @param template - The template string containing `<g-ifelse>` blocks
   * @returns The template with each block replaced by its interpolation
   *
   * @example
   * ```typescript
   * const template = '<g-ifelse>isAdmin ? "admin" : "user"</g-ifelse>';
   * const processed = TemplateEngine._processGIfElseBlocks(template);
   * // Result: '${(() => { if (!data) return \'\'; try { return data?.isAdmin ? "admin" : "user" } catch(e) { return \'\' } })()}'
   * ```
   *
   * @public
   */
  static _processGIfElseBlocks(template: string) {
    return template.replace(/<g-ifelse\b[^>]*>([\s\S]*?)<\/g-ifelse>/gi, (_, rawExpr: string) => {
      const expr = rawExpr.trim()
      if (!expr) return ``

      return `\${(() => { if (!data) return ''; try { return (${this._rewriteScopeIdentifiers(expr)}) ?? "" } catch(e) { return '' } })()}`
    })
  }

  /**
   * Block: g-space
   * Removes lines containing self-closing `<g-space />` tags.
   *
   * @remarks
   * This internal method identifies lines that contain only a `<g-space />` tag
   * (with optional surrounding whitespace) and removes the entire line.
   * This is useful for controlling whitespace in templates.
   *
   * **Attributes:**
   *   - none
   *
   * @param template - The template string containing `<g-space />` tags
   * @returns The template with `<g-space />` lines removed
   *
   * @example
   * ```typescript
   * const template = 'Line 1\n<g-space />\nLine 2';
   * const processed = TemplateEngine._processGSpaceBlocks(template);
   * // Result: 'Line 1\n\nLine 2'
   * ```
   *
   * @public
   */
  static _processGSpaceBlocks(template: string) {
    return template.replace(/^[ \t]*<g-space\s*\/>[ \t]*$/gim, ``)
  }

  /**
   * Block: g-div
   * Normalizes content within `<g-div>` blocks by removing indentation.
   *
   * @remarks
   * This internal method processes `<g-div>` blocks and cleans their inner content
   * by removing leading tabs/spaces per line and trimming surrounding newlines.
   * The `<g-div>` tags themselves are removed from the output.
   *
   * **Attributes:**
   *   - none
   *
   * @param template - The template string containing `<g-div>` blocks
   * @returns The template with `<g-div>` blocks replaced by their de-indented content
   *
   * @example
   * ```typescript
   * const template = '<g-div>\n    Line 1\n    Line 2\n</g-div>';
   * const processed = TemplateEngine._processGDivBlocks(template);
   * // Result: 'Line 1\nLine 2'
   * ```
   *
   * @public
   */
  static _processGDivBlocks(template: string) {
    return template.replace(/<g-div>([\s\S]*?)<\/g-div>/gi, (_, inner: string) => {
      const cleaned = inner
        .replace(/^[\t ]+/gm, ``)
        .replace(/^\n+/, ``)
        .replace(/\n+$/, ``)
      return cleaned
    })
  }

  /**
   * Block: g-switch
   * Transforms `<g-switch>` blocks into JavaScript switch statement expressions.
   *
   * @remarks
   * This internal method converts `<g-switch>` blocks with `<g-case>` and `<g-default>`
   * sub-blocks into self-invoking JavaScript switch expressions. The `value`
   * attribute specifies which data key to switch on. Case values can be
   * comma-separated for multiple matches.
   *
   * **Attributes:**
   *   - <g-switch>
   *      - `value` (required): The key name in the `data` object whose value will be used as the switch expression.
   *   - <g-case>
   *      - `is` (required): One or more literal match values. Multiple values may be provided as a comma-separated list.
   *   - <g-default>
   *      - none
   *
   * @param template - The template string containing `<g-switch>` blocks
   * @returns The template with `<g-switch>` blocks converted to executable switch expressions
   *
   * @example
   * ```typescript
   * const template = `
   *   <g-switch value="status">
   *     <g-case is="active">Active status</g-case>
   *     <g-case is="pending">Pending status</g-case>
   *     <g-default>Unknown status</g-default>
   *   </g-switch>
   * `;
   * const processed = TemplateEngine._processGSwitchBlocks(template);
   * // Result: '${(() => { switch((data && data["status"])) { case "active": return `Active status`; ... } })()}'
   * ```
   *
   * @public
   */
  static _processGSwitchBlocks(template: string) {
    const switchRegex = /<g-switch\b(?:\s+value\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+)))?>([\s\S]*?)<\/g-switch>/gi
    return template.replace(switchRegex, (_, valueDouble, valueSingle, valueBare, innerContent) => {
      const valueKey = valueDouble ?? valueSingle ?? valueBare
      if (!valueKey) return ``

      let casesJs = ``
      const caseRegex = /<g-case\b(?:\s+is\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+)))?>([\s\S]*?)<\/g-case>/gi
      const defaultRegex = /<g-default>([\s\S]*?)<\/g-default>/gi

      let match: RegExpExecArray | null
      while ((match = caseRegex.exec(innerContent)) !== null) {
        const values = (match[1] ?? match[2] ?? match[3] ?? ``).split(`,`).map((v) => v.trim())
        const content = this._escapeStaticExceptInterpolation(
          (match[4] || ``)
            .replace(/^[\t ]+/gm, ``)
            .replace(/^\n+/, ``)
            .replace(/\n+$/, ``)
            .trim()
        )

        values.forEach((v) => {
          casesJs += `case ${JSON.stringify(v)}: `
        })
        casesJs += `return \`${content}\`; `
      }

      const defaultMatch = defaultRegex.exec(innerContent)
      if (defaultMatch) {
        const content = this._escapeStaticExceptInterpolation(
          (defaultMatch[1] || ``)
            .replace(/^[\t ]+/gm, ``)
            .replace(/^\n+/, ``)
            .replace(/\n+$/, ``)
            .trim()
        )
        casesJs += `default: return \`${content}\`; `
      } else {
        casesJs += `default: return ''; `
      }

      return `\${(() => { switch((data && data[${JSON.stringify(valueKey)}])) { ${casesJs} } })()}`
    })
  }

  /**
   * Block: g-map
   * Transforms `<g-map>` blocks into JavaScript array map expressions.
   *
   * @remarks
   * This internal method converts `<g-map>` blocks into array mapping operations.
   * The `src` attribute specifies which data key contains the array. Inside the
   * block, `{{e}}` refers to the current element, `{{e.prop}}` to element properties,
   * and `{{i}}` to the current index. The `join` attribute specifies the separator.
   *
   * **Attributes:**
   *   - `src` (required): The key name in the `data` object whose value is treated as an array.
   *   - `join` (optional): Join separator string. Defaults to `"\\n"` (a newline escape sequence).
   *
   * @param template - The template string containing `<g-map>` blocks
   * @returns The template with `<g-map>` blocks converted to map expressions
   *
   * @example
   * ```typescript
   * const template = '<g-map src="items" join=", "> - {{e.name}} ({{i}})</g-map>';
   * const processed = TemplateEngine._processGMapBlocks(template);
   * // Result: '${(data && data["items"] || []).map((e, i) => ` - ${e.name} (${i})`).join(", ")}'
   * ```
   *
   * @public
   */
  static _processGMapBlocks(template: string) {
    // Match innermost g-map blocks — those whose content has no nested <g-map.
    // Uses a tempered greedy token: (?:(?!<g-map)[\s\S])*? matches any char
    // as long as the next 6 chars aren't "<g-map". Combined with lazy *?, this
    // ensures we only match g-map blocks that don't contain another g-map inside.
    const innerRegex = /<g-map(\s+[^>]*)?>((?:(?!<g-map)[\s\S])*?)<\/g-map>/gi

    let result = template
    let _loopGuard = 0

    while (/<g-map\b/i.test(result)) {
      if (++_loopGuard > 50) break
      result = result.replace(innerRegex, (_fullMatch: string, attrsStr: string | undefined, content: string, offset: number) => {
        // Compute nesting depth: open g-map tags before this match + 1.
        // The current block adds another level, so its depth is one more
        // than the number of open outer tags.
        let openTags = 0
        const tagRegex = /<(\/?)g-map\b[^>]*>/gi
        let m: RegExpExecArray | null
        while ((m = tagRegex.exec(result)) !== null) {
          if (m.index >= offset) break
          if (m[1] === `/`) {
            if (openTags > 0) openTags--
          } else {
            openTags++
          }
        }
        const depth = openTags + 1
        const suffix = depth === 1 ? `` : String(depth)

        // Parse src attribute (double-quoted, single-quoted, or bare)
        const srcAttrMatch = attrsStr?.match(/src\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/)
        const src = srcAttrMatch?.[1] ?? srcAttrMatch?.[2] ?? srcAttrMatch?.[3]
        if (!src) return ``

        // Parse join attribute (default: newline)
        const joinAttrMatch = attrsStr?.match(/join\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/)
        const join =
          joinAttrMatch?.[1] ??
          joinAttrMatch?.[2] ??
          joinAttrMatch?.[3] ??
          `
`

        // Clean content: strip line-leading whitespace, trim surrounding newlines
        let processed = this._escapeStaticExceptInterpolation(
          content
            .replace(/^[\t ]+/gm, ``)
            .replace(/^\n+/, ``)
            .replace(/\n+$/, ``)
        )

        // Replace loop variable references with depth-indexed JS expressions.
        // {{e}} / {{e.prop}}  →  current depth's element (e, e2, e3...)
        // {{e2}} / {{e2.prop}} → explicit depth element
        // {{i}} / {{i2}}       → current/explicit depth index (0-based)
// {{ord}} / {{ord2}}   → current/explicit depth ordinal (1-based)
        // {{{e}}}/{{{e.prop}}} → raw (no escaping)
        // Everything else passes through for _processScopeVariables.
        const warnedFilters = new Set<string>()
        const loopRef = (inner: string): {accessor: string; isElement: boolean} | null => {
          const head = inner.split(`|`, 1)[0] ?? ``
          const eMatch = head.match(/^(e(\d*))(?:\.(.+))?$/)
          if (eMatch) {
            const requested = eMatch[2] === `` ? depth : Number(eMatch[2])
            const clamped = Number.isNaN(requested) ? depth : Math.min(requested, depth)
            const varSuffix = clamped === 1 ? `` : String(clamped)
            return {accessor: eMatch[3] === undefined ? `e${varSuffix}` : `e${varSuffix}.${eMatch[3]}`, isElement: true}
          }
          const iMatch = head.match(/^i(\d*)$/)
          if (iMatch) {
            const requestedI = iMatch[1] === `` ? depth : Number(iMatch[1])
            const clampedI = Number.isNaN(requestedI) ? depth : Math.min(requestedI, depth)
            const varSuffixI = clampedI === 1 ? `` : String(clampedI)
            return {accessor: `i${varSuffixI}`, isElement: false}
          }
          const ordMatch = head.match(/^ord(\d*)$/)
          if (ordMatch) {
            const requestedOrd = ordMatch[1] === `` ? depth : Number(ordMatch[1])
            const clampedOrd = Number.isNaN(requestedOrd) ? depth : Math.min(requestedOrd, depth)
            const varSuffixOrd = clampedOrd === 1 ? `` : String(clampedOrd)
            return {accessor: `ord${varSuffixOrd}`, isElement: false}
          }
          return null
        }
        const piped = /^(.*)\|([^{}]+)$/
        processed = processed.replace(/\{\{\{([\w.]+(?:\|[^{}]*?)?)\}\}\}/g, (_m: string, inner: string) => {
          const ref = loopRef(inner)
          if (ref === null) return _m
          if (!piped.test(inner)) return `\${${ref.accessor}}`
          return `\${${this._compileFilterChain(`(${ref.accessor})`, inner, warnedFilters)} ?? ""}`
        })
        processed = processed.replace(/\{\{([\w.]+(?:\|[^{}]*?)?)\}\}/g, (_m: string, inner: string) => {
          const ref = loopRef(inner)
          if (ref === null) return _m
          if (!piped.test(inner)) return ref.isElement ? `\${__esc(${ref.accessor})}` : `\${${ref.accessor}}`
          return `\${__esc(${this._compileFilterChain(`(${ref.accessor})`, inner, warnedFilters)} ?? "")}`
        })

        // Resolve src: "e.prop" or "e2.prop" → parent loop element property, else data key
        const srcRef = src.match(/^(e\d*)\.(.+)$/)
        const srcExpr = srcRef ? `(${srcRef[1]} && ${srcRef[1]}[${JSON.stringify(srcRef[2])}])` : `(data && data[${JSON.stringify(src)}])`

        const unescapedJoin = join.replace(/\\(\\|n|t|r|"|')/g, (_m, c) => {
          if (c === `\\`) return `\\`
          if (c === `n`) return `\n`
          if (c === `t`) return `\t`
          if (c === `r`) return `\r`
          return c
        })
        const safeJoin = JSON.stringify(unescapedJoin)
        return `\${(() => { const __arr${suffix} = ${srcExpr} || []; let __out${suffix} = ""; for (let i${suffix} = 0; i${suffix} < __arr${suffix}.length; i${suffix}++) { const e${suffix} = __arr${suffix}[i${suffix}]; const ord${suffix} = i${suffix} + 1; if (i${suffix} > 0) { __out${suffix} += ${safeJoin} } __out${suffix} += \`${processed}\`; } return __out${suffix}; })()}`
      })
    }

    return result
  }

  /**
   * Block: g-media
   * Extracts and parses `<g-media>` blocks from a template string.
   *
   * @remarks
   * This internal method identifies all `<g-media>` blocks and extracts their
   * attributes and content. It supports various media types including photo,
   * video, audio, document, animation, voice, video_note, sticker, location,
   * and contact. The inner content becomes the caption for supported types.
   *
   * **Attributes:**
   *   - `lang` (optional): Language key for the output map. Defaults to `"default"`.
   *   - `type` (required): Media type discriminator. Expected values:
   *     - `photo`, `video`, `audio`, `document`, `animation`, `voice`, `video_note`,
   *     - `sticker`, `location`, `contact`.
   *   - `src` (optional): File path / URL / file identifier for file-based media.
   *   - `latitude` (optional): Location latitude (used when `type="location"`).
   *   - `longitude` (optional): Location longitude (used when `type="location"`).
   *   - `phone` (optional): Contact phone number (used when `type="contact"`).
   *   - `first_name` (optional): Contact first name (used when `type="contact"`).
   *   - `last_name` (optional): Contact last name (used when `type="contact"`).
   *   - `vcard` (optional): Contact vCard payload (used when `type="contact"`).
   *
   * Media rules (based on `type`):
   * - If `src` exists, it is assigned as `mediaBlock.src` (for any type).
   * - If `src` contains pipe-delimited values, `mediaBlock.srcList` is populated
   *   with up to 10 trimmed entries for Telegram media groups.
   * - If caption exists and `type !== "video_note"` and `type !== "sticker"`,
   *   it is assigned as `mediaBlock.caption`.
   * - If `type === "location"`, `latitude` and `longitude` are copied if present,
   *   and caption (if present) is also allowed.
   * - If `type === "contact"`, `phone`, `first_name`, `last_name`, and `vcard`
   *   are copied if present, and caption (if present) is also allowed.
   *
   * Note:
   * - If multiple `<g-media>` blocks share the same `lang`, the last one wins
   *   (it overwrites the previous entry).
   *
   * @param template - The template string containing `<g-media>` blocks
   * @returns An object mapping language keys to their corresponding media block configurations
   *
   * @example
   * ```typescript
   * const template = '<g-media type="photo" src="image.jpg|image-2.jpg" lang="en">Hello</g-media>';
   * const media = TemplateEngine._processGMediaBlocks(template);
   * // Result: { en: { type: 'photo', src: 'image.jpg|image-2.jpg', srcList: ['image.jpg', 'image-2.jpg'], caption: 'Hello' } }
   * ```
   *
   * @public
   */
  static _processGMediaBlocks(template: string) {
    const mediaRegex = /<g-media(?:\s+([^>]*))?>([\s\S]*?)<\/g-media>/gi
    const result: {[lang: string]: IMediaBlock} = {}

    for (const match of template.matchAll(mediaRegex)) {
      const attributesStr = match[1]
      const rawContent = match[2]

      // Extract all attributes
      const attrs: {[key: string]: string} = {}
      const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g

      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ``
        }
      }

      // Make sure have lang attribute
      const lang = attrs.lang || `default`
      const type = attrs.type

      // Clean caption/content
      const caption = rawContent!
        .replace(/^[\t ]+/gm, ``)
        .replace(/^\n+/, ``)
        .replace(/\n+$/, ``)
        .trim()

      // Build media block based on type
      const mediaBlock: IMediaBlock = {type: type as IMediaBlock[`type`]}

      // Media with file src (photo, video, audio, document, animation, voice, video_note, sticker)
      if (attrs.src) {
        mediaBlock.src = attrs.src
        const srcList = this._splitMediaSrcList(attrs.src)
        if (srcList.length > 1) {
          mediaBlock.srcList = srcList
        }
      }

      // Caption (otherwise for video_note and sticker with not suppert caption)
      if (caption && type !== `video_note` && type !== `sticker`) {
        mediaBlock.caption = caption
      }

      if (attrs.filename) {
        mediaBlock.filename = attrs.filename
      }

      // Location attributes
      if (type === `location`) {
        if (attrs.latitude) mediaBlock.latitude = attrs.latitude
        if (attrs.longitude) mediaBlock.longitude = attrs.longitude
        if (attrs.live) mediaBlock.live = attrs.live
        if (caption) mediaBlock.caption = caption // Location can gave caption for additional text
      }

      // Contact attributes
      if (type === `contact`) {
        if (attrs.phone) mediaBlock.phone = attrs.phone
        if (attrs.first_name) mediaBlock.first_name = attrs.first_name
        if (attrs.last_name) mediaBlock.last_name = attrs.last_name
        if (attrs.vcard) mediaBlock.vcard = attrs.vcard
        if (caption) mediaBlock.caption = caption // Contact can gave caption for additional text
      }

      result[lang] = mediaBlock
    }

    return result
  }

  /**
   * Splits a pipe-delimited `src` attribute into media-group items.
   *
   * @remarks
   * A `src` without a pipe is NOT a group and yields an empty array, so the
   * caller can treat "no pipe" and "empty list" identically. Entries are
   * trimmed and blanks dropped, then the list is capped at
   * {@link TemplateEngine.MAX_MEDIA_GROUP_ITEMS} — Telegram rejects larger
   * albums, so the surplus is dropped rather than reported.
   *
   * @param src - Raw `src` attribute value from the parsed template.
   * @returns Trimmed, non-empty sources, truncated to the album limit.
   *
   * @public
   */
  static _splitMediaSrcList(src: string): string[] {
    if (!src.includes(`|`)) return []
    return src
      .split(`|`)
      .map((it) => it.trim())
      .filter((it) => it.length > 0)
      .slice(0, this.MAX_MEDIA_GROUP_ITEMS)
  }

  /**
   * Block: g-poll
   * Extracts and parses `<g-poll>` blocks from a template string.
   *
   * @remarks
   * Each block declares one poll per language (`lang` defaults to
   * `"default"`; last block wins per lang). The inner `<g-question>`
   * becomes `question`, each inner `<g-option>` becomes one entry of
   * `options`. `type` defaults to `"regular"`; `correct` is parsed to a
   * 0-based index when numeric; `anonymous` defaults to `true`.
   * Structural rules (exactly one question, 2–10 options, quiz/regular
   * coherence) are enforced by `validateBlockGPollAttributes`, not here.
   *
   * @param template - The template string containing `<g-poll>` blocks
   * @returns An object mapping language keys to their poll configurations
   *
   * @example
   * ```typescript
   * const polls = TemplateEngine._processGPollBlocks(`<g-poll type="quiz" correct="1"><g-question>Q?</g-question><g-option>A</g-option><g-option>B</g-option></g-poll>`);
   * // Result: { default: { type: 'quiz', question: 'Q?', options: ['A', 'B'], correct: 1, anonymous: true } }
   * ```
   *
   * @public
   */
  static _processGPollBlocks(template: string) {
    const pollRegex = /<g-poll(?:\s+([^>]*))?>([\s\S]*?)<\/g-poll>/gi
    const result: {[lang: string]: IPollBlock} = {}
    const clean = (raw: string): string =>
      raw
        .replace(/^[\t ]+/gm, ``)
        .replace(/^\n+/, ``)
        .replace(/\n+$/, ``)
        .trim()

    for (const match of template.matchAll(pollRegex)) {
      const attributesStr = match[1]
      const body = match[2] ?? ``
      const attrs: {[key: string]: string} = {}
      const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g

      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ``
        }
      }

      const lang = attrs.lang || `default`
      const type = attrs.type === `quiz` ? `quiz` : `regular`
      const question = clean(/<g-question(?:\s+[^>]*)?>([\s\S]*?)<\/g-question>/i.exec(body)?.[1] ?? ``)
      const options: string[] = []
      for (const optMatch of body.matchAll(/<g-option(?:\s+[^>]*)?>([\s\S]*?)<\/g-option>/gi)) {
        options.push(clean(optMatch[1] ?? ``))
      }

      const poll: IPollBlock = {type, question, options}
      if (attrs.correct !== undefined && attrs.correct !== ``) {
        const n = Number(attrs.correct)
        if (Number.isInteger(n)) poll.correct = n
      }
      if (attrs.explanation !== undefined && attrs.explanation !== ``) poll.explanation = attrs.explanation
      poll.anonymous = attrs.anonymous === undefined ? true : attrs.anonymous !== `false`
      if (attrs.multiple !== undefined && attrs.multiple !== ``) poll.multiple = attrs.multiple === `true`
      result[lang] = poll
    }

    return result
  }

  /**
   * Block: g-venue
   * Extracts and parses `<g-venue>` blocks from a template string.
   *
   * @remarks
   * Each block declares one venue per language (`lang` defaults to
   * `"default"`; last block wins per lang). All four venue fields
   * (`title`, `address`, `latitude`, `longitude`) are carried as raw
   * attribute strings verbatim (including `{{var|filter}}` spans) for
   * later compilation. Both `<g-venue ...></g-venue>` and self-closing
   * `<g-venue .../>` forms parse identically; the block carries no
   * children. Presence and static numeric rules are enforced by
   * `validateBlockGVenueAttributes`, not here.
   *
   * @param template - The template string containing `<g-venue>` blocks
   * @returns An object mapping language keys to their venue configurations
   *
   * @example
   * ```typescript
   * const venues = TemplateEngine._processGVenueBlocks(`<g-venue title="{{name}}" address="Jl. Merdeka 1" latitude="-6.2" longitude="106.8"/>`);
   * // Result: { default: { title: '{{name}}', address: 'Jl. Merdeka 1', latitude: '-6.2', longitude: '106.8' } }
   * ```
   *
   * @public
   */
  static _processGVenueBlocks(template: string) {
    const venueRegex = /<g-venue\b([^>]*?)\/?>/gi
    const result: {[lang: string]: IVenueBlock} = {}
    const parseAttrs = (attributesStr: string | undefined): {[key: string]: string} => {
      const attrs: {[key: string]: string} = {}
      const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ``
        }
      }
      return attrs
    }

    for (const match of template.matchAll(venueRegex)) {
      const attrs = parseAttrs(match[1])
      result[attrs.lang || `default`] = {
        title: attrs.title ?? ``,
        address: attrs.address ?? ``,
        latitude: attrs.latitude ?? ``,
        longitude: attrs.longitude ?? ``
      }
    }

    return result
  }

  /**
   * Block: g-dice
   * Extracts and parses `<g-dice>` blocks from a template string.
   *
   * @remarks
   * Each block declares one dice animation per language (`lang` defaults
   * to `"default"`; last block wins per lang). `emoji` is optional and
   * defaults to `🎲` when absent or empty; the raw attribute string is
   * preserved verbatim (including `{{var|filter}}` spans) for later
   * compilation. Both `<g-dice ...></g-dice>` and self-closing
   * `<g-dice .../>` forms parse identically; the block carries no
   * children. Static emoji membership is enforced by
   * `validateBlockGDiceAttributes`, not here.
   *
   * @param template - The template string containing `<g-dice>` blocks
   * @returns An object mapping language keys to their dice configurations
   *
   * @example
   * ```typescript
   * const dice = TemplateEngine._processGDiceBlocks(`<g-dice emoji="{{dice}}"/>`);
   * // Result: { default: { emoji: '{{dice}}' } }
   * ```
   *
   * @public
   */
  static _processGDiceBlocks(template: string) {
    const diceRegex = /<g-dice\b([^>]*?)\/?>/gi
    const result: {[lang: string]: IDiceBlock} = {}
    const parseAttrs = (attributesStr: string | undefined): {[key: string]: string} => {
      const attrs: {[key: string]: string} = {}
      const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ``
        }
      }
      return attrs
    }

    for (const match of template.matchAll(diceRegex)) {
      const attrs = parseAttrs(match[1])
      result[attrs.lang || `default`] = {emoji: attrs.emoji || `🎲`}
    }

    return result
  }

  /**
   * Parses `<g-invoice>` blocks into Telegram invoice definitions.
   *
   * @remarks
   * Each block carries its payment fields as attributes (`title`,
   * `description`, `payload`, `currency`, optional `lang`) with 1 or more
   * self-closing `<g-price label amount/>` line items as children. Raw
   * attribute strings are preserved verbatim (including `{{var|filter}}`
   * spans) for later compilation; `amount` is parsed to a number eagerly
   * (`NaN` when non-numeric — rejected by the validator and at runtime).
   * Structural rules (required attrs, `provider_token` rejection, price
   * count, limits) are enforced by `validateBlockGInvoiceAttributes`, not here.
   *
   * @param template - The template string containing `<g-invoice>` blocks
   * @returns An object mapping language keys to their invoice configurations
   *
   * @example
   * ```typescript
   * const invoices = TemplateEngine._processGInvoiceBlocks(`<g-invoice title="VIP {{days}} hari" description="Akses" payload="{{orderId}}" currency="XTR"><g-price label="VIP" amount="100"/></g-invoice>`);
   * // Result: { default: { title: 'VIP {{days}} hari', description: 'Akses', payload: '{{orderId}}', currency: 'XTR', prices: [{label: 'VIP', amount: 100}] } }
   * ```
   *
   * @public
   */
  static _processGInvoiceBlocks(template: string) {
    const invoiceRegex = /<g-invoice(?:\s+([^>]*))?>([\s\S]*?)<\/g-invoice>/gi
    const result: {[lang: string]: IInvoiceBlock} = {}
    const parseAttrs = (attributesStr: string | undefined): {[key: string]: string} => {
      const attrs: {[key: string]: string} = {}
      const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ``
        }
      }
      return attrs
    }

    for (const match of template.matchAll(invoiceRegex)) {
      const attrs = parseAttrs(match[1])
      const body = match[2] ?? ``
      const prices: Array<{label: string; amount: number}> = []
      for (const priceMatch of body.matchAll(/<g-price\b([^>]*?)\/?>/gi)) {
        const priceAttrs = parseAttrs(priceMatch[1])
        prices.push({label: priceAttrs.label ?? ``, amount: Number(priceAttrs.amount)})
      }

      result[attrs.lang || `default`] = {
        title: attrs.title ?? ``,
        description: attrs.description ?? ``,
        payload: attrs.payload ?? ``,
        currency: attrs.currency ?? ``,
        prices
      }
    }

    return result
  }

  /**
   * Parses `<g-paid-media>` blocks into Stars paywall definitions.
   *
   * @remarks
   * Each block carries its price as a `stars` attribute (optional `lang`)
   * with 1–10 inner `<g-media type="photo"|"video" src>` items as children.
   * Raw attribute strings are preserved verbatim (including
   * `{{var|filter}}` spans) for later compilation; `stars` is parsed to a
   * number eagerly (`NaN` when non-numeric — rejected by the validator and
   * at runtime). Child `type` values pass through as-is so the validator
   * can reject non-photo/video types with a clear message. Structural
   * rules (required `stars`, price range, item count/types) are enforced
   * by `validateBlockGPaidMediaAttributes`, not here.
   *
   * @param template - The template string containing `<g-paid-media>` blocks
   * @returns An object mapping language keys to their paid-media configurations
   *
   * @example
   * ```typescript
   * const walls = TemplateEngine._processGPaidMediaBlocks(`<g-paid-media stars="100"><g-media type="photo" src="{{teaser}}">Bayar untuk membuka</g-media></g-paid-media>`);
   * // Result: { default: { stars: 100, media: [{type: 'photo', src: '{{teaser}}', caption: 'Bayar untuk membuka'}] } }
   * ```
   *
   * @public
   */
  static _processGPaidMediaBlocks(template: string) {
    const paidMediaRegex = /<g-paid-media(?:\s+([^>]*))?>([\s\S]*?)<\/g-paid-media>/gi
    const result: {[lang: string]: IPaidMediaBlock} = {}
    const parseAttrs = (attributesStr: string | undefined): {[key: string]: string} => {
      const attrs: {[key: string]: string} = {}
      const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ``
        }
      }
      return attrs
    }

    for (const match of template.matchAll(paidMediaRegex)) {
      const attrs = parseAttrs(match[1])
      const body = match[2] ?? ``
      const media: Array<{type: `photo` | `video`; src: string; caption?: string}> = []
      for (const mediaMatch of body.matchAll(/<g-media(?:\s+([^>]*))?>([\s\S]*?)<\/g-media>/gi)) {
        const mediaAttrs = parseAttrs(mediaMatch[1])
        const caption = (mediaMatch[2] || ``)
          .replace(/^[\t ]+/gm, ``)
          .replace(/^\n+/, ``)
          .replace(/\n+$/, ``)
          .trim()
        media.push({
          type: (mediaAttrs.type ?? ``) as `photo` | `video`,
          src: mediaAttrs.src ?? ``,
          ...(caption ? {caption} : {})
        })
      }

      result[attrs.lang || `default`] = {
        stars: Number(attrs.stars),
        media
      }
    }

    return result
  }

  /**
   * Parses `<g-media-group>` blocks into Telegram media group item definitions.
   *
   * @remarks
   * Groups inner `<g-media>` items (via `_processMediaGroupItems`,
   * truncated to {@link TemplateEngine.MAX_MEDIA_GROUP_ITEMS}) into lang
   * variants preserving document order: the block-`lang` (default
   * `default`) variant holds un-languaged or `shared` items, plus one
   * variant per item `lang` holding matching or `shared` items. Each
   * variant takes its caption from the first captioned item; a block with
   * no items still yields an empty default variant unless lang items
   * exist. Attribute values accept double-quoted, single-quoted, or bare
   * syntax.
   *
   * @param template - The template source containing `<g-media-group>` blocks.
   * @returns Map of lang → `{type: "group", mediaGroup, caption?}` definitions.
   * @public
   */
  static _processGMediaGroupBlocks(template: string) {
    const mediaGroupRegex = /<g-media-group(?:\s+([^>]*))?>([\s\S]*?)<\/g-media-group>/gi
    const result: {[lang: string]: IMediaBlock} = {}

    for (const match of template.matchAll(mediaGroupRegex)) {
      const attributesStr = match[1]
      const groupContent = match[2] || ``
      const attrs: {[key: string]: string} = {}
      const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g

      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ``
        }
      }

      const blockLang = attrs.lang || `default`
      const rawItems = this._processMediaGroupItems(groupContent)

      // Preserve document order: each variant includes items matching its rules
      const langVariants = new Set(rawItems.filter((item) => item.lang && !item.shared).map((item) => item.lang!))
      const hasLangItems = langVariants.size > 0

      // Default variant: items with no lang OR shared — in template order
      const defaultItems = rawItems.filter((item) => !item.lang || item.shared)
      const defaultCaption = defaultItems.find((item) => item.caption)?.caption
      if (defaultItems.length > 0 || !hasLangItems) {
        result[blockLang] = {type: `group`, mediaGroup: defaultItems, ...(defaultCaption ? {caption: defaultCaption} : {})}
      }

      // Lang-specific variants: items matching that lang OR shared — in template order
      for (const variantLang of langVariants) {
        const variantItems = rawItems.filter((item) => item.lang === variantLang || item.shared)
        const caption = variantItems.find((item) => item.caption)?.caption
        result[variantLang] = {type: `group`, mediaGroup: variantItems, ...(caption ? {caption} : {})}
      }
    }

    return result
  }

  /**
   * Parses inner `<g-media>` items inside a `<g-media-group>` block body.
   *
   * Extracts `type`, `src`, `lang`, and `shared` attributes plus the caption
   * body for each inner `<g-media>` element. `shared` supports both standalone
   * boolean (`<g-media shared>`) and explicit (`<g-media shared="true">`) syntax.
   *
   * @param groupContent - The content between `<g-media-group>` and `</g-media-group>`
   * @returns An array of parsed media item descriptors, preserving document order
   */
  static _processMediaGroupItems(groupContent: string): Array<{type: `photo` | `video` | `audio` | `document`; src: string; caption?: string; lang?: string; shared?: boolean}> {
    const mediaRegex = /<g-media(?:\s+([^>]*))?>([\s\S]*?)<\/g-media>/gi
    const mediaGroup: Array<{type: `photo` | `video` | `audio` | `document`; src: string; caption?: string; lang?: string; shared?: boolean}> = []
    const supportedTypes = new Set([`photo`, `video`, `audio`, `document`])

    for (const match of groupContent.matchAll(mediaRegex)) {
      if (mediaGroup.length >= this.MAX_MEDIA_GROUP_ITEMS) break

      const attrs: {[key: string]: string} = {}
      const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
      const attributesStr = match[1]
      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ``
        }
        // Detect standalone boolean attributes (no ="value") — only match as a whole token, not inside src values
        if (/(?:^|\s)shared(?=\s|$)/i.test(attributesStr)) {
          if (!attrs.shared) attrs.shared = `true`
        }
      }

      if (!attrs.type || !supportedTypes.has(attrs.type) || !attrs.src) continue

      const caption = (match[2] || ``)
        .replace(/^[\t ]+/gm, ``)
        .replace(/^\n+/, ``)
        .replace(/\n+$/, ``)
        .trim()

      const shared = attrs.shared === `true`

      mediaGroup.push({
        type: attrs.type as `photo` | `video` | `audio` | `document`,
        src: attrs.src,
        ...(caption ? {caption} : {}),
        ...(attrs.lang ? {lang: attrs.lang} : {}),
        ...(shared ? {shared: true} : {})
      })
    }

    return mediaGroup
  }

  /**
   * Block: g-message
   * Extracts and parses `<g-message>` blocks from a template string.
   *
   * @remarks
   * This internal method identifies all `<g-message>` blocks and extracts their
   * content organized by language. Blocks without a `lang` attribute are stored
   * under `"default"`. Leading whitespace and surrounding newlines are trimmed.
   *
   * **Attributes:**
   *   - `lang` (optional): Language key for the output map. Defaults to `"default"`.
   *
   * @param template - The template string containing `<g-message>` blocks
   * @returns An object mapping language keys to their cleaned message content
   *
   * @example
   * ```typescript
   * const template = `
   *   <g-message>Hello World</g-message>
   *   <g-message lang="id">Halo Dunia</g-message>
   * `;
   * const messages = TemplateEngine._processGMessageBlocks(template);
   * // Result: { default: 'Hello World', id: 'Halo Dunia' }
   * ```
   *
   * @public
   */
  static _processGMessageBlocks(template: string) {
    const messageRegex = /<g-message(?:\s+([^>]*))?>([\s\S]*?)<\/g-message>/gi
    const result: {
      [lang: string]: string
    } = {}

    for (const [, attributesStr, rawContent] of template.matchAll(messageRegex)) {
      const attrs: {[key: string]: string} = {}
      const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g

      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ``
        }
      }

      const lang = attrs.lang || `default`
      const cleaned = rawContent!
        .replace(/^[\t ]+/gm, ``)
        .replace(/^\n+/, ``)
        .replace(/\n+$/, ``)
        .trim()

      result[lang] = cleaned
    }
    return result
  }

  /**
   * Block: g-callback-answer
   * Extracts `<g-callback-answer>` plain-text blocks from a template string.
   *
   * @remarks
   * Children form only (`<g-callback-answer>text</g-callback-answer>`);
   * content is cleaned exactly like `<g-message>` (leading indent stripped,
   * surrounding newlines trimmed) and keyed by `lang` (`"default"` when
   * absent; last block wins per lang). Raw content is preserved verbatim
   * (including `{{var|filter}}` spans) for later compilation. Plain-text
   * and length rules are enforced by
   * `validateBlockGCallbackAnswerAttributes`, not here.
   *
   * @param template - The template string containing `<g-callback-answer>` blocks
   * @returns An object mapping language keys to their raw text content
   *
   * @example
   * ```typescript
   * const blocks = TemplateEngine._processGCallbackAnswerBlocks(`<g-callback-answer>Pesanan {{orderId}} diproses</g-callback-answer>`);
   * // Result: { default: 'Pesanan {{orderId}} diproses' }
   * ```
   *
   * @public
   */
  static _processGCallbackAnswerBlocks(template: string) {
    const blockRegex = /<g-callback-answer(?:\s+([^>]*))?>([\s\S]*?)<\/g-callback-answer>/gi
    const result: {
      [lang: string]: string
    } = {}

    for (const [, attributesStr, rawContent] of template.matchAll(blockRegex)) {
      const attrs: {[key: string]: string} = {}
      const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g

      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ``
        }
      }

      const lang = attrs.lang || `default`
      const cleaned = rawContent!
        .replace(/^[\t ]+/gm, ``)
        .replace(/^\n+/, ``)
        .replace(/\n+$/, ``)
        .trim()

      result[lang] = cleaned
    }
    return result
  }

  /**
   * Block: g-precheckout-error
   * Extracts `<g-precheckout-error>` plain-text blocks from a template string.
   *
   * @remarks
   * Children form only; content is cleaned exactly like `<g-message>` and
   * keyed by `lang` (`"default"` when absent; last block wins per lang).
   * Raw content is preserved verbatim (including `{{var|filter}}` spans)
   * for later compilation. Plain-text rules are enforced by
   * `validateBlockGPrecheckoutErrorAttributes`, not here.
   *
   * @param template - The template string containing `<g-precheckout-error>` blocks
   * @returns An object mapping language keys to their raw text content
   *
   * @example
   * ```typescript
   * const blocks = TemplateEngine._processGPrecheckoutErrorBlocks(`<g-precheckout-error>Stok {{item}} habis</g-precheckout-error>`);
   * // Result: { default: 'Stok {{item}} habis' }
   * ```
   *
   * @public
   */
  static _processGPrecheckoutErrorBlocks(template: string) {
    const blockRegex = /<g-precheckout-error(?:\s+([^>]*))?>([\s\S]*?)<\/g-precheckout-error>/gi
    const result: {
      [lang: string]: string
    } = {}

    for (const [, attributesStr, rawContent] of template.matchAll(blockRegex)) {
      const attrs: {[key: string]: string} = {}
      const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g

      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ``
        }
      }

      const lang = attrs.lang || `default`
      const cleaned = rawContent!
        .replace(/^[\t ]+/gm, ``)
        .replace(/^\n+/, ``)
        .replace(/\n+$/, ``)
        .trim()

      result[lang] = cleaned
    }
    return result
  }

  /**
   * Block: g-shipping-error
   * Extracts `<g-shipping-error>` plain-text blocks from a template string.
   *
   * @remarks
   * Children form only; content is cleaned exactly like `<g-message>` and
   * keyed by `lang` (`"default"` when absent; last block wins per lang).
   * Raw content is preserved verbatim (including `{{var|filter}}` spans)
   * for later compilation. Plain-text rules are enforced by
   * `validateBlockGShippingErrorAttributes`, not here.
   *
   * @param template - The template string containing `<g-shipping-error>` blocks
   * @returns An object mapping language keys to their raw text content
   *
   * @example
   * ```typescript
   * const blocks = TemplateEngine._processGShippingErrorBlocks(`<g-shipping-error>Di luar zona {{city}}</g-shipping-error>`);
   * // Result: { default: 'Di luar zona {{city}}' }
   * ```
   *
   * @public
   */
  static _processGShippingErrorBlocks(template: string) {
    const blockRegex = /<g-shipping-error(?:\s+([^>]*))?>([\s\S]*?)<\/g-shipping-error>/gi
    const result: {
      [lang: string]: string
    } = {}

    for (const [, attributesStr, rawContent] of template.matchAll(blockRegex)) {
      const attrs: {[key: string]: string} = {}
      const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g

      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ``
        }
      }

      const lang = attrs.lang || `default`
      const cleaned = rawContent!
        .replace(/^[\t ]+/gm, ``)
        .replace(/^\n+/, ``)
        .replace(/\n+$/, ``)
        .trim()

      result[lang] = cleaned
    }
    return result
  }

  /**
   * Block: g-inline-button
   * Extracts `<g-inline-button>` definitions from a template string.
   *
   * @remarks
   * Attribute form only (`<g-inline-button text="..." start-parameter="..."/>`,
   * both pair and self-closing spellings parse identically); the block
   * carries no children. `text` becomes the inline `button.text` label and
   * `start-parameter` (optional) the deep-link `start_parameter`. Raw
   * attribute strings are preserved verbatim (including `{{var|filter}}`
   * spans) for later compilation. Blocks are keyed by `lang` (`"default"`
   * when absent; last block wins per lang). Structural rules (required
   * `text`, `start_parameter` format) are enforced by
   * `validateBlockGInlineButtonAttributes`, not here.
   *
   * @param template - The template string containing `<g-inline-button>` blocks
   * @returns An object mapping language keys to their button definitions
   *
   * @example
   * ```typescript
   * const blocks = TemplateEngine._processGInlineButtonBlocks(`<g-inline-button text="Lihat {{item}}" start-parameter="detail-1"/>`);
   * // Result: { default: { text: 'Lihat {{item}}', startParameter: 'detail-1' } }
   * ```
   *
   * @public
   */
  static _processGInlineButtonBlocks(template: string) {
    const buttonRegex = /<g-inline-button\b([^>]*?)\/?>/gi
    const result: {[lang: string]: IInlineButtonBlock} = {}
    const parseAttrs = (attributesStr: string | undefined): {[key: string]: string} => {
      const attrs: {[key: string]: string} = {}
      const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ``
        }
      }
      return attrs
    }

    for (const match of template.matchAll(buttonRegex)) {
      const attrs = parseAttrs(match[1])
      const block: IInlineButtonBlock = {text: attrs.text ?? ``}
      if (attrs[`start-parameter`] !== undefined && attrs[`start-parameter`] !== ``) {
        block.startParameter = attrs[`start-parameter`]
      }
      result[attrs.lang || `default`] = block
    }

    return result
  }

  /**
   * Block: g-answer-note
   * Extracts `<g-answer-note>` plain-text blocks from a template string.
   *
   * @remarks
   * Children form only; content is cleaned exactly like `<g-message>` and
   * keyed by `lang` (`"default"` when absent; last block wins per lang).
   * Raw content is preserved verbatim (including `{{var|filter}}` spans)
   * for later compilation. The block is a validation marker for answers
   * whose content comes from the caller (guest, web app), not the template.
   * Plain-text rules are enforced by
   * `validateBlockGAnswerNoteAttributes`, not here.
   *
   * @param template - The template string containing `<g-answer-note>` blocks
   * @returns An object mapping language keys to their raw text content
   *
   * @example
   * ```typescript
   * const blocks = TemplateEngine._processGAnswerNoteBlocks(`<g-answer-note>Guest fallback {{kind}}</g-answer-note>`);
   * // Result: { default: 'Guest fallback {{kind}}' }
   * ```
   *
   * @public
   */
  static _processGAnswerNoteBlocks(template: string) {
    const blockRegex = /<g-answer-note(?:\s+([^>]*))?>([\s\S]*?)<\/g-answer-note>/gi
    const result: {
      [lang: string]: string
    } = {}

    for (const [, attributesStr, rawContent] of template.matchAll(blockRegex)) {
      const attrs: {[key: string]: string} = {}
      const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g

      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ``
        }
      }

      const lang = attrs.lang || `default`
      const cleaned = rawContent!
        .replace(/^[\t ]+/gm, ``)
        .replace(/^\n+/, ``)
        .replace(/\n+$/, ``)
        .trim()

      result[lang] = cleaned
    }
    return result
  }

  /**
   * Block: g-gift
   * Extracts `<g-gift>` card-text blocks from a template string.
   *
   * @remarks
   * Children form only; content is cleaned exactly like `<g-message>` and
   * keyed by `lang` (`"default"` when absent; last block wins per lang).
   * Raw content is preserved verbatim (including `{{var|filter}}` spans
   * and HTML markup — gifts render with `text_parse_mode: HTML`) for
   * later compilation. Only attribute rules are enforced by
   * `validateBlockGGiftAttributes`, not here.
   *
   * @param template - The template string containing `<g-gift>` blocks
   * @returns An object mapping language keys to their raw text content
   *
   * @example
   * ```typescript
   * const blocks = TemplateEngine._processGGiftBlocks(`<g-gift>Hadiah <b>{{item}}</b>!</g-gift>`);
   * // Result: { default: 'Hadiah <b>{{item}}</b>!' }
   * ```
   *
   * @public
   */
  static _processGGiftBlocks(template: string) {
    const blockRegex = /<g-gift(?:\s+([^>]*))?>([\s\S]*?)<\/g-gift>/gi
    const result: {
      [lang: string]: string
    } = {}

    for (const [, attributesStr, rawContent] of template.matchAll(blockRegex)) {
      const attrs: {[key: string]: string} = {}
      const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g

      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ``
        }
      }

      const lang = attrs.lang || `default`
      const cleaned = rawContent!
        .replace(/^[\t ]+/gm, ``)
        .replace(/^\n+/, ``)
        .replace(/\n+$/, ``)
        .trim()

      result[lang] = cleaned
    }
    return result
  }

  /**
   * Block: g-description
   * Extracts and parses `<g-description>` blocks from a template string.
   *
   * This internal method identifies all `<g-description>` blocks and extracts their
   * content organized by language and scope. Blocks without a `lang` attribute
   * are stored under `"default"` language, and blocks without a `scope` attribute
   * are stored under `"default"` scope.
   *
   * **Attributes:**
   *   - `lang` (optional): Language key for the output map. Defaults to `"default"`.
   *   - `scope` (optional): Scope key for the nested output map. Defaults to `"default"`.
   *
   * @param template - The template string containing `<g-description>` blocks
   * @returns A nested object mapping language keys to scopes to their cleaned content
   *
   * @example
   * ```typescript
   * const template = `
   *   <g-description>Start the bot</g-description>
   *   <g-description lang="id">Mulai bot</g-description>
   *   <g-description scope="chat_administrators">Admin command</g-description>
   * `;
   * const descriptions = TemplateEngine._processGDescriptionBlocks(template);
   * // Result: {
   * //   default: { default: 'Start the bot', chat_administrators: 'Admin command' },
   * //   id: { default: 'Mulai bot' }
   * // }
   * ```
   *
   * @public
   */
  static _processGDescriptionBlocks(template: string) {
    const descriptionRegex = /<g-description(?:\s+([^>]*))?>([\s\S]*?)<\/g-description>/gi
    const result: {
      [lang: string]: {
        [scope: string]: string
      }
    } = {}

    for (const [, attributesStr, rawContent] of template.matchAll(descriptionRegex)) {
      const attrs: {[key: string]: string} = {}
      const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g

      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ``
        }
      }

      const lang = attrs.lang || `default`
      const scope = attrs.scope || `default`
      const cleaned = rawContent!
        .replace(/^[\t ]+/gm, ``)
        .replace(/^\n+/, ``)
        .replace(/\n+$/, ``)
        .trim()

      if (!result[lang]) {
        result[lang] = {}
      }
      result[lang][scope] = cleaned
    }
    return result
  }

  /**
   * Block: g-keyboard
   * Extracts and parses `<g-keyboard>` blocks from a template string.
   *
   * @remarks
   * This internal method identifies all `<g-keyboard>` blocks and extracts their
   * content organized by language and type (inline or bottom). Blocks without
   * a `lang` attribute are stored under `"default"`. The `type` attribute
   * defaults to `"inline"` unless explicitly set to `"bottom"`.
   *
   * **Attributes:**
   *   - `lang` (optional): Language key for the output map. Defaults to `"default"`.
   *   - `type` (optional): Keyboard type. Supported values:
   *     - `"inline"` (default)
   *     - `"bottom"`
   *
   * @param template - The template string containing `<g-keyboard>` blocks
   * @returns A nested object mapping language keys to keyboard mode configurations
   *
   * @example
   * ```typescript
   * const template = `
   *   <g-keyboard type="inline">Yes, No</g-keyboard>
   *   <g-keyboard type="bottom">Button 1, Button 2</g-keyboard>
   *   <g-keyboard type="inline" lang="id">Ya, Tidak</g-keyboard>
   * `;
   * const keyboards = TemplateEngine._processGKeyboardBlocks(template);
   * // Result: {
   * //   default: { inline: 'Yes, No', bottom: 'Button 1, Button 2' },
   * //   id: { inline: 'Ya, Tidak' }
   * // }
   * ```
   *
   * @public
   */
  static _processGKeyboardBlocks(template: string) {
    const keyboardRegex = /<g-keyboard(?:\s+([^>]*))?>([\s\S]*?)<\/g-keyboard>/gi
    const result: {
      [lang: string]: {
        inline?: string
        bottom?: string
      }
    } = {}

    for (const [, attributesStr, rawContent] of template.matchAll(keyboardRegex)) {
      const attrs: {[key: string]: string} = {}
      const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g

      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ``
        }
      }

      const lang = attrs.lang || `default`
      const mode = attrs.type === `bottom` ? `bottom` : `inline`
      const cleaned = rawContent!.trim()

      if (!result[lang]) {
        result[lang] = {}
      }
      result[lang][mode] = cleaned
    }
    return result
  }

  /**
   * Compiles a processed template string into an executable function.
   *
   * @remarks
   * This internal method takes a pre-processed template (or array of templates)
   * and compiles it into a JavaScript function that accepts a `data` object and
   * returns the rendered result. The function is created using `new Function()`.
   * Static segments are emitted via string concatenation (`JSON.stringify`
   * literals joined with `+`), never wrapped in a raw backtick literal, so
   * static backticks, backslashes, and `${` sequences cannot break out into
   * code. Only `${...}` spans produced by the block/scope processors are
   * evaluated.
   *
   * @typeParam T - Boolean type indicating whether the input is an array
   * @param template - The processed template string or array of strings
   * @param isArray - Whether the template parameter is an array
   * @returns A function that accepts optional data and returns the rendered string or string array
   *
   * @example
   * ```typescript
   * const processed = '${(data && data["name"]) ?? ""}';
   * const fn = TemplateEngine._compileToFunction(processed, false);
   * const result = fn({ name: 'John' });
   * // Result: 'John'
   * ```
   *
   * @public
   */
  static _isGeneratedCode(code: string): boolean {
    return code.startsWith(`__esc(`) || code.startsWith(`FILTERS.`) || code.startsWith(`(data`) || code.startsWith(`(() =>`) || code.startsWith(`"`) || /^e\d*(\.|$)/.test(code) || /^i\d*$/.test(code)
  }

  /**
   * Converts processed template output into a concatenation expression.
   *
   * @remarks
   * Splits `processed` on balanced `${...}` spans (quote-aware,
   * brace-nesting-aware): spans passing {@link TemplateEngine._isGeneratedCode}
   * are emitted as parenthesized code, everything else — including
   * attacker-controlled `${...}`-lookalikes — is emitted as
   * `JSON.stringify` string literals joined with `+`. Static segments can
   * therefore never break out into code; this is the core guarantee behind
   * `_compileToFunction`. An unterminated `${` is treated as literal text.
   *
   * @param processed - Template output after block/scope processing.
   * @returns A JS expression evaluating to the rendered string.
   * @public
   */
  static _toConcatExpr(processed: string): string {
    const parts: string[] = []
    let lit = ``
    let i = 0
    const tick = String.fromCharCode(96)
    const flush = (): void => {
      if (lit !== ``) {
        parts.push(JSON.stringify(lit))
        lit = ``
      }
    }
    while (i < processed.length) {
      if (processed[i] === `$` && processed[i + 1] === `{`) {
        let j = i + 2
        let depth = 1
        let quote: string | null = null
        let escaped = false
        while (j < processed.length && depth > 0) {
          const ch = processed[j]!
          if (quote !== null) {
            if (escaped) escaped = false
            else if (ch === `\\`) escaped = true
            else if (ch === quote) quote = null
          } else if (ch === `'` || ch === `"` || ch === tick) {
            quote = ch
          } else if (ch === `{`) {
            depth++
          } else if (ch === `}`) {
            depth--
          }
          j++
        }
        if (depth === 0) {
          flush()
          const code = processed.slice(i + 2, j - 1)
          if (this._isGeneratedCode(code)) {
            parts.push(`(${code})`)
          } else {
            parts.push(JSON.stringify(processed.slice(i, j)))
          }
          i = j
          continue
        }
        lit += processed[i]!
        i++
        continue
      }
      lit += processed[i]!
      i++
    }
    flush()
    return parts.length === 0 ? `""` : parts.join(`+`)
  }

  /**
   * Builds the JavaScript function body for a processed template.
   *
   * @remarks
   * Runs the three structural pre-processors in a fixed order — script blocks,
   * then `<g-div>`, then `<g-space>` — before converting the result to a
   * concatenation expression. The body is returned as source text, never
   * evaluated here: `_compileToFunction` is what turns it into a callable.
   *
   * @param template - Processed template source, or one source per language
   * when `isArray` is `true`.
   * @param isArray - When `true`, emit a body returning `string[]`.
   * @returns The `return` statement source for the compiled function.
   *
   * @public
   */
  static _buildFunctionBody<T extends boolean>(template: T extends true ? string[] : string, isArray: T): string {
    const inputs = isArray ? (template as string[]) : [template as string]
    const bodies = inputs.map((t) => {
      const post = this._processGIfElseBlocks(this._processGScriptBlocks(this._processGDivBlocks(this._processGSpaceBlocks(t))))
      return `""+(${this._toConcatExpr(post)})`
    })
    return isArray ? `return [${bodies.join(`,`)}]` : `return ${bodies[0]}`
  }

  /**
   * AOT collect hook: when set, `_compileToFunction` records the body and
   * returns a tagged stub instead of calling `new Function`.
   *
   * @remarks
   * Build tooling only (`AotEmitter` installs it around compilation and
   * always uninstalls in `finally`). `undefined` (default) runs the exact
   * JIT path — no behavior change.
   *
   * @public
   */
  static __emitHook?: (body: string, meta: {isArray: boolean}) => (...args: unknown[]) => unknown

  /**
   * AOT link hook: when set, `_compileToFunction` returns the pre-registered
   * inline function matching the body instead of calling `new Function`.
   *
   * @remarks
   * Edge-runtime path (`AotEmitter` output): emitted modules pre-register
   * every collected body, then rebuild wrapper blocks through the normal
   * compilers with this hook resolving hits. A miss throws (template drift —
   * regenerate). Never set together with `__emitHook`.
   *
   * @public
   */
  static __linkHook?: (body: string, isArray: boolean) => (...args: unknown[]) => unknown

  /**
   * Compiles a processed template body into a callable renderer.
   *
   * @remarks
   * Three mutually exclusive paths, in priority order: `__linkHook` resolves
   * a pre-registered body (the AOT link phase, used by edge output with no
   * `Function` constructor), `__emitHook` records the body and returns a
   * stub (the AOT collect phase), otherwise the body is compiled through
   * `new Function` — the exact JIT path taken when neither hook is set.
   *
   * The compiled renderer closes over `_escapeData` and `DEFAULT_FILTERS`, so
   * callers pass only `data`. `isArray` selects the return shape: `string[]`
   * for media-group style templates, `string` otherwise.
   *
   * @param template - Processed template source, or one source per language
   * when `isArray` is `true`.
   * @param isArray - When `true`, compile to a renderer returning `string[]`.
   * @returns A renderer taking `data` and returning the compiled output.
   * @throws Error when `__linkHook` and `__emitHook` are both set, which would
   * confuse the AOT collect and link phases.
   *
   * @public
   */
  static _compileToFunction<T extends boolean>(template: T extends true ? string[] : string, isArray: T): ITemplateRenderer<T> {
    const functionBody = this._buildFunctionBody(template, isArray)
    if (this.__linkHook !== undefined && this.__emitHook !== undefined) {
      throw new Error(`TemplateEngine __linkHook and __emitHook must never be set simultaneously (AOT collect vs link phase confusion)`)
    }
    if (this.__linkHook !== undefined) {
      return this.__linkHook(functionBody, isArray) as unknown as ITemplateRenderer<T>
    }
    if (this.__emitHook !== undefined) {
      return this.__emitHook(functionBody, {isArray}) as unknown as ITemplateRenderer<T>
    }

    if (isArray) {
      const fn = new Function(`data`, `__esc`, `FILTERS`, functionBody) as unknown as (data: Record<string, unknown> | undefined, esc: (value: unknown) => string, filters: Record<string, ITemplateFilter>) => string[]
      return ((data: Record<string, unknown> | undefined) => fn(data, this._escapeData, DEFAULT_FILTERS)) as unknown as ITemplateRenderer<T>
    } else {
      const fn = new Function(`data`, `__esc`, `FILTERS`, functionBody) as unknown as (data: Record<string, unknown> | undefined, esc: (value: unknown) => string, filters: Record<string, ITemplateFilter>) => string
      return ((data: Record<string, unknown> | undefined) => fn(data, this._escapeData, DEFAULT_FILTERS)) as unknown as ITemplateRenderer<T>
    }
  }

  /**
   * Matches a bare `src` placeholder with no pipes or surrounding text.
   *
   * @remarks
   * Only `{{dotted.path}}` (optional surrounding whitespace) qualifies —
   * filtered (`{{x|upper}}`) or embedded (`pre-{{x}}`) values keep the
   * existing string pipeline untouched.
   *
   * @param rawSrc - Raw `src` attribute value from the parsed template.
   * @returns Dotted path when bare, otherwise `null`.
   *
   * @public
   */
  static _matchBareMediaPlaceholder(rawSrc: string): string | null {
    const match = /^\s*\{\{\s*([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*\}\}\s*$/.exec(rawSrc)
    return match?.[1] ?? null
  }

  /**
   * Null-safe dotted-path lookup against template data.
   *
   * @param data - Template data passed to the compiled block.
   * @param path - Dotted path such as `a.b.c`.
   * @returns Resolved value, or `undefined` when any segment is missing.
   *
   * @public
   */
  static _resolveMediaDataPath(data: ITemplateData | undefined, path: string): unknown {
    let current: unknown = data
    for (const part of path.split(`.`)) {
      if (current === null || current === undefined) return undefined
      current = (current as Record<string, unknown>)[part]
    }
    return current
  }

  /**
   * Wraps a compiled string `src` fn so bare placeholders pass objects by reference.
   *
   * @remarks
   * Strings, `null`, and `undefined` fall through to the existing compiled fn
   * (byte-identical output, same escaping and `''` fallback). Non-string
   * values (pre-built `InputFile`, `Buffer`, `Uint8Array`) bypass stringify
   * and reach grammY intact.
   *
   * @param rawSrc - Raw `src` attribute value from the parsed template.
   * @param stringFn - Existing compiled string renderer for this `src`.
   * @returns Renderer yielding either the string output or the raw object.
   *
   * @public
   */
  static _compileMediaSrc(rawSrc: string, stringFn: (data?: ITemplateData) => string): (data?: ITemplateData) => string | InputFile | Buffer | Uint8Array {
    const path = this._matchBareMediaPlaceholder(rawSrc)
    if (path === null) return stringFn
    return (data?: ITemplateData) => {
      const value = this._resolveMediaDataPath(data, path)
      if (typeof value === `string` || value === null || value === undefined) return stringFn(data)
      return value as InputFile | Buffer | Uint8Array
    }
  }

  /**
   * Compiles media blocks from a template into executable functions.
   *
   * @remarks
   * This method parses `<g-media>` blocks from the template and compiles them into
   * functions that generate `ITMediaBlock` objects. The result is organized by
   * base ID and language. Pre-parsed base blocks can be provided for efficiency.
   *
   * @param template - Raw template string containing `<g-base>` and `<g-media>` blocks
   * @param baseBlocks - Optional pre-parsed base blocks for reuse
   * @returns Compiled media functions organized by base ID and language
   *
   * @example
   * ```typescript
   * const template = `
   *   <g-base>
   *     <g-media type="photo" src="{{image}}">{{caption}}</g-media>
   *   </g-base>
   * `;
   * const media = TemplateEngine.compileBlockGMedia(template);
   * const result = media.default?.default?.({ image: 'photo.jpg', caption: 'Hello' });
   * // Result: { type: 'photo', src: 'photo.jpg', caption: 'Hello' }
   * ```
   *
   * @public
   */
  static compileBlockGMedia(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>) {
    const bases = baseBlocks || this._processGBaseBlocks(template)
    const result: {
      [AGBaseId: string]: {
        [ALang: string]: (data?: ITemplateData) => IMediaBlock
      }
    } = {}

    for (const [AGBaseId, baseContent] of Object.entries(bases)) {
      const mediaBlocks = {...this._processGMediaBlocks(baseContent), ...this._processGMediaGroupBlocks(baseContent)}
      result[AGBaseId] = {}

      for (const [ALang, mediaBlock] of Object.entries(mediaBlocks)) {
        const compiledProps: Record<string, (data?: ITemplateData) => string | InputFile | Buffer | Uint8Array> = {}
        const compiledMediaGroup = mediaBlock.mediaGroup?.map((item) => {
          const rawSrc = item.src as string
          const stringSrc = this._compileToFunction(this._processScopeVariables(this._processScopeExec(this._processGSwitchBlocks(this._processGMapBlocks(this._processGIfElseBlocks(this._processGScriptBlocks(rawSrc)))))), false)
          return {
            type: item.type,
            src: this._compileMediaSrc(rawSrc, stringSrc),
            caption: item.caption ? this._compileToFunction(this._processScopeVariables(this._processScopeExec(this._processGSwitchBlocks(this._processGMapBlocks(this._processGIfElseBlocks(this._processGScriptBlocks(item.caption)))))), false) : undefined
          }
        })

        for (const [key, value] of Object.entries(mediaBlock)) {
          if (key === `type` || typeof value !== `string`) continue

          const processed = this._processScopeVariables(this._processScopeExec(this._processGSwitchBlocks(this._processGMapBlocks(this._processGIfElseBlocks(this._processGScriptBlocks(value))))))
          const stringFn = this._compileToFunction(processed, false)
          compiledProps[key] = key === `src` ? this._compileMediaSrc(value, stringFn) : stringFn
        }

        result[AGBaseId][ALang] = (data?: ITemplateData) => {
          const resolvedBlock = {...mediaBlock} as IMediaBlock & Record<string, unknown>
          for (const [key, fn] of Object.entries(compiledProps)) {
            resolvedBlock[key] = fn(data)
          }
          if (compiledMediaGroup) {
            resolvedBlock.mediaGroup = compiledMediaGroup.map((item) => ({type: item.type, src: item.src(data), ...(item.caption ? {caption: item.caption(data)} : {})}))
            // Only fallback to first mediaGroup caption if no explicit caption was set via compiledProps
            const caption = resolvedBlock.mediaGroup.find((item: {caption?: string}) => item.caption)?.caption
            if (caption && !resolvedBlock.caption) resolvedBlock.caption = caption
          }
          if (typeof resolvedBlock.src === `string`) {
            const srcList = this._splitMediaSrcList(resolvedBlock.src)
            if (srcList.length > 1) {
              resolvedBlock.srcList = srcList
            } else {
              delete resolvedBlock.srcList
            }
          }
          return resolvedBlock
        }
      }
    }
    return result
  }

  /**
   * Compiles poll blocks from a template into executable functions.
   *
   * @remarks
   * Parses `<g-poll>` blocks per base and compiles `question`, each
   * `option`, and `explanation` through the same pipeline as media
   * captions (script → map → switch → exec → variables), so
   * `{{var|filter}}` works in all three. Static fields (`type`,
   * `correct`, `anonymous`, `multiple`) pass through untouched.
   *
   * @param template - Raw template string containing `<g-base>` and `<g-poll>` blocks
   * @param baseBlocks - Optional pre-parsed base blocks for reuse
   * @returns Compiled poll functions organized by base ID and language
   *
   * @example
   * ```typescript
   * const polls = TemplateEngine.compileBlockGPoll(`<g-base><g-poll><g-question>Hi {{name}}?</g-question><g-option>Yes</g-option><g-option>No</g-option></g-poll></g-base>`);
   * const result = polls.default?.default?.({ name: 'Jo' });
   * // Result: { type: 'regular', question: 'Hi Jo?', options: ['Yes', 'No'], anonymous: true }
   * ```
   *
   * @public
   */
  static compileBlockGPoll(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>) {
    const bases = baseBlocks || this._processGBaseBlocks(template)
    const result: {
      [AGBaseId: string]: {
        [ALang: string]: (data?: ITemplateData) => IPollBlock
      }
    } = {}
    const compileString = (raw: string): ((data?: ITemplateData) => string) => this._compileToFunction(this._processScopeVariables(this._processScopeExec(this._processGSwitchBlocks(this._processGMapBlocks(this._processGIfElseBlocks(this._processGScriptBlocks(raw)))))), false)

    for (const [AGBaseId, baseContent] of Object.entries(bases)) {
      const polls = this._processGPollBlocks(baseContent)
      result[AGBaseId] = {}

      for (const [ALang, poll] of Object.entries(polls)) {
        const questionFn = compileString(poll.question)
        const optionFns = poll.options.map((opt) => compileString(opt))
        const explanationFn = poll.explanation !== undefined ? compileString(poll.explanation) : undefined
        result[AGBaseId][ALang] = (data?: ITemplateData) => ({
          ...poll,
          question: questionFn(data),
          options: optionFns.map((fn) => fn(data)),
          ...(explanationFn ? {explanation: explanationFn(data)} : {})
        })
      }
    }
    return result
  }

  /**
   * Compiles venue blocks from a template into executable functions.
   *
   * @remarks
   * Parses `<g-venue>` blocks per base and compiles all four fields
   * (`title`, `address`, `latitude`, `longitude`) through the same
   * pipeline as media captions (script → map → switch → exec →
   * variables), so `{{var|filter}}` works in every field.
   *
   * @param template - Raw template string containing `<g-base>` and `<g-venue>` blocks
   * @param baseBlocks - Optional pre-parsed base blocks for reuse
   * @returns Compiled venue functions organized by base ID and language
   *
   * @example
   * ```typescript
   * const venues = TemplateEngine.compileBlockGVenue(`<g-base><g-venue title="{{name}}" address="Jl. Merdeka 1" latitude="-6.2" longitude="106.8"/></g-base>`);
   * const result = venues.default?.default?.({ name: 'Cafe' });
   * // Result: { title: 'Cafe', address: 'Jl. Merdeka 1', latitude: '-6.2', longitude: '106.8' }
   * ```
   *
   * @public
   */
  static compileBlockGVenue(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>) {
    const bases = baseBlocks || this._processGBaseBlocks(template)
    const result: {
      [AGBaseId: string]: {
        [ALang: string]: (data?: ITemplateData) => IVenueBlock
      }
    } = {}
    const compileString = (raw: string): ((data?: ITemplateData) => string) => this._compileToFunction(this._processScopeVariables(this._processScopeExec(this._processGSwitchBlocks(this._processGMapBlocks(this._processGIfElseBlocks(this._processGScriptBlocks(raw)))))), false)

    for (const [AGBaseId, baseContent] of Object.entries(bases)) {
      const venues = this._processGVenueBlocks(baseContent)
      result[AGBaseId] = {}

      for (const [ALang, venue] of Object.entries(venues)) {
        const titleFn = compileString(venue.title)
        const addressFn = compileString(venue.address)
        const latitudeFn = compileString(venue.latitude)
        const longitudeFn = compileString(venue.longitude)
        result[AGBaseId][ALang] = (data?: ITemplateData) => ({
          title: titleFn(data),
          address: addressFn(data),
          latitude: latitudeFn(data),
          longitude: longitudeFn(data)
        })
      }
    }
    return result
  }

  /**
   * Compiles dice blocks from a template into executable functions.
   *
   * @remarks
   * Parses `<g-dice>` blocks per base and compiles `emoji` through the
   * same pipeline as media captions (script → map → switch → exec →
   * variables), so `{{var|filter}}` works in the emoji field.
   *
   * @param template - Raw template string containing `<g-base>` and `<g-dice>` blocks
   * @param baseBlocks - Optional pre-parsed base blocks for reuse
   * @returns Compiled dice functions organized by base ID and language
   *
   * @example
   * ```typescript
   * const dice = TemplateEngine.compileBlockGDice(`<g-base><g-dice emoji="{{dice}}"/></g-base>`);
   * const result = dice.default?.default?.({ dice: '🎯' });
   * // Result: { emoji: '🎯' }
   * ```
   *
   * @public
   */
  static compileBlockGDice(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>) {
    const bases = baseBlocks || this._processGBaseBlocks(template)
    const result: {
      [AGBaseId: string]: {
        [ALang: string]: (data?: ITemplateData) => IDiceBlock
      }
    } = {}
    const compileString = (raw: string): ((data?: ITemplateData) => string) => this._compileToFunction(this._processScopeVariables(this._processScopeExec(this._processGSwitchBlocks(this._processGMapBlocks(this._processGIfElseBlocks(this._processGScriptBlocks(raw)))))), false)

    for (const [AGBaseId, baseContent] of Object.entries(bases)) {
      const blocks = this._processGDiceBlocks(baseContent)
      result[AGBaseId] = {}

      for (const [ALang, block] of Object.entries(blocks)) {
        const emojiFn = compileString(block.emoji)
        result[AGBaseId][ALang] = (data?: ITemplateData) => ({emoji: emojiFn(data)})
      }
    }
    return result
  }

  /**
   * Compiles invoice blocks from a template into executable functions.
   *
   * @remarks
   * This method parses `<g-invoice>` blocks from the template and compiles
   * the interpolable fields (`title`, `description`, `payload`, each price
   * `label`) into functions; `currency` and `amount` pass through as parsed
   * (amounts are static integers — dynamic amounts are rejected by the
   * validator). The result is organized by base ID and language.
   * Pre-parsed base blocks can be provided for efficiency.
   *
   * Processing pipeline (in order, per string field):
   * 1. `_processGScriptBlocks` - converts `<g-script>` blocks into executable expressions
   * 2. `_processGMapBlocks` - converts `<g-map>` blocks into array map expressions
   * 3. `_processGSwitchBlocks` - converts `<g-switch>` blocks into switch expressions
   * 4. `_processScopeExec` - evaluates scope execution blocks (implementation-defined)
   * 5. `_processScopeVariables` - resolves scope variables (implementation-defined)
   * 6. `_compileToFunction(processed, false)` - produces the final render function
   *
   * Output shape:
   * - First level key: `AGBaseId` (from `<g-base id="...">`, or `"default"` if omitted)
   * - Second level key: `ALang` (from `<g-invoice lang="...">`, or `"default"` if omitted)
   * - Value: `(data?: Record<string, unknown>) => ITInvoiceBlock`
   *
   * @param template - Raw template string containing `<g-base>` and `<g-invoice>` blocks
   * @param baseBlocks - Optional pre-parsed base blocks for reuse
   * @returns Compiled invoice functions organized by base ID and language
   *
   * @example
   * ```typescript
   * const invoices = TemplateEngine.compileBlockGInvoice(`<g-base><g-invoice title="VIP {{days}} hari" description="Akses" payload="{{orderId}}" currency="XTR"><g-price label="VIP {{days}} hari" amount="100"/></g-invoice></g-base>`);
   * const result = invoices.default?.default?.({ days: 30, orderId: 'o-1' });
   * // Result: { title: 'VIP 30 hari', description: 'Akses', payload: 'o-1', currency: 'XTR', prices: [{label: 'VIP 30 hari', amount: 100}] }
   * ```
   *
   * @public
   */
  static compileBlockGInvoice(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>) {
    const bases = baseBlocks || this._processGBaseBlocks(template)
    const result: {
      [AGBaseId: string]: {
        [ALang: string]: (data?: ITemplateData) => IInvoiceBlock
      }
    } = {}
    const compileString = (raw: string): ((data?: ITemplateData) => string) => this._compileToFunction(this._processScopeVariables(this._processScopeExec(this._processGSwitchBlocks(this._processGMapBlocks(this._processGIfElseBlocks(this._processGScriptBlocks(raw)))))), false)

    for (const [AGBaseId, baseContent] of Object.entries(bases)) {
      const invoices = this._processGInvoiceBlocks(baseContent)
      result[AGBaseId] = {}

      for (const [ALang, invoice] of Object.entries(invoices)) {
        const titleFn = compileString(invoice.title)
        const descriptionFn = compileString(invoice.description)
        const payloadFn = compileString(invoice.payload)
        const labelFns = invoice.prices.map((price) => compileString(price.label))
        result[AGBaseId][ALang] = (data?: ITemplateData) => ({
          ...invoice,
          title: titleFn(data),
          description: descriptionFn(data),
          payload: payloadFn(data),
          prices: invoice.prices.map((price, index) => ({label: labelFns[index]!(data), amount: price.amount}))
        })
      }
    }
    return result
  }

  /**
   * Compiles paid-media blocks from a template into executable functions.
   *
   * @remarks
   * This method parses `<g-paid-media>` blocks from the template and compiles
   * the interpolable fields (each item `src` and `caption`) into functions;
   * `stars` and item `type` pass through as parsed (dynamic prices are
   * rejected by the validator and re-checked at runtime). The result is
   * organized by base ID and language.
   *
   * Processing pipeline (in order, per string field):
   * 1. `_processGScriptBlocks` - converts `<g-script>` blocks into executable expressions
   * 2. `_processGMapBlocks` - converts `<g-map>` blocks into array map expressions
   * 3. `_processGSwitchBlocks` - converts `<g-switch>` blocks into switch expressions
   * 4. `_processScopeExec` - evaluates scope execution blocks (implementation-defined)
   * 5. `_processScopeVariables` - resolves scope variables (implementation-defined)
   * 6. `_compileToFunction(processed, false)` - produces the final render function
   *
   * Output shape:
   * - First level key: `AGBaseId` (from `<g-base id="...">`, or `"default"` if omitted)
   * - Second level key: `ALang` (from `<g-paid-media lang="...">`, or `"default"` if omitted)
   * - Value: `(data?: Record<string, unknown>) => ITPaidMediaBlock`
   *
   * @param template - Raw template string containing `<g-base>` and `<g-paid-media>` blocks
   * @param baseBlocks - Optional pre-parsed base blocks for reuse
   * @returns Compiled paid-media functions organized by base ID and language
   *
   * @example
   * ```typescript
   * const walls = TemplateEngine.compileBlockGPaidMedia(`<g-base><g-paid-media stars="100"><g-media type="photo" src="{{teaser}}">Bayar untuk membuka</g-media></g-paid-media></g-base>`);
   * const result = walls.default?.default?.({ teaser: 't.jpg' });
   * // Result: { stars: 100, media: [{type: 'photo', src: 't.jpg', caption: 'Bayar untuk membuka'}] }
   * ```
   *
   * @public
   */
  static compileBlockGPaidMedia(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>) {
    const bases = baseBlocks || this._processGBaseBlocks(template)
    const result: {
      [AGBaseId: string]: {
        [ALang: string]: (data?: ITemplateData) => IPaidMediaBlock
      }
    } = {}
    const compileString = (raw: string): ((data?: ITemplateData) => string) => this._compileToFunction(this._processScopeVariables(this._processScopeExec(this._processGSwitchBlocks(this._processGMapBlocks(this._processGIfElseBlocks(this._processGScriptBlocks(raw)))))), false)

    for (const [AGBaseId, baseContent] of Object.entries(bases)) {
      const walls = this._processGPaidMediaBlocks(baseContent)
      result[AGBaseId] = {}

      for (const [ALang, paidMedia] of Object.entries(walls)) {
        const srcFns = paidMedia.media.map((item) => compileString(item.src))
        const captionFns = paidMedia.media.map((item) => (item.caption === undefined ? undefined : compileString(item.caption)))
        result[AGBaseId][ALang] = (data?: ITemplateData) => ({
          stars: paidMedia.stars,
          media: paidMedia.media.map((item, index) => ({
            type: item.type,
            src: srcFns[index]!(data),
            ...(captionFns[index] === undefined ? {} : {caption: captionFns[index]!(data)})
          }))
        })
      }
    }
    return result
  }

  /**
   * Compiles message blocks from a template into executable functions.
   *
   * @remarks
   * This method parses `<g-message>` blocks from the template and compiles them into
   * functions that generate rendered message strings. The result is organized by
   * base ID and language. Pre-parsed base blocks can be provided for efficiency.
   *
   * Processing pipeline (in order, per message):
   * 1. `_processGScriptBlocks` - converts `<g-script>` blocks into executable expressions
   * 2. `_processGMapBlocks` - converts `<g-map>` blocks into array map expressions
   * 3. `_processGSwitchBlocks` - converts `<g-switch>` blocks into switch expressions
   * 4. `_processScopeExec` - evaluates scope execution blocks (implementation-defined)
   * 5. `_processScopeVariables` - resolves scope variables (implementation-defined)
   * 6. `_compileToFunction(processed, false)` - produces the final render function
   *
   * Output shape:
   * - First level key: `AGBaseId` (from `<g-base id="...">`, or `"default"` if omitted)
   * - Second level key: `ALang` (from `<g-message lang="...">`, or `"default"` if omitted)
   * - Value: `(data?: Record<string, unknown>) => {text: string; rich: boolean}` —
   *   `text` is the rendered message string, `rich` is computed once from the
   *   raw block body (`true` when it contains at least one Telegram Rich HTML tag)
   *
   * @param template - Raw template string containing `<g-base>` and `<g-message>` blocks
   * @param baseBlocks - Optional pre-parsed base blocks for reuse
   * @returns Compiled message functions organized by base ID and language
   *
   * @example
   * ```typescript
   * const template = `
   *   <g-base>
   *     <g-message>Hello {{name}}!</g-message>
   *     <g-message lang="id">Halo {{name}}!</g-message>
   *   </g-base>
   * `;
   * const messages = TemplateEngine.compileBlockGMessages(template);
   * const result = messages.default?.default?.({ name: 'John' });
   * // Result: {text: 'Hello John!', rich: false}
   * ```
   *
   * @public
   */
  static compileBlockGMessage(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>) {
    const bases = baseBlocks || this._processGBaseBlocks(template)
    const result: {
      [AGBaseId: string]: {
        [ALang: string]: (data?: ITemplateData) => {text: string; rich: boolean}
      }
    } = {}

    for (const [AGBaseId, baseContent] of Object.entries(bases)) {
      const messages = this._processGMessageBlocks(baseContent)
      result[AGBaseId] = {}

      for (const [ALang, content] of Object.entries(messages)) {
        const rich = RICH_MESSAGE_MATCHER.test(content)
        const processed = this._processScopeVariables(this._processScopeExec(this._processGSwitchBlocks(this._processGMapBlocks(this._processGIfElseBlocks(this._processGScriptBlocks(content))))))
        if (this.__emitHook !== undefined) {
          // AOT collect: record the whole `{text, rich}` leaf so emitted modules
          // freeze the wrapper; message slots never ride the link-rebuild path.
          if (this.__linkHook !== undefined) {
            throw new Error(`TemplateEngine __linkHook and __emitHook must never be set simultaneously (AOT collect vs link phase confusion)`)
          }
          const functionBody = this._buildFunctionBody(processed, false)
          result[AGBaseId][ALang] = this.__emitHook(`return {text: ${functionBody.slice(`return `.length)}, rich: ${rich}}`, {isArray: false}) as (data?: ITemplateData) => {text: string; rich: boolean}
        } else {
          const render = this._compileToFunction(processed, false)
          result[AGBaseId][ALang] = (data?: ITemplateData) => ({text: render(data), rich})
        }
      }
    }

    return result
  }

  /**
   * Compiles callback-answer blocks from a template into executable functions.
   *
   * @remarks
   * This method parses `<g-callback-answer>` blocks from the template and
   * compiles them into functions that generate rendered toast text. The
   * result is organized by base ID and language. Each content string runs
   * the same pipeline as `<g-message>` (script → map → switch → scope-exec
   * → scope-variables → function).
   *
   * Output shape:
   * - First level key: `AGBaseId` (from `<g-base id="...">`, or `"default"` if omitted)
   * - Second level key: `ALang` (from `lang="..."`, or `"default"` if omitted)
   * - Value: `(data?: Record<string, unknown>) => string`
   *
   * @param template - Raw template string containing `<g-base>` and `<g-callback-answer>` blocks
   * @param baseBlocks - Optional pre-parsed base blocks for reuse
   * @returns Compiled callback-answer functions organized by base ID and language
   *
   * @example
   * ```typescript
   * const compiled = TemplateEngine.compileBlockGCallbackAnswer(`<g-base><g-callback-answer>Hi {{name}}</g-callback-answer></g-base>`);
   * const text = compiled.default?.default?.({name: `Ani`});
   * // Result: 'Hi Ani'
   * ```
   *
   * @public
   */
  static compileBlockGCallbackAnswer(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>) {
    const bases = baseBlocks || this._processGBaseBlocks(template)
    const result: {
      [AGBaseId: string]: {
        [ALang: string]: (data?: ITemplateData) => string
      }
    } = {}

    for (const [AGBaseId, baseContent] of Object.entries(bases)) {
      const blocks = this._processGCallbackAnswerBlocks(baseContent)
      result[AGBaseId] = {}

      for (const [ALang, content] of Object.entries(blocks)) {
        const processed = this._processScopeVariables(this._processScopeExec(this._processGSwitchBlocks(this._processGMapBlocks(this._processGIfElseBlocks(this._processGScriptBlocks(content))))))
        result[AGBaseId][ALang] = this._compileToFunction(processed, false)
      }
    }

    return result
  }

  /**
   * Compiles precheckout-error blocks from a template into executable functions.
   *
   * @remarks
   * This method parses `<g-precheckout-error>` blocks from the template and
   * compiles them into functions that generate rendered decline messages.
   * Same organization and pipeline as `compileBlockGCallbackAnswer`.
   *
   * @param template - Raw template string containing `<g-base>` and `<g-precheckout-error>` blocks
   * @param baseBlocks - Optional pre-parsed base blocks for reuse
   * @returns Compiled precheckout-error functions organized by base ID and language
   *
   * @example
   * ```typescript
   * const compiled = TemplateEngine.compileBlockGPrecheckoutError(`<g-base><g-precheckout-error>Stok {{item}} habis</g-precheckout-error></g-base>`);
   * const text = compiled.default?.default?.({item: `kopi`});
   * // Result: 'Stok kopi habis'
   * ```
   *
   * @public
   */
  static compileBlockGPrecheckoutError(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>) {
    const bases = baseBlocks || this._processGBaseBlocks(template)
    const result: {
      [AGBaseId: string]: {
        [ALang: string]: (data?: ITemplateData) => string
      }
    } = {}

    for (const [AGBaseId, baseContent] of Object.entries(bases)) {
      const blocks = this._processGPrecheckoutErrorBlocks(baseContent)
      result[AGBaseId] = {}

      for (const [ALang, content] of Object.entries(blocks)) {
        const processed = this._processScopeVariables(this._processScopeExec(this._processGSwitchBlocks(this._processGMapBlocks(this._processGIfElseBlocks(this._processGScriptBlocks(content))))))
        result[AGBaseId][ALang] = this._compileToFunction(processed, false)
      }
    }

    return result
  }

  /**
   * Compiles shipping-error blocks from a template into executable functions.
   *
   * @remarks
   * This method parses `<g-shipping-error>` blocks from the template and
   * compiles them into functions that generate rendered rejection messages.
   * Same organization and pipeline as `compileBlockGCallbackAnswer`.
   *
   * @param template - Raw template string containing `<g-base>` and `<g-shipping-error>` blocks
   * @param baseBlocks - Optional pre-parsed base blocks for reuse
   * @returns Compiled shipping-error functions organized by base ID and language
   *
   * @example
   * ```typescript
   * const compiled = TemplateEngine.compileBlockGShippingError(`<g-base><g-shipping-error>Di luar {{city}}</g-shipping-error></g-base>`);
   * const text = compiled.default?.default?.({city: `Bandung`});
   * // Result: 'Di luar Bandung'
   * ```
   *
   * @public
   */
  static compileBlockGShippingError(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>) {
    const bases = baseBlocks || this._processGBaseBlocks(template)
    const result: {
      [AGBaseId: string]: {
        [ALang: string]: (data?: ITemplateData) => string
      }
    } = {}

    for (const [AGBaseId, baseContent] of Object.entries(bases)) {
      const blocks = this._processGShippingErrorBlocks(baseContent)
      result[AGBaseId] = {}

      for (const [ALang, content] of Object.entries(blocks)) {
        const processed = this._processScopeVariables(this._processScopeExec(this._processGSwitchBlocks(this._processGMapBlocks(this._processGIfElseBlocks(this._processGScriptBlocks(content))))))
        result[AGBaseId][ALang] = this._compileToFunction(processed, false)
      }
    }

    return result
  }

  /**
   * Compiles inline-button blocks from a template into executable functions.
   *
   * @remarks
   * This method parses `<g-inline-button>` blocks from the template and
   * compiles them into functions that generate button definitions. Both
   * `text` and `start-parameter` run the string pipeline (script → map →
   * switch → scope-exec → scope-variables → function), so either may carry
   * `{{var|filter}}` spans; static `start_parameter` format is enforced by
   * `validateBlockGInlineButtonAttributes`, dynamic values at runtime by the
   * caller. The result is organized by base ID and language.
   *
   * Output shape:
   * - First level key: `AGBaseId` (from `<g-base id="...">`, or `"default"` if omitted)
   * - Second level key: `ALang` (from `lang="..."`, or `"default"` if omitted)
   * - Value: `(data?: Record<string, unknown>) => ITInlineButtonBlock`
   *
   * @param template - Raw template string containing `<g-base>` and `<g-inline-button>` blocks
   * @param baseBlocks - Optional pre-parsed base blocks for reuse
   * @returns Compiled inline-button functions organized by base ID and language
   *
   * @example
   * ```typescript
   * const compiled = TemplateEngine.compileBlockGInlineButton(`<g-base><g-inline-button text="Lihat {{item}}" start-parameter="d-1"/></g-base>`);
   * const button = compiled.default?.default?.({item: `kopi`});
   * // Result: { text: 'Lihat kopi', startParameter: 'd-1' }
   * ```
   *
   * @public
   */
  static compileBlockGInlineButton(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>) {
    const bases = baseBlocks || this._processGBaseBlocks(template)
    const result: {
      [AGBaseId: string]: {
        [ALang: string]: (data?: ITemplateData) => IInlineButtonBlock
      }
    } = {}
    const compileString = (raw: string): ((data?: ITemplateData) => string) => this._compileToFunction(this._processScopeVariables(this._processScopeExec(this._processGSwitchBlocks(this._processGMapBlocks(this._processGIfElseBlocks(this._processGScriptBlocks(raw)))))), false)

    for (const [AGBaseId, baseContent] of Object.entries(bases)) {
      const blocks = this._processGInlineButtonBlocks(baseContent)
      result[AGBaseId] = {}

      for (const [ALang, block] of Object.entries(blocks)) {
        const textFn = compileString(block.text)
        const paramFn = block.startParameter !== undefined ? compileString(block.startParameter) : undefined
        result[AGBaseId][ALang] = (data?: ITemplateData) => ({
          text: textFn(data),
          ...(paramFn ? {startParameter: paramFn(data)} : {})
        })
      }
    }

    return result
  }

  /**
   * Compiles answer-note blocks from a template into executable functions.
   *
   * @remarks
   * This method parses `<g-answer-note>` blocks from the template and
   * compiles them into functions that generate rendered note text. Same
   * organization and pipeline as `compileBlockGCallbackAnswer`. The note
   * is a validation marker for answers whose content comes from the caller.
   *
   * @param template - Raw template string containing `<g-base>` and `<g-answer-note>` blocks
   * @param baseBlocks - Optional pre-parsed base blocks for reuse
   * @returns Compiled answer-note functions organized by base ID and language
   *
   * @example
   * ```typescript
   * const compiled = TemplateEngine.compileBlockGAnswerNote(`<g-base><g-answer-note>Note {{kind}}</g-answer-note></g-base>`);
   * const text = compiled.default?.default?.({kind: `vip`});
   * // Result: 'Note vip'
   * ```
   *
   * @public
   */
  static compileBlockGAnswerNote(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>) {
    const bases = baseBlocks || this._processGBaseBlocks(template)
    const result: {
      [AGBaseId: string]: {
        [ALang: string]: (data?: ITemplateData) => string
      }
    } = {}

    for (const [AGBaseId, baseContent] of Object.entries(bases)) {
      const blocks = this._processGAnswerNoteBlocks(baseContent)
      result[AGBaseId] = {}

      for (const [ALang, content] of Object.entries(blocks)) {
        const processed = this._processScopeVariables(this._processScopeExec(this._processGSwitchBlocks(this._processGMapBlocks(this._processGIfElseBlocks(this._processGScriptBlocks(content))))))
        result[AGBaseId][ALang] = this._compileToFunction(processed, false)
      }
    }

    return result
  }

  /**
   * Compiles gift blocks from a template into executable functions.
   *
   * @remarks
   * This method parses `<g-gift>` blocks from the template and compiles
   * them into functions that generate rendered card text. Same
   * organization and pipeline as `compileBlockGCallbackAnswer`. HTML
   * markup is preserved — gifts render with `text_parse_mode: HTML`.
   *
   * @param template - Raw template string containing `<g-base>` and `<g-gift>` blocks
   * @param baseBlocks - Optional pre-parsed base blocks for reuse
   * @returns Compiled gift functions organized by base ID and language
   *
   * @example
   * ```typescript
   * const compiled = TemplateEngine.compileBlockGGift(`<g-base><g-gift>Hadiah <b>{{item}}</b>!</g-gift></g-base>`);
   * const text = compiled.default?.default?.({item: `kopi`});
   * // Result: 'Hadiah <b>kopi</b>!'
   * ```
   *
   * @public
   */
  static compileBlockGGift(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>) {
    const bases = baseBlocks || this._processGBaseBlocks(template)
    const result: {
      [AGBaseId: string]: {
        [ALang: string]: (data?: ITemplateData) => string
      }
    } = {}

    for (const [AGBaseId, baseContent] of Object.entries(bases)) {
      const blocks = this._processGGiftBlocks(baseContent)
      result[AGBaseId] = {}

      for (const [ALang, content] of Object.entries(blocks)) {
        const processed = this._processScopeVariables(this._processScopeExec(this._processGSwitchBlocks(this._processGMapBlocks(this._processGIfElseBlocks(this._processGScriptBlocks(content))))))
        result[AGBaseId][ALang] = this._compileToFunction(processed, false)
      }
    }

    return result
  }

  /**
   * Compiles description blocks from a template into executable functions.
   *
   * @remarks
   * This method parses `<g-description>` blocks from the template and compiles them
   * into functions that generate rendered description strings. The result is organized
   * by base ID, scope, and language. Used for Telegram bot command descriptions.
   *
   * Processing pipeline (in order, per description):
   * 1. `_processGScriptBlocks` – converts `<g-script>` blocks into executable expressions
   * 2. `_processGMapBlocks` – converts `<g-map>` blocks into array map expressions
   * 3. `_processGSwitchBlocks` – converts `<g-switch>` blocks into switch expressions
   * 4. `_processScopeExec` – evaluates scope execution blocks (implementation-defined)
   * 5. `_processScopeVariables` – resolves scope variables (implementation-defined)
   * 6. `_compileToFunction(processed, false)` – produces the final render function
   *
   * Output shape:
   * - First level key: `AGBaseId` (from `<g-base id="...">`, or `"default"` if omitted)
   * - Second level key: `AScope` (from `<g-description scope="...">`, or `"default"` if omitted)
   * - Third level key: `ALang` (from `<g-description lang="...">`, or `"default"` if omitted)
   * - Value: `(data?: Record<string, unknown>) => string`
   *
   * @param template - Raw template string containing `<g-base>` and `<g-description>` blocks
   * @param gBaseBlocks - Optional pre-parsed base blocks for reuse
   * @returns Compiled description functions organized by base ID, scope, and language
   *
   * @example
   * ```typescript
   * const template = `
   *   <g-base>
   *     <g-description>Start the bot</g-description>
   *     <g-description scope="chat_administrators">Admin command</g-description>
   *   </g-base>
   * `;
   * const descriptions = TemplateEngine.compileBlockGDescription(template);
   * const result = descriptions.default?.default?.default?.({});
   * // Result: 'Start the bot'
   * ```
   *
   * @public
   */
  static compileBlockGDescription(template: string, gBaseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>) {
    const bases = gBaseBlocks || this._processGBaseBlocks(template)
    const result: {
      [AGBaseId: string]: {
        [AScope: string]: {
          [ALang: string]: (data?: ITemplateData) => string
        }
      }
    } = {}

    for (const [AGBaseId, baseContent] of Object.entries(bases)) {
      const descriptions = this._processGDescriptionBlocks(baseContent)
      result[AGBaseId] = {}

      for (const [ALang, scopes] of Object.entries(descriptions)) {
        for (const [AScope, scopeContent] of Object.entries(scopes)) {
          if (!result[AGBaseId][AScope]) {
            result[AGBaseId][AScope] = {}
          }
          const processed = this._processScopeVariables(this._processScopeExec(this._processGSwitchBlocks(this._processGMapBlocks(this._processGIfElseBlocks(this._processGScriptBlocks(scopeContent))))))
          result[AGBaseId][AScope][ALang] = this._compileToFunction(processed, false)
        }
      }
    }

    return result
  }

  /**
   * Compiles keyboard blocks from a template into executable functions.
   *
   * @remarks
   * This method parses `<g-keyboard>` blocks from the template and compiles them
   * into functions that generate button label arrays. The result is organized by
   * base ID and language, with separate `inline` and `bottom` keyboard modes.
   * Comma-separated labels are split into individual button strings.
   *
   * Processing pipeline (in order, per keyboard label):
   * 1. `_processGScriptBlocks` – converts `<g-script>` blocks into executable expressions
   * 2. `_processGMapBlocks` – converts `<g-map>` blocks into array map expressions
   * 3. `_processGSwitchBlocks` – converts `<g-switch>` blocks into switch expressions
   * 4. `_processScopeExec` – evaluates scope execution blocks (implementation-defined)
   * 5. `_processScopeVariables` – resolves scope variables (implementation-defined)
   * 6. `_compileToFunction(processedLabels, true)` – produces the final render function
   *
   * Notes:
   * - Keyboard content is split by commas into individual labels.
   * - Escaped commas with double backslash (`\\,`) are preserved as literal commas.
   * - Each label is processed independently through the pipeline.
   *
   * Output shape:
   * - First level key: `AGBaseId` (from `<g-base id="...">`, or `"default"` if omitted)
   * - Second level key: `ALang` (from `<g-keyboard lang="...">`, or `"default"` if omitted)
   * - Third level key: `mode`:
   *   - `inline` (default)
   *   - `bottom`
   * - Value: `(data?: Record<string, unknown>) => string[]`
   *
   * @param template - Raw template string containing `<g-base>` and `<g-keyboard>` blocks
   * @param gBaseBlocks - Optional pre-parsed base blocks for reuse
   * @returns Compiled keyboard functions organized by base ID, language, and mode
   *
   * @example
   * ```typescript
   * const template = `
   *   <g-base>
   *     <g-keyboard>Yes, No, {{action}}</g-keyboard>
   *     <g-keyboard type="bottom">Menu, Help</g-keyboard>
   *   </g-base>
   * `;
   * const keyboards = TemplateEngine.compileBlockGKeyboards(template);
   * const inline = keyboards.default?.default?.inline?.({ action: 'Cancel' });
   * // Result: ['Yes', 'No', 'Cancel']
   * ```
   *
   * @public
   */
  static _splitKeyboardLabels(content: string): string[] {
    const labels: string[] = []
    let current = ``
    let inTag = false
    let inQuotes = false

    for (let i = 0; i < content.length; i++) {
      const char = content[i]!
      const prev = i > 0 ? content[i - 1]! : ``

      if (inTag) {
        if (char === `"` && !inQuotes) {
          inQuotes = true
        } else if (char === `"` && inQuotes) {
          inQuotes = false
        } else if (char === `>` && !inQuotes) {
          inTag = false
        }
        current += char
      } else if (inQuotes) {
        if (char === `"`) {
          inQuotes = false
        }
        current += char
      } else {
        // NORMAL state — outside any tag
        if (char === `<`) {
          inTag = true
          current += char
        } else if (char === `,` && prev !== `\\`) {
          labels.push(current.trim())
          current = ``
        } else {
          current += char
        }
      }
    }

    // Always push the final segment (even empty) to match String.split() semantics
    labels.push(current.trim())

    return labels
  }

  /**
   * Compiles keyboard labels from a processed template, executing blocks and
   * scope variables to produce final label arrays for inline/bottom keyboards.
   *
   * @param template - The processed template string containing `<g-keyboard>` blocks
   * @param gBaseBlocks - Optional pre-parsed base blocks (avoids re-parsing)
   * @returns A nested record of compiled label functions keyed by base, lang, and mode
   *
   * @public
   */
  static compileBlockGKeyboards(template: string, gBaseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>) {
    const bases = gBaseBlocks || this._processGBaseBlocks(template)
    const result: {
      [AGBaseId: string]: {
        [ALang: string]: {
          inline?: (data?: ITemplateData) => string[]
          bottom?: (data?: ITemplateData) => string[]
        }
      }
    } = {}

    for (const [AGBaseId, content] of Object.entries(bases)) {
      const keyboards = this._processGKeyboardBlocks(content)
      result[AGBaseId] = {}

      for (const [lang, modes] of Object.entries(keyboards)) {
        result[AGBaseId][lang] = {}

        for (const [mode, content] of Object.entries(modes)) {
          // Separates label, handle escaped comma — now quote-aware (commas inside HTML attributes are not split)
          const labels = this._splitKeyboardLabels(content).map((label: string) => label.replace(/\\,/g, `,`).trim())

          const processedLabels = labels.map((label) => this._processScopeVariables(this._processScopeExec(this._processGSwitchBlocks(this._processGMapBlocks(this._processGIfElseBlocks(this._processGScriptBlocks(label)))))))

          result[AGBaseId][lang][mode as `inline` | `bottom`] = this._compileToFunction(processedLabels, true)
        }
      }
    }

    return result
  }

  /**
   * Extracts specific blocks from template content with optional filtering.
   *
   * @remarks
   * This internal method extracts content from templates based on base ID,
   * block type, language, and section mode. It supports scoped extraction
   * with indentation normalization for clean output.
   *
   * @param content - The template content to extract from
   * @param blocks - Block type(s) to extract, or `"all"` for all blocks
   * @param AGBaseId - The base ID to extract from (defaults to `"default"`)
   * @param section - Whether to return the full block (`"all"`) or just inner content (`"value"`)
   * @param lang - Optional language filter for blocks
   * @returns The extracted content as a string
   *
   * @example
   * ```typescript
   * const template = `
   *   <g-base id="main">
   *     <g-message>Hello</g-message>
   *     <g-keyboard>Yes, No</g-keyboard>
   *   </g-base>
   * `;
   * const result = TemplateEngine._extractBlock(template, 'message', 'main', 'value');
   * // Result: 'Hello'
   * ```
   *
   * @public
   */
  static _extractBlock(content: string, blocks?: string | string[], AGBaseId: string = `default`, section: `all` | `value` = `all`, lang?: string) {
    // 1. Extract Base Block
    const baseRegex = /<g-base\b[^>]*?(?:\sid=(["']?)([^"'\s>]+)\1)?[^>]*?>([\s\S]*?)<\/g-base>/g
    let baseContent = content
    let foundBase = false

    // Try to find specific base
    for (const match of content.matchAll(baseRegex)) {
      const id = match[2] ?? `default`
      if (id === AGBaseId) {
        baseContent = match[3] ?? ``
        foundBase = true
        break
      }
    }

    // If base not found
    if (!foundBase) {
      const hasAnyBase = /<g-base\b/.test(content)
      if (AGBaseId === `default` && !hasAnyBase) {
        // use whole content as base
      } else {
        return `` // Specific base not found
      }
    }

    // 2. Handle blocks parameter
    if (blocks) {
      // If blocks is "all", extract all known block types
      if (blocks === `all`) {
        // Return the entire base content (all blocks)
        if (section === `value`) {
          return baseContent
        }
        return baseContent
      }

      // Convert to array if string
      const blockList = Array.isArray(blocks) ? blocks : [blocks]
      const allBlockMatches: Array<{start: number; content: string; innerContent: string}> = []

      for (const block of blockList) {
        // Capture optional leading whitespace to correctly identify the block's base indentation level
        const blockRegex = new RegExp(`([ \\t]*)<${block}(?:\\s+([^>]*))?>([\\s\\S]*?)<\\/${block}>`, `gi`)
        for (const match of baseContent.matchAll(blockRegex)) {
          const attributesStr = match[2]
          if (lang) {
            const attrRegex = /lang\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i
            const langMatch = attributesStr?.match(attrRegex)
            const blockLang = langMatch ? (langMatch[1] ?? langMatch[2] ?? langMatch[3]) : undefined

            // Fix: lang="default" should match blocks with no lang attribute (undefined)
            const effectiveBlockLang = blockLang || `default`
            if (effectiveBlockLang !== lang) continue
          }

          allBlockMatches.push({
            start: match.index!,
            content: match[0],
            innerContent: match[3] ?? `` // Group 3 because group 1 is indentation and group 2 is attributes
          })
        }
      }

      // Sort by position to maintain original order in the document
      allBlockMatches.sort((a, b) => a.start - b.start)

      const processResult = (content: string) => {
        const lines = content.split(`\n`)
        if (lines.length <= 1) return content.trim()

        // Find common indentation among all non-empty lines
        const nonEmptyLines = lines.filter((line) => line.trim().length > 0)
        if (nonEmptyLines.length === 0) return ``

        const minIndent = nonEmptyLines.reduce((min: number, line: string) => {
          const match = line.match(/^([ \t]*)/)
          const indent = match ? match[1]!.length : 0
          return indent < min ? indent : min
        }, Infinity)

        return lines
          .map((line) => (line.length >= minIndent ? line.slice(minIndent) : line.trimStart()))
          .join(`\n`)
          .trim()
      }

      if (section === `all`) {
        const result = allBlockMatches.map((m) => processResult(m.content)).join(`\n`)
        return result
      } else {
        const result = allBlockMatches.map((m) => processResult(m.innerContent)).join(`\n`)
        return result
      }
    }

    // 3. If no blocks specified, return base content based on section
    if (section === `value`) {
      // Return only the inner content, preserving structure
      return baseContent
    }

    // section === `all` - return with base wrapper
    return baseContent
  }

  /**
   * Parses `<g-import>` directives from a template and extracts import metadata.
   *
   * @remarks
   * This internal method identifies all `<g-import>` tags in a template and replaces
   * them with placeholders while collecting their metadata (src, blocks, base, lang,
   * section, indent). The placeholders are later resolved by `processGImportBlocks`.
   *
   * **Attributes:**
   *   - `src` (required): Import source identifier (e.g., template/page key). If missing, the tag is removed (replaced with an empty string).
   *   - `block` (optional): Block selector. Supported forms:
   *     - `"all"`: import all supported blocks
   *     - `"block1"`: import a single block
   *     - `"block1,block2"` / `"block1, block2"`: import multiple blocks (comma-separated)
   *   - `base` (optional): Base id selector for the imported template. Defaults to `"default"`.
   *   - `lang` (optional): Language selector for the imported content (passed through as metadata).
   *   - `section` (optional): Import section selector. Supported values:
   *     - `"all"` (default): include block
   *     - `"value"`: only value
   *
   * @param template - The template string containing `<g-import>` directives
   * @returns An object containing the processed template with placeholders and an array of import metadata
   *
   * @example
   * ```typescript
   * const template = '<g-import src="other-page" block="message" />';
   * const { processed, imports } = TemplateEngine._processGImportBlocks(template);
   * // processed: '__IMPORT_0__'
   * // imports: [{ src: 'other-page', blocks: 'message', base: 'default', ... }]
   * ```
   *
   * @public
   */
  static _processGImportBlocks(template: string) {
    const importRegex = /([ \t]*)<g-import(?:\s+([^>]*))?\/?>/gi
    const imports: Array<{src: string; blocks?: string | string[]; base: string; lang?: string; section: `all` | `value`; indent: string}> = []
    const processed = template.replace(importRegex, (_, indent, attributesStr) => {
      const attrs: {[key: string]: string} = {}
      const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g
      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ``
        }
      }

      const src = attrs.src
      if (!src) return `` // 'src' is required

      const withGBPrefix = (b: string) => (b.startsWith(`g-`) ? b : `g-${b}`)
      let blocks: string | string[] | undefined
      if (attrs.block) {
        if (attrs.block === `all`) {
          blocks = `all`
        } else if (attrs.block.includes(`,`)) {
          blocks = attrs.block
            .split(`,`)
            .map((b) => b.trim())
            .filter((b) => b)
            .map(withGBPrefix)
        } else {
          blocks = withGBPrefix(attrs.block)
        }
      }

      const importInfo = {
        src,
        blocks,
        base: attrs.base || `default`,
        lang: attrs.lang, // Support lang attribute
        section: (attrs.section as `all` | `value`) || `all`,
        indent: indent || ``
      }

      imports.push(importInfo)
      return `${indent}__IMPORT_${imports.length - 1}__`
    })

    return {processed, imports}
  }

  /**
   * Recursively processes and resolves `<g-import>` blocks in a template.
   *
   * @remarks
   * This method resolves all `<g-import>` placeholders produced by `_processGImportBlocks` by invoking a user-provided `resolver` function.
   *
   * Resolution behavior:
   * - Each `<g-import>` is resolved by calling `resolver(src)` to obtain raw template content.
   * - The resolved content is filtered using `_extractBlock` based on the import metadata
   *   (`blocks`, `base`, `section`, `lang`).
   * - If the resolved content itself contains `<g-import>` directives, they are processed
   *   recursively.
   *
   * Recursion and safety:
   * - Recursive import resolution is limited to a maximum depth of **10** to prevent
   *   infinite import loops.
   * - If the depth limit is exceeded, an empty string is returned.
   *
   * Output behavior:
   * - `<g-import>` placeholders (`__IMPORT_N__`) are replaced sequentially.
   * - If the resolver returns `null` or an empty result, the import is replaced with
   *   an empty string.
   *
   * @param template - Template string containing `<g-import>` directives
   * @param resolver - Function that resolves import sources to template content
   * @param depth - Current recursion depth (defaults to 0)
   * @param importCache - Optional Map to cache resolved imports for reuse
   * @returns Template with all `<g-import>` blocks resolved and replaced
   *
   * @example
   * ```typescript
   * const template = '<g-import src="header" block="message" />\n<g-message>Main content</g-message>';
   * const resolver = (src: string) => {
   *   if (src === 'header') return '<g-message>Header text</g-message>';
   *   return null;
   * };
   * const result = TemplateEngine.processGImportBlocks(template, resolver);
   * // Result: '<g-message>Header text</g-message>\n<g-message>Main content</g-message>'
   * ```
   *
   * @public
   */
  static processGImportBlocks(template: string, resolver: (src: string) => string | null, depth = 0, importCache?: Map<string, string>): string {
    if (depth > 10) return `` // recursive limit

    const {processed, imports} = this._processGImportBlocks(template)

    let result = processed
    for (let i = 0; i < imports.length; i++) {
      const importInfo = imports[i]!

      // Unique key for cache: src|base|lang|section|blocks
      const cacheKey = `${importInfo.src}|${importInfo.base}|${importInfo.lang || ``}|${importInfo.section}|${Array.isArray(importInfo.blocks) ? importInfo.blocks.join(`,`) : importInfo.blocks || ``}`

      let resolved: string
      if (importCache && importCache.has(cacheKey)) {
        resolved = importCache.get(cacheKey)!
      } else {
        const content = resolver(importInfo.src)
        resolved = content ? this._extractBlock(content, importInfo.blocks, importInfo.base, importInfo.section, importInfo.lang) : ``

        // Recursive process: resolve imports within the resolved content
        if (resolved && resolved.includes(`<` + `g-import`)) {
          resolved = this.processGImportBlocks(resolved, resolver, depth + 1, importCache)
        }

        if (importCache) {
          importCache.set(cacheKey, resolved)
        }
      }

      // Apply indentation to all lines except the first
      const indentedResolved = resolved
        .split(`\n`)
        .map((line, index) => (index === 0 ? line : importInfo.indent + line))
        .join(`\n`)

      result = result.replace(`__IMPORT_${i}__`, indentedResolved)
    }

    return result
  }

  /**
   * Validates that all block tags in a template are recognized.
   *
   * @remarks
   * Every HTML-like tag in the template must match a known block name from
   * {@link TemplateEngine.ALLOWED_BLOCKS}. Unknown tags produce an error.
   *
   * Telegram HTML formatting tags (`<b>`, `<i>`, `<u>`, `<s>`, `<code>`, `<pre>`,
   * `<a>`, `<blockquote>`) are whitelisted and silently ignored.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array containing
   *          line numbers and descriptive messages for each unknown block found
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateNamesBlock(`<custom>text</custom>`);
   * // Result: { valid: false, errors: [{ line: 1, message: 'Unsupported template block: <custom>' }] }
   * ```
   *
   * @public
   */
  static validateNamesBlock(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors: Array<{line: number; message: string}> = []
    const allowedBlockNames = this._extractBlockNames(TemplateEngine.ALLOWED_BLOCKS)
    const passthroughTags = this._extractBlockNames(TemplateEngine.ALLOWED_BLOCKS_TELEGRAM)
    const tagRegex = /<\/?\s*([a-z][\w-]*)(?:\s[^<>]*)?\/?\s*>/gi

    for (const match of template.matchAll(tagRegex)) {
      const blockName = match[1]?.toLowerCase()
      if (!blockName) continue
      if (passthroughTags.has(blockName)) continue
      if (allowedBlockNames.has(blockName)) continue

      const line = (template.slice(0, match.index).match(/\n/g) || []).length + 1
      errors.push({line, message: `Unsupported template block: <${blockName}>`})
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Validates that all interpolation scope syntaxes in a template are recognized.
   *
   * @remarks
   * Every interpolation scope delimited by `{X...X}` (where X is a non-word character)
   * must match a known scope name from {@link TemplateEngine.ALLOWED_SCOPE}.
   *
   * For example, `{{variable}}` uses scope `{{}}` and `{~ expr ~}` uses `{~~}`.
   * Any other delimiter like `{# comment #}` would be reported as unsupported.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array containing
   *          line numbers and descriptive messages for each unsupported scope found
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateScopes(`{# comment #}`);
   * // Result: { valid: false, errors: [{ line: 1, message: 'Unsupported template scope: {# #}' }] }
   * ```
   *
   * @public
   */
  static validateScopes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors: Array<{line: number; message: string}> = []
    const allowedScopeNames = TemplateEngine.ALLOWED_SCOPE
    const scopeRegex = /\{([^\s{}\w])([\s\S]*?)\1\}/g

    for (const match of template.matchAll(scopeRegex)) {
      const scopeName = `{${match[1]}${match[1]}}`
      if (match[1] && allowedScopeNames.has(scopeName)) continue

      const line = (template.slice(0, match.index).match(/\n/g) || []).length + 1
      const delim = match[1] ?? `?`
      errors.push({line, message: `Unsupported template scope: {${delim} ${delim}}`})
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Validates block positioning and nesting rules in a template string.
   *
   * @remarks
   * This method checks a template string for structural block nesting violations.
   * It ensures that blocks are placed in their allowed parent contexts.
   *
   * **Nesting hierarchy:**
   * ```
   * __root__
   *   ├── g-base             (root level only)
   *   │   ├── g-message      (content block)
   *   │   │   ├── g-switch   (logic block)
   *   │   │   │   ├── case
   *   │   │   │   └── default
   *   │   │   ├── g-map      (logic block)
   *   │   │   ├── g-script   (logic block)
   *   │   │   └── g-space    (utility)
   *   │   ├── g-keyboard     (content block)
   *   │   │   ├── g-switch   (logic block)
   *   │   │   │   ├── g-case
   *   │   │   │   └── g-default
   *   │   │   ├── g-map      (logic block)
   *   │   │   ├── g-script   (logic block)
   *   │   │   └── g-space    (utility)
   *   │   ├── g-media        (content block)
   *   │   │   ├── g-switch   (logic block)
   *   │   │   │   ├── g-case
   *   │   │   │   └── g-default
   *   │   │   ├── g-map      (logic block)
   *   │   │   ├── g-script   (logic block)
   *   │   │   └── g-space    (utility)
   *   │   ├── g-description  (content block)
   *   │   │   ├── g-switch   (logic block)
   *   │   │   │   ├── g-case
   *   │   │   │   └── g-default
   *   │   │   ├── g-map      (logic block)
   *   │   │   ├── g-script   (logic block)
   *   │   │   └── g-space    (utility)
   *   │   ├── g-import       (utility)
   *   │   ├── g-description  (utility)
   *   │   ├── g-script       (logic block)
   *   └   └── g-space        (utility)
   * ```
   *
   * **Enforced rules:**
   * - `<g-base>` must be at the outermost level and cannot be nested inside any other block.
   * - `<g-message>`, `<g-keyboard>`, `<g-media>`, `<g-media-group>`, `<g-poll>`, `<g-invoice>`, `<g-paid-media>`, `<g-venue>`, `<g-dice>`, `<g-description>`, `<g-import>`, `<g-script>`, `<g-space>` can only appear directly inside `<g-base>`.
   * - `<g-media>` can also appear directly inside `<g-media-group>` as a group item, or inside `<g-paid-media>` as a paywall item.
   * - `<g-question>` and `<g-option>` can only appear directly inside `<g-poll>`.
   * - `<g-price>` can only appear directly inside `<g-invoice>`.
   * - `<g-switch>`, `<g-map>` can only appear inside `<g-message>`, `<g-keyboard>`, `<g-media>`, or `<g-description>`.
   * - `<g-case>` and `<g-default>` can only appear inside `<g-switch>`.
   * - `<g-map>` is also allowed inside `<g-case>` and `<g-default>` (explicitly and via
   *   parent-child inheritance — see `inheritsContentFromParent`).
   * - Telegram formatting tags (`<b>`, `<i>`, `<u>`, `<s>`, `<code>`, `<pre>`, `<a>`, `<blockquote>`, `<blockquote expandable>`)
   *   are passthrough and ignored during validation.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array containing
   *          line numbers and descriptive messages for each violation found
   *
   * @example
   * ```typescript
   * // Valid template
   * const result = TemplateEngine.validatePositionsBlock(`
   *   <g-base>
   *     <g-message>Hello {{name}}!</g-message>
   *     <g-keyboard>Yes, No</g-keyboard>
   *   </g-base>
   * `);
   * // Result: { valid: true, errors: [] }
   *
   * // Invalid: <g-base> nested inside <g-message>
   * const bad = TemplateEngine.validatePositionsBlock(`
   *   <g-base>
   *     <g-message>
   *       <g-base>Nested base</g-base>
   *     </g-message>
   *   </g-base>
   * `);
   * // Result: { valid: false, errors: [{ line: 4, message: 'Block <g-base> is not allowed inside <g-message>' }] }
   * ```
   *
   * @public
   */
  static validatePositionsBlock(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors: Array<{line: number; message: string}> = []
    const stack: Array<{block: string; line: number}> = []

    // Passthrough Telegram HTML tags that are not structural
    const passthroughTags = this._extractBlockNames(TemplateEngine.ALLOWED_BLOCKS_TELEGRAM)

    // Allowed parent context for each structural block.
    // `__root__` represents the outermost level (outside any block).
    // Blocks whose only parent is g-switch (g-case, g-default) inherit
    // the same content children as the blocks g-switch lives in.
    // This prevents needing to manually update allowedParents when new
    // g-switch child blocks are added.
    const inheritsContentFromParent: Set<string> = new Set([`g-case`, `g-default`])
    const allowedParents: Record<string, Set<string>> = {
      "g-base": new Set([`__root__`]),
      "g-message": new Set([`g-base`]),
      "g-keyboard": new Set([`g-base`]),
      "g-media": new Set([`g-base`, `g-media-group`, `g-paid-media`]),
      "g-media-group": new Set([`g-base`]),
      "g-poll": new Set([`g-base`]),
      "g-question": new Set([`g-poll`]),
      "g-option": new Set([`g-poll`]),
      "g-invoice": new Set([`g-base`]),
      "g-price": new Set([`g-invoice`]),
      "g-paid-media": new Set([`g-base`]),
      "g-venue": new Set([`g-base`]),
      "g-dice": new Set([`g-base`]),
      "g-description": new Set([`g-base`]),
      "g-switch": new Set([`g-message`, `g-keyboard`, `g-media`, `g-poll`, `g-question`, `g-option`, `g-description`]),
      "g-case": new Set([`g-switch`]),
      "g-default": new Set([`g-switch`]),
      "g-map": new Set([`g-message`, `g-keyboard`, `g-media`, `g-poll`, `g-question`, `g-option`, `g-description`, `g-case`, `g-default`, `g-map`]),
      "g-div": new Set([`g-base`, `g-message`, `g-description`, `g-keyboard`, `g-case`, `g-default`, `g-map`]),
      "g-script": new Set([`g-base`, `g-message`, `g-description`, `g-keyboard`, `g-poll`, `g-question`, `g-option`, `g-case`, `g-default`, `g-map`, `g-div`]),
      "g-ifelse": new Set([`g-base`, `g-message`, `g-description`, `g-keyboard`, `g-poll`, `g-question`, `g-option`, `g-case`, `g-default`, `g-map`, `g-div`]),
      "g-import": new Set([`g-base`]),
      "g-space": new Set([`g-base`, `g-message`, `g-description`, `g-keyboard`, `g-poll`, `g-question`, `g-option`, `g-case`, `g-default`, `g-switch`, `g-map`, `g-div`])
    }

    // Matches all HTML-like tags: <tagname>, <tagname attr="val">, </tagname>, <tagname />
    const tagRegex = /<(\/?)(\w[\w-]*)([^>]*)>/g
    let match: RegExpExecArray | null

    while ((match = tagRegex.exec(template)) !== null) {
      const fullTag = match[0]
      const slashPrefix = match[1]!
      const tagName = match[2]!.toLowerCase()
      const isClosing = slashPrefix === `/`
      const isSelfClosing = !isClosing && fullTag.endsWith(`/>`)

      // Skip passthrough Telegram HTML tags
      if (passthroughTags.has(tagName)) continue

      // Skip tags that are not recognized structural blocks
      if (!allowedParents[tagName]) continue

      // Calculate the 1-based line number
      const line = (template.slice(0, match.index).match(/\n/g) || []).length + 1

      if (isClosing) {
        // Closing tag: validate it matches the current open block on the stack
        if (stack.length === 0) {
          errors.push({line, message: `Unexpected closing tag </${tagName}>: no matching opening tag`})
        } else {
          const last = stack[stack.length - 1]!
          if (last.block !== tagName) {
            errors.push({line, message: `Mismatched closing tag: expected </${last.block}> but found </${tagName}>`})
          } else {
            stack.pop()
          }
        }
      } else if (isSelfClosing) {
        // Self-closing tag: validate parent only, no stack push
        const currentParent = stack.length > 0 ? stack[stack.length - 1]!.block : `__root__`
        const allowed = allowedParents[tagName]!
        let isAllowed = allowed.has(currentParent)
        // Check inheritance: if currentParent inherits from its own parent(s)
        if (!isAllowed && inheritsContentFromParent.has(currentParent)) {
          for (const parentBlock of allowedParents[currentParent] || []) {
            for (const grandParent of allowedParents[parentBlock] || []) {
              const gpAllowed = allowedParents[tagName]
              if (gpAllowed && gpAllowed.has(grandParent)) {
                isAllowed = true
                break
              }
            }
            if (isAllowed) break
          }
        }
        if (!isAllowed) {
          errors.push({line, message: `Block <${tagName}> is not allowed inside <${currentParent}>`})
        }
      } else {
        // Opening tag: validate parent, then push to stack
        const currentParent = stack.length > 0 ? stack[stack.length - 1]!.block : `__root__`
        const allowed = allowedParents[tagName]!
        let isAllowed = allowed.has(currentParent)
        // Check inheritance: if currentParent inherits from its own parent(s)
        if (!isAllowed && inheritsContentFromParent.has(currentParent)) {
          for (const parentBlock of allowedParents[currentParent] || []) {
            for (const grandParent of allowedParents[parentBlock] || []) {
              const gpAllowed = allowedParents[tagName]
              if (gpAllowed && gpAllowed.has(grandParent)) {
                isAllowed = true
                break
              }
            }
            if (isAllowed) break
          }
        }
        if (!isAllowed) {
          errors.push({line, message: `Block <${tagName}> is not allowed inside <${currentParent}>`})
        }
        stack.push({block: tagName, line})
      }
    }

    // Report any blocks that were never closed
    for (const item of stack) {
      errors.push({line: item.line, message: `Unclosed block <${item.block}>: missing closing tag </${item.block}>`})
    }

    // Check for content outside <g-base> blocks.
    // All template content must be enclosed in <g-base>...</g-base>.
    if (errors.length === 0) {
      const baseBlocks: Array<{start: number; end: number}> = []
      const baseTag = /<g-base\b[^>]*>[\s\S]*?<\/g-base>/g
      let blockMatch: RegExpExecArray | null
      while ((blockMatch = baseTag.exec(template)) !== null) {
        baseBlocks.push({start: blockMatch.index, end: blockMatch.index + blockMatch[0].length})
      }

      if (baseBlocks.length === 0 && template.trim()) {
        // No <g-base> block at all
        errors.push({line: 1, message: `Missing <g-base> block: template content must be wrapped in <g-base>...</g-base>`})
      } else {
        // Check before first <g-base>
        let prevEnd = 0
        for (const block of baseBlocks) {
          if (block.start > prevEnd) {
            const slice = template.slice(prevEnd, block.start)
            if (slice.trim()) {
              const line = (template.slice(0, prevEnd).match(/\n/g) || []).length + 1
              errors.push({line, message: `Content found outside <g-base> block: move content inside a <g-base>...</g-base>`})
              break
            }
          }
          prevEnd = block.end
        }
        // Check after last </g-base>
        if (errors.length === 0 && prevEnd < template.length && template.slice(prevEnd).trim()) {
          const line = (template.slice(0, prevEnd).match(/\n/g) || []).length + 1
          errors.push({line, message: `Content found outside <g-base> block: move content inside a <g-base>...</g-base>`})
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Validates block syntax format (self-closing vs regular open/close).
   *
   * @remarks
   * This method checks that each block tag uses the correct syntax format:
   *
   * **Must be self-closing:**
   * - `<g-space />` — whitespace control block
   * - `<g-import ... />` — import directive block
   * - `<hr/>`, `<img/>`, `<input/>`, `<br/>`, `<tg-map/>` — Telegram Rich HTML void elements
   *
   * **Must NOT be self-closing (must use open/close tags):**
   * - `<g-base>...</g-base>`, `<g-message>...</g-message>`, `<g-keyboard>...</g-keyboard>`,
   *   `<g-media>...</g-media>`, `<g-poll>...</g-poll>`, `<g-question>...</g-question>`,
   *   `<g-option>...</g-option>`, `<g-invoice>...</g-invoice>`, `<g-paid-media>...</g-paid-media>`, `<g-description>...</g-description>`, `<g-script>...</g-script>`,
   *   `<g-switch>...</g-switch>`, `<g-case>...</g-case>`, `<g-default>...</g-default>`,
   *   `<g-map>...</g-map>`, `<g-div>...</g-div>`
   *
   * Telegram HTML formatting tags with content (e.g. `<b>`, `<p>`, `<table>`) passthrough
   * and are not format-checked — both `<b>text</b>` and `<b/>` are accepted.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array containing
   *          line numbers and descriptive messages for each format violation found
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateFormatBlock(`<g-space>content</g-space>`);
   * // Result: { valid: false, errors: [{ line: 1, message: 'Block <g-space> must be self-closing: use <g-space /> instead' }] }
   * ```
   *
   * @public
   */
  static validateFormatBlock(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors: Array<{line: number; message: string}> = []
    const selfClosingBlocks = new Set([`space`, `import`, `hr`, `img`, `input`, `br`, `tg-map`])
    const regularBlocks = new Set([`g-base`, `g-message`, `g-keyboard`, `g-media`, `g-media-group`, `g-poll`, `g-question`, `g-option`, `g-invoice`, `g-paid-media`, `g-description`, `g-script`, `g-ifelse`, `g-switch`, `g-case`, `g-default`, `g-map`, `g-div`])

    const tagRegex = /<(\/?)(\w[\w-]*)([^>]*)>/g
    let match: RegExpExecArray | null

    while ((match = tagRegex.exec(template)) !== null) {
      const fullTag = match[0]
      const slashPrefix = match[1]!
      const tagName = match[2]!.toLowerCase()
      const isClosing = slashPrefix === `/`
      const isSelfClosing = !isClosing && fullTag.endsWith(`/>`)

      if (isClosing) continue

      const line = (template.slice(0, match.index).match(/\n/g) || []).length + 1

      if (isSelfClosing) {
        // Block is self-closing but must have regular open/close tags
        if (regularBlocks.has(tagName)) {
          errors.push({line, message: `Block <${tagName}> must not be self-closing: use <${tagName}>...</${tagName}> instead`})
        }
      } else {
        // Block is a regular opening tag but must be self-closing
        if (selfClosingBlocks.has(tagName)) {
          errors.push({line, message: `Block <${tagName}> must be self-closing: use <${tagName} /> instead`})
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Shared helper: validates attributes on a specific block tag.
   *
   * @param template - The raw template string
   * @param tagName - Block tag name (e.g. `g-base`, `g-message`)
   * @param allowedAttributes - Set of allowed attribute names
   * @param allowedLabel - Text listing allowed attributes for error messages (e.g. `"id"`)
   * @param valueValidators - Optional per-attribute value validators; return error message or null
   * @returns Array of line, message errors
   */
  static _validateBlockAttributes(template: string, tagName: string, allowedAttributes: Set<string>, allowedLabel: string, valueValidators?: Record<string, (value: string) => string | null>): Array<{line: number; message: string}> {
    const errors: Array<{line: number; message: string}> = []
    const tagRegex = new RegExp(`<${tagName}(?![\\w-])([^>]*?)>`, `g`)
    let match: RegExpExecArray | null

    while ((match = tagRegex.exec(template)) !== null) {
      const attrsStr = match[1]!.trim()
      if (!attrsStr) continue

      const line = (template.slice(0, match.index).match(/\n/g) || []).length + 1

      const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g
      let attrMatch: RegExpExecArray | null

      while ((attrMatch = attrRegex.exec(attrsStr)) !== null) {
        const attrName = attrMatch[1]!.toLowerCase()

        if (!allowedAttributes.has(attrName)) {
          const allowedMsg = allowedAttributes.size === 0 ? `no attributes are allowed` : `only ${allowedLabel} is allowed`
          errors.push({line, message: `Unknown attribute "${attrMatch[1]}" on <${tagName}>: ${allowedMsg}`})
          continue
        }

        if (valueValidators?.[attrName]) {
          const attrValue = attrMatch[2] ?? attrMatch[3] ?? attrMatch[4] ?? ``
          const valError = valueValidators[attrName]!(attrValue)
          if (valError) {
            errors.push({line, message: valError})
          }
        }
      }
    }

    return errors
  }

  /**
   * Scans a template for Telegram Rich HTML tags that are missing required attributes.
   *
   * @remarks
   * Iterates every opening tag in the template and, for any tag listed in
   * {@link TemplateEngine._TELEGRAM_REQUIRED_ATTRS}, checks that the required
   * attribute set is fully present. Both value attributes (`href="..."`) and
   * boolean attributes (`checked`, `reversed`, `open`) are recognized.
   *
   * For tags with `oneOf` spec (e.g. `<a>`), at least one of the listed sets
   * must be fully present. Returns one error per offending tag with the 1-based
   * line number.
   *
   * @param template - The raw template string to scan
   * @returns Array of `{line, message}` errors (empty if all required attrs are present)
   *
   * @example
   * ```typescript
   * const errors = TemplateEngine._validateTelegramTagAttributes(`
   *   <a>link</a>
   *   <img src="x.png"/>
   *   <tg-time unix="1" format="wDT">x</tg-time>
   * `);
   * // => [{line: 2, message: "<a> must have one of: href | name"}]
   * ```
   *
   * @public
   */
  static _validateTelegramTagAttributes(template: string): Array<{line: number; message: string}> {
    const errors: Array<{line: number; message: string}> = []
    const tagRegex = /<(\w[\w-]*)([^>]*?)\/?>/g
    let match: RegExpExecArray | null

    while ((match = tagRegex.exec(template)) !== null) {
      const tagName = match[1]!.toLowerCase()
      const attrsStr = match[2] ?? ``
      const tagDisplay = match[0]!.endsWith(`/>`) ? `<${tagName}/>` : `<${tagName}>`

      const spec = this._TELEGRAM_REQUIRED_ATTRS[tagName]
      if (!spec) continue

      // Extract attribute names: both `name="value"` and boolean `name`
      const attrNames = new Set<string>()
      const attrRegex = /([\w-]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g
      let am: RegExpExecArray | null
      while ((am = attrRegex.exec(attrsStr)) !== null) {
        attrNames.add(am[1]!.toLowerCase())
      }

      const line = (template.slice(0, match.index).match(/\n/g) || []).length + 1

      if (Array.isArray(spec)) {
        const missing = spec.filter((a) => !attrNames.has(a))
        if (missing.length > 0) {
          errors.push({line, message: `${tagDisplay} is missing required attribute(s): ${missing.join(`, `)}`})
        }
      } else {
        const matched = spec.oneOf.find((set) => set.every((a) => attrNames.has(a)))
        if (!matched) {
          const alternatives = spec.oneOf.map((set) => set.join(` + `)).join(` | `)
          errors.push({line, message: `<${tagName}> must have one of: ${alternatives}`})
        }
      }
    }

    return errors
  }

  /**
   * Validates that Telegram Rich HTML tags in the template carry their required attributes.
   *
   * @remarks
   * Telegram tags with required attributes (per the Rich HTML spec) are checked:
   * `<a>` (href or name), `<img/>`, `<video>`, `<audio>` (src), `<tg-emoji>`
   * (emoji-id), `<tg-time>` (unix, format), `<tg-map/>` (lat, long, zoom),
   * `<tg-reference>` (name), `<input/>` (type). For `<a>`, at least one of
   * `href` (link) or `name` (anchor) must be present.
   *
   * Tags without required attributes (e.g. `<b>`, `<table>`, `<p>`) are not
   * checked. See {@link TemplateEngine._TELEGRAM_REQUIRED_ATTRS} for the full spec.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateTelegramAttributesBlock(`
   *   <g-base>
   *     <g-message><a href="https://t.me/">link</a></g-message>
   *   </g-base>
   * `);
   * // Result: { valid: true, errors: [] }
   *
   * const bad = TemplateEngine.validateTelegramAttributesBlock(`
   *   <g-base>
   *     <g-message><a>broken</a></g-message>
   *   </g-base>
   * `);
   * // Result: { valid: false, errors: [{ line: 3, message: '<a> must have one of: href | name' }] }
   * ```
   *
   * @public
   */
  static validateTelegramAttributesBlock(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateTelegramTagAttributes(template)
    return {valid: errors.length === 0, errors}
  }

  /**
   * Scans a template for Telegram Rich HTML tags carrying attribute names
   * outside their per-tag allowlist.
   *
   * @remarks
   * For every Telegram rich tag (see {@link TemplateEngine._TELEGRAM_ALLOWED_ATTRS}),
   * each attribute name present is checked against the allowlist. Unknown
   * attribute names — including `{{placeholder}}` used as a NAME — produce
   * errors. Tags with an empty allowlist reject every attribute. Attribute
   * VALUES (including `{{placeholder}}` values) are NOT checked here — that is
   * {@link TemplateEngine._validateTelegramTagAttributeValues}'s job.
   *
   * @param template - The raw template string to scan
   * @returns Array of `{line, message}` errors (empty if all attributes are known)
   *
   * @example
   * ```typescript
   * const errors = TemplateEngine._validateTelegramTagUnknownAttributes(`
   *   <table ngasal="x"><tr><td>a</td></tr></table>
   *   <b class="y">bold</b>
   * `);
   * // => [
   * //   {line: 2, message: '<table> has unknown attribute(s): ngasal (allowed: bordered, striped)'},
   * //   {line: 3, message: '<b> does not support any attributes'}
   * // ]
   * ```
   *
   * @public
   */
  static _validateTelegramTagUnknownAttributes(template: string): Array<{line: number; message: string}> {
    const errors: Array<{line: number; message: string}> = []
    const tagRegex = /<(\w[\w-]*)([^>]*?)\/?>/g
    let match: RegExpExecArray | null

    while ((match = tagRegex.exec(template)) !== null) {
      const tagName = match[1]!.toLowerCase()
      const attrsStr = match[2] ?? ``
      const tagDisplay = match[0]!.endsWith(`/>`) ? `<${tagName}/>` : `<${tagName}>`

      const allowed = this._TELEGRAM_ALLOWED_ATTRS[tagName]
      if (!allowed) continue // not a Telegram rich tag — g-* blocks handled elsewhere

      // Extract attribute names: `name="v"`, `name='v'`, `name=v`, boolean `name`,
      // and `{{placeholder}}` used as a full attribute name.
      const attrNames: string[] = []
      const attrRegex = /([\w-]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?|\{\{\s*[\w-]+\s*\}\}(?:\s*=\s*[^\s>]+)?/g
      let am: RegExpExecArray | null
      while ((am = attrRegex.exec(attrsStr)) !== null) {
        // Group 1 = literal name; otherwise the whole match is a {{placeholder}} name
        attrNames.push(am[1] ?? am[0])
      }

      if (attrNames.length === 0) continue

      const allowedSet = new Set(allowed)
      const unknown = attrNames.filter((name) => !allowedSet.has(name))
      if (unknown.length === 0) continue

      const line = (template.slice(0, match.index).match(/\n/g) || []).length + 1
      const message = allowed.length === 0 ? `${tagDisplay} does not support any attributes` : `${tagDisplay} has unknown attribute(s): ${unknown.join(`, `)} (allowed: ${allowed.join(`, `)})`
      errors.push({line, message})
    }

    return errors
  }

  /**
   * Validates that Telegram Rich HTML tags carry only their allowed attributes.
   *
   * @remarks
   * Runs after {@link TemplateEngine.validateTelegramAttributeValuesBlock} as a
   * dedicated unknown-attribute pass. Rejects attribute names outside the
   * per-tag allowlist {@link TemplateEngine._TELEGRAM_ALLOWED_ATTRS} — including
   * `{{placeholder}}` used as a name, and ANY attribute on no-attribute tags.
   * `<g-*>` PAGE blocks are unaffected (validated by `validateBlockG*Attributes`).
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateTelegramUnknownAttributesBlock(`<table ngasal="x"></table>`);
   * // Result: { valid: false, errors: [{ line: 1, message: '<table> has unknown attribute(s): ngasal (allowed: bordered, striped)' }] }
   * ```
   *
   * @public
   */
  static validateTelegramUnknownAttributesBlock(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateTelegramTagUnknownAttributes(template)
    return {valid: errors.length === 0, errors}
  }

  /**
   * Scans a template for Telegram Rich HTML tags whose attribute values fail format checks.
   *
   * @remarks
   * For every tag in {@link TemplateEngine._TELEGRAM_ATTR_VALUE_VALIDATORS},
   * each present attribute is extracted and run through its validator. Boolean
   * attributes (without `=value`) are skipped. Only attributes with value
   * declarations are checked. Missing required attributes are NOT reported here
   * — that is {@link TemplateEngine._validateTelegramTagAttributes}'s job.
   *
   * @param template - The raw template string to scan
   * @returns Array of `{line, message}` errors (empty if all values are valid)
   *
   * @example
   * ```typescript
   * const errors = TemplateEngine._validateTelegramTagAttributeValues(`
   *   <tg-time unix="abc" format="wDT">x</tg-time>
   *   <a href="javascript:alert(1)">x</a>
   * `);
   * // => [
   * //   {line: 2, message: '<tg-time> unix must be a positive integer (got "abc")'},
   * //   {line: 3, message: '<a> href must use http(s)://, mailto:, tel:, tg://, or # scheme (got "javascript:alert(1)")'}
   * // ]
   * ```
   *
   * @public
   */
  static _validateTelegramTagAttributeValues(template: string): Array<{line: number; message: string}> {
    const errors: Array<{line: number; message: string}> = []
    const tagRegex = /<(\w[\w-]*)([^>]*?)\/?>/g
    let match: RegExpExecArray | null

    while ((match = tagRegex.exec(template)) !== null) {
      const tagName = match[1]!.toLowerCase()
      const attrsStr = match[2] ?? ``
      const tagDisplay = match[0]!.endsWith(`/>`) ? `<${tagName}/>` : `<${tagName}>`

      const validators = this._TELEGRAM_ATTR_VALUE_VALIDATORS[tagName]
      if (!validators) continue

      // Extract `name="value"` / `name='value'` / `name=value` pairs
      const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g
      let am: RegExpExecArray | null
      while ((am = attrRegex.exec(attrsStr)) !== null) {
        const attrName = am[1]!.toLowerCase()
        const attrValue = am[2] ?? am[3] ?? am[4] ?? ``
        if (/\{\{|\}\}/.test(attrValue)) continue
        const validator = validators[attrName]
        if (!validator) continue

        const error = validator(attrValue)
        if (error) {
          const line = (template.slice(0, match.index).match(/\n/g) || []).length + 1
          errors.push({line, message: `${tagDisplay} ${error}`})
        }
      }
    }

    return errors
  }

  /**
   * Validates that Telegram Rich HTML tag attribute values match their expected formats.
   *
   * @remarks
   * Runs after {@link TemplateEngine.validateTelegramAttributesBlock} (which checks
   * presence) to catch format-level issues. Validates:
   * - `<tg-time unix>` must be a positive integer; `<tg-time format>` must be non-empty
   * - `<tg-map lat>` ∈ [-90, 90], `<tg-map long>` ∈ [-180, 180], `<tg-map zoom>` ∈ [0, 24]
   * - `<tg-emoji emoji-id>` must be a numeric string
   * - `<a href>` must use http(s)://, mailto:, tel:, tg://, or # scheme
   * - `<input type>` must be a known HTML input type
   *
   * Tags without value validators (e.g. `<b>`, `<p>`, `<table>`) are skipped.
   * See {@link TemplateEngine._TELEGRAM_ATTR_VALUE_VALIDATORS} for the full spec.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateTelegramAttributeValuesBlock(`
   *   <g-base>
   *     <g-message><tg-time unix="1647531900" format="wDT">22:45</tg-time></g-message>
   *   </g-base>
   * `);
   * // Result: { valid: true, errors: [] }
   *
   * const bad = TemplateEngine.validateTelegramAttributeValuesBlock(`
   *   <g-base>
   *     <g-message><tg-time unix="abc" format="wDT">x</tg-time></g-message>
   *   </g-base>
   * `);
   * // Result: { valid: false, errors: [{ line: 3, message: '<tg-time> unix must be a positive integer (got "abc")' }] }
   * ```
   *
   * @public
   */
  static validateTelegramAttributeValuesBlock(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateTelegramTagAttributeValues(template)
    return {valid: errors.length === 0, errors}
  }

  /**
   * Scans a template for `<g-*>` PAGE blocks that are missing required attributes.
   *
   * @remarks
   * Iterates every opening tag in the template and, for any tag listed in
   * {@link TemplateEngine._PAGE_REQUIRED_ATTRS}, checks that the required
   * attribute set is fully present. Both value attributes (`href="..."`) and
   * boolean attributes (`checked`, `reversed`, `open`) are recognized.
   *
   * For tags with `oneOf` spec, at least one of the listed sets must be
   * fully present. Returns one error per offending tag with the 1-based
   * line number.
   *
   * @param template - The raw template string to scan
   * @returns Array of `{line, message}` errors (empty if all required attrs are present)
   *
   * @example
   * ```typescript
   * const errors = TemplateEngine._validatePageTagAttributes(`<g-base id=""></g-base>`);
   * // => [{line: 1, message: "<g-base> is missing required attribute(s): id"}]  (if id is in spec)
   * ```
   *
   * @public
   */
  static _validatePageTagAttributes(template: string): Array<{line: number; message: string}> {
    const errors: Array<{line: number; message: string}> = []
    const tagRegex = /<(\w[\w-]*)([^>]*?)\/?>/g
    let match: RegExpExecArray | null

    while ((match = tagRegex.exec(template)) !== null) {
      const tagName = match[1]!.toLowerCase()
      const attrsStr = match[2] ?? ``
      const tagDisplay = match[0]!.endsWith(`/>`) ? `<${tagName}/>` : `<${tagName}>`

      const spec = this._PAGE_REQUIRED_ATTRS[tagName]
      if (!spec) continue

      // Extract attribute names: both `name="value"` and boolean `name`
      const attrNames = new Set<string>()
      const attrRegex = /([\w-]+)(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?/g
      let am: RegExpExecArray | null
      while ((am = attrRegex.exec(attrsStr)) !== null) {
        attrNames.add(am[1]!.toLowerCase())
      }

      const line = (template.slice(0, match.index).match(/\n/g) || []).length + 1

      if (Array.isArray(spec)) {
        const missing = spec.filter((a) => !attrNames.has(a))
        if (missing.length > 0) {
          errors.push({line, message: `${tagDisplay} is missing required attribute(s): ${missing.join(`, `)}`})
        }
      } else {
        const matched = spec.oneOf.find((set) => set.every((a) => attrNames.has(a)))
        if (!matched) {
          const alternatives = spec.oneOf.map((set) => set.join(` + `)).join(` | `)
          errors.push({line, message: `${tagDisplay} must have one of: ${alternatives}`})
        }
      }
    }

    return errors
  }

  /**
   * Validates that `<g-*>` PAGE blocks in the template carry their required attributes.
   *
   * @remarks
   * PAGE block attributes are mostly optional, so {@link TemplateEngine._PAGE_REQUIRED_ATTRS}
   * is currently empty. This method exists to mirror the Telegram validation pattern
   * (`validateTelegramAttributesBlock`) and is reserved for future use — e.g. context-dependent
   * requirements that may be added as the framework evolves.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validatePageAttributesBlock(`<g-base id="main"></g-base>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validatePageAttributesBlock(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validatePageTagAttributes(template)
    return {valid: errors.length === 0, errors}
  }

  /**
   * Scans a template for `<g-*>` PAGE blocks whose attribute values fail format checks.
   *
   * @remarks
   * For every tag in {@link TemplateEngine._PAGE_ATTR_VALUE_VALIDATORS}, each
   * present attribute is extracted and run through its validator. Boolean
   * attributes (without `=value`) are skipped. Only attributes with value
   * declarations are checked. Missing required attributes are NOT reported
   * here — that is {@link TemplateEngine._validatePageTagAttributes}'s job.
   *
   * @param template - The raw template string to scan
   * @returns Array of `{line, message}` errors (empty if all values are valid)
   *
   * @example
   * ```typescript
   * const errors = TemplateEngine._validatePageTagAttributeValues(`
   *   <g-keyboard type="sidebar">A, B</g-keyboard>
   *   <g-media type="unknown" src="x.jpg"/>
   * `);
   * // => [
   * //   {line: 2, message: 'Attribute "type" on <g-keyboard> must be "inline" or "bottom", got "sidebar"'},
   * //   {line: 3, message: 'Attribute "type" on <g-media> must be one of: photo, video, ..., got "unknown"'}
   * // ]
   * ```
   *
   * @public
   */
  static _validatePageTagAttributeValues(template: string): Array<{line: number; message: string}> {
    const errors: Array<{line: number; message: string}> = []
    const tagRegex = /<(\w[\w-]*)([^>]*?)\/?>/g
    let match: RegExpExecArray | null

    while ((match = tagRegex.exec(template)) !== null) {
      const tagName = match[1]!.toLowerCase()
      const attrsStr = match[2] ?? ``

      const validators = this._PAGE_ATTR_VALUE_VALIDATORS[tagName]
      if (!validators) continue

      // Extract `name="value"` / `name='value'` / `name=value` pairs
      const attrRegex = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g
      let am: RegExpExecArray | null
      while ((am = attrRegex.exec(attrsStr)) !== null) {
        const attrName = am[1]!.toLowerCase()
        const attrValue = am[2] ?? am[3] ?? am[4] ?? ``
        if (/\{\{|\}\}/.test(attrValue)) continue
        const validator = validators[attrName]
        if (!validator) continue

        const error = validator(attrValue)
        if (error) {
          const line = (template.slice(0, match.index).match(/\n/g) || []).length + 1
          errors.push({line, message: error})
        }
      }
    }

    return errors
  }

  /**
   * Validates that `<g-*>` PAGE block attribute values match their expected formats.
   *
   * @remarks
   * Runs after `TemplateEngine.validateBlockG*Attributes` (which check
   * allowed attrs) to catch format-level issues. Currently validates:
   * - `<g-base id>` — must not be empty
   * - `<g-keyboard type>` — must be `inline` or `bottom`
   * - `<g-media type>` — must be one of: photo, video, audio, document, animation, voice, video_note, sticker, location, contact
   * - `<g-media shared>` — must be `true` or `false`
   * - `<g-media filename>` — any string, always valid
   * - `<g-poll type>` — must be `regular` or `quiz`
   * - `<g-poll correct>` — must be a non-negative option index
   * - `<g-poll explanation>` — any string, always valid
   * - `<g-poll anonymous>` / `<g-poll multiple>` — must be `true` or `false`
   * - `<g-venue title>` / `<g-venue address>` — any string, always valid
   * - `<g-venue latitude>` — must be a number between -90 and 90; `{{}}` values skip the static check (runtime-enforced)
   * - `<g-venue longitude>` — must be a number between -180 and 180; `{{}}` values skip the static check (runtime-enforced)
   * - `<g-dice emoji>` — must be one of 🎲🎯🏀⚽🎳🎰; `{{}}` values skip the static check (runtime-enforced)
   * - `<g-invoice currency>` — must be a 3-letter code (`XTR` or fiat); `{{}}` values skip the static check (runtime-enforced)
   * - `<g-price amount>` — must be a positive integer in smallest currency units
   * - `<g-paid-media stars>` — must be a positive integer 1–25000; `{{}}` values skip the static check (runtime-enforced)
   *
   * Tags without value validators (e.g. `<g-message>`, `<g-script>`, `<g-div>`) are
   * skipped. See {@link TemplateEngine._PAGE_ATTR_VALUE_VALIDATORS} for the full spec.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validatePageAttributeValuesBlock(`
   *   <g-base>
   *     <g-keyboard type="inline">A, B</g-keyboard>
   *   </g-base>
   * `);
   * // Result: { valid: true, errors: [] }
   *
   * const bad = TemplateEngine.validatePageAttributeValuesBlock(`
   *   <g-base>
   *     <g-keyboard type="sidebar">A, B</g-keyboard>
   *   </g-base>
   * `);
   * // Result: { valid: false, errors: [{ line: 3, message: 'Attribute "type" on <g-keyboard> must be "inline" or "bottom", got "sidebar"' }] }
   * ```
   *
   * @public
   */
  static validatePageAttributeValuesBlock(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validatePageTagAttributeValues(template)
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<g-base>` blocks.
   *
   * @remarks
   * The only allowed attribute is `id`.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockGBaseAttributes(`<g-base id="main"></g-base>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockGBaseAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-base`, new Set([`id`]), `"id"`, this._PAGE_ATTR_VALUE_VALIDATORS[`g-base`])
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<g-message>` blocks.
   *
   * @remarks
   * The only allowed attribute is `lang`.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockGMessageAttributes(`<g-message lang="en">Hi</g-message>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockGMessageAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-message`, new Set([`lang`]), `"lang"`, this._PAGE_ATTR_VALUE_VALIDATORS[`g-message`])
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<g-keyboard>` blocks.
   *
   * @remarks
   * Allowed attributes are `lang` and `type`.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockGKeyboardAttributes(`<g-keyboard type="bottom">A, B</g-keyboard>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockGKeyboardAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-keyboard`, new Set([`lang`, `type`]), `"lang" and "type"`, this._PAGE_ATTR_VALUE_VALIDATORS[`g-keyboard`])
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<g-media>` blocks.
   *
   * @remarks
   * Allowed attributes are `lang`, `type`, `src`, `shared`, `filename`, `latitude`, `longitude`,
   * `live`, `phone`, `first_name`, `last_name`, and `vcard`.
   *
   * `shared` is a boolean attribute — it can be written as `shared`, `shared="true"`,
   * or `shared="false"`. When `true`, the media item is included in all language
   * variants of the enclosing `<g-media-group>`. Only valid inside `<g-media-group>`.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockGMediaAttributes(`<g-media type="photo" src="img.jpg">Caption</g-media>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockGMediaAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(
      template,
      `g-media`,
      new Set([`lang`, `type`, `src`, `shared`, `filename`, `latitude`, `longitude`, `live`, `phone`, `first_name`, `last_name`, `vcard`]),
      `"lang", "type", "src", "shared", "filename", "latitude", "longitude", "live", "phone", "first_name", "last_name", and "vcard"`,
      this._PAGE_ATTR_VALUE_VALIDATORS[`g-media`]
    )
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes and item constraints on `<g-media-group>` blocks.
   *
   * @remarks
   * Step 12 of the `validateTemplate` pipeline. Checks the block-level
   * `lang` attribute via `_validateBlockAttributes`, then delegates item
   * rules (supported `type`, required `src`, 1–10 items, no `audio`/
   * `document` mixing) to {@link TemplateEngine._validateMediaGroupItems}.
   * Returns `valid: false` with per-line errors instead of throwing, so
   * callers can aggregate across blocks.
   *
   * @param template - The raw template source to validate.
   * @returns `{valid, errors}`; `errors` carry 1-based line numbers.
   * @public
   */
  static validateBlockGMediaGroupAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-media-group`, new Set([`lang`]), `"lang"`, this._PAGE_ATTR_VALUE_VALIDATORS[`g-media-group`])
    errors.push(...this._validateMediaGroupItems(template))
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes and item constraints on `<g-poll>` blocks.
   *
   * @remarks
   * Checks the block-level attributes (`lang`, `type`, `correct`,
   * `explanation`, `anonymous`, `multiple`) via `_validateBlockAttributes`,
   * then delegates structural rules (exactly one `<g-question>`, 2–10
   * `<g-option>` items, `correct` required and in range for quiz but
   * rejected on regular, `multiple`/`explanation` quiz/regular coherence,
   * static Bot API length limits where no `{{}}` interpolation is present)
   * to {@link TemplateEngine._validatePollItems}. Returns `valid: false`
   * with per-line errors instead of throwing, so callers can aggregate
   * across blocks.
   *
   * @param template - The raw template source to validate.
   * @returns `{valid, errors}`; `errors` carry 1-based line numbers.
   * @public
   */
  static validateBlockGPollAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-poll`, new Set([`lang`, `type`, `correct`, `explanation`, `anonymous`, `multiple`]), `"lang", "type", "correct", "explanation", "anonymous", and "multiple"`, this._PAGE_ATTR_VALUE_VALIDATORS[`g-poll`])
    errors.push(...this._validatePollItems(template))
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates `<g-question>` / `<g-option>` items inside `<g-poll>` blocks.
   *
   * @remarks
   * Enforces the Telegram `sendPoll` constraints: exactly one
   * `<g-question>`, 2–10 `<g-option>` items, quiz-only `correct` (required,
   * numeric, within the option range) and `explanation` (at most 200
   * chars), regular-only `multiple`. Static length limits (question 1–300
   * chars, each option 1–100 chars) apply only when the text carries no
   * `{{}}` / `{~ ~}` interpolation — dynamic lengths are checked at
   * runtime on the compiled strings. Called by
   * {@link TemplateEngine.validateBlockGPollAttributes}; errors carry
   * 1-based line numbers.
   *
   * @param template - The raw template source to inspect.
   * @returns Validation errors (empty when valid).
   * @public
   */
  static _validatePollItems(template: string): Array<{line: number; message: string}> {
    const errors: Array<{line: number; message: string}> = []
    const pollRegex = /<g-poll(?:\s+([^>]*))?>([\s\S]*?)<\/g-poll>/gi
    const attrValue = (attrsStr: string, name: string): string | undefined => {
      const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`).exec(attrsStr)
      if (!m) return undefined
      return m[1] ?? m[2] ?? m[3]
    }
    const isDynamic = (s: string): boolean => s.includes(`{{`) || s.includes(`{~`)

    for (const pollMatch of template.matchAll(pollRegex)) {
      const line = (template.slice(0, pollMatch.index).match(/\n/g) || []).length + 1
      const attrsStr = pollMatch[1] ?? ``
      const body = pollMatch[2] ?? ``
      const type = attrValue(attrsStr, `type`) || `regular`
      const correct = attrValue(attrsStr, `correct`)
      const explanation = attrValue(attrsStr, `explanation`)
      const multiple = attrValue(attrsStr, `multiple`)
      const questionCount = (body.match(/<g-question(?![\w-])[^>]*>/gi) || []).length
      const optionMatches = [...body.matchAll(/<g-option(?![\w-])[^>]*>([\s\S]*?)<\/g-option>/gi)]
      const questionText = /<g-question(?![\w-])[^>]*>([\s\S]*?)<\/g-question>/i.exec(body)?.[1]?.trim() ?? ``

      if (questionCount !== 1) {
        errors.push({line, message: `<g-poll> must contain exactly one <g-question> (got ${questionCount})`})
      }
      if (optionMatches.length < 2 || optionMatches.length > 10) {
        errors.push({line, message: `<g-poll> must contain 2-10 <g-option> blocks (got ${optionMatches.length})`})
      }
      if (type === `quiz`) {
        if (correct === undefined) {
          errors.push({line, message: `Attribute "correct" on <g-poll type="quiz"> is required`})
        } else if (!/^\d+$/.test(correct) || Number(correct) >= optionMatches.length) {
          errors.push({line, message: `Attribute "correct" on <g-poll> must be an option index 0-${optionMatches.length - 1} (got "${correct}")`})
        }
        if (multiple !== undefined) {
          errors.push({line, message: `Attribute "multiple" on <g-poll> is only allowed for type="regular"`})
        }
      } else {
        if (correct !== undefined) {
          errors.push({line, message: `Attribute "correct" on <g-poll> is only allowed for type="quiz"`})
        }
        if (explanation !== undefined) {
          errors.push({line, message: `Attribute "explanation" on <g-poll> is only allowed for type="quiz"`})
        }
      }
      if (!isDynamic(questionText) && (questionText.length < 1 || questionText.length > 300)) {
        errors.push({line, message: `<g-question> must be 1-300 characters (got ${questionText.length})`})
      }
      for (const optMatch of optionMatches) {
        const text = (optMatch[1] ?? ``).trim()
        if (!isDynamic(text) && (text.length < 1 || text.length > 100)) {
          errors.push({line, message: `<g-option> must be 1-100 characters (got ${text.length})`})
        }
      }
      if (explanation !== undefined && !isDynamic(explanation) && explanation.length > 200) {
        errors.push({line, message: `Attribute "explanation" on <g-poll> must be at most 200 characters (got ${explanation.length})`})
      }
    }

    return errors
  }

  /**
   * Validates attributes and presence rules on `<g-venue>` blocks.
   *
   * @remarks
   * Checks the block-level attributes (`lang`, `title`, `address`,
   * `latitude`, `longitude`) via `_validateBlockAttributes`, then
   * delegates presence rules (all four venue fields required and
   * non-empty; static latitude/longitude numeric within the Bot API
   * ranges) to {@link TemplateEngine._validateVenueItems}. `{{}}` /
   * `{~ ~}` values skip the static numeric check — dynamic coordinates
   * are range-checked at runtime on the compiled strings. Returns
   * `valid: false` with per-line errors instead of throwing, so callers
   * can aggregate across blocks.
   *
   * @param template - The raw template source to validate.
   * @returns `{valid, errors}`; `errors` carry 1-based line numbers.
   * @public
   */
  static validateBlockGVenueAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-venue`, new Set([`lang`, `title`, `address`, `latitude`, `longitude`]), `"lang", "title", "address", "latitude", and "longitude"`, this._PAGE_ATTR_VALUE_VALIDATORS[`g-venue`])
    errors.push(...this._validateVenueItems(template))
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates `<g-venue>` required attributes and static coordinates.
   *
   * @remarks
   * Enforces the Telegram `sendVenue` constraints: `title`, `address`,
   * `latitude`, and `longitude` must be present and non-empty. Static
   * coordinates (no `{{}}` / `{~ ~}` interpolation) must be finite
   * numbers within latitude -90–90 and longitude -180–180; dynamic
   * coordinates are checked at runtime on the compiled strings. Called
   * by {@link TemplateEngine.validateBlockGVenueAttributes}; errors
   * carry 1-based line numbers.
   *
   * @param template - The raw template source to inspect.
   * @returns Validation errors (empty when valid).
   * @public
   */
  static _validateVenueItems(template: string): Array<{line: number; message: string}> {
    const errors: Array<{line: number; message: string}> = []
    const venueRegex = /<g-venue\b([^>]*?)\/?>/gi
    const attrValue = (attrsStr: string, name: string): string | undefined => {
      const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`).exec(attrsStr)
      if (!m) return undefined
      return m[1] ?? m[2] ?? m[3]
    }
    const isDynamic = (s: string): boolean => s.includes(`{{`) || s.includes(`{~`)

    for (const venueMatch of template.matchAll(venueRegex)) {
      const line = (template.slice(0, venueMatch.index).match(/\n/g) || []).length + 1
      const attrsStr = venueMatch[1] ?? ``
      const title = attrValue(attrsStr, `title`)
      const address = attrValue(attrsStr, `address`)
      const latitude = attrValue(attrsStr, `latitude`)
      const longitude = attrValue(attrsStr, `longitude`)

      if (title === undefined || title === ``) {
        errors.push({line, message: `Attribute "title" on <g-venue> is required`})
      }
      if (address === undefined || address === ``) {
        errors.push({line, message: `Attribute "address" on <g-venue> is required`})
      }
      if (latitude === undefined || latitude === ``) {
        errors.push({line, message: `Attribute "latitude" on <g-venue> is required`})
      } else if (!isDynamic(latitude)) {
        const n = Number(latitude)
        if (latitude.trim() === `` || !Number.isFinite(n) || n < -90 || n > 90) {
          errors.push({line, message: `Attribute "latitude" on <g-venue> must be a number between -90 and 90 (got "${latitude}")`})
        }
      }
      if (longitude === undefined || longitude === ``) {
        errors.push({line, message: `Attribute "longitude" on <g-venue> is required`})
      } else if (!isDynamic(longitude)) {
        const n = Number(longitude)
        if (longitude.trim() === `` || !Number.isFinite(n) || n < -180 || n > 180) {
          errors.push({line, message: `Attribute "longitude" on <g-venue> must be a number between -180 and 180 (got "${longitude}")`})
        }
      }
    }

    return errors
  }

  /**
   * Validates attributes and the static emoji rule on `<g-dice>` blocks.
   *
   * @remarks
   * Checks the block-level attributes (`lang`, `emoji`) via
   * `_validateBlockAttributes`, then delegates the static emoji
   * membership rule to {@link TemplateEngine._validateDiceItems}.
   * `emoji` is optional (defaults to `🎲`); static values must be one of
   * the six Bot API dice emoji, while `{{}}` / `{~ ~}` values skip the
   * static check — dynamic emoji are checked at runtime on the compiled
   * strings. Returns `valid: false` with per-line errors instead of
   * throwing, so callers can aggregate across blocks.
   *
   * @param template - The raw template source to validate.
   * @returns `{valid, errors}`; `errors` carry 1-based line numbers.
   * @public
   */
  static validateBlockGDiceAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-dice`, new Set([`lang`, `emoji`]), `"lang" and "emoji"`, this._PAGE_ATTR_VALUE_VALIDATORS[`g-dice`])
    errors.push(...this._validateDiceItems(template))
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates the static `<g-dice>` emoji against the Bot API set.
   *
   * @remarks
   * Static `emoji` values (no `{{}}` / `{~ ~}` interpolation) must be one
   * of the six Bot API dice emoji (`🎲🎯🏀⚽🎳🎰` per
   * {@link TemplateEngine.DICE_EMOJI}); dynamic emoji are checked at
   * runtime on the compiled strings. Called by
   * {@link TemplateEngine.validateBlockGDiceAttributes}; errors carry
   * 1-based line numbers.
   *
   * @param template - The raw template source to inspect.
   * @returns Validation errors (empty when valid).
   * @public
   */
  static _validateDiceItems(template: string): Array<{line: number; message: string}> {
    const errors: Array<{line: number; message: string}> = []
    const diceRegex = /<g-dice\b([^>]*?)\/?>/gi
    const attrValue = (attrsStr: string, name: string): string | undefined => {
      const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`).exec(attrsStr)
      if (!m) return undefined
      return m[1] ?? m[2] ?? m[3]
    }
    const isDynamic = (s: string): boolean => s.includes(`{{`) || s.includes(`{~`)

    for (const diceMatch of template.matchAll(diceRegex)) {
      const line = (template.slice(0, diceMatch.index).match(/\n/g) || []).length + 1
      const emoji = attrValue(diceMatch[1] ?? ``, `emoji`)
      if (emoji !== undefined && emoji !== `` && !isDynamic(emoji) && !this.DICE_EMOJI.has(emoji)) {
        errors.push({line, message: `Attribute "emoji" on <g-dice> must be one of 🎲🎯🏀⚽🎳🎰 (got "${emoji}")`})
      }
    }

    return errors
  }

  /**
   * Validates `<g-media>` items inside `<g-media-group>` blocks.
   *
   * @remarks
   * Enforces the Telegram `sendMediaGroup` constraints: every item needs a
   * supported `type` (`photo`, `video`, `audio`, `document`) and a `src`;
   * groups need 1–{@link TemplateEngine.MAX_MEDIA_GROUP_ITEMS} items;
   * `audio` and `document` items cannot mix with other types. Called by
   * {@link TemplateEngine.validateBlockGMediaGroupAttributes}; errors carry
   * 1-based line numbers.
   *
   * @param template - The raw template source to inspect.
   * @returns Validation errors (empty when valid).
   * @public
   */
  static _validateMediaGroupItems(template: string): Array<{line: number; message: string}> {
    const errors: Array<{line: number; message: string}> = []
    const mediaGroupRegex = /<g-media-group(?:\s+[^>]*)?>([\s\S]*?)<\/g-media-group>/gi
    const mediaRegex = /<g-media(?:\s+([^>]*))?>([\s\S]*?)<\/g-media>/gi
    const supportedTypes = new Set([`photo`, `video`, `audio`, `document`])

    for (const groupMatch of template.matchAll(mediaGroupRegex)) {
      const groupLine = (template.slice(0, groupMatch.index).match(/\n/g) || []).length + 1
      const groupContent = groupMatch[1] || ``
      const itemTypes: string[] = []
      let itemCount = 0

      for (const mediaMatch of groupContent.matchAll(mediaRegex)) {
        itemCount += 1
        const line = groupLine + (groupContent.slice(0, mediaMatch.index).match(/\n/g) || []).length
        const attrsStr = mediaMatch[1] || ``
        const type = attrsStr
          .match(/\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/)
          ?.slice(1, 4)
          .find((g) => g !== undefined)
        const src = attrsStr
          .match(/\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/)
          ?.slice(1, 4)
          .find((g) => g !== undefined)

        if (!type || !supportedTypes.has(type)) {
          errors.push({line, message: `Attribute "type" on <g-media> inside <g-media-group> must be one of: photo, video, audio, document`})
          continue
        }
        if (!src) {
          errors.push({line, message: `Attribute "src" on <g-media> inside <g-media-group> is required`})
        }
        itemTypes.push(type)
      }

      if (itemCount === 0) {
        errors.push({line: groupLine, message: `<g-media-group> must contain at least one <g-media> item`})
      }
      if (itemCount > this.MAX_MEDIA_GROUP_ITEMS) {
        errors.push({line: groupLine, message: `<g-media-group> must contain at most ${this.MAX_MEDIA_GROUP_ITEMS} <g-media> items`})
      }
      const uniqueTypes = new Set(itemTypes)
      if (uniqueTypes.has(`audio`) && uniqueTypes.size > 1) {
        errors.push({line: groupLine, message: `<g-media-group> with audio items can only contain audio items`})
      }
      if (uniqueTypes.has(`document`) && uniqueTypes.size > 1) {
        errors.push({line: groupLine, message: `<g-media-group> with document items can only contain document items`})
      }
    }

    return errors
  }

  /**
   * Validates attributes and item constraints on `<g-invoice>` blocks.
   *
   * @remarks
   * Checks the block-level attributes (`lang`, `title`, `description`,
   * `payload`, `currency`) via `_validateBlockAttributes`, then delegates
   * structural rules (required attrs, `provider_token` rejection, 1 or more
   * `<g-price>` items, static Bot API length limits where no `{{}}`
   * interpolation is present) to {@link TemplateEngine._validateInvoiceItems}.
   * `provider_token` is listed in the allowed set only so the dedicated
   * secrets error (not a generic unknown-attribute error) is reported.
   * Returns `valid: false` with per-line errors instead of throwing, so
   * callers can aggregate across blocks.
   *
   * @param template - The raw template source to validate.
   * @returns `{valid, errors}`; `errors` carry 1-based line numbers.
   * @public
   */
  static validateBlockGInvoiceAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-invoice`, new Set([`lang`, `title`, `description`, `payload`, `currency`, `provider_token`]), `"lang", "title", "description", "payload", and "currency"`, this._PAGE_ATTR_VALUE_VALIDATORS[`g-invoice`])
    errors.push(...this._validateInvoiceItems(template))
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<g-price>` line items inside `<g-invoice>` blocks.
   *
   * @remarks
   * Allowed attributes are `label` and `amount`; value formats come from
   * {@link TemplateEngine._PAGE_ATTR_VALUE_VALIDATORS} (`amount` must be a
   * positive integer in smallest currency units). Presence and static
   * length rules live in {@link TemplateEngine._validateInvoiceItems}.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockGPriceAttributes(`<g-price label="VIP" amount="100"/>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockGPriceAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-price`, new Set([`label`, `amount`]), `"label" and "amount"`, this._PAGE_ATTR_VALUE_VALIDATORS[`g-price`])
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates `<g-invoice>` required attributes, secrets ban, and `<g-price>` items.
   *
   * @remarks
   * Enforces the Telegram `sendInvoice` constraints: `title`, `description`,
   * `payload`, and `currency` must be present and non-empty; `provider_token`
   * is forbidden (secrets must come from `renderInvoice` options, never
   * templates); at least one `<g-price>` with a non-empty `label` and a
   * positive integer `amount` is required; `currency` must be a 3-letter
   * code. Static length limits (title 1–32 chars, description 1–255 chars,
   * payload 1–128 bytes per the Bot API) apply only when the value carries
   * no `{{}}` / `{~ ~}` interpolation — dynamic lengths are checked at
   * runtime on the compiled strings. Called by
   * {@link TemplateEngine.validateBlockGInvoiceAttributes}; errors carry
   * 1-based line numbers.
   *
   * @param template - The raw template source to inspect.
   * @returns Validation errors (empty when valid).
   * @public
   */
  static _validateInvoiceItems(template: string): Array<{line: number; message: string}> {
    const errors: Array<{line: number; message: string}> = []
    const invoiceRegex = /<g-invoice(?:\s+([^>]*))?>([\s\S]*?)<\/g-invoice>/gi
    const attrValue = (attrsStr: string, name: string): string | undefined => {
      const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`).exec(attrsStr)
      if (!m) return undefined
      return m[1] ?? m[2] ?? m[3]
    }
    const isDynamic = (s: string): boolean => s.includes(`{{`) || s.includes(`{~`)

    for (const invoiceMatch of template.matchAll(invoiceRegex)) {
      const line = (template.slice(0, invoiceMatch.index).match(/\n/g) || []).length + 1
      const attrsStr = invoiceMatch[1] ?? ``
      const body = invoiceMatch[2] ?? ``
      const title = attrValue(attrsStr, `title`)
      const description = attrValue(attrsStr, `description`)
      const payload = attrValue(attrsStr, `payload`)
      const currency = attrValue(attrsStr, `currency`)
      const priceMatches = [...body.matchAll(/<g-price(?![\w-])([^>]*?)\/?>/gi)]

      if (title === undefined || title === ``) {
        errors.push({line, message: `Attribute "title" on <g-invoice> is required`})
      }
      if (description === undefined || description === ``) {
        errors.push({line, message: `Attribute "description" on <g-invoice> is required`})
      }
      if (payload === undefined || payload === ``) {
        errors.push({line, message: `Attribute "payload" on <g-invoice> is required`})
      }
      if (currency === undefined || currency === ``) {
        errors.push({line, message: `Attribute "currency" on <g-invoice> is required`})
      } else if (!isDynamic(currency) && !/^[A-Z]{3}$/.test(currency)) {
        errors.push({line, message: `Attribute "currency" on <g-invoice> must be a 3-letter code (got "${currency}")`})
      }
      if (/\bprovider_token\s*=/.test(attrsStr)) {
        errors.push({line, message: `Attribute "provider_token" on <g-invoice> is forbidden: secrets must come from options, never templates`})
      }
      if (priceMatches.length < 1) {
        errors.push({line, message: `<g-invoice> must contain at least one <g-price> block (got ${priceMatches.length})`})
      }
      for (const priceMatch of priceMatches) {
        const priceAttrs = priceMatch[1] ?? ``
        const label = attrValue(priceAttrs, `label`)
        const amount = attrValue(priceAttrs, `amount`)
        if (label === undefined || label === ``) {
          errors.push({line, message: `Attribute "label" on <g-price> is required`})
        }
        if (amount === undefined || amount === ``) {
          errors.push({line, message: `Attribute "amount" on <g-price> is required`})
        } else if (!/^[1-9]\d*$/.test(amount)) {
          errors.push({line, message: `Attribute "amount" on <g-price> must be a positive integer in smallest units (got "${amount}")`})
        }
      }
      if (title !== undefined && title !== `` && !isDynamic(title) && (title.length < 1 || title.length > 32)) {
        errors.push({line, message: `<g-invoice> "title" must be 1-32 characters (got ${title.length})`})
      }
      if (description !== undefined && description !== `` && !isDynamic(description) && (description.length < 1 || description.length > 255)) {
        errors.push({line, message: `<g-invoice> "description" must be 1-255 characters (got ${description.length})`})
      }
      if (payload !== undefined && payload !== `` && !isDynamic(payload) && (payload.length < 1 || Buffer.byteLength(payload, `utf8`) > 128)) {
        errors.push({line, message: `<g-invoice> "payload" must be 1-128 bytes (got ${Buffer.byteLength(payload, `utf8`)})`})
      }
    }

    return errors
  }

  /**
   * Validates attributes and item constraints on `<g-paid-media>` blocks.
   *
   * @remarks
   * Checks the block-level attributes (`lang`, `stars`) via
   * `_validateBlockAttributes`, then delegates structural rules (required
   * `stars` in the 1–25000 range, 1–10 `<g-media>` items of type
   * `photo`/`video` only, each with a `src`) to
   * {@link TemplateEngine._validatePaidMediaItems}. Returns `valid: false`
   * with per-line errors instead of throwing, so callers can aggregate
   * across blocks.
   *
   * @param template - The raw template source to validate.
   * @returns `{valid, errors}`; `errors` carry 1-based line numbers.
   * @public
   */
  static validateBlockGPaidMediaAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-paid-media`, new Set([`lang`, `stars`]), `"lang" and "stars"`, this._PAGE_ATTR_VALUE_VALIDATORS[`g-paid-media`])
    errors.push(...this._validatePaidMediaItems(template))
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates `<g-paid-media>` required attributes and `<g-media>` items.
   *
   * @remarks
   * Enforces the Telegram `sendPaidMedia` constraints: `stars` must be
   * present and a positive integer within 1–`MAX_PAID_MEDIA_STARS` (the
   * Bot API `star_count` range, 1–25000 per
   * `https://core.telegram.org/bots/api#sendpaidmedia`); the block must
   * hold 1–`MAX_PAID_MEDIA_ITEMS` `<g-media>` children, each typed
   * `photo` or `video` with a non-empty `src`. Static checks apply only
   * when the value carries no `{{}}` / `{~ ~}` interpolation — dynamic
   * values are checked at runtime on the compiled block. Called by
   * {@link TemplateEngine.validateBlockGPaidMediaAttributes}; errors carry
   * 1-based line numbers.
   *
   * @param template - The raw template source to inspect.
   * @returns Validation errors (empty when valid).
   * @public
   */
  static _validatePaidMediaItems(template: string): Array<{line: number; message: string}> {
    const errors: Array<{line: number; message: string}> = []
    const paidMediaRegex = /<g-paid-media(?:\s+([^>]*))?>([\s\S]*?)<\/g-paid-media>/gi
    const mediaRegex = /<g-media(?:\s+([^>]*))?>([\s\S]*?)<\/g-media>/gi
    const attrValue = (attrsStr: string, name: string): string | undefined => {
      const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`).exec(attrsStr)
      if (!m) return undefined
      return m[1] ?? m[2] ?? m[3]
    }
    const isDynamic = (s: string): boolean => s.includes(`{{`) || s.includes(`{~`)

    for (const paidMatch of template.matchAll(paidMediaRegex)) {
      const line = (template.slice(0, paidMatch.index).match(/\n/g) || []).length + 1
      const attrsStr = paidMatch[1] ?? ``
      const body = paidMatch[2] ?? ``
      const stars = attrValue(attrsStr, `stars`)
      const mediaMatches = [...body.matchAll(mediaRegex)]

      if (stars === undefined || stars === ``) {
        errors.push({line, message: `Attribute "stars" on <g-paid-media> is required`})
      } else if (!isDynamic(stars) && (!/^[1-9]\d*$/.test(stars) || Number(stars) > this.MAX_PAID_MEDIA_STARS)) {
        errors.push({line, message: `Attribute "stars" on <g-paid-media> must be a positive integer 1-${this.MAX_PAID_MEDIA_STARS} (got "${stars}")`})
      }
      if (mediaMatches.length < 1 || mediaMatches.length > this.MAX_PAID_MEDIA_ITEMS) {
        errors.push({line, message: `<g-paid-media> must contain 1-${this.MAX_PAID_MEDIA_ITEMS} <g-media> items (got ${mediaMatches.length})`})
      }
      for (const mediaMatch of mediaMatches) {
        const mediaAttrs = mediaMatch[1] ?? ``
        const mediaLine = line + (body.slice(0, mediaMatch.index).match(/\n/g) || []).length
        const type = attrValue(mediaAttrs, `type`)
        const src = attrValue(mediaAttrs, `src`)
        if (type === undefined || (!isDynamic(type) && type !== `photo` && type !== `video`)) {
          errors.push({line: mediaLine, message: `Attribute "type" on <g-media> inside <g-paid-media> must be "photo" or "video" (got "${type ?? ``}")`})
        }
        if (src === undefined || src === ``) {
          errors.push({line: mediaLine, message: `Attribute "src" on <g-media> inside <g-paid-media> is required`})
        }
      }
    }

    return errors
  }

  /**
   * Validates attributes on `<g-description>` blocks.
   *
   * @remarks
   * Allowed attributes are `lang` and `scope`.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockGDescriptionAttributes(`<g-description scope="chat_administrators">Admin cmd</g-description>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockGDescriptionAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-description`, new Set([`lang`, `scope`]), `"lang" and "scope"`, this._PAGE_ATTR_VALUE_VALIDATORS[`g-description`])
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates plain-text content of answer blocks.
   *
   * @remarks
   * Answer payloads (`<g-callback-answer>`, `<g-precheckout-error>`,
   * `<g-shipping-error>`) reach Telegram fields that accept no HTML
   * (toast text, `error_message`), so any static markup tag inside the
   * block body is rejected. `{{}}` / `{~ ~}` spans are stripped before
   * checking (runtime data is the caller's responsibility, mirroring the
   * `_validateDiceItems` static/dynamic split). When `maxLength` is set,
   * the stripped static length is capped (toast text at most 200 chars
   * per the Bot API `answerCallbackQuery` limits). Errors carry 1-based
   * line numbers.
   *
   * @param template - The raw template source to inspect.
   * @param tag - The block tag name without brackets (e.g. `g-callback-answer`).
   * @param maxLength - Optional static-length cap (or null to skip).
   * @returns Validation errors (empty when valid).
   * @public
   */
  static _validateAnswerTextContent(template: string, tag: string, maxLength?: number | null): Array<{line: number; message: string}> {
    const errors: Array<{line: number; message: string}> = []
    const blockRegex = new RegExp(`<${tag}(?:\\s+([^>]*))?>([\\s\\S]*?)<\\/${tag}>`, `gi`)

    for (const blockMatch of template.matchAll(blockRegex)) {
      const line = (template.slice(0, blockMatch.index).match(/\n/g) || []).length + 1
      const raw = blockMatch[2] ?? ``
      const stripped = raw.replace(/{{[\s\S]*?}}/g, ``).replace(/{~[\s\S]*?~}/g, ``)
      if (/<[a-zA-Z][^>]*>/.test(stripped)) {
        errors.push({line, message: `Content of <${tag}> must be plain text without HTML (toast and error_message accept no markup)`})
      }
      if (maxLength !== undefined && maxLength !== null && stripped.trim().length > maxLength) {
        errors.push({line, message: `Content of <${tag}> exceeds ${maxLength} character limit (got ${stripped.trim().length})`})
      }
    }

    return errors
  }

  /**
   * Validates attributes and content on `<g-callback-answer>` blocks.
   *
   * @remarks
   * Allowed attributes are `lang` only. Content must be plain text without
   * HTML and at most 200 chars of static text (Bot API toast limits);
   * `{{}}` spans skip the static checks (runtime-enforced).
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockGCallbackAnswerAttributes(`<g-base><g-callback-answer>OK</g-callback-answer></g-base>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockGCallbackAnswerAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-callback-answer`, new Set([`lang`]), `"lang"`, this._PAGE_ATTR_VALUE_VALIDATORS[`g-callback-answer`])
    errors.push(...this._validateAnswerTextContent(template, `g-callback-answer`, 200))
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes and content on `<g-precheckout-error>` blocks.
   *
   * @remarks
   * Allowed attributes are `lang` only. Content must be plain text without
   * HTML (`error_message` accepts no markup); `{{}}` spans skip the static
   * checks (runtime-enforced).
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockGPrecheckoutErrorAttributes(`<g-base><g-precheckout-error>Habis</g-precheckout-error></g-base>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockGPrecheckoutErrorAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-precheckout-error`, new Set([`lang`]), `"lang"`, this._PAGE_ATTR_VALUE_VALIDATORS[`g-precheckout-error`])
    errors.push(...this._validateAnswerTextContent(template, `g-precheckout-error`))
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes and content on `<g-shipping-error>` blocks.
   *
   * @remarks
   * Allowed attributes are `lang` only. Content must be plain text without
   * HTML (`error_message` accepts no markup); `{{}}` spans skip the static
   * checks (runtime-enforced).
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockGShippingErrorAttributes(`<g-base><g-shipping-error>Jauh</g-shipping-error></g-base>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockGShippingErrorAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-shipping-error`, new Set([`lang`]), `"lang"`, this._PAGE_ATTR_VALUE_VALIDATORS[`g-shipping-error`])
    errors.push(...this._validateAnswerTextContent(template, `g-shipping-error`))
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<g-inline-button>` blocks.
   *
   * @remarks
   * Allowed attributes are `lang`, `text`, and `start-parameter`. `text`
   * is required and must be non-empty; a static `start-parameter` must
   * match the Bot API deep-link format (`[A-Za-z0-9_-]`, at most 64 chars)
   * while `{{}}` / `{~ ~}` spans skip the static check (runtime-enforced,
   * mirroring the `_validateDiceItems` static/dynamic split).
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockGInlineButtonAttributes(`<g-base><g-inline-button text="Lihat" start-parameter="d-1"/></g-base>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockGInlineButtonAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-inline-button`, new Set([`lang`, `text`, `start-parameter`]), `"lang", "text" and "start-parameter"`, this._PAGE_ATTR_VALUE_VALIDATORS[`g-inline-button`])
    errors.push(...this._validateInlineButtonItems(template))
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates `<g-inline-button>` items beyond attribute names.
   *
   * @remarks
   * Enforces the structural rules: every block needs a non-empty `text`,
   * and every static `start-parameter` must match the Bot API deep-link
   * format. Called by `validateBlockGInlineButtonAttributes`; errors carry
   * 1-based line numbers.
   *
   * @param template - The raw template source to inspect.
   * @returns Validation errors (empty when valid).
   * @public
   */
  static _validateInlineButtonItems(template: string): Array<{line: number; message: string}> {
    const errors: Array<{line: number; message: string}> = []
    const buttonRegex = /<g-inline-button\b([^>]*?)\/?>/gi
    const attrValue = (attrsStr: string, name: string): string | undefined => {
      const m = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`).exec(attrsStr)
      if (!m) return undefined
      return m[1] ?? m[2] ?? m[3]
    }
    const isDynamic = (s: string): boolean => s.includes(`{{`) || s.includes(`{~`)

    for (const buttonMatch of template.matchAll(buttonRegex)) {
      const line = (template.slice(0, buttonMatch.index).match(/\n/g) || []).length + 1
      const text = attrValue(buttonMatch[1] ?? ``, `text`)
      if (text === undefined || text.trim() === ``) {
        errors.push({line, message: `Missing required attribute "text" on <g-inline-button>`})
      }
      const param = attrValue(buttonMatch[1] ?? ``, `start-parameter`)
      if (param !== undefined && param !== `` && !isDynamic(param) && !/^[A-Za-z0-9_-]{1,64}$/.test(param)) {
        errors.push({line, message: `Attribute "start-parameter" on <g-inline-button> must match [A-Za-z0-9_-] at most 64 chars (got "${param}")`})
      }
    }

    return errors
  }

  /**
   * Validates attributes and content on `<g-answer-note>` blocks.
   *
   * @remarks
   * Allowed attributes are `lang` only. Content must be plain text without
   * HTML; `{{}}` spans skip the static checks (runtime-enforced).
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockGAnswerNoteAttributes(`<g-base><g-answer-note>Note</g-answer-note></g-base>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockGAnswerNoteAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-answer-note`, new Set([`lang`]), `"lang"`, this._PAGE_ATTR_VALUE_VALIDATORS[`g-answer-note`])
    errors.push(...this._validateAnswerTextContent(template, `g-answer-note`))
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<g-gift>` blocks.
   *
   * @remarks
   * Allowed attributes are `lang` only. Unlike the answer payload blocks,
   * HTML markup inside `<g-gift>` is legal (`renderGift` sends with
   * `text_parse_mode: HTML`), so no content check runs here.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockGGiftAttributes(`<g-base><g-gift>Hadiah <b>x</b>!</g-gift></g-base>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockGGiftAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-gift`, new Set([`lang`]), `"lang"`, this._PAGE_ATTR_VALUE_VALIDATORS[`g-gift`])
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<g-script>` blocks.
   *
   * @remarks
   * No attributes are allowed on `<g-script>` blocks.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockGScriptAttributes(`<g-script>return x;</g-script>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockGScriptAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-script`, new Set(), ``, this._PAGE_ATTR_VALUE_VALIDATORS[`g-script`])
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<g-ifelse>` blocks.
   *
   * @remarks
   * `<g-ifelse>` takes no attributes — the whole conditional is the block body, so there is
   * nothing for an attribute to configure.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockGIfElseAttributes(`<g-ifelse>a ? "x" : "y"</g-ifelse>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockGIfElseAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-ifelse`, new Set(), ``, this._PAGE_ATTR_VALUE_VALIDATORS[`g-ifelse`])
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates the body of every `<g-ifelse>` block.
   *
   * @remarks
   * Four rules, all required to keep the block a conditional and unambiguous:
   *
   * 1. The body must not be empty.
   * 2. `{{}}` and `{~~}` interpolation must not appear — the body is already JavaScript, and
   *    nesting the interpolation syntaxes inside it would give one construct two grammars.
   * 3. Template literals must not interpolate `${...}` — that is a third spelling of the same
   *    interpolation. Use string concatenation inside the conditional instead.
   * 4. The body must actually branch: a ternary, or a `&&` / `||` / `??` short-circuit.
   *    A plain expression such as `items.length` belongs in `{~~}` and is rejected here so
   *    `<g-ifelse>` cannot silently become a second `{~~}`.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * TemplateEngine.validateBlockGIfElseBody(`<g-ifelse>items.length</g-ifelse>`);
   * // Result: { valid: false, errors: [{ line: 1, message: '<g-ifelse> body must be a conditional expression — use a ternary (test ? a : b) or a short-circuit (&&, ||, ??), got "items.length". Use {~~ items.length ~~} for a plain expression' }] }
   * ```
   *
   * @public
   */
  static validateBlockGIfElseBody(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors: Array<{line: number; message: string}> = []
    const blockRegex = /<g-ifelse\b[^>]*>([\s\S]*?)<\/g-ifelse>/gi
    let match: RegExpExecArray | null

    while ((match = blockRegex.exec(template)) !== null) {
      const line = (template.slice(0, match.index).match(/\n/g) || []).length + 1
      const expr = (match[1] ?? ``).trim()

      if (!expr) {
        errors.push({line, message: `<g-ifelse> body must not be empty`})
        continue
      }
      if (expr.includes(`{{`) || expr.includes(`{~`)) {
        errors.push({line, message: `<g-ifelse> body must not contain {{}} or {~~} interpolation — the body is already a JavaScript expression, so use the value directly (for example <g-ifelse>user ? user.name : ""</g-ifelse>)`})
        continue
      }

      const tokens = this._tokenizeExpression(expr)
      if (tokens.some((token) => token.type === `template` && token.value.includes(`\${`))) {
        errors.push({line, message: `<g-ifelse> body must not use \${...} interpolation inside a template literal — concatenate inside the conditional instead (for example \`\${a}-\${b}\` becomes a + "-" + b)`})
        continue
      }
      if (!this._isConditionalExpression(tokens)) {
        errors.push({line, message: `<g-ifelse> body must be a conditional expression — use a ternary (test ? a : b) or a short-circuit (&&, ||, ??), got "${expr}". Use {~~ ${expr} ~~} for a plain expression`})
      }
    }

    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<g-switch>` blocks.
   *
   * @remarks
   * The only allowed attribute is `value`.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockGSwitchAttributes(`<g-switch value="status">...</g-switch>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockGSwitchAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-switch`, new Set([`value`]), `"value"`, this._PAGE_ATTR_VALUE_VALIDATORS[`g-switch`])
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<g-case>` blocks.
   *
   * @remarks
   * The only allowed attribute is `is`.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockGCaseAttributes(`<g-case is="active">Active</g-case>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockGCaseAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-case`, new Set([`is`]), `"is"`, this._PAGE_ATTR_VALUE_VALIDATORS[`g-case`])
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<g-default>` blocks.
   *
   * @remarks
   * No attributes are allowed on `<g-default>` blocks.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockGDefaultAttributes(`<g-default>Unknown</g-default>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockGDefaultAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-default`, new Set(), ``, this._PAGE_ATTR_VALUE_VALIDATORS[`g-default`])
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<g-map>` blocks.
   *
   * @remarks
   * Allowed attributes are `src` and `join`.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockGMapAttributes(`<g-map src="items" join=", ">{{e}}</g-map>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockGMapAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-map`, new Set([`src`, `join`]), `"src" and "join"`, this._PAGE_ATTR_VALUE_VALIDATORS[`g-map`])
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<g-div>` blocks.
   *
   * @remarks
   * No attributes are allowed on `<g-div>` blocks.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockGDivAttributes(`<g-div>content</g-div>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockGDivAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-div`, new Set(), ``, this._PAGE_ATTR_VALUE_VALIDATORS[`g-div`])
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<g-import>` blocks.
   *
   * @remarks
   * Allowed attributes are `src`, `block`, `base`, `lang`, and `section`.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockGImportAttributes(`<g-import src="other" block="message" />`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockGImportAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-import`, new Set([`src`, `block`, `base`, `lang`, `section`]), `"src", "block", "base", "lang", and "section"`, this._PAGE_ATTR_VALUE_VALIDATORS[`g-import`])
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<g-space>` blocks.
   *
   * @remarks
   * No attributes are allowed on `<g-space>` blocks.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockGSpaceAttributes(`<g-space />`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockGSpaceAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-space`, new Set(), ``, this._PAGE_ATTR_VALUE_VALIDATORS[`g-space`])
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates all aspects of a template: block names, scopes, block format, block positioning, and base attributes.
   *
   * @remarks
   * This is a convenience method that runs all validators in order:
   *
   * 1. {@link TemplateEngine.validateNamesBlock} — checks that all tags are known
   * 2. {@link TemplateEngine.validateScopes} — checks that all interpolation scopes are known
   * 3. {@link TemplateEngine.validateFormatBlock} — checks self-closing vs regular tag syntax
   * 4. {@link TemplateEngine.validatePositionsBlock} — checks structural nesting rules
   * 5. {@link TemplateEngine.validateTelegramAttributesBlock} — checks required attributes on Telegram Rich HTML tags
   * 6. {@link TemplateEngine.validateTelegramAttributeValuesBlock} — checks value formats on Telegram Rich HTML tag attributes
   * 7. {@link TemplateEngine.validateTelegramUnknownAttributesBlock} — rejects unknown attribute names on Telegram Rich HTML tags
   * 8. {@link TemplateEngine.validateBlockGBaseAttributes} — checks `<g-base>` block attributes
   * 9. {@link TemplateEngine.validateBlockGMessageAttributes} — checks `<g-message>` block attributes
   * 10. {@link TemplateEngine.validateBlockGKeyboardAttributes} — checks `<g-keyboard>` block attributes
   * 11. {@link TemplateEngine.validateBlockGMediaAttributes} — checks `<g-media>` block attributes
   * 12. {@link TemplateEngine.validateBlockGMediaGroupAttributes} — checks `<g-media-group>` block attributes
   * 13. {@link TemplateEngine.validateBlockGPollAttributes} — checks `<g-poll>` block attributes
   * 14. {@link TemplateEngine.validateBlockGDescriptionAttributes} — checks `<g-description>` block attributes
   * 15. {@link TemplateEngine.validateBlockGScriptAttributes} — checks `<g-script>` block attributes
   * 16. {@link TemplateEngine.validateBlockGSwitchAttributes} — checks `<g-switch>` block attributes
   * 17. {@link TemplateEngine.validateBlockGCaseAttributes} — checks `<g-case>` block attributes
   * 18. {@link TemplateEngine.validateBlockGDefaultAttributes} — checks `<g-default>` block attributes
   * 19. {@link TemplateEngine.validateBlockGMapAttributes} — checks `<g-map>` block attributes
   * 20. {@link TemplateEngine.validateBlockGDivAttributes} — checks `<g-div>` block attributes
   * 21. {@link TemplateEngine.validateBlockGImportAttributes} — checks `<g-import>` block attributes
   * 22. {@link TemplateEngine.validateBlockGSpaceAttributes} — checks `<g-space>` block attributes
   * 23. {@link TemplateEngine.validateBlockGVenueAttributes} — checks `<g-venue>` block attributes
   * 24. {@link TemplateEngine.validateBlockGDiceAttributes} — checks `<g-dice>` block attributes
   * 25. {@link TemplateEngine.validateBlockGCallbackAnswerAttributes} — checks `<g-callback-answer>` block attributes and plain-text content
   * 26. {@link TemplateEngine.validateBlockGPrecheckoutErrorAttributes} — checks `<g-precheckout-error>` block attributes and plain-text content
   * 27. {@link TemplateEngine.validateBlockGShippingErrorAttributes} — checks `<g-shipping-error>` block attributes and plain-text content
   * 28. {@link TemplateEngine.validateBlockGInlineButtonAttributes} — checks `<g-inline-button>` block attributes, required text, and start-parameter format
   * 29. {@link TemplateEngine.validateBlockGAnswerNoteAttributes} — checks `<g-answer-note>` block attributes and plain-text content
   * 30. {@link TemplateEngine.validateBlockGGiftAttributes} — checks `<g-gift>` block attributes (HTML content is legal)
   * 31. {@link TemplateEngine.validatePageAttributesBlock} — checks required attributes on `<g-*>` PAGE blocks (centralized)
   * 32. {@link TemplateEngine.validatePageAttributeValuesBlock} — checks value formats on `<g-*>` PAGE block attributes (centralized)
   *
   * Errors from all validators are combined into a single result.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and a combined `errors` array containing
   *          line numbers and descriptive messages for every violation found
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateTemplate(`
   *   <g-base>
   *     <g-message>Hello {{name}}!</g-message>
   *   </g-base>
   * `);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockGMessageRich(html: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors: Array<{line: number; message: string}> = []

    // 1. UTF-8 length check (32768 chars)
    if (html.length > 32768) {
      errors.push({line: 0, message: `Rich message exceeds 32768 character limit (got ${html.length})`})
    }

    // 2. Block count check (≤ 500) — excludes <g-*> gramstax tags
    const blockMatches = html.match(/<(?!g-)[a-zA-Z][^>]*>/g)
    const blockCount = blockMatches ? blockMatches.length : 0
    if (blockCount > 500) {
      errors.push({line: 0, message: `Rich message exceeds 500 block limit (got ${blockCount})`})
    }

    // 3. Nesting depth check (≤ 16)
    let maxDepth = 0
    let currentDepth = 0
    const voidElements = new Set([`area`, `base`, `br`, `col`, `embed`, `hr`, `img`, `input`, `link`, `meta`, `param`, `source`, `track`, `wbr`, `tg-map`, `tg-emoji`])
    const tagRegex = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*(\/?)>/g
    let tagMatch: RegExpExecArray | null
    while ((tagMatch = tagRegex.exec(html)) !== null) {
      const isClosing = tagMatch[1] === `/`
      const tagName = tagMatch[2]!.toLowerCase()
      const isSelfClosing = tagMatch[3] === `/` || voidElements.has(tagName)

      if (isClosing && !isSelfClosing) {
        currentDepth = Math.max(0, currentDepth - 1)
      } else if (!isSelfClosing) {
        currentDepth++
        maxDepth = Math.max(maxDepth, currentDepth)
      }
    }
    if (maxDepth > 16) {
      errors.push({line: 0, message: `Rich message exceeds 16 nesting level limit (got ${maxDepth})`})
    }

    // 4. Table column check (≤ 20 per table)
    const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi
    let tableMatch: RegExpExecArray | null
    while ((tableMatch = tableRegex.exec(html)) !== null) {
      const tableContent = tableMatch[1]!
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
      let rowMatch: RegExpExecArray | null
      while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
        const cellCount = (rowMatch[1]!.match(/<t[dh][^>]*>/gi) || []).length
        if (cellCount > 20) {
          errors.push({line: 0, message: `Rich message table exceeds 20 column limit (got ${cellCount} columns in a row)`})
          break
        }
      }
    }

    return {valid: errors.length === 0, errors}
  }

  /**
   * Extract `<g-message>` inner HTML from a gramstax template and validate
   * it against Rich Message limits.
   *
   * @remarks
   * Called by {@link TemplateEngine.validateTemplate}. Strips gramstax-specific
   * template syntax (`{{}}`, `<g-*>`) to approximate the rendered HTML, then
   * delegates to {@link TemplateEngine.validateBlockGMessageRich}.
   *
   * @param template - Raw gramstax template string.
   * @returns Combined validation errors from all `<g-message>` blocks.
   *
   * @internal
   */
  static _validateBlockGMessageRichInTemplate(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors: Array<{line: number; message: string}> = []

    const msgRegex = /<g-message(?:\s+[^>]*)?>([\s\S]*?)<\/g-message>/gi
    let match: RegExpExecArray | null
    while ((match = msgRegex.exec(template)) !== null) {
      let content = match[1]!

      // Strip gramstax syntax to approximate rendered HTML
      content = content
        .replace(/{{[^}]+}}/g, ``)
        .replace(/<g-[^>]*>[\s\S]*?<\/g-[^>]*>/gi, ``)
        .replace(/<g-[^/>]*\/>/gi, ``)
        .trim()

      if (!content) continue

      const result = this.validateBlockGMessageRich(content)
      errors.push(...result.errors)
    }

    return {valid: errors.length === 0, errors}
  }

  /**
   * Full template validation — runs all validation passes.
   *
   * @remarks
   * Executes every registered validator in sequence and collects all errors.
   * Validation steps:
   *
   * 1. {@link TemplateEngine.validateNamesBlock} — checks that all tags are known
   * 2. {@link TemplateEngine.validateScopes} — checks that all interpolation scopes are known
   * 3. {@link TemplateEngine.validateFormatBlock} — checks self-closing vs regular tag syntax
   * 4. {@link TemplateEngine.validatePositionsBlock} — checks structural nesting rules
   * 5. {@link TemplateEngine.validateTelegramAttributesBlock} — checks required attributes on Telegram Rich HTML tags
   * 6. {@link TemplateEngine.validateTelegramAttributeValuesBlock} — checks value formats on Telegram Rich HTML tag attributes
   * 7. {@link TemplateEngine.validateTelegramUnknownAttributesBlock} — rejects unknown attribute names on Telegram Rich HTML tags
   * 8. {@link TemplateEngine.validateBlockGBaseAttributes} — checks `<g-base>` block attributes
   * 9. {@link TemplateEngine.validateBlockGMessageAttributes} — checks `<g-message>` block attributes
   * 10. {@link TemplateEngine.validateBlockGKeyboardAttributes} — checks `<g-keyboard>` block attributes
   * 11. {@link TemplateEngine.validateBlockGMediaAttributes} — checks `<g-media>` block attributes
   * 12. {@link TemplateEngine.validateBlockGMediaGroupAttributes} — checks `<g-media-group>` block attributes
   * 13. {@link TemplateEngine.validateBlockGPollAttributes} — checks `<g-poll>` block attributes
   * 14. {@link TemplateEngine.validateBlockGDescriptionAttributes} — checks `<g-description>` block attributes
   * 15. {@link TemplateEngine.validateBlockGScriptAttributes} — checks `<g-script>` block attributes
   * 16. {@link TemplateEngine.validateBlockGSwitchAttributes} — checks `<g-switch>` block attributes
   * 17. {@link TemplateEngine.validateBlockGCaseAttributes} — checks `<g-case>` block attributes
   * 18. {@link TemplateEngine.validateBlockGDefaultAttributes} — checks `<g-default>` block attributes
   * 19. {@link TemplateEngine.validateBlockGMapAttributes} — checks `<g-map>` block attributes
   * 20. {@link TemplateEngine.validateBlockGDivAttributes} — checks `<g-div>` block attributes
   * 21. {@link TemplateEngine.validateBlockGImportAttributes} — checks `<g-import>` block attributes
   * 22. {@link TemplateEngine.validateBlockGSpaceAttributes} — checks `<g-space>` block attributes
   * 23. {@link TemplateEngine.validateBlockGVenueAttributes} — checks `<g-venue>` block attributes
   * 24. {@link TemplateEngine.validateBlockGDiceAttributes} — checks `<g-dice>` block attributes
   * 25. {@link TemplateEngine.validateBlockGCallbackAnswerAttributes} — checks `<g-callback-answer>` block attributes and plain-text content
   * 26. {@link TemplateEngine.validateBlockGPrecheckoutErrorAttributes} — checks `<g-precheckout-error>` block attributes and plain-text content
   * 27. {@link TemplateEngine.validateBlockGShippingErrorAttributes} — checks `<g-shipping-error>` block attributes and plain-text content
   * 28. {@link TemplateEngine.validateBlockGInlineButtonAttributes} — checks `<g-inline-button>` block attributes, required text, and start-parameter format
   * 29. {@link TemplateEngine.validateBlockGAnswerNoteAttributes} — checks `<g-answer-note>` block attributes and plain-text content
   * 30. {@link TemplateEngine.validateBlockGGiftAttributes} — checks `<g-gift>` block attributes (HTML content is legal)
   * 31. {@link TemplateEngine.validatePageAttributesBlock} — checks required attributes on `<g-*>` PAGE blocks (centralized)
   * 32. {@link TemplateEngine.validatePageAttributeValuesBlock} — checks value formats on `<g-*>` PAGE block attributes (centralized)
   *
   * Errors from all validators are combined into a single result.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and a combined `errors` array containing
   *          line numbers and descriptive messages for every violation found
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateTemplate(`
   *   <g-base>
   *     <g-message>Hello {{name}}!</g-message>
   *   </g-base>
   * `);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateTemplate(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const blockNamesResult = this.validateNamesBlock(template)
    const scopesResult = this.validateScopes(template)
    const formatResult = this.validateFormatBlock(template)
    const positionsResult = this.validatePositionsBlock(template)
    const telegramAttrResult = this.validateTelegramAttributesBlock(template)
    const telegramValueResult = this.validateTelegramAttributeValuesBlock(template)
    const telegramUnknownResult = this.validateTelegramUnknownAttributesBlock(template)
    const baseAttrResult = this.validateBlockGBaseAttributes(template)
    const messageAttrResult = this.validateBlockGMessageAttributes(template)
    const keyboardAttrResult = this.validateBlockGKeyboardAttributes(template)
    const mediaAttrResult = this.validateBlockGMediaAttributes(template)
    const mediaGroupAttrResult = this.validateBlockGMediaGroupAttributes(template)
    const pollAttrResult = this.validateBlockGPollAttributes(template)
    const venueAttrResult = this.validateBlockGVenueAttributes(template)
    const diceAttrResult = this.validateBlockGDiceAttributes(template)
    const invoiceAttrResult = this.validateBlockGInvoiceAttributes(template)
    const priceAttrResult = this.validateBlockGPriceAttributes(template)
    const paidMediaAttrResult = this.validateBlockGPaidMediaAttributes(template)
    const descriptionAttrResult = this.validateBlockGDescriptionAttributes(template)
    const scriptAttrResult = this.validateBlockGScriptAttributes(template)
    const ifElseAttrResult = this.validateBlockGIfElseAttributes(template)
    const ifElseBodyResult = this.validateBlockGIfElseBody(template)
    const switchAttrResult = this.validateBlockGSwitchAttributes(template)
    const caseAttrResult = this.validateBlockGCaseAttributes(template)
    const defaultAttrResult = this.validateBlockGDefaultAttributes(template)
    const mapAttrResult = this.validateBlockGMapAttributes(template)
    const divAttrResult = this.validateBlockGDivAttributes(template)
    const importAttrResult = this.validateBlockGImportAttributes(template)
    const spaceAttrResult = this.validateBlockGSpaceAttributes(template)
    const callbackAnswerAttrResult = this.validateBlockGCallbackAnswerAttributes(template)
    const precheckoutErrorAttrResult = this.validateBlockGPrecheckoutErrorAttributes(template)
    const shippingErrorAttrResult = this.validateBlockGShippingErrorAttributes(template)
    const inlineButtonAttrResult = this.validateBlockGInlineButtonAttributes(template)
    const answerNoteAttrResult = this.validateBlockGAnswerNoteAttributes(template)
    const giftAttrResult = this.validateBlockGGiftAttributes(template)
    const pageAttrResult = this.validatePageAttributesBlock(template)
    const pageValueResult = this.validatePageAttributeValuesBlock(template)

    // Extract <g-message> inner HTML and validate against Rich Message limits
    const richMsgResult = this._validateBlockGMessageRichInTemplate(template)

    const errors = [
      ...blockNamesResult.errors,
      ...scopesResult.errors,
      ...formatResult.errors,
      ...positionsResult.errors,
      ...telegramAttrResult.errors,
      ...telegramValueResult.errors,
      ...telegramUnknownResult.errors,
      ...baseAttrResult.errors,
      ...messageAttrResult.errors,
      ...keyboardAttrResult.errors,
      ...mediaAttrResult.errors,
      ...mediaGroupAttrResult.errors,
      ...pollAttrResult.errors,
      ...venueAttrResult.errors,
      ...diceAttrResult.errors,
      ...invoiceAttrResult.errors,
      ...priceAttrResult.errors,
      ...paidMediaAttrResult.errors,
      ...descriptionAttrResult.errors,
      ...scriptAttrResult.errors,
      ...ifElseAttrResult.errors,
      ...ifElseBodyResult.errors,
      ...switchAttrResult.errors,
      ...caseAttrResult.errors,
      ...defaultAttrResult.errors,
      ...mapAttrResult.errors,
      ...divAttrResult.errors,
      ...importAttrResult.errors,
      ...spaceAttrResult.errors,
      ...callbackAnswerAttrResult.errors,
      ...precheckoutErrorAttrResult.errors,
      ...shippingErrorAttrResult.errors,
      ...inlineButtonAttrResult.errors,
      ...answerNoteAttrResult.errors,
      ...giftAttrResult.errors,
      ...pageAttrResult.errors,
      ...pageValueResult.errors,
      ...richMsgResult.errors
    ]

    return {
      valid: errors.length === 0,
      errors
    }
  }
}

/**
 * Builds the rich-marker matcher for `<g-message>` bodies.
 *
 * @remarks
 * Tag names come from an allowlist of angle-bracketed literals
 * ({@link TemplateEngine.ALLOWED_BLOCKS_TELEGRAM_RICH}): each literal is
 * stripped of `<`, `>` and `/`, then matched as a single precompiled
 * alternation `</?(name1|name2|...)(?:\s|/|>)`, case-insensitively. Every
 * lead is matched as one RegExp — no per-tag `includes()` scan. An empty
 * allowlist degenerates to `/(?!)/` (never matches) so it can never become
 * the catch-all `(?:)`.
 */
function buildRichMessageMatcher(tags: ReadonlySet<string>): RegExp {
  const names = [...tags].map((tag) => tag.replace(/[<>/]/g, ``)).sort((a, b) => b.length - a.length)
  if (names.length === 0) return /(?!)/ // empty allowlist must never match everything
  return new RegExp(`</?(?:${names.join(`|`)})(?:\\s|/|>)`, `i`)
}

/** Precompiled single-pass rich-tag matcher over {@link TemplateEngine.ALLOWED_BLOCKS_TELEGRAM_RICH}. */
const RICH_MESSAGE_MATCHER = buildRichMessageMatcher(TemplateEngine.ALLOWED_BLOCKS_TELEGRAM_RICH)
