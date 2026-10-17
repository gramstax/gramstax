import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static left = `l`
  static right = `r`
  static success = `s`
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
    const {step, left} = this.helper.getSessionParams()
    const input = this.msg!.text!.trim()
    const value = input ? Number(input) : NaN
    if (step === Base.left) {
      await this.gleft.process(value)
    } else if (step === Base.right) {
      await this.gright.process(value, left!)
    }
  }

  helper = {
    getSessionParams: () => {
      return (this.temp.session?.params as {step?: (typeof Base)[keyof typeof Base]; left?: number} | undefined) ?? {}
    },
    homeKeyboard: (AGBaseId: string) => {
      return this.inlineKeyboardT([StartPage], `1`, AGBaseId)
    }
  }
  gleft = {
    show: async () => {
      await this.setSessionFreeText({step: Base.left})
      await this.renderText({AGBaseId: Base.left, keyboard: this.helper.homeKeyboard(Base.left)})
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
      await this.setSessionFreeText({step: Base.right, left})
      await this.renderText({AGBaseId: Base.right, keyboard: this.helper.homeKeyboard(Base.right)})
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
      await this.renderText({AGBaseId: Base.success, keyboard: this.helper.homeKeyboard(Base.success), data: {result: left + right}})
    },
    process: () => {}
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
