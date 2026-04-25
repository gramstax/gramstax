import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Helper {
  static kb(ctx: LanguagePage) {
    return ctx.inlineKeyboard((k, l) => {
      const languages = l.slice(0, -1)
      const backButton = l[l.length - 1]! // Get the back button text

      // Get current user language for comparison
      const currentLang = ctx.userLanguage?.toLowerCase()

      // Add language buttons in rows of 3
      for (let i = 0; i < languages.length; i += 3) {
        const row = languages.slice(i, i + 3)
        row.forEach((lang) => {
          const langCode = lang.toLowerCase()
          const isSelected = langCode === currentLang
          const displayText = isSelected ? `+ ${lang}` : lang
          k.text(displayText, LanguagePage.data.callbackData(langCode))
        })
        k.row()
      }

      // Add back button
      return k.text(backButton, StartPage.data.callbackData())
    })
  }
}

class Flow {
  static async step1Form(ctx: LanguagePage) {
    const kb = Helper.kb(ctx)
    await ctx.edit(kb)
  }

  static async step2Answer(ctx: LanguagePage) {
    const language = ctx.callbackDataArg.toLowerCase()

    await ctx.cacheData.set(`${ctx.userId}:lang`, language)
    ctx.userLanguage = language
    await this.step1Form(ctx)
  }
}

export class LanguagePage extends PageBase {
  static data = this.buildData((lang?: string) => [lang])

  async handleCallbackData() {
    await Flow.step1Form(this)
  }

  async handleArgsCallbackData() {
    await Flow.step2Answer(this)
  }

  static template = `
    <base>
      <keyboard>🇺🇸 EN, 🇮🇩 ID, ${this.kbl.back.default}</keyboard>
      <keyboard lang="id">🇺🇸 EN, 🇮🇩 ID, ${this.kbl.back.id}</keyboard>

      <message>
        🌐 Language

        Choose your preferred language. The UI will update immediately.
      </message>
      <message lang="id">
        🌐 Bahasa

        Pilih bahasa yang diinginkan. Antarmuka akan langsung diperbarui.
      </message>
    </base>
  `
}
