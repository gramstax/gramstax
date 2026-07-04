import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class InputTextPage extends PageBase {
  async handleCommandText() {
    const kb = this.inlineKeyboardT([StartPage])
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
    <g-base>
      ${this.kbk.cancel()}
      <g-message>Send any text and it will be echoed back on the next step.</g-message>
      <g-message lang="id">Kirim teks apa pun dan hasilnya akan ditampilkan pada langkah berikutnya.</g-message>
    </g-base>
    <g-base id="success">
      ${this.kbk.home()}
      <g-message>✅ Result: {{res}}</g-message>
      <g-message lang="id">✅ Hasil: {{res}}</g-message>
    </g-base>
    `
}
