/**
 * Represents a media block configuration for Telegram messages.
 *
 * @remarks
 * This type defines the structure for various media types supported by Telegram,
 * including file-based media (photo, video, audio, document, animation, voice,
 * video_note, sticker), location, and contact.
 * Pipe-delimited `src` values such as `a.jpg|b.jpg` are also exposed as
 * `srcList` for Telegram media groups. `<media-group>` blocks are exposed as
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
 * Templates are typically organized into `<base>` blocks containing various
 * content blocks like `<message>`, `<keyboard>`, `<media>`, and `<description>`.
 * Each block supports a `lang` attribute for internationalization.
 *
 * @example
 * ```typescript
 * import { TemplateEngine } from 'gramstax';
 *
 * const template = `
 *   <base>
 *     <keyboard>Back, Next</keyboard>
 *     <message>Welcome {{name}}!</message>
 *   </base>
 * `;
 *
 * const messages = TemplateEngine.compileBlockMessages(template);
 * const keyboards = TemplateEngine.compileBlockKeyboards(template);
 *
 * const msg = messages.default?.default?.({ name: 'John' });
 * // Result: 'Welcome John!'
 * ```
 *
 * @public
 */
export class TemplateEngine {
  static MAX_MEDIA_GROUP_ITEMS = 10

  /**
   * Registry of all supported template block tags.
   *
   * @remarks
   * These are the actual XML-like tags recognized by `TemplateEngine`.
   * Each corresponds to a `<tagName>` element in template strings.
   *
   * **Content blocks:** `base`, `message`, `keyboard`, `media`, `description`
   * **Logic blocks:** `script`, `switch`, `case`, `default`, `map`, `div`
   * **Utility blocks:** `import`, `space`
   * **Telegram HTML formatting (passed through, not compiled):** `b`, `i`, `u`, `s`, `code`, `pre`, `a`, `blockquote`, `blockquote expandable`
   */
  static ALLOWED_BLOCKS = [
    // Content blocks
    `<base>`,
    `<message>`,
    `<keyboard>`,
    `<media>`,
    `<media-group>`,
    `<description>`,
    // Logic blocks
    `<script>`,
    `<switch>`,
    `<case>`,
    `<default>`,
    `<map>`,
    `<div>`,
    // Utility blocks
    `<import/>`,
    `<space/>`,
    // Telegram HTML formatting (passed through to message text)
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
   * Block: base
   * Extracts and parses `<base>` blocks from a template string.
   *
   * @remarks
   * This internal method identifies all `<base>` blocks in the template and extracts
   * their content, organizing them by their `id` attribute. Blocks without an `id`
   * are stored under the key `"default"`. Leading whitespace and surrounding
   * newlines are trimmed from the inner content.
   *
   * **Attributes:**
   *   - `id` (optional): Identifier for the base block. If not specified,
   *                      defaults to `"default"`. Used to reference specific base blocks when compiling
   *                      templates or extracting content.
   *
   * @param template - The raw template string containing `<base>` blocks
   * @returns An object mapping base IDs to their cleaned inner content
   *
   * @example
   * ```typescript
   * const template = `
   *   <base id="main">
   *     <message>Hello World</message>
   *   </base>
   *   <base id="error">
   *     <message>Error occurred</message>
   *   </base>
   *   <base>
   *     <message>Default block</message>
   *   </base>
   * `;
   * const bases = TemplateEngine._processBaseBlocks(template);
   * // Result: {
   * //   main: '<message>Hello World</message>',
   * //   error: '<message>Error occurred</message>',
   * //   default: '<message>Default block</message>'
   * // }
   * ```
   *
   * @public
   */
  static _processBaseBlocks(template: string) {
    const baseRegex = /<base\b[^>]*?(?:\sid=(["']?)([^"'\s>]+)\1)?[^>]*?>([\s\S]*?)<\/base>/g
    const result: {
      [baseId: string]: string
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
   * Block: script
   * Transforms `<script>` blocks into executable JavaScript expressions.
   *
   * @remarks
   * This internal method converts `<script>` blocks into self-invoking functions
   * that execute with access to the `data` object via `with(data)`. If the script
   * throws an error or `data` is undefined, an empty string is returned.
   *
   * **Attributes:**
   *   - none
   *
   * @param template - The template string containing `<script>` blocks
   * @returns The template with `<script>` blocks converted to executable expressions
   *
   * @example
   * ```typescript
   * const template = '<script>return name ? `Hello ${name}` : `Hello`;</script>';
   * const processed = TemplateEngine._processScriptBlocks(template);
   * // Result: '${(() => { if (!data) return ''; try { with(data) { return name ? `Hello ${name}` : `Hello`; } } catch(e) { return '' } })()}'
   * ```
   *
   * @public
   */
  static _processScriptBlocks(template: string) {
    return template.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (_, rawCode: string) => {
      const innerCode = rawCode.trim()
      if (!innerCode) return ``

      return `\${(() => { if (!data) return ''; try { with(data) { ${innerCode} } } catch(e) { return '' } })()}`
    })
  }

  /**
   * Block: space
   * Removes lines containing self-closing `<space />` tags.
   *
   * @remarks
   * This internal method identifies lines that contain only a `<space />` tag
   * (with optional surrounding whitespace) and removes the entire line.
   * This is useful for controlling whitespace in templates.
   *
   * **Attributes:**
   *   - none
   *
   * @param template - The template string containing `<space />` tags
   * @returns The template with `<space />` lines removed
   *
   * @example
   * ```typescript
   * const template = 'Line 1\n<space />\nLine 2';
   * const processed = TemplateEngine._processSpaceBlocks(template);
   * // Result: 'Line 1\n\nLine 2'
   * ```
   *
   * @public
   */
  static _processSpaceBlocks(template: string) {
    return template.replace(/^[ \t]*<space\s*\/>[ \t]*$/gim, ``)
  }

  /**
   * Block: div
   * Normalizes content within `<div>` blocks by removing indentation.
   *
   * @remarks
   * This internal method processes `<div>` blocks and cleans their inner content
   * by removing leading tabs/spaces per line and trimming surrounding newlines.
   * The `<div>` tags themselves are removed from the output.
   *
   * **Attributes:**
   *   - none
   *
   * @param template - The template string containing `<div>` blocks
   * @returns The template with `<div>` blocks replaced by their de-indented content
   *
   * @example
   * ```typescript
   * const template = '<div>\n    Line 1\n    Line 2\n</div>';
   * const processed = TemplateEngine._processDivBlocks(template);
   * // Result: 'Line 1\nLine 2'
   * ```
   *
   * @public
   */
  static _processDivBlocks(template: string) {
    return template.replace(/<div>([\s\S]*?)<\/div>/gi, (_, inner: string) => {
      const cleaned = inner
        .replace(/^[\t ]+/gm, ``)
        .replace(/^\n+/, ``)
        .replace(/\n+$/, ``)
      return cleaned
    })
  }

  /**
   * Block: switch
   * Transforms `<switch>` blocks into JavaScript switch statement expressions.
   *
   * @remarks
   * This internal method converts `<switch>` blocks with `<case>` and `<default>`
   * sub-blocks into self-invoking JavaScript switch expressions. The `value`
   * attribute specifies which data key to switch on. Case values can be
   * comma-separated for multiple matches.
   *
   * **Attributes:**
   *   - <switch>
   *      - `value` (required): The key name in the `data` object whose value will be used as the switch expression.
   *   - <case>
   *      - `is` (required): One or more literal match values. Multiple values may be provided as a comma-separated list.
   *   - <default>
   *      - none
   *
   * @param template - The template string containing `<switch>` blocks
   * @returns The template with `<switch>` blocks converted to executable switch expressions
   *
   * @example
   * ```typescript
   * const template = `
   *   <switch value="status">
   *     <case is="active">Active status</case>
   *     <case is="pending">Pending status</case>
   *     <default>Unknown status</default>
   *   </switch>
   * `;
   * const processed = TemplateEngine._processSwitchBlocks(template);
   * // Result: '${(() => { switch((data && data["status"])) { case "active": return `Active status`; ... } })()}'
   * ```
   *
   * @public
   */
  static _processSwitchBlocks(template: string) {
    const switchRegex = /<switch\b(?:\s+value="([^"]+)")?>([\s\S]*?)<\/switch>/gi
    return template.replace(switchRegex, (_, valueKey, innerContent) => {
      if (!valueKey) return ``

      let casesJs = ``
      const caseRegex = /<case\b(?:\s+is="([^"]+)")?>([\s\S]*?)<\/case>/gi
      const defaultRegex = /<default>([\s\S]*?)<\/default>/gi

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
   * Block: map
   * Transforms `<map>` blocks into JavaScript array map expressions.
   *
   * @remarks
   * This internal method converts `<map>` blocks into array mapping operations.
   * The `src` attribute specifies which data key contains the array. Inside the
   * block, `{{e}}` refers to the current element, `{{e.prop}}` to element properties,
   * and `{{i}}` to the current index. The `join` attribute specifies the separator.
   *
   * **Attributes:**
   *   - `src` (required): The key name in the `data` object whose value is treated as an array.
   *   - `join` (optional): Join separator string. Defaults to `"\\n"` (a newline escape sequence).
   *
   * @param template - The template string containing `<map>` blocks
   * @returns The template with `<map>` blocks converted to map expressions
   *
   * @example
   * ```typescript
   * const template = '<map src="items" join=", "> - {{e.name}} ({{i}})</map>';
   * const processed = TemplateEngine._processMapBlocks(template);
   * // Result: '${(data && data["items"] || []).map((e, i) => ` - ${e.name} (${i})`).join(", ")}'
   * ```
   *
   * @public
   */
  static _processMapBlocks(template: string) {
    const mapRegex = /<map(?:\s+([^>]*))?>([\s\S]*?)<\/map>/gi
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
   * Block: media
   * Extracts and parses `<media>` blocks from a template string.
   *
   * @remarks
   * This internal method identifies all `<media>` blocks and extracts their
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
   * - If multiple `<media>` blocks share the same `lang`, the last one wins
   *   (it overwrites the previous entry).
   *
   * @param template - The template string containing `<media>` blocks
   * @returns An object mapping language keys to their corresponding media block configurations
   *
   * @example
   * ```typescript
   * const template = '<media type="photo" src="image.jpg|image-2.jpg" lang="en">Hello</media>';
   * const media = TemplateEngine._processMediaBlocks(template);
   * // Result: { en: { type: 'photo', src: 'image.jpg|image-2.jpg', srcList: ['image.jpg', 'image-2.jpg'], caption: 'Hello' } }
   * ```
   *
   * @public
   */
  static _processMediaBlocks(template: string) {
    const mediaRegex = /<media(?:\s+([^>]*))?>([\s\S]*?)<\/media>/gi
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

  /** Parses `<media-group>` blocks into Telegram media group item definitions. */
  static _processMediaGroupBlocks(template: string) {
    const mediaGroupRegex = /<media-group(?:\s+([^>]*))?>([\s\S]*?)<\/media-group>/gi
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
   * Parses inner `<media>` items inside a `<media-group>` block body.
   *
   * Extracts `type`, `src`, `lang`, and `shared` attributes plus the caption
   * body for each inner `<media>` element. `shared` supports both standalone
   * boolean (`<media shared>`) and explicit (`<media shared="true">`) syntax.
   *
   * @param groupContent - The content between `<media-group>` and `</media-group>`
   * @returns An array of parsed media item descriptors, preserving document order
   */
  private static _processMediaGroupItems(groupContent: string): Array<{type: `photo` | `video` | `audio` | `document`; src: string; caption?: string; lang?: string; shared?: boolean}> {
    const mediaRegex = /<media(?:\s+([^>]*))?>([\s\S]*?)<\/media>/gi
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
   * Block: message
   * Extracts and parses `<message>` blocks from a template string.
   *
   * @remarks
   * This internal method identifies all `<message>` blocks and extracts their
   * content organized by language. Blocks without a `lang` attribute are stored
   * under `"default"`. Leading whitespace and surrounding newlines are trimmed.
   *
   * **Attributes:**
   *   - `lang` (optional): Language key for the output map. Defaults to `"default"`.
   *
   * @param template - The template string containing `<message>` blocks
   * @returns An object mapping language keys to their cleaned message content
   *
   * @example
   * ```typescript
   * const template = `
   *   <message>Hello World</message>
   *   <message lang="id">Halo Dunia</message>
   * `;
   * const messages = TemplateEngine._processMessageBlocks(template);
   * // Result: { default: 'Hello World', id: 'Halo Dunia' }
   * ```
   *
   * @public
   */
  static _processMessageBlocks(template: string) {
    const messageRegex = /<message(?:\s+([^>]*))?>([\s\S]*?)<\/message>/gi
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
   * Block: description
   * Extracts and parses `<description>` blocks from a template string.
   *
   * @remarks
   * This internal method identifies all `<description>` blocks and extracts their
   * content organized by language and scope. Blocks without a `lang` attribute
   * are stored under `"default"` language, and blocks without a `scope` attribute
   * are stored under `"default"` scope.
   *
   * **Attributes:**
   *   - `lang` (optional): Language key for the output map. Defaults to `"default"`.
   *   - `scope` (optional): Scope key for the nested output map. Defaults to `"default"`.
   *
   * @param template - The template string containing `<description>` blocks
   * @returns A nested object mapping language keys to scopes to their cleaned content
   *
   * @example
   * ```typescript
   * const template = `
   *   <description>Start the bot</description>
   *   <description lang="id">Mulai bot</description>
   *   <description scope="chat_administrators">Admin command</description>
   * `;
   * const descriptions = TemplateEngine._processDescriptionBlocks(template);
   * // Result: {
   * //   default: { default: 'Start the bot', chat_administrators: 'Admin command' },
   * //   id: { default: 'Mulai bot' }
   * // }
   * ```
   *
   * @public
   */
  static _processDescriptionBlocks(template: string) {
    const descriptionRegex = /<description(?:\s+([^>]*))?>([\s\S]*?)<\/description>/gi
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
   * Block: keyboard
   * Extracts and parses `<keyboard>` blocks from a template string.
   *
   * @remarks
   * This internal method identifies all `<keyboard>` blocks and extracts their
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
   * @param template - The template string containing `<keyboard>` blocks
   * @returns A nested object mapping language keys to keyboard mode configurations
   *
   * @example
   * ```typescript
   * const template = `
   *   <keyboard>Yes, No</keyboard>
   *   <keyboard type="bottom">Button 1, Button 2</keyboard>
   *   <keyboard lang="id">Ya, Tidak</keyboard>
   * `;
   * const keyboards = TemplateEngine._processKeyboardBlocks(template);
   * // Result: {
   * //   default: { inline: 'Yes, No', bottom: 'Button 1, Button 2' },
   * //   id: { inline: 'Ya, Tidak' }
   * // }
   * ```
   *
   * @public
   */
  static _processKeyboardBlocks(template: string) {
    const keyboardRegex = /<keyboard(?:\s+([^>]*))?>([\s\S]*?)<\/keyboard>/gi
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
    processed = this._processScriptBlocks(this._processDivBlocks(this._processSpaceBlocks(processed)))

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
   * This method parses `<media>` blocks from the template and compiles them into
   * functions that generate `ITMediaBlock` objects. The result is organized by
   * base ID and language. Pre-parsed base blocks can be provided for efficiency.
   *
   * @param template - Raw template string containing `<base>` and `<media>` blocks
   * @param baseBlocks - Optional pre-parsed base blocks for reuse
   * @returns Compiled media functions organized by base ID and language
   *
   * @example
   * ```typescript
   * const template = `
   *   <base>
   *     <media type="photo" src="{{image}}">{{caption}}</media>
   *   </base>
   * `;
   * const media = TemplateEngine.compileBlockMedia(template);
   * const result = media.default?.default?.({ image: 'photo.jpg', caption: 'Hello' });
   * // Result: { type: 'photo', src: 'photo.jpg', caption: 'Hello' }
   * ```
   *
   * @public
   */
  static compileBlockMedia(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processBaseBlocks>) {
    const bases = baseBlocks || this._processBaseBlocks(template)
    const result: {
      [baseId: string]: {
        [lang: string]: (data?: Record<string, any>) => ITMediaBlock
      }
    } = {}

    for (const [baseId, baseContent] of Object.entries(bases)) {
      const mediaBlocks = {...this._processMediaBlocks(baseContent), ...this._processMediaGroupBlocks(baseContent)}
      result[baseId] = {}

      for (const [lang, mediaBlock] of Object.entries(mediaBlocks)) {
        const compiledProps: Record<string, (data?: Record<string, any>) => string> = {}
        const compiledMediaGroup = mediaBlock.mediaGroup?.map((item) => ({
          type: item.type,
          src: this._compileToFunction(this._processScopeVariables(this._processScopeExec(this._processSwitchBlocks(this._processMapBlocks(this._processScriptBlocks(item.src))))), false),
          caption: item.caption ? this._compileToFunction(this._processScopeVariables(this._processScopeExec(this._processSwitchBlocks(this._processMapBlocks(this._processScriptBlocks(item.caption))))), false) : undefined
        }))

        for (const [key, value] of Object.entries(mediaBlock)) {
          if (key === `type` || typeof value !== `string`) continue

          const processed = this._processScopeVariables(this._processScopeExec(this._processSwitchBlocks(this._processMapBlocks(this._processScriptBlocks(value)))))
          compiledProps[key] = this._compileToFunction(processed, false)
        }

        result[baseId][lang] = (data?: Record<string, any>) => {
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
   * This method parses `<message>` blocks from the template and compiles them into
   * functions that generate rendered message strings. The result is organized by
   * base ID and language. Pre-parsed base blocks can be provided for efficiency.
   *
   * Processing pipeline (in order, per message):
   * 1. `_processScriptBlocks` - converts `<script>` blocks into executable expressions
   * 2. `_processMapBlocks` - converts `<map>` blocks into array map expressions
   * 3. `_processSwitchBlocks` - converts `<switch>` blocks into switch expressions
   * 4. `_processScopeExec` - evaluates scope execution blocks (implementation-defined)
   * 5. `_processScopeVariables` - resolves scope variables (implementation-defined)
   * 6. `_compileToFunction(processed, false)` - produces the final render function
   *
   * Output shape:
   * - First level key: `baseId` (from `<base id="...">`, or `"default"` if omitted)
   * - Second level key: `lang` (from `<message lang="...">`, or `"default"` if omitted)
   * - Value: `(data?: Record<string, any>) => string`
   *
   * @param template - Raw template string containing `<base>` and `<message>` blocks
   * @param baseBlocks - Optional pre-parsed base blocks for reuse
   * @returns Compiled message functions organized by base ID and language
   *
   * @example
   * ```typescript
   * const template = `
   *   <base>
   *     <message>Hello {{name}}!</message>
   *     <message lang="id">Halo {{name}}!</message>
   *   </base>
   * `;
   * const messages = TemplateEngine.compileBlockMessages(template);
   * const result = messages.default?.default?.({ name: 'John' });
   * // Result: 'Hello John!'
   * ```
   *
   * @public
   */
  static compileBlockMessage(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processBaseBlocks>) {
    const bases = baseBlocks || this._processBaseBlocks(template)
    const result: {
      [baseId: string]: {
        [lang: string]: (data?: Record<string, any>) => string
      }
    } = {}

    for (const [baseId, baseContent] of Object.entries(bases)) {
      const messages = this._processMessageBlocks(baseContent)
      result[baseId] = {}

      for (const [lang, content] of Object.entries(messages)) {
        const processed = this._processScopeVariables(this._processScopeExec(this._processSwitchBlocks(this._processMapBlocks(this._processScriptBlocks(content)))))
        result[baseId][lang] = this._compileToFunction(processed, false)
      }
    }

    return result
  }

  /**
   * Compiles description blocks from a template into executable functions.
   *
   * @remarks
   * This method parses `<description>` blocks from the template and compiles them
   * into functions that generate rendered description strings. The result is organized
   * by base ID, scope, and language. Used for Telegram bot command descriptions.
   *
   * Processing pipeline (in order, per description):
   * 1. `_processScriptBlocks` – converts `<script>` blocks into executable expressions
   * 2. `_processMapBlocks` – converts `<map>` blocks into array map expressions
   * 3. `_processSwitchBlocks` – converts `<switch>` blocks into switch expressions
   * 4. `_processScopeExec` – evaluates scope execution blocks (implementation-defined)
   * 5. `_processScopeVariables` – resolves scope variables (implementation-defined)
   * 6. `_compileToFunction(processed, false)` – produces the final render function
   *
   * Output shape:
   * - First level key: `baseId` (from `<base id="...">`, or `"default"` if omitted)
   * - Second level key: `scope` (from `<description scope="...">`, or `"default"` if omitted)
   * - Third level key: `lang` (from `<description lang="...">`, or `"default"` if omitted)
   * - Value: `(data?: Record<string, any>) => string`
   *
   * @param template - Raw template string containing `<base>` and `<description>` blocks
   * @param baseBlocks - Optional pre-parsed base blocks for reuse
   * @returns Compiled description functions organized by base ID, scope, and language
   *
   * @example
   * ```typescript
   * const template = `
   *   <base>
   *     <description>Start the bot</description>
   *     <description scope="chat_administrators">Admin command</description>
   *   </base>
   * `;
   * const descriptions = TemplateEngine.compileBlockDescription(template);
   * const result = descriptions.default?.default?.default?.({});
   * // Result: 'Start the bot'
   * ```
   *
   * @public
   */
  static compileBlockDescription(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processBaseBlocks>) {
    const bases = baseBlocks || this._processBaseBlocks(template)
    const result: {
      [baseId: string]: {
        [scope: string]: {
          [lang: string]: (data?: Record<string, any>) => string
        }
      }
    } = {}

    for (const [baseId, baseContent] of Object.entries(bases)) {
      const descriptions = this._processDescriptionBlocks(baseContent)
      result[baseId] = {}

      for (const [lang, scopes] of Object.entries(descriptions)) {
        for (const [scope, content] of Object.entries(scopes)) {
          if (!result[baseId][scope]) {
            result[baseId][scope] = {}
          }
          const processed = this._processScopeVariables(this._processScopeExec(this._processSwitchBlocks(this._processMapBlocks(this._processScriptBlocks(content)))))
          result[baseId][scope][lang] = this._compileToFunction(processed, false)
        }
      }
    }

    return result
  }

  /**
   * Compiles keyboard blocks from a template into executable functions.
   *
   * @remarks
   * This method parses `<keyboard>` blocks from the template and compiles them
   * into functions that generate button label arrays. The result is organized by
   * base ID and language, with separate `inline` and `bottom` keyboard modes.
   * Comma-separated labels are split into individual button strings.
   *
   * Processing pipeline (in order, per keyboard label):
   * 1. `_processScriptBlocks` – converts `<script>` blocks into executable expressions
   * 2. `_processMapBlocks` – converts `<map>` blocks into array map expressions
   * 3. `_processSwitchBlocks` – converts `<switch>` blocks into switch expressions
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
   * - First level key: `baseId` (from `<base id="...">`, or `"default"` if omitted)
   * - Second level key: `lang` (from `<keyboard lang="...">`, or `"default"` if omitted)
   * - Third level key: `mode`:
   *   - `inline` (default)
   *   - `bottom`
   * - Value: `(data?: Record<string, any>) => string[]`
   *
   * @param template - Raw template string containing `<base>` and `<keyboard>` blocks
   * @param baseBlocks - Optional pre-parsed base blocks for reuse
   * @returns Compiled keyboard functions organized by base ID, language, and mode
   *
   * @example
   * ```typescript
   * const template = `
   *   <base>
   *     <keyboard>Yes, No, {{action}}</keyboard>
   *     <keyboard type="bottom">Menu, Help</keyboard>
   *   </base>
   * `;
   * const keyboards = TemplateEngine.compileBlockKeyboards(template);
   * const inline = keyboards.default?.default?.inline?.({ action: 'Cancel' });
   * // Result: ['Yes', 'No', 'Cancel']
   * ```
   *
   * @public
   */
  static compileBlockKeyboards(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processBaseBlocks>) {
    const bases = baseBlocks || this._processBaseBlocks(template)
    const result: {
      [baseId: string]: {
        [lang: string]: {
          inline?: (data?: Record<string, any>) => string[]
          bottom?: (data?: Record<string, any>) => string[]
        }
      }
    } = {}

    for (const [baseId, baseContent] of Object.entries(bases)) {
      const keyboards = this._processKeyboardBlocks(baseContent)
      result[baseId] = {}

      for (const [lang, modes] of Object.entries(keyboards)) {
        result[baseId][lang] = {}

        for (const [mode, content] of Object.entries(modes)) {
          // Seperates label, handle escaped comma
          const labels = content.split(/(?<!\\),\s*/).map((label: string) => label.replace(/\\,/g, `,`).trim())

          const processedLabels = labels.map((label) => this._processScopeVariables(this._processScopeExec(this._processSwitchBlocks(this._processMapBlocks(this._processScriptBlocks(label))))))

          result[baseId][lang][mode as `inline` | `bottom`] = this._compileToFunction(processedLabels, true)
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
   * @param baseId - The base ID to extract from (defaults to `"default"`)
   * @param section - Whether to return the full block (`"all"`) or just inner content (`"value"`)
   * @param lang - Optional language filter for blocks
   * @returns The extracted content as a string
   *
   * @example
   * ```typescript
   * const template = `
   *   <base id="main">
   *     <message>Hello</message>
   *     <keyboard>Yes, No</keyboard>
   *   </base>
   * `;
   * const result = TemplateEngine._extractBlock(template, 'message', 'main', 'value');
   * // Result: 'Hello'
   * ```
   *
   * @public
   */
  static _extractBlock(content: string, blocks?: string | string[], baseId: string = `default`, section: `all` | `value` = `all`, lang?: string) {
    // 1. Extract Base Block
    const baseRegex = /<base\b[^>]*?(?:\sid=(["']?)([^"'\s>]+)\1)?[^>]*?>([\s\S]*?)<\/base>/g
    let baseContent = content
    let foundBase = false

    // Try to find specific base
    for (const match of content.matchAll(baseRegex)) {
      const id = match[2] ?? `default`
      if (id === baseId) {
        baseContent = match[3] ?? ``
        foundBase = true
        break
      }
    }

    // If base not found
    if (!foundBase) {
      const hasAnyBase = /<base\b/.test(content)
      if (baseId === `default` && !hasAnyBase) {
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
   * Parses `<import>` directives from a template and extracts import metadata.
   *
   * @remarks
   * This internal method identifies all `<import>` tags in a template and replaces
   * them with placeholders while collecting their metadata (src, blocks, base, lang,
   * section, indent). The placeholders are later resolved by `processImportBlocks`.
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
   * @param template - The template string containing `<import>` directives
   * @returns An object containing the processed template with placeholders and an array of import metadata
   *
   * @example
   * ```typescript
   * const template = '<import src="other-page" block="message" />';
   * const { processed, imports } = TemplateEngine._processImportBlocks(template);
   * // processed: '__IMPORT_0__'
   * // imports: [{ src: 'other-page', blocks: 'message', base: 'default', ... }]
   * ```
   *
   * @public
   */
  static _processImportBlocks(template: string) {
    const importRegex = /([ \t]*)<import(?:\s+([^>]*))?\/?>/gi
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

      // Parse blocks attribute: "all" | "block1,block2" | "block1, block2" | single block
      let blocks: string | string[] | undefined
      if (attrs.block) {
        if (attrs.block === `all`) {
          blocks = `all`
        } else if (attrs.block.includes(`,`)) {
          // Split by comma and trim each value to support both "a,b" and "a, b"
          blocks = attrs.block
            .split(`,`)
            .map((b) => b.trim())
            .filter((b) => b)
        } else {
          blocks = attrs.block
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
   * Recursively processes and resolves `<import>` blocks in a template.
   *
   * @remarks
   * This method resolves all `<import>` placeholders produced by `_processImportBlocks` by invoking a user-provided `resolver` function.
   *
   * Resolution behavior:
   * - Each `<import>` is resolved by calling `resolver(src)` to obtain raw template content.
   * - The resolved content is filtered using `_extractBlock` based on the import metadata
   *   (`blocks`, `base`, `section`, `lang`).
   * - If the resolved content itself contains `<import>` directives, they are processed
   *   recursively.
   *
   * Recursion and safety:
   * - Recursive import resolution is limited to a maximum depth of **10** to prevent
   *   infinite import loops.
   * - If the depth limit is exceeded, an empty string is returned.
   *
   * Output behavior:
   * - `<import>` placeholders (`__IMPORT_N__`) are replaced sequentially.
   * - If the resolver returns `null` or an empty result, the import is replaced with
   *   an empty string.
   *
   * @param template - Template string containing `<import>` directives
   * @param resolver - Function that resolves import sources to template content
   * @param depth - Current recursion depth (defaults to 0)
   * @param importCache - Optional Map to cache resolved imports for reuse
   * @returns Template with all `<import>` blocks resolved and replaced
   *
   * @example
   * ```typescript
   * const template = '<import src="header" block="message" />\n<message>Main content</message>';
   * const resolver = (src: string) => {
   *   if (src === 'header') return '<message>Header text</message>';
   *   return null;
   * };
   * const result = TemplateEngine.processImportBlocks(template, resolver);
   * // Result: '<message>Header text</message>\n<message>Main content</message>'
   * ```
   *
   * @public
   */
  static processImportBlocks(template: string, resolver: (src: string) => string | null, depth = 0, importCache?: Map<string, string>): string {
    if (depth > 10) return `` // recursive limit

    const {processed, imports} = this._processImportBlocks(template)

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
        if (resolved && resolved.includes(`<import`)) {
          resolved = this.processImportBlocks(resolved, resolver, depth + 1, importCache)
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
    const allowedBlockNames = new Set(
      TemplateEngine.ALLOWED_BLOCKS.map((block) =>
        block
          .replace(/^<\/?/, ``)
          .replace(/\s.*?>$/, ``)
          .replace(/\/?>$/, ``)
          .toLowerCase()
      )
    )
    const passthroughTags = new Set([`b`, `i`, `u`, `s`, `code`, `pre`, `a`, `blockquote`])
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
   *   ├── base             (root level only)
   *   │   ├── message      (content block)
   *   │   │   ├── switch   (logic block)
   *   │   │   │   ├── case
   *   │   │   │   └── default
   *   │   │   ├── map      (logic block)
   *   │   │   ├── script   (logic block)
   *   │   │   └── space    (utility)
   *   │   ├── keyboard     (content block)
   *   │   │   ├── switch   (logic block)
   *   │   │   │   ├── case
   *   │   │   │   └── default
   *   │   │   ├── map      (logic block)
   *   │   │   ├── script   (logic block)
   *   │   │   └── space    (utility)
   *   │   ├── media        (content block)
   *   │   │   ├── switch   (logic block)
   *   │   │   │   ├── case
   *   │   │   │   └── default
   *   │   │   ├── map      (logic block)
   *   │   │   ├── script   (logic block)
   *   │   │   └── space    (utility)
   *   │   ├── description  (content block)
   *   │   │   ├── switch   (logic block)
   *   │   │   │   ├── case
   *   │   │   │   └── default
   *   │   │   ├── map      (logic block)
   *   │   │   ├── script   (logic block)
   *   │   │   └── space    (utility)
   *   │   ├── import       (utility)
   *   │   ├── description  (utility)
   *   │   ├── script       (logic block)
   *   └   └── space        (utility)
   * ```
   *
   * **Enforced rules:**
   * - `<base>` must be at the outermost level and cannot be nested inside any other block.
   * - `<message>`, `<keyboard>`, `<media>`, `<media-group>`, `<description>`, `<import>`, `<script>`, `<space>` can only appear directly inside `<base>`.
   * - `<media>` can also appear directly inside `<media-group>` as a group item.
   * - `<switch>`, `<map>` can only appear inside `<message>`, `<keyboard>`, `<media>`, or `<description>`.
   * - `<case>` and `<default>` can only appear inside `<switch>`.
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
   *   <base>
   *     <message>Hello {{name}}!</message>
   *     <keyboard>Yes, No</keyboard>
   *   </base>
   * `);
   * // Result: { valid: true, errors: [] }
   *
   * // Invalid: <base> nested inside <message>
   * const bad = TemplateEngine.validatePositionsBlock(`
   *   <base>
   *     <message>
   *       <base>Nested base</base>
   *     </message>
   *   </base>
   * `);
   * // Result: { valid: false, errors: [{ line: 4, message: 'Block <base> is not allowed inside <message>' }] }
   * ```
   *
   * @public
   */
  static validatePositionsBlock(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors: Array<{line: number; message: string}> = []
    const stack: Array<{block: string; line: number}> = []

    // Passthrough Telegram HTML tags that are not structural
    const passthroughTags = new Set([`b`, `i`, `u`, `s`, `code`, `pre`, `a`, `blockquote`])

    // Allowed parent context for each structural block.
    // `__root__` represents the outermost level (outside any block).
    const allowedParents: Record<string, Set<string>> = {
      base: new Set([`__root__`]),
      message: new Set([`base`]),
      keyboard: new Set([`base`]),
      media: new Set([`base`, `media-group`]),
      "media-group": new Set([`base`]),
      description: new Set([`base`]),
      switch: new Set([`message`, `keyboard`, `media`, `description`]),
      case: new Set([`switch`]),
      default: new Set([`switch`]),
      map: new Set([`message`, `keyboard`, `media`, `description`]),
      div: new Set([`base`, `message`, `description`, `keyboard`, `case`, `default`, `map`]),
      script: new Set([`base`, `message`, `description`, `keyboard`, `case`, `default`, `map`, `div`]),
      import: new Set([`base`]),
      space: new Set([`base`, `message`, `description`, `keyboard`, `case`, `default`, `switch`, `map`, `div`])
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

    // Check for content outside <base> blocks.
    // All template content must be enclosed in <base>...</base>.
    if (errors.length === 0) {
      const baseBlocks: Array<{start: number; end: number}> = []
      const baseTag = /<base\b[^>]*>[\s\S]*?<\/base>/g
      let blockMatch: RegExpExecArray | null
      while ((blockMatch = baseTag.exec(template)) !== null) {
        baseBlocks.push({start: blockMatch.index, end: blockMatch.index + blockMatch[0].length})
      }

      if (baseBlocks.length === 0 && template.trim()) {
        // No <base> block at all
        errors.push({line: 1, message: `Missing <base> block: template content must be wrapped in <base>...</base>`})
      } else {
        // Check before first <base>
        let prevEnd = 0
        for (const block of baseBlocks) {
          if (block.start > prevEnd) {
            const slice = template.slice(prevEnd, block.start)
            if (slice.trim()) {
              const line = (template.slice(0, prevEnd).match(/\n/g) || []).length + 1
              errors.push({line, message: `Content found outside <base> block: move content inside a <base>...</base>`})
              break
            }
          }
          prevEnd = block.end
        }
        // Check after last </base>
        if (errors.length === 0 && prevEnd < template.length && template.slice(prevEnd).trim()) {
          const line = (template.slice(0, prevEnd).match(/\n/g) || []).length + 1
          errors.push({line, message: `Content found outside <base> block: move content inside a <base>...</base>`})
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
   * - `<space />` — whitespace control block
   * - `<import ... />` — import directive block
   *
   * **Must NOT be self-closing (must use open/close tags):**
   * - `<base>...</base>`, `<message>...</message>`, `<keyboard>...</keyboard>`,
   *   `<media>...</media>`, `<description>...</description>`, `<script>...</script>`,
   *   `<switch>...</switch>`, `<case>...</case>`, `<default>...</default>`,
   *   `<map>...</map>`, `<div>...</div>`
   *
   * Telegram HTML formatting tags passthrough and are ignored.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array containing
   *          line numbers and descriptive messages for each format violation found
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateFormatBlock(`<space>content</space>`);
   * // Result: { valid: false, errors: [{ line: 1, message: 'Block <space> must be self-closing: use <space /> instead' }] }
   * ```
   *
   * @public
   */
  static validateFormatBlock(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors: Array<{line: number; message: string}> = []
    const selfClosingBlocks = new Set([`space`, `import`])
    const regularBlocks = new Set([`base`, `message`, `keyboard`, `media`, `media-group`, `description`, `script`, `switch`, `case`, `default`, `map`, `div`])

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
   * @param tagName - Block tag name (e.g. `base`, `message`)
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
   * Validates attributes on `<base>` blocks.
   *
   * @remarks
   * The only allowed attribute is `id`.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockBaseAttributes(`<base id="main"></base>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockBaseAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `base`, new Set([`id`]), `"id"`, {
      id: (v) => (v ? null : `Attribute "id" on <base> must not be empty`)
    })
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<message>` blocks.
   *
   * @remarks
   * The only allowed attribute is `lang`.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockMessageAttributes(`<message lang="en">Hi</message>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockMessageAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `message`, new Set([`lang`]), `"lang"`)
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<keyboard>` blocks.
   *
   * @remarks
   * Allowed attributes are `lang` and `type`.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockKeyboardAttributes(`<keyboard type="bottom">A, B</keyboard>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockKeyboardAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `keyboard`, new Set([`lang`, `type`]), `"lang" and "type"`, {
      type: (v) => (v === `inline` || v === `bottom` ? null : `Attribute "type" on <keyboard> must be "inline" or "bottom", got "${v}"`)
    })
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<media>` blocks.
   *
   * @remarks
   * Allowed attributes are `lang`, `type`, `src`, `shared`, `latitude`, `longitude`,
   * `phone`, `first_name`, `last_name`, and `vcard`.
   *
   * `shared` is a boolean attribute — it can be written as `shared`, `shared="true"`,
   * or `shared="false"`. When `true`, the media item is included in all language
   * variants of the enclosing `<media-group>`. Only valid inside `<media-group>`.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockMediaAttributes(`<media type="photo" src="img.jpg">Caption</media>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockMediaAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const validTypes = new Set([`photo`, `video`, `audio`, `document`, `animation`, `voice`, `video_note`, `sticker`, `location`, `contact`])
    const errors = this._validateBlockAttributes(template, `media`, new Set([`lang`, `type`, `src`, `shared`, `latitude`, `longitude`, `phone`, `first_name`, `last_name`, `vcard`]), `"lang", "type", "src", "shared", "latitude", "longitude", "phone", "first_name", "last_name", and "vcard"`, {
      type: (v) => (validTypes.has(v) ? null : `Attribute "type" on <media> must be one of: ${[...validTypes].join(`, `)}, got "${v}"`),
      shared: (v) => (v === `true` || v === `false` ? null : `Attribute "shared" on <media> must be "true" or "false", got "${v}"`)
    })
    return {valid: errors.length === 0, errors}
  }

  /** Validates attributes and item constraints on `<media-group>` blocks. */
  static validateBlockMediaGroupAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `media-group`, new Set([`lang`]), `"lang"`)
    errors.push(...this._validateMediaGroupItems(template))
    return {valid: errors.length === 0, errors}
  }

  private static _validateMediaGroupItems(template: string): Array<{line: number; message: string}> {
    const errors: Array<{line: number; message: string}> = []
    const mediaGroupRegex = /<media-group(?:\s+[^>]*)?>([\s\S]*?)<\/media-group>/gi
    const mediaRegex = /<media(?:\s+([^>]*))?>([\s\S]*?)<\/media>/gi
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
          errors.push({line, message: `Attribute "type" on <media> inside <media-group> must be one of: photo, video, audio, document`})
          continue
        }
        if (!src) {
          errors.push({line, message: `Attribute "src" on <media> inside <media-group> is required`})
        }
        itemTypes.push(type)
      }

      if (itemCount === 0) {
        errors.push({line: groupLine, message: `<media-group> must contain at least one <media> item`})
      }
      if (itemCount > this.MAX_MEDIA_GROUP_ITEMS) {
        errors.push({line: groupLine, message: `<media-group> must contain at most ${this.MAX_MEDIA_GROUP_ITEMS} <media> items`})
      }
      const uniqueTypes = new Set(itemTypes)
      if (uniqueTypes.has(`audio`) && uniqueTypes.size > 1) {
        errors.push({line: groupLine, message: `<media-group> with audio items can only contain audio items`})
      }
      if (uniqueTypes.has(`document`) && uniqueTypes.size > 1) {
        errors.push({line: groupLine, message: `<media-group> with document items can only contain document items`})
      }
    }

    return errors
  }

  /**
   * Validates attributes on `<description>` blocks.
   *
   * @remarks
   * Allowed attributes are `lang` and `scope`.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockDescriptionAttributes(`<description scope="chat_administrators">Admin cmd</description>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockDescriptionAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `description`, new Set([`lang`, `scope`]), `"lang" and "scope"`)
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<script>` blocks.
   *
   * @remarks
   * No attributes are allowed on `<script>` blocks.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockScriptAttributes(`<script>return x;</script>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockScriptAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `script`, new Set(), ``)
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<switch>` blocks.
   *
   * @remarks
   * The only allowed attribute is `value`.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockSwitchAttributes(`<switch value="status">...</switch>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockSwitchAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `switch`, new Set([`value`]), `"value"`)
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<case>` blocks.
   *
   * @remarks
   * The only allowed attribute is `is`.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockCaseAttributes(`<case is="active">Active</case>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockCaseAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `case`, new Set([`is`]), `"is"`)
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<default>` blocks.
   *
   * @remarks
   * No attributes are allowed on `<default>` blocks.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockDefaultAttributes(`<default>Unknown</default>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockDefaultAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `default`, new Set(), ``)
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<map>` blocks.
   *
   * @remarks
   * Allowed attributes are `src` and `join`.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockMapAttributes(`<map src="items" join=", ">{{e}}</map>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockMapAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `map`, new Set([`src`, `join`]), `"src" and "join"`)
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<div>` blocks.
   *
   * @remarks
   * No attributes are allowed on `<div>` blocks.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockDivAttributes(`<div>content</div>`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockDivAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `div`, new Set(), ``)
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<import>` blocks.
   *
   * @remarks
   * Allowed attributes are `src`, `block`, `base`, `lang`, and `section`.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockImportAttributes(`<import src="other" block="message" />`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockImportAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `import`, new Set([`src`, `block`, `base`, `lang`, `section`]), `"src", "block", "base", "lang", and "section"`)
    return {valid: errors.length === 0, errors}
  }

  /**
   * Validates attributes on `<space>` blocks.
   *
   * @remarks
   * No attributes are allowed on `<space>` blocks.
   *
   * @param template - The raw template string to validate
   * @returns An object with a `valid` boolean and an `errors` array
   *
   * @example
   * ```typescript
   * const result = TemplateEngine.validateBlockSpaceAttributes(`<space />`);
   * // Result: { valid: true, errors: [] }
   * ```
   *
   * @public
   */
  static validateBlockSpaceAttributes(template: string): {valid: boolean; errors: Array<{line: number; message: string}>} {
    const errors = this._validateBlockAttributes(template, `space`, new Set(), ``)
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
   * 5. {@link TemplateEngine.validateBlockBaseAttributes} — checks `<base>` block attributes
   * 6. {@link TemplateEngine.validateBlockMessageAttributes} — checks `<message>` block attributes
   * 7. {@link TemplateEngine.validateBlockKeyboardAttributes} — checks `<keyboard>` block attributes
   * 8. {@link TemplateEngine.validateBlockMediaAttributes} — checks `<media>` block attributes
   * 9. {@link TemplateEngine.validateBlockDescriptionAttributes} — checks `<description>` block attributes
   * 10. {@link TemplateEngine.validateBlockScriptAttributes} — checks `<script>` block attributes
   * 11. {@link TemplateEngine.validateBlockSwitchAttributes} — checks `<switch>` block attributes
   * 12. {@link TemplateEngine.validateBlockCaseAttributes} — checks `<case>` block attributes
   * 13. {@link TemplateEngine.validateBlockDefaultAttributes} — checks `<default>` block attributes
   * 14. {@link TemplateEngine.validateBlockMapAttributes} — checks `<map>` block attributes
   * 15. {@link TemplateEngine.validateBlockDivAttributes} — checks `<div>` block attributes
   * 16. {@link TemplateEngine.validateBlockImportAttributes} — checks `<import>` block attributes
   * 17. {@link TemplateEngine.validateBlockSpaceAttributes} — checks `<space>` block attributes
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
   *   <base>
   *     <message>Hello {{name}}!</message>
   *   </base>
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
    const baseAttrResult = this.validateBlockBaseAttributes(template)
    const messageAttrResult = this.validateBlockMessageAttributes(template)
    const keyboardAttrResult = this.validateBlockKeyboardAttributes(template)
    const mediaAttrResult = this.validateBlockMediaAttributes(template)
    const mediaGroupAttrResult = this.validateBlockMediaGroupAttributes(template)
    const descriptionAttrResult = this.validateBlockDescriptionAttributes(template)
    const scriptAttrResult = this.validateBlockScriptAttributes(template)
    const switchAttrResult = this.validateBlockSwitchAttributes(template)
    const caseAttrResult = this.validateBlockCaseAttributes(template)
    const defaultAttrResult = this.validateBlockDefaultAttributes(template)
    const mapAttrResult = this.validateBlockMapAttributes(template)
    const divAttrResult = this.validateBlockDivAttributes(template)
    const importAttrResult = this.validateBlockImportAttributes(template)
    const spaceAttrResult = this.validateBlockSpaceAttributes(template)

    const errors = [
      ...blockNamesResult.errors,
      ...scopesResult.errors,
      ...formatResult.errors,
      ...positionsResult.errors,
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
      ...spaceAttrResult.errors
    ]

    return {
      valid: errors.length === 0,
      errors
    }
  }
}
