import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Helper {
  static kb(ctx: CounterPage) {
    return ctx.inlineKeyboardT([ctx.data.callbackData(`I`), ctx.data.callbackData(`D`), StartPage], `2`)
  }
}

class Main {
  static async showStep1Form(ctx: CounterPage) {
    const key = `${ctx.userId}`
    const count = (await ctx.cacheData.get(key)) || `0`
    const kb = Helper.kb(ctx)
    const da = {count}
    await ctx.edit(kb, da)
  }

  static async processStep1Answer(ctx: CounterPage) {
    const execution = ctx.callbackDataArg
    const kb = Helper.kb(ctx)
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
    const da = {count}
    await ctx.edit(kb, da)
  }
}

export class CounterPage extends PageBase {
  static data = this.buildData((exe?: string) => [exe])

  async handleCallbackData() {
    await Main.showStep1Form(this)
  }

  async handleArgsCallbackData() {
    await Main.processStep1Answer(this)
  }

  static template = `
    <base>
      <keyboard>➕ Increase, ➖ Decrease, ${this.kbl.back.default}</keyboard>
      <keyboard lang="id">➕ Tambah, ➖ Kurang, ${this.kbl.back.id}</keyboard>
      <message>
        🔢 Counter

        Current count: {{count}}

        Use Increase or Decrease to update the cached counter value.
      </message>
      <message lang="id">
        🔢 Kounter

        Jumlah saat ini: {{count}}

        Gunakan Tambah atau Kurang untuk memperbarui nilai kounter yang tersimpan.
      </message>
    </base>
  `
}
