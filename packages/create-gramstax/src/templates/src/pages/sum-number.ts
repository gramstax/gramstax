import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
  static step2 = `s2`
  static success = `s`
}

class Helper {
  static getSessionParams(ctx: SumNumberPage) {
    return (ctx.temp.session?.params as {step?: (typeof Base)[keyof typeof Base]; left?: number} | undefined) ?? {}
  }

  static kb(ctx: SumNumberPage, baseId: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, baseId)
  }
}

class Alert {
  static async showSuccess(ctx: SumNumberPage, left: number, right: number) {
    await ctx.clearSession()
    const bi = Base.success
    const kb = Helper.kb(ctx, bi)
    const da = {result: left! + right}
    await ctx.reply(kb, da, bi)
  }
}

class Main {
  static async showStep1Form(ctx: SumNumberPage, edit: boolean) {
    const bi = Base.step1
    const kb = Helper.kb(ctx, bi)
    const da = {}
    await ctx.setSessionFreeText({step: bi})
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async processStep1Answer(ctx: SumNumberPage, left: number) {
    if (!Number.isFinite(left)) {
      await Main.showStep1Form(ctx, false)
    } else {
      await this.showStep2Form(ctx, left)
    }
  }

  static async showStep2Form(ctx: SumNumberPage, left: number) {
    const bi = Base.step2
    const kb = Helper.kb(ctx, bi)
    const da = {}
    await ctx.setSessionFreeText({step: bi, left})
    await ctx.reply(kb, da, bi)
  }

  static async processStep2Answer(ctx: SumNumberPage, left: number, right: number) {
    if (!Number.isFinite(right)) {
      await Main.showStep2Form(ctx, right)
    } else if (!Number.isFinite(right ?? NaN)) {
      await Main.showStep1Form(ctx, false)
    } else {
      await Alert.showSuccess(ctx, left, right)
    }
  }
}

export class SumNumberPage extends PageBase {
  async handleCallbackData() {
    await Main.showStep1Form(this, true)
  }

  async handleCommandText() {
    await Main.showStep1Form(this, false)
  }

  async handleFreeText() {
    if (!this.isSessionFreeText()) {
      return null
    }
    const {step, left} = Helper.getSessionParams(this)
    const input = this.msgText?.trim()
    const value = input ? Number(input) : NaN
    if (step === Base.step1) {
      await Main.processStep1Answer(this, value)
    } else if (step === Base.step2) {
      await Main.processStep2Answer(this, left!, value)
    }
  }

  static template = `
    <base id="${Base.step1}">
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

    <base id="${Base.step2}">
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

    <base id="${Base.success}">
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
