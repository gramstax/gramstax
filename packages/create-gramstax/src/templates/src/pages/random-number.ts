import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class RandomNumberPage extends PageBase {
  async handleCallbackQueryData() {
    await this.bdefault.show(true)
  }

  async handleCommandText() {
    await this.bdefault.show(false)
  }

  bdefault = {
    show: async (isEdit = true) => {
      const kb = this.inlineKeyboardT([this, StartPage])
      const da = {result: Math.random() * 10 ** 18}
      await this.renderAuto(kb, da, null, null, isEdit)
    }
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">🎲 Shake, ${this.kbl.back.default}</g-keyboard>
      <g-keyboard type="inline" lang="id">🎲 Kocok, ${this.kbl.back.id}</g-keyboard>
      <g-message>
        <b>🎰 Random Number</b>

        {{result}}

        Generated automatically based SCALE 18.
      </g-message>
      <g-message lang="id">
        <b>🎰 Angka Acak</b>

        {{result}}

        Dihasilkan secara otomatis berdasarkan SCALE 18.
      </g-message>
    </g-base>
  `
}
