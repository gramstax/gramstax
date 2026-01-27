import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class LanguagePage extends PageBase {
  static data = this.buildData((lang?: string) => [lang])

  kb() {
    return this.inlineKeyboard((k, l) => {
      const languages = l.slice(0, -1)
      const backButton = l[l.length - 1]! // Get the back button text

      // Get current user language for comparison
      const currentLang = this.userLanguage?.toLowerCase()

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

  async show() {
    await this.edit(this.kb())
  }

  async handleCallbackData() {
    await this.show()
  }

  async handleArgsCallbackData() {
    const language = this.callbackDataArg.toLowerCase()

    await this.cacheData.set(`${this.userId}:lang`, language)
    this.userLanguage = language
    await this.show()
  }

  static template = (() => {
    const lb = this.kbl.back
    return `
      <base>
        <keyboard>🇺🇸 EN, 🇮🇩 ID, ${lb.default}</keyboard>
        <keyboard lang="id">🇺🇸 EN, 🇮🇩 ID, ${lb.id}</keyboard>

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
  })()
}
