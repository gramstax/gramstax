import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class InputTextPage extends PageBase {
  async handleCommandText() {
    const kb = this.inlineKeyboardT([StartPage], `1`)
    const da = {}
    await this.setSessionFreeText()
    await this.reply(kb, da)
  }

  async handleSessionFreeText() {
    const bi = `success`
    const da = {res: this.msgText}
    const kb = this.inlineKeyboardT([StartPage], `1`, bi)
    await this.clearSession()
    await this.reply(kb, da, bi)
  }

  static template = `
    <base>
      ${this.kbk.cancel()}
      <message>Send any text and it will be echoed back on the next step.</message>
      <message lang="id">Kirim teks apa pun dan hasilnya akan ditampilkan pada langkah berikutnya.</message>
    </base>
    <base id="success">
      ${this.kbk.home()}
      <message>✅ Result: {{res}}</message>
      <message lang="id">✅ Hasil: {{res}}</message>
    </base>
    `
}
