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
    return template.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, (_, rawCode: string) => {
      const innerCode = rawCode.trim()
      if (!innerCode) return ``

      return `\${(() => { if (!data) return ''; try { with(data) { ${innerCode} } } catch(e) { return '' } })()}`
    })
  }

  public static _processSpaceBlocks(template: string) {
    return template.replace(/^[ \t]*<space\s*\/>[ \t]*$/gim, ``)
  }

  public static _processDivBlocks(template: string) {
    return template.replace(/<div>([\s\S]*?)<\/div>/gi, (_, inner: string) => {
      const cleaned = inner
        .replace(/^[\t ]+/gm, ``)
        .replace(/^\n+/, ``)
        .replace(/\n+$/, ``)
      return cleaned
    })
  }

  public static _processExec(template: string) {
    return template.replace(/{~\s*([\s\S]*?)\s*~}/g, (_, code) => `\${(() => { try { return ${code} } catch(e) { try { with(data || {}) { return ${code} } } catch(ee) { return '' } } })()}`)
  }

  public static _processMapBlocks(template: string) {
    const mapRegex = /<map(?:\s+([^>]*))?>([\s\S]*?)<\/map>/gi
    return template.replace(mapRegex, (_, attributesStr, rawContent) => {
      const attrs: { [key: string]: string } = {}
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

  public static _processMediaBlocks(template: string) {
    const mediaRegex = /<media(?:\s+([^>]*))?>([\s\S]*?)<\/media>/gi
    const result: { [lang: string]: IMediaBlock } = {}

    for (const match of template.matchAll(mediaRegex)) {
      const attributesStr = match[1]
      const rawContent = match[2]

      // Extract all attributes
      const attrs: { [key: string]: string } = {}
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
      const mediaBlock = { type } as Record<any, any>

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

  public static _processMessageBlocks(template: string) {
    const messageRegex = /<message(?:\s+([^>]*))?>([\s\S]*?)<\/message>/gi
    const result: {
      [lang: string]: string
    } = {}

    for (const [, attributesStr, rawContent] of template.matchAll(messageRegex)) {
      const attrs: { [key: string]: string } = {}
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

  public static _processDescriptionBlocks(template: string) {
    const descriptionRegex = /<description(?:\s+([^>]*))?>([\s\S]*?)<\/description>/gi
    const result: {
      [lang: string]: {
        [scope: string]: string
      }
    } = {}

    for (const [, attributesStr, rawContent] of template.matchAll(descriptionRegex)) {
      const attrs: { [key: string]: string } = {}
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

  public static _processKeyboardBlocks(template: string) {
    const keyboardRegex = /<keyboard(?:\s+([^>]*))?>([\s\S]*?)<\/keyboard>/gi
    const result: {
      [lang: string]: {
        inline?: string
        bottom?: string
      }
    } = {}

    for (const [, attributesStr, rawContent] of template.matchAll(keyboardRegex)) {
      const attrs: { [key: string]: string } = {}
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

  public static compileMedia(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processBaseBlocks>) {
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

          const processed = this._processVariables(this._processExec(this._processMapBlocks(this._processScriptBlocks(value))))
          compiledProps[key] = this._compileToFunction(processed, false)
        }

        result[baseId][lang] = (data?: Record<string, any>) => {
          const resolvedBlock = { ...mediaBlock } as any
          for (const [key, fn] of Object.entries(compiledProps)) {
            resolvedBlock[key] = fn(data)
          }
          return resolvedBlock
        }
      }
    }
    return result
  }

  public static compileMessages(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processBaseBlocks>) {
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
        const processed = this._processVariables(this._processExec(this._processMapBlocks(this._processScriptBlocks(content))))
        result[baseId][lang] = this._compileToFunction(processed, false)
      }
    }

    return result
  }

  public static compileDescription(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processBaseBlocks>) {
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
          const processed = this._processVariables(this._processExec(this._processMapBlocks(this._processScriptBlocks(content))))
          result[baseId][scope][lang] = this._compileToFunction(processed, false)
        }
      }
    }

    return result
  }

  public static compileKeyboards(template: string, baseBlocks?: ReturnType<typeof TemplateEngine._processBaseBlocks>) {
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

          const processedLabels = labels.map((label) => this._processVariables(this._processExec(this._processMapBlocks(this._processScriptBlocks(label)))))

          result[baseId][lang][mode as `inline` | `bottom`] = this._compileToFunction(processedLabels, true)
        }
      }
    }

    return result
  }

  public static _extractBlock(content: string, blocks?: string | string[], baseId: string = `default`, section: `all` | `value` = `all`, lang?: string) {
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
      const allBlockMatches: Array<{ start: number; content: string; innerContent: string }> = []

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

  public static _processImportBlocks(template: string) {
    const importRegex = /([ \t]*)<import(?:\s+([^>]*))?\/?>/gi
    const imports: Array<{ src: string; blocks?: string | string[]; base: string; lang?: string; section: `all` | `value`; indent: string }> = []
    const processed = template.replace(importRegex, (_, indent, attributesStr) => {
      const attrs: { [key: string]: string } = {}
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

    return { processed, imports }
  }

  public static processImportBlocks(template: string, resolver: (src: string) => string | null, depth = 0, importCache?: Map<string, string>): string {
    if (depth > 10) return `` // recursive limit

    const { processed, imports } = this._processImportBlocks(template)

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
