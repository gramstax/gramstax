import {PageBase} from "~/base/page"
import {StartRandomPage} from "."

export class StartRandomNumberPage extends PageBase {
  static data = this.buildData()

  async handleCallbackQueryData() {
    await this.gdefault.show()
  }

  helper = {}
  gdefault = {
    show: async () => {
      const kb = this.inlineKeyboardT([this, StartRandomPage], `2`)
      const da = {result: Math.random() * 10 ** 18}
      await this.renderAuto(kb, da)
    },
    process: () => {}
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
