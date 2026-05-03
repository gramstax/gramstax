import {PageBase} from "~/base/page"
import {StartPage} from "./start"
import {IncrementJob} from "~/jobs/increment"

class Base {
  static index = `-`
}

class Main {
  static async showIndex(ctx: CounterThreadPage) {
    const count = await IncrementJob.mtdGetCount()
    const bi = Base.index
    const kb = ctx.inlineKeyboardT([ctx.data.callbackData(`1`), StartPage], `1`, bi)
    const da = {count, timestamp: new Date().getTime()}
    await ctx.edit(kb, da, bi)
  }
}

export class CounterThreadPage extends PageBase {
  static data = this.buildData((exe?: string) => [exe])

  async handleCallbackData() {
    await Main.showIndex(this)
  }

  async handleArgsCallbackData() {
    await Main.showIndex(this)
  }

  static template = `
    <base id="${Base.index}">
      ${this.kbk.refresh_back()}
      <message>
        🧵 Worker counter

        Count: {{count}}
        Timestamp: {{timestamp}}

        This counter is updated by a worker thread running in the background.
      </message>
      <message lang="id">
        🧵 Kounter worker

        Kounter: {{count}}
        Waktu: {{timestamp}}

        Kounter ini diperbarui oleh worker thread yang berjalan di latar belakang.
      </message>
    </base>
  `
}
