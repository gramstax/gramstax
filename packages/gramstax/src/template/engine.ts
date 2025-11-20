type IMediaBlock = {
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

export class TemplateEngine {
  public static _escape(str: string): string {
    return str
      .replace(/\\/g, `\\\\`) // escape backslash: \ → \\
      .replace(/`/g, `\\\``) // escape backtick: ` → \`
  }

  public static _processVariables(template: string) {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => `\${(data && data["${key}"]) ?? ""}`)
  }

  public static _processBaseBlocks(template: string) {
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

  public static _processScriptBlocks(template: string) {
    return template.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (_, rawCode) => {
      const innerCode = rawCode.trim()
      if (!innerCode) return ``

      return `\${(() => { if (!data) return ''; try { with(data) { ${innerCode} } } catch(e) { return '' } })()}`
    })
  }

  public static _processSpaceBlocks(template: string) {
    return template.replace(/^[ \t]*<space\s*\/>[ \t]*$/gim, ``)
  }

  public static _processDivBlocks(template: string) {
    return template.replace(/<div>([\s\S]*?)<\/div>/gi, (_, inner) => {
      const cleaned = inner
        .replace(/^[\t ]+/gm, ``)
        .replace(/^\n+/, ``)
        .replace(/\n+$/, ``)
      return cleaned
    })
  }

  public static _processMediaBlocks(template: string) {
    const mediaRegex = /<media\s+([^>]+)>([\s\S]*?)<\/media>/gi
    const result: { [lang: string]: IMediaBlock } = {}

    for (const match of template.matchAll(mediaRegex) as any) {
      const attributesStr = match[1]
      const rawContent = match[2]

      // Extract all attributes
      const attrs: { [key: string]: string } = {}
      const attrRegex = /(\w+)="([^"]*)"/g

      for (const attrMatch of attributesStr.matchAll(attrRegex) as any) {
        attrs[attrMatch[1]] = attrMatch[2]
      }

      // Make sure have lang attribute
      if (!attrs.lang) {
        continue
      }

      const lang = attrs.lang
      const type = attrs.type

      // Clean caption/content
      const caption = rawContent
        .replace(/^[\t ]+/gm, ``)
        .replace(/^\n+/, ``)
        .replace(/\n+$/, ``)
        .trim()

      // Build media block based on type
      const mediaBlock: any = { type }

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

      result[lang] = mediaBlock
    }

    return result
  }

  public static _processMessageBlocks(template: string) {
    const messageRegex = /<message\s+lang="([^"]+)"\s*>([\s\S]*?)<\/message>/gi
    const result: {
      [lang: string]: string
    } = {}

    for (const [, lang, rawContent] of template.matchAll(messageRegex) as any) {
      const cleaned = rawContent
        .replace(/^[\t ]+/gm, ``)
        .replace(/^\n+/, ``)
        .replace(/\n+$/, ``)
        .trim()

      result[lang] = cleaned
    }
    return result
  }

  public static _processKeyboardBlocks(template: string) {
    const keyboardRegex = /<keyboard\b[^>]*\blang="([^"]*)"[^>]*?(?:\stype="([^"]*)")?[^>]*>([\s\S]*?)<\/keyboard>/gi
    const result: {
      [lang: string]: {
        inline?: string
        default?: string
      }
    } = {}

    for (const [, lang, typeAttr, rawContent] of template.matchAll(keyboardRegex) as any) {
      const mode = typeAttr === `default` ? `default` : `inline`
      const cleaned = rawContent.trim()

      if (!result[lang]) {
        result[lang] = {}
      }
      result[lang][mode] = cleaned
    }
    return result
  }

  public static _compileToFunction<T extends boolean>(template: T extends true ? string[] : string, isArray: T): T extends true ? (data?: Record<string, any>) => string[] : (data?: Record<string, any>) => string {
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

  public static compileMedia(template: string) {
    const baseBlocks = this._processBaseBlocks(template)
    const result: {
      [baseId: string]: {
        [lang: string]: (data?: Record<string, any>) => IMediaBlock
      }
    } = {}

    for (const [baseId, baseContent] of Object.entries(baseBlocks)) {
      const mediaBlocks = this._processMediaBlocks(baseContent)
      result[baseId] = {}

      for (const [lang, mediaBlock] of Object.entries(mediaBlocks)) {
        // Process caption if have (support variables and script blocks)
        if (mediaBlock.caption) {
          const processed = this._processVariables(this._processScriptBlocks(mediaBlock.caption))
          const captionFunction = this._compileToFunction(processed, false)

          // Create a function that returns a MediaBlock with the compiled caption.
          result[baseId][lang] = (data?: Record<string, any>) => ({
            ...mediaBlock,
            caption: captionFunction(data)
          })
        } else {
          // If caption not found, return mediaBlock as-is
          result[baseId][lang] = () => mediaBlock
        }
      }
    }
    return result
  }

  public static compileMessages(template: string) {
    const baseBlocks = this._processBaseBlocks(template)
    const result: {
      [baseId: string]: {
        [lang: string]: (data?: Record<string, any>) => string
      }
    } = {}

    for (const [baseId, baseContent] of Object.entries(baseBlocks)) {
      const messages = this._processMessageBlocks(baseContent)
      result[baseId] = {}

      for (const [lang, content] of Object.entries(messages)) {
        const processed = this._processVariables(this._processScriptBlocks(content))
        result[baseId][lang] = this._compileToFunction(processed, false)
      }
    }

    return result
  }

  public static compileKeyboards(template: string) {
    const baseBlocks = this._processBaseBlocks(template)
    const result: {
      [baseId: string]: {
        [lang: string]: {
          inline?: (data?: Record<string, any>) => string[]
          default?: (data?: Record<string, any>) => string[]
        }
      }
    } = {}

    for (const [baseId, baseContent] of Object.entries(baseBlocks)) {
      const keyboards = this._processKeyboardBlocks(baseContent)
      result[baseId] = {}

      for (const [lang, modes] of Object.entries(keyboards)) {
        result[baseId][lang] = {}

        for (const [mode, content] of Object.entries(modes)) {
          // Seperates label, handle escaped comma
          const labels = content.split(/(?<!\\),\s*/).map((label: string) => label.replace(/\\,/g, `,`).trim())

          const processedLabels = labels.map((label) => this._processVariables(this._processScriptBlocks(label)))

          result[baseId][lang][mode as `inline` | `default`] = this._compileToFunction(processedLabels, true)
        }
      }
    }

    return result
  }
}
