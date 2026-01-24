import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class RandomNumberPage extends PageBase {
  async show(edit = true) {
    const kb = this.inlineKeyboardT([this, StartPage])
    const da = {result: Math.random() * 10 ** 18}
    if (edit) await this.edit(kb, da)
    else await this.reply(kb, da)
  }

  async callback() {
    await this.show(true)
  }

  async textCommand() {
    await this.show(false)
  }

  static template = `
    <base>
      <keyboard>🎲 Shake, ${this.kbl.back.default}</keyboard>
      <keyboard lang="id">🎲 Kocok, ${this.kbl.back.id}</keyboard>
      <message>
        <b>🎰 Random Number</b>

        {{result}}

        Generated automatically based SCALE 18.
      </message>
      <message lang="id">
        <b>🎰 Angka Acak</b>

        {{result}}

        Dihasilkan secara otomatis berdasarkan SCALE 18.
      </message>
    </base>
  `
}
