import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class LanguagePage extends PageBase {
  static data = this.buildData((lang?: string) => [lang])

  kb() {
    return this.inlineKeyboard((k, a) => {
      const languages = a.slice(0, -1)
      const backButton = a[a.length - 1]! // Get the back button text

      // Get current user language for comparison
      const currentLang = this.userLanguage?.toLowerCase()

      // Add language buttons in rows of 3
      for (let i = 0; i < languages.length; i += 3) {
        const row = languages.slice(i, i + 3)
        row.forEach((lang) => {
          const langCode = lang.toLowerCase()
          const isSelected = langCode === currentLang
          const displayText = isSelected ? `+ ${lang}` : lang
          k.text(displayText, LanguagePage.data.callback(langCode))
        })
        k.row()
      }

      // Add back button
      return k.text(backButton, StartPage.data.callback())
    })
  }

  async core() {
    const kb = this.kb()
    await this.edit(kb)
  }

  async callback() {
    await this.core()
  }

  async callbackPayload() {
    const language = this.callbackDataPayload.toLowerCase()

    await this.cacheData.set(`${this.userId}:lang`, language)
    this.userLanguage = language
    await this.core()
  }

  static template = `
    <base>
      <keyboard>EN, ID, ${this.kbl.back(`default`)}</keyboard>
      <keyboard lang="id">EN, ID, ${this.kbl.back(`id`)}</keyboard>

      <message>Choose language below</message>
      <message lang="id">Pilih bahasa di bawah</message>
    </base>
  `
}
