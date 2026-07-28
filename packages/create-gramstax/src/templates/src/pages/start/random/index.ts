import {PageBase} from "~/base/page"
import {StartPage} from ".."
import {StartRandomNumberPage} from "./number"
import {StartRandomTextPage} from "./text"

export class StartRandomPage extends PageBase {
  static data = this.buildData()
  async handleCallbackQueryData() {
    await this.bdefault.show(true)
  }

  async handleCommandText() {
    await this.bdefault.show(false)
  }

  bdefault = {
    show: async (isEdit = true) => {
      const kb = this.inlineKeyboardT([StartRandomNumberPage, StartRandomTextPage, StartPage], `2`)
      await this.renderAutoRich(kb, null, null, null, null, isEdit)
    }
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">🎲 Random Number, 📝 Random Text, ${this.kbl.back.default}</g-keyboard>
      <g-keyboard type="inline" lang="id">🎲 Angka Acak, 📝 Teks Acak, ${this.kbl.back.id}</g-keyboard>
      <g-message>
        <b>🎲 Random Generator</b>

        Choose what kind of random you want to generate.
      </g-message>
      <g-message lang="id">
        <b>🎲 Generator Acak</b>

        Pilih jenis acak yang ingin dihasilkan.
      </g-message>
    </g-base>
  `
}
