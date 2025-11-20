import { CtxCore } from "../core/ctx"
import { StartPage } from "./start"

export class LanguagePage extends CtxCore {
  static data = this.buildData((lang?: string) => lang)

  public kb() {
    return this.buildInlineKeyboard((kb, arr) => {
      const languages = arr.slice(0, -1)
      const backButton = arr[arr.length - 1] // Get the back button text

      // Get current user language for comparison
      const currentLang = this.languageCode?.toLowerCase()

      // Add language buttons in rows of 3
      for (let i = 0; i < languages.length; i += 3) {
        const row = languages.slice(i, i + 3)
        row.forEach((lang) => {
          const langCode = lang.toLowerCase()
          const isSelected = langCode === currentLang
          const displayText = isSelected ? `+ ${lang}` : lang
          kb.text(displayText, LanguagePage.data.callbackData(langCode))
        })
        kb.row()
      }

      // Add back button
      return kb.text(backButton, StartPage.data.callbackData())
    })
  }

  public async internal() {
    const kb = this.kb()
    await this.edit(kb)
  }

  public async callback() {
    await this.internal()
  }

  public async callbackPayload() {
    const language = this.callbackDataPayload.toLowerCase()

    await this.cacheData.set(`${this.userid}:language`, language)
    this.languageCode = language
    await this.internal()
  }

  public static template = `
    <base>
      <keyboard lang="en" type="inline">EN, ID, Back</keyboard>
      <keyboard lang="id" type="inline">EN, ID, Kembali</keyboard>

      <message lang="en">
        Select language below
      </message>

      <message lang="id">
        Pilih bahasa di bawah
      </message>
    </base>
  `
}
