/**
 * Represents a media block configuration for Telegram messages.
 *
 * @remarks
 * This type defines the structure for various media types supported by Telegram,
 * including file-based media (photo, video, audio, document, animation, voice,
 * video_note, sticker), location, and contact.
 * Pipe-delimited `src` values such as `a.jpg|b.jpg` are also exposed as
 * `srcList` for Telegram media groups. `<g-media-group>` blocks are exposed as
 * `mediaGroup` items and may mix photo/video items. Telegram media groups
 * support up to 10 items and only for photo, video, audio, and document media.
 *
 * @example
 * ```typescript
 * const photoMedia: ITMediaBlock = {
 *   type: 'photo',
 *   src: 'path/to/image.jpg',
 *   caption: 'A beautiful sunset'
 * };
 *
 * const albumMedia: ITMediaBlock = {
 *   type: 'photo',
 *   src: 'one.jpg|two.jpg',
 *   srcList: ['one.jpg', 'two.jpg'],
 *   caption: 'Photo album'
 * };
 *
 * const locationMedia: ITMediaBlock = {
 *   type: 'location',
 *   latitude: '37.7749',
 *   longitude: '-122.4194'
 * };
 *
 * const contactMedia: ITMediaBlock = {
 *   type: 'contact',
 *   phone: '+1234567890',
 *   first_name: 'John',
 *   last_name: 'Doe'
 * };
 * ```
 *
 * @public
 */
