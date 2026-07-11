import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Helper {
  static kb(ctx: LanguagePage) {
    const kb = ctx.inlineKeyboard((k, l) => {
      const languages = l.slice(0, -1)
      const backButton = l[l.length - 1]! // Get the back button text

      // Get current user language for comparison
      const currentLang = ctx.userLanguage?.toLowerCase()

      // Add language buttons in rows of 3
      for (let i = 0; i < languages.length; i += 3) {
        const row = languages.slice(i, i + 3)
        row.forEach((lang) => {
          const langCode = lang.toLowerCase()
          const isSelected = langCode.endsWith(currentLang)
          const displayText = isSelected ? `+ ${lang}` : lang
          k.text(displayText, ctx.data.callbackData(langCode))
        })
        k.row()
      }

      // Add back button
      return k.text(backButton, StartPage.data.callbackData())
    })
    return kb
  }
}

class Main {
  static async showIndex(ctx: LanguagePage) {
    const kb = Helper.kb(ctx)
    const da = {}
    await ctx.edit(kb, da)
  }

  static async processIndex(ctx: LanguagePage) {
    const language = ctx.callbackDataArg.toLowerCase().split(` `)[1] as string

    await ctx.cacheData.set(`${ctx.userId}:lang`, language)
    ctx.userLanguage = language
    await Main.showIndex(ctx)
  }
}

export class LanguagePage extends PageBase {
  static data = this.buildData((lang?: string) => [lang])

  async handleCallbackData() {
    await Main.showIndex(this)
  }

  async handleArgsCallbackData() {
    await Main.processIndex(this)
  }

  static template = `
    <g-base>
      <g-keyboard>🇺🇸 EN, 🇮🇩 ID, ${this.kbl.back.default}</g-keyboard>
      <g-keyboard lang="id">🇺🇸 EN, 🇮🇩 ID, ${this.kbl.back.id}</g-keyboard>

      <g-message>
        🌐 Language

        Choose your preferred language. The UI will update immediately.
      </g-message>
      <g-message lang="id">
        🌐 Bahasa

        Pilih bahasa yang diinginkan. Antarmuka akan langsung diperbarui.
      </g-message>
    </g-base>
  `
}
