import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class SumNumberPage extends PageBase {
  static BASE = {pleft: `pleft`, pright: `pright`, result: `result`}

  async handleCallbackData() {
    await this.first(true)
  }

  async handleCommandText() {
    await this.first(false)
  }

  async handleFreeText() {
    if (!this.isSessionFreeText()) return null
    const {BASE} = SumNumberPage
    const {step, left} = this.getSessionParams()
    const input = this.msgText?.trim()
    const value = input ? Number(input) : NaN

    if (step === `left`) {
      if (!Number.isFinite(value)) {
        await this.sessionFreeText({step: `left`})
        return await this.reply(this.kb(BASE.pleft), {}, BASE.pleft)
      }

      await this.sessionFreeText({step: `right`, left: value})
      return await this.reply(this.kb(BASE.pright), {}, BASE.pright)
    }

    if (step === `right`) {
      if (!Number.isFinite(value)) {
        await this.sessionFreeText({step: `right`, left})
        return await this.reply(this.kb(BASE.pright), {}, BASE.pright)
      }

      if (!Number.isFinite(left ?? NaN)) {
        await this.clearSession()
        return await this.first(false)
      }

      const result = left! + value
      await this.clearSession()
      return await this.reply(this.kb(BASE.result), {result}, BASE.result)
    }
  }

  private async first(edit: boolean) {
    await this.sessionFreeText({step: `left`})
    const {BASE} = SumNumberPage
    const kb = this.kb(BASE.pleft)

    if (edit) await this.edit(kb, {}, BASE.pleft)
    else await this.reply(kb, {}, BASE.pleft)
  }

  private kb(baseId: string) {
    return this.inlineKeyboardT([StartPage], `1`, baseId)
  }

  private getSessionParams() {
    return (this.temp.session?.params as {step?: `left` | `right`; left?: number} | undefined) ?? {}
  }

  static template = `
    <base id="${this.BASE.pleft}">
      ${this.kbk.cancel()}
      <message>
        <b>📚 Input Left Number</b>

        Example: 23
      </message>
      <message lang="id">
        <b>📚 Masukan Angka Kiri</b>

        Contoh: 23
      </message>
    </base>
    <base id="${this.BASE.pright}">
      ${this.kbk.cancel()}
      <message>
        <b>📚 Input Right Number</b>

        Example: 10
      </message>
      <message lang="id">
        <b>📚 Masukan Angka Kanan</b>

        Contoh: 10
      </message>
    </base>
    <base id="${this.BASE.result}">
      ${this.kbk.home()}
      <message>
        <b>📚 Result Sum</b>

        {{result}}
      </message>
      <message lang="id">
        <b>📚 Hasil Sum</b>

        {{result}}
      </message>
    </base>
  `
}
