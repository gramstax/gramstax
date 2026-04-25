import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static pleft: `pleft`
  static pright: `pright`
  static result: `result`
}

class Helper {
  static getSessionParams(ctx: SumNumberPage) {
    return (ctx.temp.session?.params as {step?: `left` | `right`; left?: number} | undefined) ?? {}
  }

  static kb(ctx: SumNumberPage, baseId: string) {
    return ctx.inlineKeyboardT([StartPage], `1`, baseId)
  }
}

class Flow {
  static async step1Form(ctx: SumNumberPage, edit: boolean) {
    await ctx.sessionFreeText({step: `left`})
    const bi = Base.pleft
    const kb = Helper.kb(ctx, bi)
    const da = {}
    if (edit) {
      await ctx.edit(kb, da, bi)
    } else {
      await ctx.reply(kb, da, bi)
    }
  }

  static async step1Answer(ctx: SumNumberPage, left: number) {
    if (!Number.isFinite(left)) {
      await Flow.step1Form(ctx, false)
    } else {
      await this.step2Form(ctx, left)
    }
  }

  static async step2Form(ctx: SumNumberPage, left: number) {
    await ctx.sessionFreeText({step: `right`, left})
    const bi = Base.pright
    const kb = Helper.kb(ctx, bi)
    const da = {}
    await ctx.reply(kb, da, bi)
  }

  static async step2Answer(ctx: SumNumberPage, left: number, right: number) {
    if (!Number.isFinite(right)) {
      await Flow.step2Form(ctx, right)
    } else if (!Number.isFinite(right ?? NaN)) {
      await ctx.clearSession()
      await Flow.step1Form(ctx, false)
    } else {
      await Alert.success(ctx, left, right)
    }
  }
}

class Alert {
  static async success(ctx: SumNumberPage, left: number, right: number) {
    await ctx.clearSession()
    const bi = Base.result
    const kb = Helper.kb(ctx, bi)
    const da = {result: left! + right}
    await ctx.reply(kb, da, bi)
  }
}

export class SumNumberPage extends PageBase {
  async handleCallbackData() {
    await Flow.step1Form(this, true)
  }

  async handleCommandText() {
    await Flow.step1Form(this, false)
  }

  async handleFreeText() {
    if (!this.isSessionFreeText()) {
      return null
    }
    const {step, left} = Helper.getSessionParams(this)
    const input = this.msgText?.trim()
    const value = input ? Number(input) : NaN
    if (step === `left`) {
      await Flow.step1Answer(this, value)
    } else if (step === `right`) {
      await Flow.step2Answer(this, left!, value)
    }
  }

  static template = `
    <base id="${Base.pleft}">
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

    <base id="${Base.pright}">
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

    <base id="${Base.result}">
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
