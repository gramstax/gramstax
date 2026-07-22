import {PageBase} from "~/base/page"
import {StartPage} from "./start"

class Helper {
  static kb(ctx: CounterPage) {
    return ctx.inlineKeyboardT([ctx.data.callbackQueryData(`I`), ctx.data.callbackQueryData(`D`), StartPage], `2`)
  }
}

export class CounterPage extends PageBase {
  static data = this.buildData((exe?: string) => [exe])

  async handleCallbackQueryData() {
    await this.default.show()
  }

  async handleArgsCallbackQueryData() {
    await this.default.process()
  }

  default = {
    show: async () => {
      const key = `${this.from!.id}`
      const count = (await this.cacheData.get(key)) || `0`
      const kb = Helper.kb(this)
      const da = {count}
      await this.renderEdit(kb, da)
    },
    process: async () => {
      const exe = this.callbackQueryDataArg
      const key = `${this.from!.id}`
      const getCache = (await this.cacheData.get(key)) as string
      const data = getCache || `0`

      let count
      if (exe == `I`) {
        count = `${parseInt(data) + 1}`
      } else if (exe == `D`) {
        count = `${parseInt(data) - 1}`
      }

      await this.cacheData.set(key, count)
      const kb = Helper.kb(this)
      const da = {count}
      await this.renderEdit(kb, da)
    }
  }

  static template = `
    <g-base>
      <g-keyboard type="inline">➕ Increase, ➖ Decrease, ${this.kbl.back.default}</g-keyboard>
      <g-keyboard type="inline" lang="id">➕ Tambah, ➖ Kurang, ${this.kbl.back.id}</g-keyboard>
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
