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
    await this.gleft.show()
  }

  async handleCommandText() {
    await this.gleft.show()
  }

  async handleSessionFreeText() {
    const {step, left} = Helper.getSessionParams(this)
    const input = this.msg!.text!.trim()
    const value = input ? Number(input) : NaN
    if (step === Base.left) {
      await this.gleft.process(value)
    } else if (step === Base.right) {
      await this.gright.process(value, left!)
    }
  }

  gleft = {
    show: async () => {
      const bi = Base.left
      const kb = Helper.kb(this, bi)
      await this.setSessionFreeText({step: bi})
      await this.renderAuto(kb, {}, bi)
    },
    process: async (left: number) => {
      if (!Number.isFinite(left)) {
        await this.gleft.show()
      } else {
        await this.gright.show(left)
      }
    }
  }

  gright = {
    show: async (left: number) => {
      const bi = Base.right
      const kb = Helper.kb(this, bi)
      await this.setSessionFreeText({step: bi, left})
      await this.renderAuto(kb, {}, bi)
    },
    process: async (value: number, left: number) => {
      if (!Number.isFinite(value)) {
        await this.gright.show(left)
      } else {
        await this.clearSession()
        await this.gsuccess.show(left, value)
      }
    }
  }

  gsuccess = {
    show: async (left: number, right: number) => {
      const bi = Base.success
      const kb = Helper.kb(this, bi)
      const da = {result: left + right}
      await this.renderAuto(kb, da, bi)
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
