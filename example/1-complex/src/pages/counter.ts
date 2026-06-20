import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Base {
  static step1 = `s1`
}

class Helper {
  static kb(ctx: CounterPage) {
    const bi = Base.step1
    const kb = ctx.inlineKeyboardT([ctx.data.callbackData(`I`), ctx.data.callbackData(`D`), StartPage], `2`, bi)
    return kb
  }
}

class Main {
  static async showStep1Form(ctx: CounterPage) {
    const key = `${ctx.userId}`
    const count = (await ctx.cacheData.get(key)) || `0`
    const bi = Base.step1
    const kb = Helper.kb(ctx)
    const da = {count}
    await ctx.edit(kb, da, bi)
  }

  static async processStep1Answer(ctx: CounterPage, execution: string) {
    const key = `${ctx.userId}`
    const getCache = (await ctx.cacheData.get(key)) as string
    const data = getCache || `0`

    let count
    if (execution == `I`) {
      count = `${parseInt(data) + 1}`
    } else if (execution == `D`) {
      count = `${parseInt(data) - 1}`
    }

    await ctx.cacheData.set(key, count)
    const bi = Base.step1
    const kb = Helper.kb(ctx)
    const da = {count}
    await ctx.edit(kb, da, bi)
  }
}

export class CounterPage extends PageBase {
  static data = this.buildData((exe?: string) => [exe])

  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  async handleArgsCallbackData() {
    await Main.processStep1Answer(this, this.callbackDataArg)
  }

  static template = `
    <g-base id="${Base.step1}">
      <g-keyboard>➕ Increase, ➖ Decrease, ${this.kbl.back.default}</g-keyboard>
      <g-keyboard lang="id">➕ Tambah, ➖ Kurang, ${this.kbl.back.id}</g-keyboard>
      <g-message>
        🔢 Counter

        Current count: {{count}}

        Use Increase or Decrease to update the cached counter value.
      </g-message>
      <g-message lang="id">
        🔢 Kounter

        Jumlah saat ini: {{count}}

        Gunakan Tambah atau Kurang untuk memperbarui nilai kounter yang tersimpan.
      </g-message>
    </g-base>
  `
}
