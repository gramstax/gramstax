import {PageBase} from "~/base/page"
import {StartPage} from "./start"

export class SumNumberPage extends PageBase {
  static BASE = {pleft: `pleft`, pright: `pright`, result: `result`}

  async callback() {
    await this.first(true)
  }

  async textCommand() {
    await this.first(false)
  }

  async textFree() {
    if (!this.validateSessionTextFree()) return null
    const {step, left} = this.getSessionParams()
    const input = this.msgText?.trim()
    const value = input ? Number(input) : NaN

    if (step === `left`) {
      if (!Number.isFinite(value)) {
        await this.sessionTextFree({step: `left`})
        return await this.reply(this.kb(SumNumberPage.BASE.pleft), {}, SumNumberPage.BASE.pleft)
      }

      await this.sessionTextFree({step: `right`, left: value})
      return await this.reply(this.kb(SumNumberPage.BASE.pright), {}, SumNumberPage.BASE.pright)
    }

    if (step === `right`) {
      if (!Number.isFinite(value)) {
        await this.sessionTextFree({step: `right`, left})
        return await this.reply(this.kb(SumNumberPage.BASE.pright), {}, SumNumberPage.BASE.pright)
      }

      if (!Number.isFinite(left ?? NaN)) {
        await this.sessionClear()
        return await this.first(false)
      }

      const result = left! + value
      await this.sessionClear()
      return await this.reply(this.kb(SumNumberPage.BASE.result), {result}, SumNumberPage.BASE.result)
    }
  }

  private async first(edit: boolean) {
    await this.sessionTextFree({step: `left`})
    const kb = this.kb(SumNumberPage.BASE.pleft)
    if (edit) await this.edit(kb, {}, SumNumberPage.BASE.pleft)
    else await this.reply(kb, {}, SumNumberPage.BASE.pleft)
  }

  private kb(baseId: string) {
    return this.inlineKeyboardT([StartPage], `1`, baseId)
  }

  private getSessionParams() {
    return (this.session?.params as {step?: `left` | `right`; left?: number} | undefined) ?? {}
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
