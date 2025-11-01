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
    const keyboardRegex = /<keyboard\b[^>]*\blang="([^"]*)"[^>]*?(?:\sfor="([^"]*)")?[^>]*>([\s\S]*?)<\/keyboard>/gi
    const result: {
      [lang: string]: {
        inline?: string
        default?: string
      }
    } = {}

    for (const [, lang, forAttr, rawContent] of template.matchAll(keyboardRegex) as any) {
      const mode = forAttr === `default` ? `default` : `inline`
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
          // Pisahkan label, handle escaped comma
          const labels = content.split(/(?<!\\),\s*/).map((label: string) => label.replace(/\\,/g, `,`).trim())

          const processedLabels = labels.map((label) => this._processVariables(this._processScriptBlocks(label)))

          result[baseId][lang][mode as `inline` | `default`] = this._compileToFunction(processedLabels, true)
        }
      }
    }

    return result
  }
}
