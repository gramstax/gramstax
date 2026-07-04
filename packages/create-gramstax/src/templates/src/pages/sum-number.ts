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

class Main {
  static async showLeftForm(ctx: SumNumberPage, edit: boolean) {
    const bi = Base.left
    const kb = Helper.kb(ctx, bi)
    const da = {}
    await ctx.setSessionFreeText({step: bi})
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processLeftForm(ctx: SumNumberPage, left: number) {
    if (!Number.isFinite(left)) {
      await Main.showLeftForm(ctx, false)
    } else {
      await this.showRightForm(ctx, left)
    }
  }

  static async showRightForm(ctx: SumNumberPage, left: number) {
    const bi = Base.right
    const kb = Helper.kb(ctx, bi)
    const da = {}
    await ctx.setSessionFreeText({step: bi, left})
    await ctx.reply(kb, da, bi)
  }

  static async processRightForm(ctx: SumNumberPage, left: number, right: number) {
    if (!Number.isFinite(right)) {
      await Main.showRightForm(ctx, right)
    } else if (!Number.isFinite(right ?? NaN)) {
      await Main.showLeftForm(ctx, false)
    } else {
      await Main.showSuccess(ctx, left, right)
    }
  }

  static async showSuccess(ctx: SumNumberPage, left: number, right: number) {
    await ctx.clearSession()
    const bi = Base.success
    const kb = Helper.kb(ctx, bi)
    const da = {result: left! + right}
    await ctx.reply(kb, da, bi)
  }
}

export class SumNumberPage extends PageBase {
  async handleCallbackData() {
    await Main.showLeftForm(this, true)
  }

  async handleCommandText() {
    await Main.showLeftForm(this, false)
  }

  async handleSessionFreeText() {
    const {step, left} = Helper.getSessionParams(this)
    const input = this.msgText?.trim()
    const value = input ? Number(input) : NaN
    if (step === Base.left) {
      await Main.processLeftForm(this, value)
    } else if (step === Base.right) {
      await Main.processRightForm(this, left!, value)
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