export type ITMediaBlock = {
  type: `photo` | `video` | `audio` | `document` | `animation` | `voice` | `video_note` | `sticker` | `location` | `contact` | `group`
  src?: string
  srcList?: string[]
  mediaGroup?: Array<{type: `photo` | `video` | `audio` | `document`; src: string; caption?: string}>
  caption?: string
  // for location
  latitude?: string
  longitude?: string
  // for contact
  phone?: string
  first_name?: string
  last_name?: string
  vcard?: string
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
 * // Result: 'Welcome John!'
 * ```
 *
 * @public
 */
export class TemplateEngine {
  static MAX_MEDIA_GROUP_ITEMS = 10
  static ALLOWED_BLOCKS_TELEGRAM_LEGACY = [
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
  ]
  static ALLOWED_BLOCKS_TELEGRAM_RICH = [
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
  ]
  static ALLOWED_BLOCKS_TELEGRAM = [...TemplateEngine.ALLOWED_BLOCKS_TELEGRAM_LEGACY, ...TemplateEngine.ALLOWED_BLOCKS_TELEGRAM_RICH]
  static ALLOWED_BLOCKS_PAGE = [
    // Content blocks
    `<g-base>`,
    `<g-message>`,
    `<g-keyboard>`,
    `<g-media>`,
    `<g-media-group>`,
    `<g-description>`,
    // Logic blocks
    `<g-script>`,
    `<g-switch>`,
    `<g-case>`,
    `<g-default>`,
    `<g-map>`,
    `<g-div>`,
    // Utility blocks
    `<g-import/>`,
    `<g-space/>`
  ]

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
   * - *Block/structural:* `aside`, `blockquote`, `blockquote expandable`, `br`, `details`, `footer`, `h1`-`h6`, `hr`, `li`, `ol`, `p`, `pre`, `summary`, `table`, `td`, `th`, `tr`, `ul`
   * - *Telegram-specific:* `tg-collage`, `tg-emoji`, `tg-map`, `tg-math`, `tg-math-block`, `tg-reference`, `tg-slideshow`, `tg-time`
   * - *Media:* `audio`, `cite`, `figcaption`, `figure`, `img`, `video`
   * - *Forms:* `input`
   */
  static ALLOWED_BLOCKS = [...this.ALLOWED_BLOCKS_PAGE, ...this.ALLOWED_BLOCKS_TELEGRAM]

  /**
   * Extracts lowercase block tag names from an array of tag literals.
   *
   * @remarks
   * Strips leading `</` or `<`, any trailing `>`, any attributes that follow
   * a space, and lowercases the result. Self-closing tags like `<g-import/>`
   * are normalised to their bare name. Entries with attributes after a space
   * (e.g. `<blockquote expandable>`) are returned with the attribute suffix
   * preserved.
   *
   * @param blocks - Array of tag literals (e.g. `["<g-base>", "<message/>", "<blockquote expandable>"]`)
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
  static _extractBlockNames(blocks: string[]): Set<string> {
    return new Set(
      blocks.map((block) =>
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
   * TemplateEngine._TELEGRAM_REQUIRED_ATTRS["tg-time"] // => ["unix", "format"]
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
    "tg-time": [`unix`, `format`],
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
   * Validators are intentionally lenient — they catch obvious bugs (wrong
   * type, invalid scheme) but do not enforce every Telegram-side constraint.
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
      unix: (v) => (/^\d+$/.test(v) ? null : `unix must be a positive integer (got "${v}")`),
      format: (v) => (v.length > 0 ? null : `format must not be empty`)
    },
    "tg-map": {
      lat: (v) => {
        const n = Number(v)
        return !isNaN(n) && n >= -90 && n <= 90 ? null : `lat must be a number between -90 and 90 (got "${v}")`
      },
      long: (v) => {
        const n = Number(v)
        return !isNaN(n) && n >= -180 && n <= 180 ? null : `long must be a number between -180 and 180 (got "${v}")`
      },
      zoom: (v) => (/^\d+$/.test(v) && Number(v) <= 24 ? null : `zoom must be a non-negative integer ≤ 24 (got "${v}")`)
    },
    "tg-emoji": {
      "emoji-id": (v) => (/^\d+$/.test(v) ? null : `emoji-id must be a numeric string (got "${v}")`)
    },
    a: {
      href: (v) => (/^(https?:\/\/|mailto:|tel:|tg:\/\/|#)/i.test(v) ? null : `href must use http(s)://, mailto:, tel:, tg://, or # scheme (got "${v}")`)
    },
    input: {
      type: (v) => {
        const allowed = [`checkbox`, `text`, `number`, `email`, `password`, `submit`, `radio`, `hidden`, `tel`, `url`]
        return allowed.includes(v.toLowerCase()) ? null : `type must be one of: ${allowed.join(`, `)} (got "${v}")`
      }
    }
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
      shared: (v) => (v === `true` || v === `false` ? null : `Attribute "shared" on <g-media> must be "true" or "false", got "${v}"`)
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
  static ALLOWED_SCOPE = [`{{}}`, `{~~}`]

  /**
   * Escapes special characters in a string for safe use in template literals.
   *
   * @remarks
   * This internal method escapes backslashes and backticks to prevent them from
   * interfering with template literal syntax during compilation.
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
    return str
      .replace(/\\/g, `\\\\`) // escape backslash: \ → \\
      .replace(/`/g, `\\\``) // escape backtick: ` → \`
  }

  /**
   * Scope: `{{}}`
   * Converts `{{variable}}` placeholders to JavaScript template literal expressions.
   *
   * @remarks
   * This internal method transforms Mustache-like variable syntax into JavaScript
   * template literal interpolation. Variables are accessed from the `data` object,
   * with nullish coalescing to empty string when undefined.
   *
   * @param template - The template string containing `{{variable}}` placeholders
   * @returns The processed template with placeholders converted to `${data["key"]}` syntax
   *
   * @example
   * ```typescript
   * const processed = TemplateEngine._processVariables('Hello {{name}}!');
   * // Result: 'Hello ${(data && data["name"]) ?? ""}!'
   * ```
   *
   * @public
   */
  static _processScopeVariables(template: string) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => `\${(data && data["${key}"]) ?? ""}`)
  }

  /**
   * Scope: `{~~}`
   * Transforms inline execution blocks `{~ jscode ~}` into JavaScript expressions.
   *
   * @remarks
   * This internal method converts inline execution syntax into self-invoking
   * JavaScript expressions. It first attempts direct execution, then falls back
   * to `with(data)` scope. Returns an empty string on any error.
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
    const switchRegex = /<g-switch\b(?:\s+value="([^"]+)")?>([\s\S]*?)<\/g-switch>/gi
    return template.replace(switchRegex, (_, valueKey, innerContent) => {
      if (!valueKey) return ``

      let casesJs = ``
      const caseRegex = /<g-case\b(?:\s+is="([^"]+)")?>([\s\S]*?)<\/g-case>/gi
      const defaultRegex = /<g-default>([\s\S]*?)<\/g-default>/gi

      let match
      while ((match = caseRegex.exec(innerContent)) !== null) {
        const values = (match[1] || ``).split(`,`).map((v) => v.trim())
        const content = (match[2] || ``)
          .replace(/^[\t ]+/gm, ``)
          .replace(/^\n+/, ``)
          .replace(/\n+$/, ``)
          .trim()
          .replace(/`/g, `\\\``)

        values.forEach((v) => {
          casesJs += `case "${v}": `
        })
        casesJs += `return \`${content}\`; `
      }

      // Reset regex index for safety if needed, though we only call once per switch
      const defaultMatch = defaultRegex.exec(innerContent)
      if (defaultMatch) {
        const content = (defaultMatch[1] || ``)
          .replace(/^[\t ]+/gm, ``)
          .replace(/^\n+/, ``)
          .replace(/\n+$/, ``)
          .trim()
        //  .replace(/`/g, `\\\``)
        casesJs += `default: return \`${content}\`; `
      } else {
        casesJs += `default: return ''; `
      }

      return `\${(() => { switch((data && data["${valueKey}"])) { ${casesJs} } })()}`
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
    const mapRegex = /<g-map(?:\s+([^>]*))?>([\s\S]*?)<\/g-map>/gi
    return template.replace(mapRegex, (_, attributesStr, rawContent) => {
      const attrs: {[key: string]: string} = {}
      const attrRegex = /(\w+)="([^"]*)"/g

      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2]!
        }
      }

      const src = attrs.src
      if (!src) return ``

      const join = attrs.join ?? `\\n`

      let content = rawContent
        .replace(/^[\t ]+/gm, ``)
        .replace(/^\n+/, ``)
        .replace(/\n+$/, ``)
        .replace(/`/g, `\\\``) // escape backticks

      // Handle local variables {{e...}} and {{i}}
      content = content.replace(/\{\{([\w.]+)\}\}/g, (match: string, inner: string) => {
        if (inner === `e` || inner.startsWith(`e.`)) {
          return `\${${inner}}`
        }
        if (inner === `i`) {
          return `\${i}`
        }
        return match
      })

      // We need to escape the join string for the JS code
      const safeJoin = join.replace(/"/g, `\\"`)

      return `\${(() => { const __arr = (data && data["${src}"]) || []; let __out = ""; for (let i = 0; i < __arr.length; i++) { const e = __arr[i]; if (i > 0) { __out += "${safeJoin}" } __out += \`${content}\`; } return __out; })()}`
    })
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
    const result: {[lang: string]: ITMediaBlock} = {}

    for (const match of template.matchAll(mediaRegex)) {
      const attributesStr = match[1]
      const rawContent = match[2]

      // Extract all attributes
      const attrs: {[key: string]: string} = {}
      const attrRegex = /(\w+)="([^"]*)"/g

      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2]!
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
      const mediaBlock = {type} as Record<any, any>

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

      // Location attributes
      if (type === `location`) {
        if (attrs.latitude) mediaBlock.latitude = attrs.latitude
        if (attrs.longitude) mediaBlock.longitude = attrs.longitude
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

      result[lang] = mediaBlock as any
    }

    return result
  }

  static _splitMediaSrcList(src: string): string[] {
    if (!src.includes(`|`)) return []
    return src
      .split(`|`)
      .map((it) => it.trim())
      .filter((it) => it.length > 0)
      .slice(0, this.MAX_MEDIA_GROUP_ITEMS)
  }

  /** Parses `<g-media-group>` blocks into Telegram media group item definitions. */
  static _processGMediaGroupBlocks(template: string) {
    const mediaGroupRegex = /<g-media-group(?:\s+([^>]*))?>([\s\S]*?)<\/g-media-group>/gi
    const result: {[lang: string]: ITMediaBlock} = {}

    for (const match of template.matchAll(mediaGroupRegex)) {
      const attributesStr = match[1]
      const groupContent = match[2] || ``
      const attrs: {[key: string]: string} = {}
      const attrRegex = /(\w+)="([^"]*)"/g

      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2]!
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
  private static _processMediaGroupItems(groupContent: string): Array<{type: `photo` | `video` | `audio` | `document`; src: string; caption?: string; lang?: string; shared?: boolean}> {
    const mediaRegex = /<g-media(?:\s+([^>]*))?>([\s\S]*?)<\/g-media>/gi
    const mediaGroup: Array<{type: `photo` | `video` | `audio` | `document`; src: string; caption?: string; lang?: string; shared?: boolean}> = []
    const supportedTypes = new Set([`photo`, `video`, `audio`, `document`])

    for (const match of groupContent.matchAll(mediaRegex)) {
      if (mediaGroup.length >= this.MAX_MEDIA_GROUP_ITEMS) break

      const attrs: {[key: string]: string} = {}
      const attrRegex = /(\w+)="([^"]*)"/g
      const attributesStr = match[1]
      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2]!
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
      const attrRegex = /(\w+)="([^"]*)"/g

      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2]!
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
   * @remarks
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
      const attrRegex = /(\w+)="([^"]*)"/g

      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2]!
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
   *   <g-keyboard>Yes, No</g-keyboard>
   *   <g-keyboard type="bottom">Button 1, Button 2</g-keyboard>
   *   <g-keyboard lang="id">Ya, Tidak</g-keyboard>
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
      const attrRegex = /(\w+)="([^"]*)"/g

      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2]!
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
  static _compileToFunction<T extends boolean>(template: T extends true ? string[] : string, isArray: T): T extends true ? (data?: Record<string, any>) => string[] : (data?: Record<string, any>) => string {
    let singleOrCombined: string
    if (isArray) {
      const multiTemplate = template as string[]
      singleOrCombined = multiTemplate.map((t) => `\`${t}\``).join(`,`)
    } else {
      singleOrCombined = `\`${template as string}\``
    }

    let processed = singleOrCombined
    processed = this._processGScriptBlocks(this._processGDivBlocks(this._processGSpaceBlocks(processed)))

    if (isArray) {
      const functionBody = `return [${processed}]`
      return new Function(`data`, functionBody) as any
    } else {
      const functionBody = `return ${processed}`
      return new Function(`data`, functionBody) as any
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
        [ALang: string]: (data?: Record<string, any>) => ITMediaBlock
      }
    } = {}

    for (const [AGBaseId, baseContent] of Object.entries(bases)) {
      const mediaBlocks = {...this._processGMediaBlocks(baseContent), ...this._processGMediaGroupBlocks(baseContent)}
      result[AGBaseId] = {}

      for (const [ALang, mediaBlock] of Object.entries(mediaBlocks)) {
        const compiledProps: Record<string, (data?: Record<string, any>) => string> = {}
        const compiledMediaGroup = mediaBlock.mediaGroup?.map((item) => ({
          type: item.type,
          src: this._compileToFunction(this._processScopeVariables(this._processScopeExec(this._processGSwitchBlocks(this._processGMapBlocks(this._processGScriptBlocks(item.src))))), false),
          caption: item.caption ? this._compileToFunction(this._processScopeVariables(this._processScopeExec(this._processGSwitchBlocks(this._processGMapBlocks(this._processGScriptBlocks(item.caption))))), false) : undefined
        }))

        for (const [key, value] of Object.entries(mediaBlock)) {
          if (key === `type` || typeof value !== `string`) continue

          const processed = this._processScopeVariables(this._processScopeExec(this._processGSwitchBlocks(this._processGMapBlocks(this._processGScriptBlocks(value)))))
          compiledProps[key] = this._compileToFunction(processed, false)
        }

        result[AGBaseId][ALang] = (data?: Record<string, any>) => {
          const resolvedBlock = {...mediaBlock} as any
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
   * - Value: `(data?: Record<string, any>) => string`
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
   * // Result: 'Hello John!'
   * ```
   *
   * @public
   */
  static compileBlockGMessage(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>) {
    const bases = baseBlocks || this._processGBaseBlocks(template)
    const result: {
      [AGBaseId: string]: {
        [ALang: string]: (data?: Record<string, any>) => string
      }
    } = {}

    for (const [AGBaseId, baseContent] of Object.entries(bases)) {
      const messages = this._processGMessageBlocks(baseContent)
      result[AGBaseId] = {}

      for (const [ALang, content] of Object.entries(messages)) {
        const processed = this._processScopeVariables(this._processScopeExec(this._processGSwitchBlocks(this._processGMapBlocks(this._processGScriptBlocks(content)))))
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
   * - Value: `(data?: Record<string, any>) => string`
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
          [ALang: string]: (data?: Record<string, any>) => string
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
          const processed = this._processScopeVariables(this._processScopeExec(this._processGSwitchBlocks(this._processGMapBlocks(this._processGScriptBlocks(scopeContent)))))
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
   * - Value: `(data?: Record<string, any>) => string[]`
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
  static compileBlockGKeyboards(template: string, gBaseBlocks?: ReturnType<typeof TemplateEngine._processGBaseBlocks>) {
    const bases = gBaseBlocks || this._processGBaseBlocks(template)
    const result: {
      [AGBaseId: string]: {
        [ALang: string]: {
          inline?: (data?: Record<string, any>) => string[]
          bottom?: (data?: Record<string, any>) => string[]
        }
      }
    } = {}

    for (const [AGBaseId, content] of Object.entries(bases)) {
      const keyboards = this._processGKeyboardBlocks(content)
      result[AGBaseId] = {}

      for (const [lang, modes] of Object.entries(keyboards)) {
        result[AGBaseId][lang] = {}

        for (const [mode, content] of Object.entries(modes)) {
          // Seperates label, handle escaped comma
          const labels = content.split(/(?<!\\),\s*/).map((label: string) => label.replace(/\\,/g, `,`).trim())

          const processedLabels = labels.map((label) => this._processScopeVariables(this._processScopeExec(this._processGSwitchBlocks(this._processGMapBlocks(this._processGScriptBlocks(label))))))

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
            const attrRegex = /lang="([^"]*)"/i
            const langMatch = attributesStr?.match(attrRegex)
            const blockLang = langMatch ? langMatch[1] : undefined

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
      const attrRegex = /(\w+)="([^"]*)"/g
      if (attributesStr) {
        for (const attrMatch of attributesStr.matchAll(attrRegex)) {
          attrs[attrMatch[1]!] = attrMatch[2]!
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
    const allowedScopeNames = new Set(TemplateEngine.ALLOWED_SCOPE)
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
   * - `<g-message>`, `<g-keyboard>`, `<g-media>`, `<g-media-group>`, `<g-description>`, `<g-import>`, `<g-script>`, `<g-space>` can only appear directly inside `<g-base>`.
   * - `<g-media>` can also appear directly inside `<g-media-group>` as a group item.
   * - `<g-switch>`, `<g-map>` can only appear inside `<g-message>`, `<g-keyboard>`, `<g-media>`, or `<g-description>`.
   * - `<g-case>` and `<g-default>` can only appear inside `<g-switch>`.
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
    const allowedParents: Record<string, Set<string>> = {
      "g-base": new Set([`__root__`]),
      "g-message": new Set([`g-base`]),
      "g-keyboard": new Set([`g-base`]),
      "g-media": new Set([`g-base`, `g-media-group`]),
      "g-media-group": new Set([`g-base`]),
      "g-description": new Set([`g-base`]),
      "g-switch": new Set([`g-message`, `g-keyboard`, `g-media`, `g-description`]),
      "g-case": new Set([`g-switch`]),
      "g-default": new Set([`g-switch`]),
      "g-map": new Set([`g-message`, `g-keyboard`, `g-media`, `g-description`]),
      "g-div": new Set([`g-base`, `g-message`, `g-description`, `g-keyboard`, `g-case`, `g-default`, `g-map`]),
      "g-script": new Set([`g-base`, `g-message`, `g-description`, `g-keyboard`, `g-case`, `g-default`, `g-map`, `g-div`]),
      "g-import": new Set([`g-base`]),
      "g-space": new Set([`g-base`, `g-message`, `g-description`, `g-keyboard`, `g-case`, `g-default`, `g-switch`, `g-map`, `g-div`])
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
        if (!allowed.has(currentParent)) {
          errors.push({line, message: `Block <${tagName}> is not allowed inside <${currentParent}>`})
        }
      } else {
        // Opening tag: validate parent, then push to stack
        const currentParent = stack.length > 0 ? stack[stack.length - 1]!.block : `__root__`
        const allowed = allowedParents[tagName]!
        if (!allowed.has(currentParent)) {
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
   *   `<g-media>...</g-media>`, `<g-description>...</g-description>`, `<g-script>...</g-script>`,
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
    const regularBlocks = new Set([`g-base`, `g-message`, `g-keyboard`, `g-media`, `g-media-group`, `g-description`, `g-script`, `g-switch`, `g-case`, `g-default`, `g-map`, `g-div`])

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
  private static _validateBlockAttributes(template: string, tagName: string, allowedAttributes: Set<string>, allowedLabel: string, valueValidators?: Record<string, (value: string) => string | null>): Array<{line: number; message: string}> {
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
        // Skip pure template variable placeholders — they're substituted at compile time
        if (/^\{\{[\w-]+\}\}$/.test(attrValue)) continue
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
        // Skip pure template variable placeholders — they're substituted at compile time
        if (/^\{\{[\w-]+\}\}$/.test(attrValue)) continue
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
   * Allowed attributes are `lang`, `type`, `src`, `shared`, `latitude`, `longitude`,
   * `phone`, `first_name`, `last_name`, and `vcard`.
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
      new Set([`lang`, `type`, `src`, `shared`, `latitude`, `longitude`, `phone`, `first_name`, `last_name`, `vcard`]),
      `"lang", "type", "src", "shared", "latitude", "longitude", "phone", "first_name", "last_name", and "vcard"`,
      this._PAGE_ATTR_VALUE_VALIDATORS[`g-media`]
    )
    return {valid: errors.length === 0, errors}
  }

  /** Validates attributes and item constraints on `<g-media-group>` blocks. */
  static validateBlockGMediaGroupAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `g-media-group`, new Set([`lang`]), `"lang"`, this._PAGE_ATTR_VALUE_VALIDATORS[`g-media-group`])
    errors.push(...this._validateMediaGroupItems(template))
    return {valid: errors.length === 0, errors}
  }

  private static _validateMediaGroupItems(template: string): Array<{line: number; message: string}> {
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
        const type = attrsStr.match(/\btype\s*=\s*"([^"]*)"/)?.[1]
        const src = attrsStr.match(/\bsrc\s*=\s*"([^"]*)"/)?.[1]

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
   * 7. {@link TemplateEngine.validateBlockGBaseAttributes} — checks `<g-base>` block attributes
   * 8. {@link TemplateEngine.validateBlockGMessageAttributes} — checks `<g-message>` block attributes
   * 9. {@link TemplateEngine.validateBlockGKeyboardAttributes} — checks `<g-keyboard>` block attributes
   * 10. {@link TemplateEngine.validateBlockGMediaAttributes} — checks `<g-media>` block attributes
   * 11. {@link TemplateEngine.validateBlockGMediaGroupAttributes} — checks `<g-media-group>` block attributes
   * 12. {@link TemplateEngine.validateBlockGDescriptionAttributes} — checks `<g-description>` block attributes
   * 13. {@link TemplateEngine.validateBlockGScriptAttributes} — checks `<g-script>` block attributes
   * 14. {@link TemplateEngine.validateBlockGSwitchAttributes} — checks `<g-switch>` block attributes
   * 15. {@link TemplateEngine.validateBlockGCaseAttributes} — checks `<g-case>` block attributes
   * 16. {@link TemplateEngine.validateBlockGDefaultAttributes} — checks `<g-default>` block attributes
   * 17. {@link TemplateEngine.validateBlockGMapAttributes} — checks `<g-map>` block attributes
   * 18. {@link TemplateEngine.validateBlockGDivAttributes} — checks `<g-div>` block attributes
   * 19. {@link TemplateEngine.validateBlockGImportAttributes} — checks `<g-import>` block attributes
   * 20. {@link TemplateEngine.validateBlockGSpaceAttributes} — checks `<g-space>` block attributes
   * 21. {@link TemplateEngine.validatePageAttributesBlock} — checks required attributes on `<g-*>` PAGE blocks (centralized)
   * 22. {@link TemplateEngine.validatePageAttributeValuesBlock} — checks value formats on `<g-*>` PAGE block attributes (centralized)
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
    const baseAttrResult = this.validateBlockGBaseAttributes(template)
    const messageAttrResult = this.validateBlockGMessageAttributes(template)
    const keyboardAttrResult = this.validateBlockGKeyboardAttributes(template)
    const mediaAttrResult = this.validateBlockGMediaAttributes(template)
    const mediaGroupAttrResult = this.validateBlockGMediaGroupAttributes(template)
    const descriptionAttrResult = this.validateBlockGDescriptionAttributes(template)
    const scriptAttrResult = this.validateBlockGScriptAttributes(template)
    const switchAttrResult = this.validateBlockGSwitchAttributes(template)
    const caseAttrResult = this.validateBlockGCaseAttributes(template)
    const defaultAttrResult = this.validateBlockGDefaultAttributes(template)
    const mapAttrResult = this.validateBlockGMapAttributes(template)
    const divAttrResult = this.validateBlockGDivAttributes(template)
    const importAttrResult = this.validateBlockGImportAttributes(template)
    const spaceAttrResult = this.validateBlockGSpaceAttributes(template)
    const pageAttrResult = this.validatePageAttributesBlock(template)
    const pageValueResult = this.validatePageAttributeValuesBlock(template)

    const errors = [
      ...blockNamesResult.errors,
      ...scopesResult.errors,
      ...formatResult.errors,
      ...positionsResult.errors,
      ...telegramAttrResult.errors,
      ...telegramValueResult.errors,
      ...baseAttrResult.errors,
      ...messageAttrResult.errors,
      ...keyboardAttrResult.errors,
      ...mediaAttrResult.errors,
      ...mediaGroupAttrResult.errors,
      ...descriptionAttrResult.errors,
      ...scriptAttrResult.errors,
      ...switchAttrResult.errors,
      ...caseAttrResult.errors,
      ...defaultAttrResult.errors,
      ...mapAttrResult.errors,
      ...divAttrResult.errors,
      ...importAttrResult.errors,
      ...spaceAttrResult.errors,
      ...pageAttrResult.errors,
      ...pageValueResult.errors
    ]

    return {
      valid: errors.length === 0,
      errors
    }
  }
}
