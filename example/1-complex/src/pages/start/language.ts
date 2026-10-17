import {PageBase} from "~/base/page"
import {StartPage} from "~/pages/start"

export class StartLanguagePage extends PageBase {
  static data = this.buildData((lang?: string) => [lang])

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  async handleArgsCallbackQueryData() {
    await this.gdefault.process()
  }

  helper = {}
  gdefault = {
    show: async () => {
      await this.renderText({
        keyboard: this.inlineKeyboard((k, l) => {
          const languages = l.slice(0, -1)
          const backButton = l[l.length - 1]! // Get the back button text

          // Get current user language for comparison
          const currentLang = this.from!.language_code!.toLowerCase()

          // Add language buttons in rows of 3
          for (let i = 0; i < languages.length; i += 3) {
            const row = languages.slice(i, i + 3)
            row.forEach((lang) => {
              const langCode = lang.toLowerCase()
              const isSelected = langCode.endsWith(currentLang)
              const displayText = isSelected ? `+ ${lang}` : lang
              k.text(displayText, this.data.callbackQueryData(langCode))
            })
            k.row()
          }

          // Add back button
          return k.text(backButton, StartPage)
        })
      })
    },
    process: async () => {
      const language = this.callbackQueryDataArg.toLowerCase().split(` `)[1] as string

      this.from!.language_code = language
      await this.cacheData.set(`${this.from!.id}:lang`, language)
      await this.gdefault.show()
    }
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">🇺🇸 EN, 🇮🇩 ID, ${this.kbl.back.default}</g-keyboard>
      <g-keyboard type="inline" lang="id">🇺🇸 EN, 🇮🇩 ID, ${this.kbl.back.id}</g-keyboard>
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
