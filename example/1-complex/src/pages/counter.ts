import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Helper {
  static kb(ctx: CounterPage) {
    const kb = ctx.inlineKeyboardT([CounterPage.data.callbackData(`I`), CounterPage.data.callbackData(`D`), StartPage], `2`)
    return kb
  }
}

class Main {
  static async showIndex(ctx: CounterPage) {
    const key = `${ctx.userId}`
    const count = (await ctx.cacheData.get(key)) || `0`
    const kb = Helper.kb(ctx)
    const da = {count}
    await ctx.edit(kb, da)
  }

  static async processIndex(ctx: CounterPage, execution: string) {
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
    const kb = Helper.kb(ctx)
    const da = {count}
    await ctx.edit(kb, da)
  }
}

export class CounterPage extends PageBase {
  static data = this.buildData((exe?: string) => [exe])

  async handleCallbackData() {
    await Main.showIndex(this)
  }

  async handleArgsCallbackData() {
    await Main.processIndex(this, this.callbackDataArg)
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">➕ Increase, ➖ Decrease, ${this.kbl.back.default}</g-keyboard>
      <g-keyboard lang="id" type="inline">➕ Tambah, ➖ Kurang, ${this.kbl.back.id}</g-keyboard>
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
