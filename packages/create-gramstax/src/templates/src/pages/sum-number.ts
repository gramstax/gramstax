import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static left = `l`
  static right = `r`
  static success = `s`
}

class Helper {
  static getSessionParams(ctx: SumNumberPage) {
    return (ctx.temp.session?.params as {step?: (typeof Base)[keyof typeof Base]; left?: number} | undefined) ?? {}
  }

  static kb(ctx: SumNumberPage, AGBaseId: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, AGBaseId)
  }
}

export class SumNumberPage extends PageBase {
  static data = this.buildData()
  async handleCallbackQueryData() {
    await this.bleft.show(true)
  }

  async handleCommandText() {
    await this.bleft.show(false)
  }

  async handleSessionFreeText() {
    const {step, left} = Helper.getSessionParams(this)
    const input = this.msg!.text!.trim()
    const value = input ? Number(input) : NaN
    if (step === Base.left) {
      await this.bleft.process(value)
    } else if (step === Base.right) {
      await this.bright.process(value, left!)
    }
  }

  bleft = {
    show: async (edit: boolean) => {
      const kb = Helper.kb(this, Base.left)
      await this.setSessionFreeText({step: Base.left})
      if (edit) {
        await this.renderEdit(kb, {}, Base.left)
      } else {
        await this.render(kb, {}, Base.left)
      }
    },
    process: async (left: number) => {
      if (!Number.isFinite(left)) {
        await this.bleft.show(false)
      } else {
        await this.bright.show(left)
      }
    }
  }

  bright = {
    show: async (left: number) => {
      const kb = Helper.kb(this, Base.right)
      await this.setSessionFreeText({step: Base.right, left})
      await this.render(kb, {}, Base.right)
    },
    process: async (value: number, left: number) => {
      if (!Number.isFinite(value)) {
        await this.bright.show(left)
      } else {
        await this.clearSession()
        await this.bsuccess.show(left, value)
      }
    }
  }

  bsuccess = {
    show: async (left: number, right: number) => {
      const kb = Helper.kb(this, Base.success)
      const da = {result: left + right}
      await this.render(kb, da, Base.success)
    }
  }

  static template = `
    <g-base id="${Base.left}">
      ${this.kbk.cancel()}
      <g-message>
        <b>📚 Input Left Number</b>

        Example: 23
      </g-message>
      <g-message lang="id">
        <b>📚 Masukan Angka Kiri</b>

        Contoh: 23
      </g-message>
    </g-base>
    <g-base id="${Base.right}">
      ${this.kbk.cancel()}
      <g-message>
        <b>📚 Input Right Number</b>

        Example: 10
      </g-message>
      <g-message lang="id">
        <b>📚 Masukan Angka Kanan</b>

        Contoh: 10
      </g-message>
    </g-base>
    <g-base id="${Base.success}">
      ${this.kbk.home()}
      <g-message>
        <b>📚 Result Sum</b>

        {{result}}
      </g-message>
      <g-message lang="id">
        <b>📚 Hasil Sum</b>

        {{result}}
      </g-message>
    </g-base>
  `
}
