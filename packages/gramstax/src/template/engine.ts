/**
 * Represents a media block configuration for Telegram messages.
 *
 * @remarks
 * This type defines the structure for various media types supported by Telegram,
 * including file-based media (photo, video, audio, document, animation, voice,
 * video_note, sticker), location, and contact.
 *
 * @example
 * ```typescript
 * const photoMedia: IMediaBlock = {
 *   type: 'photo',
 *   src: 'path/to/image.jpg',
 *   caption: 'A beautiful sunset'
 * };
 *
 * const locationMedia: IMediaBlock = {
 *   type: 'location',
 *   latitude: '37.7749',
 *   longitude: '-122.4194'
 * };
 *
 * const contactMedia: IMediaBlock = {
 *   type: 'contact',
 *   phone: '+1234567890',
 *   first_name: 'John',
 *   last_name: 'Doe'
 * };
 * ```
 *
 * @public
 */
export type IMediaBlock = {
  type: `photo` | `video` | `audio` | `document` | `animation` | `voice` | `video_note` | `sticker` | `location` | `contact`
  src?: string
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
 * const messages = TemplateEngine.compileMessages(template);
 * const keyboards = TemplateEngine.compileKeyboards(template);
 *
 * const msg = messages.default.default({ name: 'John' });
 * // Result: 'Welcome John!'
 * ```
 *
 * @public
 */
export class TemplateEngine {
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

      return `\${(data && data["${src}"] || []).map((e, i) => \`${content}\`).join("${safeJoin}")}`
    })
  }

  /**
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
   * const template = '<media type="photo" src="image.jpg" lang="en">Hello</media>';
   * const media = TemplateEngine._processMediaBlocks(template);
   * // Result: { en: { type: 'photo', src: 'image.jpg', caption: 'Hello' } }
   * ```
   *
   * @public
   */
  static _processMediaBlocks(template: string) {
    const mediaRegex = /<media(?:\s+([^>]*))?>([\s\S]*?)<\/media>/gi
    const result: {[lang: string]: IMediaBlock} = {}

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

  /**
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
   * functions that generate `IMediaBlock` objects. The result is organized by
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
   * const media = TemplateEngine.compileMedia(template);
   * const result = media.default.default({ image: 'photo.jpg', caption: 'Hello' });
   * // Result: { type: 'photo', src: 'photo.jpg', caption: 'Hello' }
   * ```
   *
   * @public
   */
  static compileBlockMedia(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processBaseBlocks>) {
    const bases = baseBlocks || this._processBaseBlocks(template)
    const result: {
      [baseId: string]: {
        [lang: string]: (data?: Record<string, any>) => IMediaBlock
      }
    } = {}

    for (const [baseId, baseContent] of Object.entries(bases)) {
      const mediaBlocks = this._processMediaBlocks(baseContent)
      result[baseId] = {}

      for (const [lang, mediaBlock] of Object.entries(mediaBlocks)) {
        const compiledProps: Record<string, (data?: Record<string, any>) => string> = {}

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
   * const messages = TemplateEngine.compileMessages(template);
   * const result = messages.default.default({ name: 'John' });
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
   * const descriptions = TemplateEngine.compileDescription(template);
   * const result = descriptions.default.default.default({});
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
   * const keyboards = TemplateEngine.compileKeyboards(template);
   * const inline = keyboards.default.default.inline?.({ action: 'Cancel' });
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
}
